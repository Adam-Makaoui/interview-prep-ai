import uuid
import json
import logging
import re
import threading
import queue as queue_mod
import asyncio
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from pydantic import BaseModel

from app.config import settings
from app.models import SessionCreate, AnswerSubmit, ResumeProfile, SessionOut
from app.agent.graph import agent, checkpointer
from app.agent.nodes import _llm_json, _llm_json_extract, _fetch_url

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Interview Prep Agent")

_allowed_origins = [settings.frontend_url, "http://localhost:5173"]
if settings.frontend_url != "http://localhost:5173":
    _allowed_origins.append("http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── DB helpers (Supabase Postgres) or in-memory fallback ─────────────

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


def _update_session_meta(sid: str, **fields):
    conn = _db()
    if conn and fields:
        sets = ", ".join(f"{k} = %s" for k in fields)
        vals = list(fields.values()) + [sid]
        with conn.cursor() as cur:
            cur.execute(f"UPDATE sessions SET {sets} WHERE session_id = %s", vals)
    elif sid in _mem_session_index:
        _mem_session_index[sid].update(fields)


def _load_saved_resume(user_id: str | None = None) -> str:
    conn = _db()
    if conn and user_id:
        with conn.cursor() as cur:
            cur.execute("SELECT resume FROM profiles WHERE id = %s", (user_id,))
            row = cur.fetchone()
        return row[0] if row else ""
    if RESUME_PATH.exists():
        try:
            data = json.loads(RESUME_PATH.read_text())
            return data.get("resume", "")
        except Exception:
            return ""
    return ""


def _save_resume(text: str, user_id: str | None = None):
    conn = _db()
    if conn and user_id:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE profiles SET resume = %s, updated_at = now() WHERE id = %s",
                (text, user_id),
            )
        return
    RESUME_PATH.write_text(json.dumps({"resume": text}))


def _increment_session_count(user_id: str | None):
    conn = _db()
    if conn and user_id:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE profiles SET session_count = session_count + 1 WHERE id = %s",
                (user_id,),
            )


def _get_profile(user_id: str) -> dict | None:
    conn = _db()
    if not conn or not user_id:
        return None
    with conn.cursor() as cur:
        cur.execute("SELECT plan, session_count FROM profiles WHERE id = %s", (user_id,))
        row = cur.fetchone()
    if row:
        return {"plan": row[0], "session_count": row[1]}
    return None


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
async def lookup_interviewer(body: LookupRequest):
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
    """
    import re
    jd = body.job_description
    if body.job_url and re.match(r"https?://", body.job_url):
        fetched = _fetch_url(body.job_url)
        if fetched:
            jd = fetched

    if not jd:
        raise HTTPException(status_code=400, detail="No job description or URL provided")

    extract_cap = 8000
    jd_for_llm = jd[:extract_cap] if len(jd) > extract_cap else jd

    result = _llm_json_extract(
        system=(
            "Extract structured information from this job posting. "
            "Return a JSON object with:\n"
            '- "company": company name\n'
            '- "role": job title\n'
            '- "stage_suggestion": most likely interview stage from these options: '
            '"phone_screen", "recruiter_screen", "hiring_manager", "technical", '
            '"behavioral", "final_panel". Pick the best default.\n'
            '- "job_description": cleaned job description text (can be truncated; '
            "prefer first ~6000 chars of substance)\n"
            "\nReturn ONLY valid JSON."
        ),
        user=jd_for_llm,
    )
    if isinstance(result.get("job_description"), str) and len(jd) > len(result["job_description"]):
        result["job_description"] = jd
    return result


FREE_SESSION_LIMIT = 1


def _check_free_limit(user_id: str | None):
    """Raise 402 if the user has exceeded the free tier."""
    if not user_id or user_id == "anonymous":
        return
    profile = _get_profile(user_id)
    if profile and profile["plan"] == "free" and profile["session_count"] >= FREE_SESSION_LIMIT:
        raise HTTPException(
            status_code=402,
            detail="Free tier limit reached. Upgrade to Pro for unlimited sessions.",
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
    metas = _list_session_metas(user_id)
    sessions = []
    for meta in metas:
        sid = meta["session_id"]
        state = _get_state(sid)
        if state:
            sessions.append(_format_session(sid, state))
        else:
            sessions.append({
                **meta,
                "status": "unknown",
                "running_competency_scores": {},
                "skill_averages": {},
            })
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

    return _format_session(session_id, result)


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    state = _get_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    return _format_session(session_id, state)


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
    return _format_session(session_id, result)


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


@app.get("/api/profile/me")
async def get_me(request: Request):
    """Return current user profile (plan, session_count). Unauthenticated = free defaults."""
    user_id = _get_current_user(request)
    if user_id and user_id != "anonymous":
        profile = _get_profile(user_id)
        if profile:
            return {"user_id": user_id, **profile, "authenticated": True}
    return {"user_id": None, "plan": "free", "session_count": 0, "authenticated": False}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
