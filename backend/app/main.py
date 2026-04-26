import uuid
import json
import logging
import re
import threading
import queue as queue_mod
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Optional
from urllib.parse import urlparse, urlunparse

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from pydantic import BaseModel

from app.config import settings
from app.models import (
    SessionCreate,
    AnswerSubmit,
    ResumeProfile,
    ResumeSlot,
    SessionOut,
    PutResumesRequest,
    SavedResumesResponse,
    LlmModelUpdate,
)
from app.resume_store import (
    MAX_TEXT_LEN,
    default_resume_text,
    document_for_file_json,
    normalize_document,
)
from app.agent.graph import agent, checkpointer
from app.agent.state import AgentState
from app.agent.nodes import _llm_json, _llm_json_extract, _fetch_url
from app.llm_catalog import (
    is_model_allowed_for_plan,
    model_choices_for_api,
    resolve_session_model,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from contextlib import asynccontextmanager


def _ensure_tables():
    """Create application tables if they don't exist (idempotent)."""
    if not settings.use_postgres:
        return
    import psycopg
    conn = psycopg.connect(settings.database_url, autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id  TEXT PRIMARY KEY,
                    user_id     TEXT,
                    company     TEXT NOT NULL DEFAULT '',
                    role        TEXT NOT NULL DEFAULT '',
                    stage       TEXT NOT NULL DEFAULT '',
                    mode        TEXT NOT NULL DEFAULT 'prep',
                    pipeline_group TEXT NOT NULL DEFAULT 'general',
                    final_scores JSONB,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS profiles (
                    id              TEXT PRIMARY KEY,
                    plan            TEXT NOT NULL DEFAULT 'free',
                    session_count   INTEGER NOT NULL DEFAULT 0,
                    resume          TEXT NOT NULL DEFAULT '',
                    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_sessions_user_created
                ON sessions (user_id, created_at)
            """)
            # Migrate: add columns if missing (safe on new installs too)
            cur.execute("""
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS final_scores JSONB
            """)
            cur.execute("""
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS running_scores JSONB
            """)
            cur.execute("""
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cached_status TEXT NOT NULL DEFAULT 'analyzing'
            """)
            cur.execute("""
                ALTER TABLE sessions ADD COLUMN IF NOT EXISTS question_count INTEGER NOT NULL DEFAULT 0
            """)
            cur.execute("""
                ALTER TABLE profiles ADD COLUMN IF NOT EXISTS saved_resumes JSONB
            """)
            cur.execute("""
                ALTER TABLE profiles ADD COLUMN IF NOT EXISTS llm_model TEXT NOT NULL DEFAULT ''
            """)
            cur.execute("""
                ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT NOT NULL DEFAULT ''
            """)
            cur.execute("""
                ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT NOT NULL DEFAULT ''
            """)
            cur.execute("""
                ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT NOT NULL DEFAULT ''
            """)
            cur.execute("""
                ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_price_id TEXT NOT NULL DEFAULT ''
            """)
            cur.execute("""
                ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_updated_at TIMESTAMPTZ
            """)
        logger.info("Application tables ensured (sessions, profiles)")
    finally:
        conn.close()


@asynccontextmanager
async def lifespan(app):
    _ensure_tables()
    yield


app = FastAPI(title="InterviewIntel Agent", lifespan=lifespan)


def _origin_with_host(scheme: str, host: str, port: int | None) -> str:
    netloc = host
    if port and not (scheme == "http" and port == 80) and not (scheme == "https" and port == 443):
        netloc = f"{host}:{port}"
    return urlunparse((scheme, netloc, "", "", "", ""))


def _apex_www_peers(origin: str) -> list[str]:
    """Allow both apex and www when FRONTEND_URL lists only one (common CORS pitfall).

    Skips localhost and multi-label hosts (e.g. dev.interviewintel.ai, *.vercel.app)
    so we do not invent bogus www.* subdomains.
    """
    o = origin.strip().rstrip("/")
    if not o:
        return []
    parsed = urlparse(o)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return [o]
    host = parsed.hostname.lower()
    if host in ("localhost", "127.0.0.1") or host.endswith(".localhost"):
        return [o]
    labels = host.split(".")
    peers: set[str] = {o}
    port = parsed.port

    if host.startswith("www."):
        apex = host[4:]
        if apex:
            peers.add(_origin_with_host(parsed.scheme, apex, port))
    elif len(labels) == 2:
        peers.add(_origin_with_host(parsed.scheme, f"www.{host}", port))
    return sorted(peers)


def _cors_allowlist(origins: Iterable[str]) -> list[str]:
    out: set[str] = set()
    for raw in origins:
        for peer in _apex_www_peers(raw):
            out.add(peer)
    return sorted(out)


# FRONTEND_URL may be a single origin or a comma-separated list (prod + staging).
_primary_origins = [
    o.strip().rstrip("/") for o in settings.frontend_url.split(",") if o.strip()
]
_allowed_origins = _cors_allowlist([*_primary_origins, "http://localhost:5173"])
logger.info("CORS allow_origins: %s", _allowed_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── DB helpers (Postgres) or in-memory fallback ──────────────────────

_pg_conn = None

def _db():
    """Lazy Postgres connection for session/profile metadata."""
    global _pg_conn
    if _pg_conn is not None:
        return _pg_conn
    if settings.use_postgres:
        import psycopg
        _pg_conn = psycopg.connect(settings.database_url)
        _pg_conn.autocommit = True
        logger.info("Session metadata DB connected (Postgres)")
        return _pg_conn
    return None


_mem_session_index: dict[str, dict] = {}
RESUME_PATH = Path(__file__).parent.parent / "resume_profile.json"


def _save_session_meta(sid: str, meta: dict, user_id: str | None = None):
    conn = _db()
    if conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO sessions (session_id, user_id, company, role, stage, mode, pipeline_group, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (session_id) DO UPDATE SET
                     company = EXCLUDED.company, role = EXCLUDED.role,
                     mode = EXCLUDED.mode, pipeline_group = EXCLUDED.pipeline_group""",
                (
                    sid,
                    user_id,
                    meta.get("company", ""),
                    meta.get("role", ""),
                    meta.get("stage", ""),
                    meta.get("mode", "prep"),
                    meta.get("pipeline_group", "general"),
                    meta.get("created_at", datetime.now(timezone.utc).isoformat()),
                ),
            )
    else:
        _mem_session_index[sid] = meta


def _list_session_metas(user_id: str | None = None) -> list[dict]:
    conn = _db()
    if conn:
        with conn.cursor() as cur:
            if user_id:
                cur.execute(
                    "SELECT session_id, company, role, stage, mode, pipeline_group, created_at "
                    "FROM sessions WHERE user_id = %s ORDER BY created_at DESC",
                    (user_id,),
                )
            else:
                cur.execute(
                    "SELECT session_id, company, role, stage, mode, pipeline_group, created_at "
                    "FROM sessions ORDER BY created_at DESC"
                )
            rows = cur.fetchall()
        return [
            {
                "session_id": r[0], "company": r[1], "role": r[2],
                "stage": r[3], "mode": r[4], "pipeline_group": r[5],
                "created_at": r[6].isoformat() if hasattr(r[6], "isoformat") else str(r[6]),
            }
            for r in rows
        ]
    return sorted(
        [{"session_id": sid, **meta} for sid, meta in _mem_session_index.items()],
        key=lambda x: x.get("created_at", ""),
        reverse=True,
    )


def _get_session_meta(sid: str) -> dict:
    conn = _db()
    if conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT company, role, stage, mode, pipeline_group, created_at "
                "FROM sessions WHERE session_id = %s",
                (sid,),
            )
            row = cur.fetchone()
        if row:
            return {
                "company": row[0], "role": row[1], "stage": row[2],
                "mode": row[3], "pipeline_group": row[4],
                "created_at": row[5].isoformat() if hasattr(row[5], "isoformat") else str(row[5]),
            }
        return {}
    return _mem_session_index.get(sid, {})


def _save_final_scores(sid: str, state: dict):
    """Persist aggregated scores to the sessions row when a session completes."""
    conn = _db()
    if not conn:
        return
    summary = state.get("summary") or {}
    running = state.get("running_competency_scores") or {}
    skill_avgs = _skill_averages_from_running(running)
    payload = {
        "overall_score": summary.get("overall_score"),
        "readiness_level": summary.get("readiness_level"),
        "skill_averages": skill_avgs,
        "total_questions": len(state.get("questions") or []),
        "total_feedback": len(state.get("feedback") or []),
    }
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE sessions SET final_scores = %s WHERE session_id = %s",
            (json.dumps(payload), sid),
        )


