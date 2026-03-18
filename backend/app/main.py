import uuid
import json
import logging
import threading
import queue as queue_mod
import asyncio
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from pydantic import BaseModel

from app.config import settings
from app.models import SessionCreate, AnswerSubmit, ResumeProfile, SessionOut
from app.agent.graph import agent, checkpointer
from app.agent.nodes import _llm_json, _fetch_url

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
    feedback_list = state.get("feedback", [])

    if is_complete:
        status = "complete"
    elif mode == "roleplay" and has_analysis and questions:
        # Detect "reviewing_feedback" state: evaluate just ran (feedback exists
        # for the current question) but the next question hasn't been asked yet.
        # This happens because interrupt_after=["evaluate"] pauses the graph.
        if feedback_list and len(feedback_list) == idx:
            status = "reviewing_feedback"
        else:
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

    result = _llm_json(
        system=(
            "Extract structured information from this job posting. "
            "Return a JSON object with:\n"
            '- "company": company name\n'
            '- "role": job title\n'
            '- "stage_suggestion": most likely interview stage from these options: '
            '"phone_screen", "recruiter_screen", "hiring_manager", "technical", '
            '"behavioral", "final_panel". Pick the best default.\n'
            '- "job_description": cleaned full job description text\n'
            "\nReturn ONLY valid JSON."
        ),
        user=jd,
    )
    return result


@app.post("/api/sessions/stream")
async def create_session_stream(body: SessionCreate):
    """Create a session with SSE progress events as each node completes.

    Uses agent.stream(stream_mode="updates") in a background thread,
    feeding node-completion events through a queue to the SSE response.
    """
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

    q: queue_mod.Queue = queue_mod.Queue()

    def _run():
        try:
            for chunk in agent.stream(initial_state, config, stream_mode="updates"):
                node = list(chunk.keys())[0]
                q.put({"node": node, "status": "complete"})
            state = _get_state(session_id)
            if state:
                if state.get("company"):
                    _session_index[session_id]["company"] = state["company"]
                if state.get("role"):
                    _session_index[session_id]["role"] = state["role"]
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
