import uuid
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models import SessionCreate, AnswerSubmit, ResumeProfile, SessionOut
from app.agent.graph import agent, checkpointer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Interview Prep Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory session index ──────────────────────────────────────────
# Maps session_id -> lightweight metadata so we can list all sessions
# without walking the checkpointer.
_session_index: dict[str, dict] = {}

RESUME_PATH = Path(__file__).parent.parent / "resume_profile.json"


def _get_state(session_id: str) -> dict | None:
    config = {"configurable": {"thread_id": session_id}}
    try:
        snapshot = agent.get_state(config)
        if snapshot and snapshot.values:
            return snapshot.values
    except Exception:
        return None
    return None


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
        status = "awaiting_answer"
    elif has_analysis:
        status = "processing"
    else:
        status = "analyzing"

    meta = _session_index.get(session_id, {})

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
    }


def _load_saved_resume() -> str:
    if RESUME_PATH.exists():
        try:
            data = json.loads(RESUME_PATH.read_text())
            return data.get("resume", "")
        except Exception:
            return ""
    return ""


# ── Routes ────────────────────────────────────────────────────────────


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/sessions")
async def list_sessions():
    """List all sessions with lightweight metadata."""
    sessions = []
    for sid, meta in sorted(
        _session_index.items(),
        key=lambda x: x[1].get("created_at", ""),
        reverse=True,
    ):
        state = _get_state(sid)
        if state:
            sessions.append(_format_session(sid, state))
        else:
            sessions.append({**meta, "session_id": sid, "status": "unknown"})
    return sessions


@app.post("/api/sessions")
async def create_session(body: SessionCreate):
    session_id = str(uuid.uuid4())[:8]
    config = {"configurable": {"thread_id": session_id}}

    resume = body.resume
    if not resume:
        resume = _load_saved_resume()

    initial_state = {
        "company": body.company,
        "role": body.role,
        "job_description": body.job_description,
        "job_url": body.job_url,
        "stage": body.stage,
        "resume": resume,
        "mode": body.mode,
        "interviewer_name": body.interviewer_name,
        "interviewer_title": body.interviewer_title,
        "analysis": {},
        "questions": [],
        "answers": [],
        "chat_history": [],
        "current_q_index": 0,
        "feedback": [],
        "summary": {},
        "session_complete": False,
    }

    now = datetime.now(timezone.utc).isoformat()
    _session_index[session_id] = {
        "company": body.company,
        "role": body.role,
        "stage": body.stage,
        "mode": body.mode,
        "created_at": now,
    }

    logger.info(f"Creating session {session_id}: {body.role} at {body.company} ({body.mode})")
    result = agent.invoke(initial_state, config)

    if result.get("company"):
        _session_index[session_id]["company"] = result["company"]
    if result.get("role"):
        _session_index[session_id]["role"] = result["role"]

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
    result = agent.invoke({"chat_history": history}, config)
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
            "summary": {},
            "session_complete": False,
        },
        as_node="generate",
    )

    result = agent.invoke(None, config)

    if session_id in _session_index:
        _session_index[session_id]["mode"] = "roleplay"

    return _format_session(session_id, result)


# ── Resume Profile ───────────────────────────────────────────────────


@app.get("/api/profile/resume")
async def get_resume():
    return {"resume": _load_saved_resume()}


@app.put("/api/profile/resume")
async def save_resume(body: ResumeProfile):
    RESUME_PATH.write_text(json.dumps({"resume": body.resume}))
    logger.info("Resume profile saved")
    return {"status": "saved"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