def _save_running_scores(sid: str, state: dict):
    """Persist partial competency scores after each Q&A round for live progress."""
    conn = _db()
    if not conn:
        return
    running = state.get("running_competency_scores") or {}
    skill_avgs = _skill_averages_from_running(running)
    q_count = len(state.get("feedback") or [])
    payload = {"skill_averages": skill_avgs, "questions_answered": q_count}
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE sessions SET running_scores = %s WHERE session_id = %s",
            (json.dumps(payload), sid),
        )


def _update_cached_status(sid: str, state: dict):
    """Write derived status + question_count to sessions table for fast listing."""
    conn = _db()
    if not conn:
        return
    is_complete = state.get("session_complete", False)
    mode = state.get("mode", "prep")
    has_analysis = bool(state.get("analysis"))
    questions = state.get("questions") or []

    if is_complete:
        status = "complete"
    elif mode == "roleplay" and has_analysis and questions:
        chat_tail = state.get("chat_history") or []
        last_role = chat_tail[-1].get("role") if chat_tail else None
        status = "reviewing_feedback" if last_role == "coach" else "awaiting_answer"
    elif has_analysis:
        status = "processing"
    else:
        status = "analyzing"

    with conn.cursor() as cur:
        cur.execute(
            "UPDATE sessions SET cached_status = %s, question_count = %s, mode = %s WHERE session_id = %s",
            (status, len(questions), mode, sid),
        )


def _update_session_meta(sid: str, **fields):
    conn = _db()
    if conn and fields:
        sets = ", ".join(f"{k} = %s" for k in fields)
        vals = list(fields.values()) + [sid]
        with conn.cursor() as cur:
            cur.execute(f"UPDATE sessions SET {sets} WHERE session_id = %s", vals)
    elif sid in _mem_session_index:
        _mem_session_index[sid].update(fields)


def _read_resume_file_raw() -> dict:
    if not RESUME_PATH.exists():
        return {}
    try:
        return json.loads(RESUME_PATH.read_text())
    except Exception:
        return {}


def _get_saved_resumes_document(user_id: str | None = None) -> dict:
    """Load normalized saved-resumes document; initialize DB/file when legacy-only."""
    conn = _db()
    if conn and user_id:
        _ensure_profile(user_id)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COALESCE(resume, ''), saved_resumes FROM profiles WHERE id = %s",
                (user_id,),
            )
            row = cur.fetchone()
        resume_txt = row[0] if row else ""
        sr_blob = row[1] if row else None
        if isinstance(sr_blob, str):
            try:
                sr_blob = json.loads(sr_blob)
            except Exception:
                sr_blob = None
        doc = normalize_document(sr_blob, resume_txt)
        if sr_blob is None and row is not None:
            _persist_saved_resumes_doc(user_id, doc)
        return doc

    data = _read_resume_file_raw()
    sr = data.get("saved_resumes")
    legacy = str(data.get("resume", "") or "")
    if isinstance(sr, str):
        try:
            sr = json.loads(sr)
        except Exception:
            sr = None
    doc = normalize_document(sr, legacy)
    if not isinstance(data.get("saved_resumes"), dict):
        RESUME_PATH.write_text(json.dumps(document_for_file_json(data, doc), indent=2))
    return doc


def _persist_saved_resumes_doc(user_id: str | None, doc: dict):
    doc = normalize_document(doc, "")
    default_text = default_resume_text(doc)
    conn = _db()
    if conn and user_id:
        _ensure_profile(user_id)
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE profiles
                SET saved_resumes = %s::jsonb, resume = %s, updated_at = now()
                WHERE id = %s
                """,
                (json.dumps(doc), default_text, user_id),
            )
        return
    data = _read_resume_file_raw()
    RESUME_PATH.write_text(
        json.dumps(document_for_file_json(data, doc), indent=2),
    )


def _load_saved_resume(user_id: str | None = None) -> str:
    return default_resume_text(_get_saved_resumes_document(user_id))


def _save_resume(text: str, user_id: str | None = None):
    """Legacy single-string save: updates the default slot text only."""
    text = (text or "")[:MAX_TEXT_LEN]
    doc = _get_saved_resumes_document(user_id)
    did = doc.get("default_id")
    for it in doc.get("items") or []:
        if isinstance(it, dict) and it.get("id") == did:
            it["text"] = text
            break
    else:
        if doc.get("items"):
            doc["items"][0]["text"] = text
    _persist_saved_resumes_doc(user_id, doc)


def _increment_session_count(user_id: str | None):
    conn = _db()
    if conn and user_id:
        _ensure_profile(user_id)
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE profiles SET session_count = session_count + 1 WHERE id = %s",
                (user_id,),
            )


def _ensure_profile(user_id: str):
    """Create a profile row for this user if one doesn't exist yet."""
    conn = _db()
    if not conn or not user_id:
        return
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO profiles (id) VALUES (%s) ON CONFLICT (id) DO NOTHING",
            (user_id,),
        )


def _get_profile(user_id: str) -> dict | None:
    conn = _db()
    if not conn or not user_id:
        return None
    _ensure_profile(user_id)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                plan,
                session_count,
                COALESCE(llm_model, ''),
                COALESCE(stripe_customer_id, ''),
                COALESCE(stripe_subscription_id, ''),
                COALESCE(stripe_subscription_status, ''),
                COALESCE(stripe_price_id, ''),
                plan_updated_at
            FROM profiles
            WHERE id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
    if row:
        return {
            "plan": row[0],
            "session_count": row[1],
            "llm_model": row[2] or "",
            "stripe_customer_id": row[3] or "",
            "stripe_subscription_id": row[4] or "",
            "stripe_subscription_status": row[5] or "",
            "stripe_price_id": row[6] or "",
            "plan_updated_at": row[7].isoformat() if hasattr(row[7], "isoformat") else row[7],
        }
    return None


def _primary_frontend_origin() -> str:
    """Return the first configured frontend origin for Stripe redirects."""
    if _primary_origins:
        return _primary_origins[0]
    return "http://localhost:5173"


def _stripe_api():
    """Load Stripe lazily so local/free deployments can boot without billing configured."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured")
    import stripe

    stripe.api_key = settings.stripe_secret_key
    return stripe


def _get_user_id_by_stripe_customer(customer_id: str) -> str | None:
    """Map a Stripe customer id back to the Supabase user id stored in profiles."""
    if not customer_id:
        return None
    conn = _db()
    if not conn:
        return None
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM profiles WHERE stripe_customer_id = %s", (customer_id,))
        row = cur.fetchone()
    return row[0] if row else None


def _update_billing_profile(
    user_id: str,
    *,
    plan: str,
    customer_id: str = "",
    subscription_id: str = "",
    subscription_status: str = "",
    price_id: str = "",
) -> None:
    """Persist Stripe subscription state and derived plan entitlement."""
    conn = _db()
    if not conn:
        raise HTTPException(status_code=503, detail="Profile storage unavailable")
    _ensure_profile(user_id)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE profiles
            SET
                plan = %s,
                stripe_customer_id = COALESCE(NULLIF(%s, ''), stripe_customer_id),
                stripe_subscription_id = COALESCE(NULLIF(%s, ''), stripe_subscription_id),
                stripe_subscription_status = %s,
                stripe_price_id = %s,
                plan_updated_at = now(),
                updated_at = now()
            WHERE id = %s
            """,
            (
                plan,
                customer_id,
                subscription_id,
                subscription_status,
                price_id,
                user_id,
            ),
        )


def _subscription_price_id(subscription: Any) -> str:
    """Extract the first price id from a Stripe subscription payload."""
    items = (subscription.get("items") or {}).get("data") or []
    if not items:
        return ""
    price = items[0].get("price") or {}
    return str(price.get("id") or "")


def _sync_subscription_to_profile(subscription: Any, fallback_user_id: str | None = None) -> None:
    """Derive app plan from Stripe subscription status + configured Pro price."""
    customer_id = str(subscription.get("customer") or "")
    subscription_id = str(subscription.get("id") or "")
    subscription_status = str(subscription.get("status") or "")
    price_id = _subscription_price_id(subscription)
    user_id = (
        str((subscription.get("metadata") or {}).get("supabase_user_id") or "")
        or fallback_user_id
        or _get_user_id_by_stripe_customer(customer_id)
    )
    if not user_id:
        logger.warning("Stripe subscription %s has no mapped user id", subscription_id)
        return
    active = subscription_status in {"active", "trialing"}
    is_pro_price = bool(settings.stripe_price_pro_monthly and price_id == settings.stripe_price_pro_monthly)
    plan = "pro" if active and is_pro_price else "free"
    _update_billing_profile(
        user_id,
        plan=plan,
        customer_id=customer_id,
        subscription_id=subscription_id,
        subscription_status=subscription_status,
        price_id=price_id,
    )


def _agent_state_stub_for_api(user_id: str | None) -> AgentState:
    """Minimal LangGraph state for API routes that call nodes._llm_json outside the graph."""
    profile = _get_profile(user_id) if user_id and user_id != "anonymous" else None
    mid = resolve_session_model(profile) if profile else settings.openai_model
    return {
        "company": "",
        "role": "",
        "job_description": "",
        "job_url": "",
        "stage": "",
        "stage_context": "",
        "resume": "",
        "interviewers": [],
        "llm_model": mid,
        "analysis": {},
        "questions": [],
        "answers": [],
        "mode": "prep",
        "chat_history": [],
        "current_q_index": 0,
        "feedback": [],
        "running_competency_scores": {},
        "summary": {},
        "session_complete": False,
    }


def _count_sessions_today(user_id: str) -> int:
    """Count how many sessions this user created since midnight UTC."""
    conn = _db()
    if not conn or not user_id:
        return 0
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM sessions "
            "WHERE user_id = %s AND created_at >= (CURRENT_DATE AT TIME ZONE 'UTC')",
            (user_id,),
        )
        row = cur.fetchone()
    return row[0] if row else 0


# ── Auth helpers ─────────────────────────────────────────────────────

def _get_current_user(request: Request) -> Optional[str]:
    """Extract user_id from Supabase JWT. Returns None if no auth configured or no token."""
    if not settings.supabase_jwt_secret:
        return None
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    try:
        import jwt
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload.get("sub")
    except Exception:
        return None


def _require_user(request: Request) -> str:
    """Dependency: require a valid Supabase JWT. Raises 401 if missing/invalid."""
    uid = _get_current_user(request)
    if not uid:
        if not settings.supabase_jwt_secret:
            return "anonymous"
        raise HTTPException(status_code=401, detail="Not authenticated")
    return uid


def _get_state(session_id: str) -> dict | None:
    config = {"configurable": {"thread_id": session_id}}
    try:
        snapshot = agent.get_state(config)
        if snapshot and snapshot.values:
            return snapshot.values
    except Exception:
        return None
    return None


def _skill_averages_from_running(running: dict | None) -> dict[str, float]:
    if not running:
        return {}
    out: dict[str, float] = {}
    for k, v in running.items():
        if isinstance(v, dict) and v.get("count"):
            out[str(k)] = round(float(v["sum"]) / int(v["count"]), 1)
    return out


def _format_session(session_id: str, state: dict) -> dict:
    questions = state.get("questions", [])
    idx = state.get("current_q_index", 0)
    mode = state.get("mode", "prep")

    current_question = None
    if mode == "roleplay" and questions and idx < len(questions):
        chat = state.get("chat_history", [])
        interviewer_msgs = [m for m in chat if m.get("role") == "interviewer"]
        if interviewer_msgs:
            current_question = {
                "index": idx,
                "total": len(questions),
                "question": questions[idx].get("question", ""),
                "interviewer_says": interviewer_msgs[-1].get("content", ""),
            }

    is_complete = state.get("session_complete", False)
    has_analysis = bool(state.get("analysis"))

    if is_complete:
        status = "complete"
    elif mode == "roleplay" and has_analysis and questions:
        chat_tail = state.get("chat_history") or []
        last_role = chat_tail[-1].get("role") if chat_tail else None
        if last_role == "coach":
            status = "reviewing_feedback"
        else:
            status = "awaiting_answer"
    elif has_analysis:
        status = "processing"
    else:
        status = "analyzing"

    meta = _get_session_meta(session_id)
    running = state.get("running_competency_scores") or {}

    return {
        "session_id": session_id,
        "company": state.get("company", ""),
        "role": state.get("role", ""),
        "stage": state.get("stage", ""),
        "mode": mode,
        "status": status,
        "analysis": state.get("analysis"),
        "questions": questions or None,
        "answers": state.get("answers") or None,
        "current_question": current_question,
        "feedback": state.get("feedback") or None,
        "summary": state.get("summary"),
        "chat_history": state.get("chat_history") or None,
        "created_at": meta.get("created_at", ""),
        "pipeline_group": meta.get("pipeline_group", ""),
        "running_competency_scores": running,
        "skill_averages": _skill_averages_from_running(running),
    }


def _pipeline_group_value(company: str, explicit: str) -> str:
    if explicit and explicit.strip():
        return explicit.strip()
    base = (company or "").strip().lower()
    base = re.sub(r"\s+", " ", base)
    return base or "general"


# ── Routes ────────────────────────────────────────────────────────────


class ExtractRequest(BaseModel):
    job_description: str = ""
    job_url: str = ""


class LookupRequest(BaseModel):
    name: str
    company: str = ""


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/lookup-interviewer")
async def lookup_interviewer(request: Request, body: LookupRequest):
    """Search the web for an interviewer's title given their name and company.

    Uses DuckDuckGo search to find LinkedIn profiles or public bios,
    then uses the LLM to extract their job title from the search snippets.
    """
    from duckduckgo_search import DDGS

    query = f"{body.name} {body.company} LinkedIn".strip()
    logger.info(f"Looking up interviewer: {query}")

    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
    except Exception as e:
        logger.warning(f"DuckDuckGo search failed: {e}")
        raise HTTPException(status_code=502, detail="Search service unavailable")

    if not results:
        return {"title": "", "source": ""}

    snippets = "\n".join(
        f"- {r.get('title', '')}: {r.get('body', '')}" for r in results[:5]
    )

    result = _llm_json(
        _agent_state_stub_for_api(_get_current_user(request)),
        system=(
            "Extract a person's current job title from search results. "
            "Return JSON with:\n"
            '- "title": their current job title (e.g. "VP of Engineering")\n'
            '- "source": which search result you got it from (brief)\n'
            "If you can't determine the title, return empty strings.\n"
            "Return ONLY valid JSON."
        ),
        user=f"Person: {body.name}\nCompany: {body.company}\n\nSearch results:\n{snippets}",
    )
    return result


@app.post("/api/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    """Extract text from an uploaded resume file (PDF, DOCX, or TXT).

    Supports .pdf (via pdfplumber), .docx (via python-docx), and .txt.
    Returns the extracted text so the frontend can populate the resume field
    and the user can review/edit before saving.
    """
    filename = (file.filename or "").lower()
    content = await file.read()

    if filename.endswith(".pdf"):
        import pdfplumber
        import io
        text_parts = []
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        text = "\n".join(text_parts)
    elif filename.endswith(".docx"):
        import docx
        import io
        doc = docx.Document(io.BytesIO(content))
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    elif filename.endswith(".txt"):
        text = content.decode("utf-8", errors="ignore")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, DOCX, or TXT.")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file.")

    return {"text": text.strip()}


@app.post("/api/extract-fields")
async def extract_fields(body: ExtractRequest):
    """Parse a JD (text or URL) and return extracted company, role, and suggested stage.

    This is a lightweight pre-submission call so the user can review and
    edit the auto-filled fields before creating a full session.

    Error contract (422 with structured detail): the frontend reads
    ``detail.message`` and surfaces it verbatim, so these strings are
    the UX. ``code`` is for telemetry / future branching.
    """
    import re
    jd = body.job_description
    url_provided = bool(body.job_url and re.match(r"https?://", body.job_url))
    if url_provided:
        fetched = _fetch_url(body.job_url)
        if fetched:
            jd = fetched
        elif not jd:
            # URL was the *only* input and every fetch path returned
            # empty. That's a fetch problem, not a user problem, so we
            # give them a clear "try pasting text" hand-off instead of
            # the old generic 400.
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "fetch_failed",
                    "message": (
                        "We couldn't read that URL \u2014 the site may be "
                        "blocking automated requests. Paste the job "
                        "description text instead and we'll take it from there."
                    ),
                },
            )

    if not jd:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "missing_input",
                "message": "Paste a job description or a job posting URL to continue.",
            },
        )

    # Bumped from 8K to 20K alongside the _fetch_url cap bump. The LLM
    # extractor's prompt still asks for a ~6K substance chunk back, so
    # the extra headroom is upstream signal only, not output bloat.
    extract_cap = 20_000
    jd_for_llm = jd[:extract_cap] if len(jd) > extract_cap else jd

    result = _llm_json_extract(
        system=(
            "Extract structured information from this job posting. "
            "Return a JSON object with:\n"
            '- "company": company name\n'
            '- "role": job title\n'
            '- "stage_suggestion": most likely interview stage from these options: '
            '"phone_screen", "recruiter_screen", "hiring_manager", "technical", '
            '"behavioral", "final_panel", "vp_round". Pick the best default.\n'
            '- "job_description": cleaned job description text (can be truncated; '
            "prefer first ~6000 chars of substance)\n"
            "\nReturn ONLY valid JSON."
        ),
        user=jd_for_llm,
    )

    # "Empty extraction" = we reached the LLM but it returned nothing
    # useful (no company AND no role). Most common when Firecrawl got
    # blocked and httpx fallback returned a cookie banner. Distinct
    # from fetch_failed because it implies the site *did* serve
    # content, just not job-posting content.
    company = (result.get("company") or "").strip() if isinstance(result, dict) else ""
    role = (result.get("role") or "").strip() if isinstance(result, dict) else ""
    if not company and not role:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "extraction_empty",
                "message": (
                    "We loaded the page but couldn't pick out the job "
                    "details. Try pasting the job description text directly."
                ),
            },
        )

    if isinstance(result.get("job_description"), str) and len(jd) > len(result["job_description"]):
        result["job_description"] = jd
    return result


FREE_DAILY_LIMIT = 2


def _check_free_limit(user_id: str | None):
    """Raise 402 if the free-tier user has hit today's daily session cap."""
    if not user_id or user_id == "anonymous":
        return
    profile = _get_profile(user_id)
    if not profile or profile["plan"] != "free":
        return
    used_today = _count_sessions_today(user_id)
    if used_today >= FREE_DAILY_LIMIT:
        raise HTTPException(
            status_code=402,
            detail=f"Daily limit reached ({FREE_DAILY_LIMIT} free sessions/day). Upgrade to Pro for unlimited.",
        )


@app.post("/api/sessions/stream")
async def create_session_stream(request: Request, body: SessionCreate):
    user_id = _get_current_user(request)
    _check_free_limit(user_id)

    session_id = str(uuid.uuid4())[:8]
    config = {"configurable": {"thread_id": session_id}}

    resume = body.resume
    if not resume:
        resume = _load_saved_resume(user_id)

    profile = _get_profile(user_id) if user_id and user_id != "anonymous" else None
    llm_model = resolve_session_model(profile)

    initial_state = {
        "company": body.company,
        "role": body.role,
        "job_description": body.job_description,
        "job_url": body.job_url,
        "stage": body.stage,
        "stage_context": "",
        "resume": resume,
        "mode": body.mode,
        "interviewers": [i.model_dump() for i in body.interviewers],
        "llm_model": llm_model,
        "analysis": {},
        "questions": [],
        "answers": [],
        "chat_history": [],
        "current_q_index": 0,
        "feedback": [],
        "running_competency_scores": {},
        "summary": {},
        "session_complete": False,
    }

    now = datetime.now(timezone.utc).isoformat()
    meta = {
        "company": body.company,
        "role": body.role,
        "stage": body.stage,
        "mode": body.mode,
        "created_at": now,
        "pipeline_group": _pipeline_group_value(body.company, body.pipeline_group),
    }
    _save_session_meta(session_id, meta, user_id)
    _increment_session_count(user_id)

    q: queue_mod.Queue = queue_mod.Queue()

    def _run():
        try:
            for chunk in agent.stream(initial_state, config, stream_mode="updates"):
                node = list(chunk.keys())[0]
                q.put({"node": node, "status": "complete", "session_id": session_id})
            state = _get_state(session_id)
            if state:
                if state.get("company"):
                    _update_session_meta(session_id, company=state["company"])
                if state.get("role"):
                    _update_session_meta(session_id, role=state["role"])
                _update_cached_status(session_id, state)
                if state.get("session_complete"):
                    _save_final_scores(session_id, state)
                q.put({"done": True, "session": _format_session(session_id, state)})
            else:
                q.put({"done": True, "error": "Failed to create session"})
        except Exception as e:
            logger.error(f"Stream error: {e}")
            q.put({"done": True, "error": str(e)})

    threading.Thread(target=_run, daemon=True).start()

    async def event_generator():
        while True:
            try:
                item = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: q.get(timeout=120)
                )
                yield f"data: {json.dumps(item)}\n\n"
                if item.get("done"):
                    break
            except queue_mod.Empty:
                break

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/sessions")
async def list_sessions(request: Request):
    user_id = _get_current_user(request)
    conn = _db()
    if conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT session_id, company, role, stage, mode, pipeline_group, "
                "created_at, cached_status, question_count, running_scores "
                "FROM sessions WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,),
            )
            rows = cur.fetchall()
        sessions = []
        for r in rows:
            rs = r[9] if r[9] else {}
            if isinstance(rs, str):
                rs = json.loads(rs)
            sessions.append({
                "session_id": r[0],
                "company": r[1],
                "role": r[2],
                "stage": r[3],
                "mode": r[4],
                "pipeline_group": r[5],
                "created_at": r[6].isoformat() if hasattr(r[6], "isoformat") else str(r[6]),
                "status": r[7] or "analyzing",
                "question_count": r[8] or 0,
                "skill_averages": rs.get("skill_averages", {}),
            })
        return sessions
    metas = _list_session_metas(user_id)
    sessions = []
    for meta in metas:
        sid = meta["session_id"]
        state = _get_state(sid)
        if state:
            sessions.append(_format_session(sid, state))
        else:
            sessions.append({**meta, "status": "unknown", "skill_averages": {}})
    return sessions


@app.post("/api/sessions")
async def create_session(request: Request, body: SessionCreate):
    user_id = _get_current_user(request)
    _check_free_limit(user_id)

    session_id = str(uuid.uuid4())[:8]
    config = {"configurable": {"thread_id": session_id}}

    resume = body.resume
    if not resume:
        resume = _load_saved_resume(user_id)

    profile = _get_profile(user_id) if user_id and user_id != "anonymous" else None
    llm_model = resolve_session_model(profile)

    initial_state = {
        "company": body.company,
        "role": body.role,
        "job_description": body.job_description,
        "job_url": body.job_url,
        "stage": body.stage,
        "stage_context": "",
        "resume": resume,
        "mode": body.mode,
        "interviewers": [i.model_dump() for i in body.interviewers],
        "llm_model": llm_model,
        "analysis": {},
        "questions": [],
        "answers": [],
        "chat_history": [],
        "current_q_index": 0,
        "feedback": [],
        "running_competency_scores": {},
        "summary": {},
        "session_complete": False,
    }

    now = datetime.now(timezone.utc).isoformat()
    meta = {
        "company": body.company,
        "role": body.role,
        "stage": body.stage,
        "mode": body.mode,
        "created_at": now,
        "pipeline_group": _pipeline_group_value(body.company, body.pipeline_group),
    }
    _save_session_meta(session_id, meta, user_id)
    _increment_session_count(user_id)

    logger.info(f"Creating session {session_id}: {body.role} at {body.company} ({body.mode})")
    result = agent.invoke(initial_state, config)

    if result.get("company"):
        _update_session_meta(session_id, company=result["company"])
    if result.get("role"):
        _update_session_meta(session_id, role=result["role"])
    _update_cached_status(session_id, result)
    if result.get("session_complete"):
        _save_final_scores(session_id, result)

    return _format_session(session_id, result)


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    state = _get_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    return _format_session(session_id, state)


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, request: Request):
    user_id = _require_user(request)

    conn = _db()
    if conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM sessions WHERE session_id = %s AND user_id = %s RETURNING session_id",
                (session_id, user_id),
            )
            deleted = cur.fetchone()
        if not deleted:
            raise HTTPException(status_code=404, detail="Session not found")

        # Clear LangGraph checkpoint tables for this thread
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM checkpoint_writes WHERE thread_id = %s", (session_id,)
            )
            cur.execute(
                "DELETE FROM checkpoints WHERE thread_id = %s", (session_id,)
            )
    elif session_id in _mem_session_index:
        del _mem_session_index[session_id]
    else:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"status": "deleted"}


@app.post("/api/sessions/{session_id}/answer")
async def submit_answer(session_id: str, body: AnswerSubmit):
    state = _get_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    config = {"configurable": {"thread_id": session_id}}
    history = list(state.get("chat_history", []))
    history.append({"role": "user", "content": body.answer})

    logger.info(f"Session {session_id}: answer submitted for Q{state.get('current_q_index', 0) + 1}")

    agent.update_state(config, {"chat_history": history}, as_node="roleplay_ask")
    result = agent.invoke(None, config)
    _save_running_scores(session_id, result)
    _update_cached_status(session_id, result)
    if result.get("session_complete"):
        _save_final_scores(session_id, result)
    return _format_session(session_id, result)


@app.post("/api/sessions/{session_id}/start-roleplay")
async def start_roleplay(session_id: str):
    """Switch an existing prep session into role-play mode.

    Uses update_state(as_node="generate") so the graph re-evaluates
    the conditional edge and routes to roleplay_ask instead of draft.
    """
    state = _get_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    if not state.get("questions"):
        raise HTTPException(status_code=400, detail="No questions generated yet")

    config = {"configurable": {"thread_id": session_id}}

    agent.update_state(
        config,
        {
            "mode": "roleplay",
            "chat_history": [],
            "current_q_index": 0,
            "feedback": [],
            "running_competency_scores": {},
            "summary": {},
            "session_complete": False,
        },
        as_node="generate",
    )

    result = agent.invoke(None, config)

    _update_session_meta(session_id, mode="roleplay")
    _update_cached_status(session_id, result)

    return _format_session(session_id, result)


@app.post("/api/sessions/{session_id}/continue")
async def continue_session(session_id: str):
    """Advance past the interrupt_after pause into the next roleplay_ask.

    Called after the user has reviewed their feedback and is ready for
    the next question.
    """
    state = _get_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    config = {"configurable": {"thread_id": session_id}}
    logger.info(f"Session {session_id}: continuing to next question")
    result = agent.invoke(None, config)
    _save_running_scores(session_id, result)
    _update_cached_status(session_id, result)
    if result.get("session_complete"):
        _save_final_scores(session_id, result)
    return _format_session(session_id, result)


@app.post("/api/sessions/{session_id}/finish")
async def finish_session(session_id: str):
    """End the roleplay early and jump to the summary node.

    Used at the 5-question checkpoint when the user chooses "Finish & See Summary".
    """
    state = _get_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")

    config = {"configurable": {"thread_id": session_id}}
    agent.update_state(
        config,
        {"session_complete": True},
        as_node="evaluate",
    )
    result = agent.invoke(None, config)
    _save_final_scores(session_id, result)
    _update_cached_status(session_id, result)
    return _format_session(session_id, result)


# ── Progress / Aggregation ────────────────────────────────────────────


@app.get("/api/profile/progress")
async def get_progress(request: Request):
    """Aggregate cross-session performance data for the My Progress page."""
    user_id = _require_user(request)
    conn = _db()
    if not conn:
        return {"sessions_completed": 0, "total_questions": 0, "competency_averages": {}, "score_trend": [], "strongest": None, "weakest": None}

    with conn.cursor() as cur:
        cur.execute(
            "SELECT session_id, final_scores, running_scores, created_at FROM sessions "
            "WHERE user_id = %s AND (final_scores IS NOT NULL OR running_scores IS NOT NULL) "
            "ORDER BY created_at ASC",
            (user_id,),
        )
        rows = cur.fetchall()

    if not rows:
        return {"sessions_completed": 0, "total_questions": 0, "competency_averages": {}, "score_trend": [], "strongest": None, "weakest": None}

    total_questions = 0
    sessions_completed = 0
    competency_sums: dict[str, float] = {}
    competency_counts: dict[str, int] = {}
    score_trend: list[dict] = []

    for _sid, raw_final, raw_running, created_at in rows:
        final = raw_final if isinstance(raw_final, dict) else json.loads(raw_final) if raw_final else {}
        running = raw_running if isinstance(raw_running, dict) else json.loads(raw_running) if raw_running else {}
        dt = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at)

        if final:
            sessions_completed += 1
            total_questions += final.get("total_questions", 0)
            overall = final.get("overall_score")
            if overall is not None:
                score_trend.append({"date": dt, "score": overall})
            skill_src = final.get("skill_averages") or {}
        else:
            total_questions += running.get("questions_answered", 0)
            skill_src = running.get("skill_averages") or {}

        for comp, val in skill_src.items():
            try:
                v = float(val)
            except (TypeError, ValueError):
                continue
            competency_sums[comp] = competency_sums.get(comp, 0.0) + v
            competency_counts[comp] = competency_counts.get(comp, 0) + 1

    competency_averages = {
        k: round(competency_sums[k] / competency_counts[k], 1)
        for k in competency_sums
    }

    strongest = max(competency_averages, key=competency_averages.get, default=None) if competency_averages else None  # type: ignore[arg-type]
    weakest = min(competency_averages, key=competency_averages.get, default=None) if competency_averages else None  # type: ignore[arg-type]

    return {
        "sessions_completed": sessions_completed,
        "total_questions": total_questions,
        "competency_averages": competency_averages,
        "score_trend": score_trend,
        "strongest": strongest,
        "weakest": weakest,
    }


# ── Resume Profile ───────────────────────────────────────────────────


@app.get("/api/profile/resume")
async def get_resume(request: Request):
    user_id = _get_current_user(request)
    return {"resume": _load_saved_resume(user_id)}


@app.put("/api/profile/resume")
async def save_resume_endpoint(request: Request, body: ResumeProfile):
    user_id = _get_current_user(request)
    _save_resume(body.resume, user_id)
    logger.info("Resume profile saved")
    return {"status": "saved"}


@app.get("/api/profile/resumes", response_model=SavedResumesResponse)
async def get_saved_resumes(request: Request):
    user_id = _get_current_user(request)
    if not user_id or user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required")
    doc = _get_saved_resumes_document(user_id)
    items = [
        ResumeSlot(**i)
        for i in (doc.get("items") or [])
        if isinstance(i, dict)
    ]
    return SavedResumesResponse(default_id=str(doc["default_id"]), items=items)


@app.put("/api/profile/resumes", response_model=SavedResumesResponse)
async def put_saved_resumes(request: Request, body: PutResumesRequest):
    user_id = _get_current_user(request)
    if not user_id or user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required")
    doc = {
        "version": 1,
        "default_id": body.default_id,
        "items": [s.model_dump() for s in body.items],
    }
    doc = normalize_document(doc, "")
    _persist_saved_resumes_doc(user_id, doc)
    logger.info("Saved resumes updated (%s slots)", len(doc.get("items") or []))
    items = [
        ResumeSlot(**i)
        for i in (doc.get("items") or [])
        if isinstance(i, dict)
    ]
    return SavedResumesResponse(default_id=str(doc["default_id"]), items=items)


@app.post("/api/billing/checkout")
async def create_billing_checkout(request: Request):
    """Create an authenticated Stripe Checkout Session for the Pro monthly plan."""
    user_id = _get_current_user(request)
    if not user_id or user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required")
    if not settings.stripe_price_pro_monthly:
        raise HTTPException(status_code=503, detail="Stripe Pro price is not configured")

    conn = _db()
    if not conn:
        raise HTTPException(status_code=503, detail="Profile storage unavailable")

    _ensure_profile(user_id)
    profile = _get_profile(user_id) or {}
    origin = _primary_frontend_origin()
    stripe = _stripe_api()
    params: dict[str, Any] = {
        "mode": "subscription",
        "client_reference_id": user_id,
        "line_items": [{"price": settings.stripe_price_pro_monthly, "quantity": 1}],
        "success_url": f"{origin}/app/settings?billing=success&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{origin}/app/settings?billing=cancelled",
        "allow_promotion_codes": True,
        "metadata": {"supabase_user_id": user_id},
        "subscription_data": {"metadata": {"supabase_user_id": user_id}},
    }
    customer_id = str(profile.get("stripe_customer_id") or "")
    if customer_id:
        params["customer"] = customer_id

    session = stripe.checkout.Session.create(**params)
    return {"url": session.url}


@app.post("/api/billing/portal")
async def create_billing_portal(request: Request):
    """Create a Stripe Customer Portal Session for managing the user's subscription."""
    user_id = _get_current_user(request)
    if not user_id or user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required")

    profile = _get_profile(user_id) or {}
    customer_id = str(profile.get("stripe_customer_id") or "")
    if not customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer is linked to this profile")

    stripe = _stripe_api()
    return_url = settings.stripe_customer_portal_return_url.strip() or f"{_primary_frontend_origin()}/app/settings"
    portal = stripe.billing_portal.Session.create(customer=customer_id, return_url=return_url)
    return {"url": portal.url}


@app.post("/api/billing/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe subscription lifecycle events and keep profile entitlements in sync."""
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Stripe webhook is not configured")
    stripe = _stripe_api()
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Stripe payload") from None
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature") from None

    event_type = str(event.get("type") or "")
    obj = (event.get("data") or {}).get("object") or {}

    if event_type == "checkout.session.completed":
        user_id = str((obj.get("metadata") or {}).get("supabase_user_id") or obj.get("client_reference_id") or "")
        customer_id = str(obj.get("customer") or "")
        subscription_id = str(obj.get("subscription") or "")
        if user_id and customer_id:
            _ensure_profile(user_id)
            _update_billing_profile(user_id, plan="free", customer_id=customer_id)
        if subscription_id:
            subscription = stripe.Subscription.retrieve(subscription_id, expand=["items.data.price"])
            _sync_subscription_to_profile(subscription, fallback_user_id=user_id or None)

    elif event_type in {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}:
        _sync_subscription_to_profile(obj)

    return {"received": True}


@app.get("/api/profile/me")
async def get_me(request: Request):
    """Return current user profile with daily usage stats."""
    user_id = _get_current_user(request)
    if user_id and user_id != "anonymous":
        profile = _get_profile(user_id)
        used_today = _count_sessions_today(user_id)
        if profile:
            eff = resolve_session_model(profile)
            return {
                "user_id": user_id,
                **profile,
                "authenticated": True,
                "daily_sessions_used": used_today,
                "daily_limit": FREE_DAILY_LIMIT if profile["plan"] == "free" else None,
                "llm_model_effective": eff,
                "llm_model_choices": model_choices_for_api(profile["plan"]),
            }
    return {
        "user_id": None,
        "plan": "free",
        "session_count": 0,
        "authenticated": False,
        "daily_sessions_used": 0,
        "daily_limit": FREE_DAILY_LIMIT,
        "llm_model": "",
        "llm_model_effective": settings.openai_model,
        "llm_model_choices": model_choices_for_api("free"),
    }


@app.put("/api/profile/llm-model")
async def put_llm_model(request: Request, body: LlmModelUpdate):
    user_id = _get_current_user(request)
    if not user_id or user_id == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required")
    profile = _get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=400, detail="Profile not found")
    mid = body.llm_model.strip()
    if not is_model_allowed_for_plan(profile["plan"], mid):
        raise HTTPException(
            status_code=403,
            detail="That model is not available on your plan. Upgrade to Pro for premium models.",
        )
    conn = _db()
    if not conn:
        raise HTTPException(status_code=503, detail="Profile storage unavailable")
    _ensure_profile(user_id)
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE profiles SET llm_model = %s, updated_at = now() WHERE id = %s",
            (mid, user_id),
        )
    updated = {**profile, "llm_model": mid}
    return {
        "llm_model": mid,
        "llm_model_effective": resolve_session_model(updated),
        "llm_model_choices": model_choices_for_api(profile["plan"]),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
