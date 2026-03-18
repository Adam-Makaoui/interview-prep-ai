from __future__ import annotations

import json
import logging

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from app.config import settings
from app.agent.state import AgentState

logger = logging.getLogger(__name__)

STAGE_CONTEXT = {
    "phone_screen": (
        "Initial phone screen. Focus on motivation, general fit, "
        "high-level experience, and 'tell me about yourself' style questions."
    ),
    "technical": (
        "Technical interview. Focus on technical skills, system design, "
        "problem-solving, coding approaches, and hands-on experience."
    ),
    "behavioral": (
        "Behavioral interview. Focus on STAR-method situational questions "
        "about leadership, teamwork, conflict resolution, and professional growth."
    ),
    "final_panel": (
        "Final panel interview. Focus on strategic thinking, leadership, "
        "culture fit, 'why us/why you', and long-term vision questions."
    ),
}


def _llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.7,
    )


def _llm_json(system: str, user: str) -> dict:
    """Call LLM and parse JSON response."""
    llm = _llm().bind(response_format={"type": "json_object"})
    resp = llm.invoke([SystemMessage(content=system), HumanMessage(content=user)])
    return json.loads(resp.content)


# ── Node 1: Parse Job Posting ────────────────────────────────────────

def parse_job_posting(state: AgentState) -> dict:
    """Extract structured fields from raw job description text.

    If company/role are already filled (manual entry), pass through.
    Otherwise use LLM to extract them from the JD text.
    """
    if state.get("company") and state.get("role"):
        logger.info("Fields already provided, skipping parse")
        return {}

    jd = state.get("job_description", "")
    if not jd:
        return {}

    result = _llm_json(
        system=(
            "Extract structured information from this job posting. "
            "Return a JSON object with:\n"
            '- "company": company name\n'
            '- "role": job title\n'
            '- "job_description": cleaned full job description text\n'
            "\nReturn ONLY valid JSON."
        ),
        user=jd,
    )
    logger.info(f"Parsed: {result.get('company')} - {result.get('role')}")
    return {
        "company": result.get("company", state.get("company", "")),
        "role": result.get("role", state.get("role", "")),
        "job_description": result.get("job_description", jd),
    }


# ── Node 2: Analyze Role ─────────────────────────────────────────────

def analyze_role(state: AgentState) -> dict:
    """Analyze the role, company, and JD to extract prep-relevant insights."""
    logger.info(f"Analyzing role: {state['role']} at {state['company']}")

    result = _llm_json(
        system=(
            "You are an expert career analyst and interview coach. "
            "Analyze the job description and return a JSON object with:\n"
            '- "key_skills": list of 5-8 most important skills/qualifications\n'
            '- "culture_signals": list of 3-5 company culture indicators\n'
            '- "what_they_value": list of 3-5 things the company values\n'
            '- "role_focus": 2-3 sentence summary of what this role is really about\n'
            '- "interview_tips": list of 3-5 specific tips for this role\n'
            "\nReturn ONLY valid JSON."
        ),
        user=(
            f"Company: {state['company']}\n"
            f"Role: {state['role']}\n\n"
            f"Job Description:\n{state['job_description']}"
        ),
    )
    logger.info(f"Analysis complete: {list(result.keys())}")
    return {"analysis": result}


# ── Node 3: Generate Questions ────────────────────────────────────────

def generate_questions(state: AgentState) -> dict:
    """Generate stage-specific interview questions."""
    stage = state.get("stage", "phone_screen")
    analysis = state.get("analysis", {})
    logger.info(f"Generating questions for {stage}")

    result = _llm_json(
        system=(
            "You are an expert interview coach. Generate realistic interview questions.\n\n"
            f"Interview Stage: {STAGE_CONTEXT.get(stage, 'General interview')}\n\n"
            "Role Analysis:\n"
            f"- Key Skills: {json.dumps(analysis.get('key_skills', []))}\n"
            f"- What They Value: {json.dumps(analysis.get('what_they_value', []))}\n"
            f"- Role Focus: {analysis.get('role_focus', '')}\n\n"
            "Generate 8-10 likely interview questions. Return a JSON object with:\n"
            '"questions": [\n'
            '  {"question": "...", "category": "technical|behavioral|situational|general", '
            '"why_asked": "brief reason why they\'d ask this"}\n'
            "]\n\nReturn ONLY valid JSON."
        ),
        user=f"Company: {state['company']}\nRole: {state['role']}\nInterview Stage: {stage}",
    )
    questions = result.get("questions", [])
    logger.info(f"Generated {len(questions)} questions")
    return {"questions": questions, "current_q_index": 0}


# ── Node 4: Draft Answers (prep mode) ────────────────────────────────

def draft_answers(state: AgentState) -> dict:
    """Draft personalized answer frameworks for all questions."""
    questions = state.get("questions", [])
    analysis = state.get("analysis", {})
    resume = state.get("resume", "")
    logger.info("Drafting answer frameworks")

    questions_text = "\n".join(
        f"{i + 1}. {q['question']}" for i, q in enumerate(questions)
    )
    resume_section = (
        f"\n\nCandidate's Resume/Background:\n{resume}"
        if resume
        else "\n\n(No resume provided -- give general answer frameworks)"
    )

    result = _llm_json(
        system=(
            "You are an expert interview coach. Draft personalized answer "
            "frameworks for each interview question.\n\n"
            f"Role: {state['role']} at {state['company']}\n"
            f"Key Skills They Want: {json.dumps(analysis.get('key_skills', []))}\n"
            f"What They Value: {json.dumps(analysis.get('what_they_value', []))}"
            f"{resume_section}\n\n"
            "For each question, provide:\n"
            "- A structured answer framework (use STAR method where applicable)\n"
            "- Key points to hit\n"
            "- A specific example to mention (from resume if available)\n"
            "- What to avoid saying\n\n"
            "Return a JSON object with:\n"
            '"answers": [\n'
            "  {\n"
            '    "question": "the original question",\n'
            '    "answer_framework": "3-5 sentence structured answer",\n'
            '    "key_points": ["point 1", "point 2", "point 3"],\n'
            '    "example_to_use": "specific example from background",\n'
            '    "avoid": "what not to say"\n'
            "  }\n"
            "]\n\nReturn ONLY valid JSON."
        ),
        user=f"Draft answers for these questions:\n{questions_text}",
    )
    answers = result.get("answers", [])
    logger.info(f"Drafted {len(answers)} answers")
    return {"answers": answers, "session_complete": True}


# ── Node 5: Role-Play Ask ────────────────────────────────────────────

def roleplay_ask(state: AgentState) -> dict:
    """Pick the next question and present it as an interviewer would."""
    questions = state.get("questions", [])
    idx = state.get("current_q_index", 0)

    if idx >= len(questions):
        return {"session_complete": True}

    q = questions[idx]
    llm = _llm()
    resp = llm.invoke([
        SystemMessage(content=(
            "You are a professional interviewer conducting a real interview. "
            "Present the following question naturally, as if you were sitting across "
            "from the candidate. Be conversational but professional. "
            "If this is the first question, start with a brief warm greeting. "
            "Do NOT reveal that you are an AI or that this is practice."
        )),
        HumanMessage(content=(
            f"Company: {state['company']}\n"
            f"Role: {state['role']}\n"
            f"Question to ask (question {idx + 1} of {len(questions)}): {q['question']}"
        )),
    ])

    history = list(state.get("chat_history", []))
    history.append({"role": "interviewer", "content": resp.content, "question_index": idx})

    return {"chat_history": history}


# ── Node 6: Evaluate Answer ──────────────────────────────────────────

def evaluate_answer(state: AgentState) -> dict:
    """Evaluate the user's answer and provide feedback."""
    history = state.get("chat_history", [])
    questions = state.get("questions", [])
    idx = state.get("current_q_index", 0)
    analysis = state.get("analysis", {})

    if not history:
        return {}

    last_user_msg = None
    for msg in reversed(history):
        if msg.get("role") == "user":
            last_user_msg = msg
            break

    if not last_user_msg:
        return {}

    q = questions[idx] if idx < len(questions) else {}

    result = _llm_json(
        system=(
            "You are an expert interview coach evaluating a candidate's answer.\n\n"
            f"Role: {state['role']} at {state['company']}\n"
            f"Key Skills: {json.dumps(analysis.get('key_skills', []))}\n"
            f"What They Value: {json.dumps(analysis.get('what_they_value', []))}\n\n"
            "Evaluate the answer and return a JSON object with:\n"
            '- "score": integer 1-10\n'
            '- "strengths": list of 2-3 things done well\n'
            '- "improvements": list of 2-3 specific improvements\n'
            '- "improved_answer": a stronger version of their answer (3-5 sentences)\n'
            '- "tip": one actionable tip for next time\n'
            "\nReturn ONLY valid JSON."
        ),
        user=(
            f"Question: {q.get('question', '')}\n"
            f"Why this is asked: {q.get('why_asked', '')}\n\n"
            f"Candidate's answer: {last_user_msg['content']}"
        ),
    )

    feedback_entry = {
        "question": q.get("question", ""),
        "user_answer": last_user_msg["content"],
        "score": result.get("score", 5),
        "strengths": result.get("strengths", []),
        "improvements": result.get("improvements", []),
        "improved_answer": result.get("improved_answer", ""),
        "tip": result.get("tip", ""),
    }

    history.append({
        "role": "coach",
        "content": (
            f"Score: {feedback_entry['score']}/10\n\n"
            f"Strengths: {', '.join(feedback_entry['strengths'])}\n\n"
            f"To improve: {', '.join(feedback_entry['improvements'])}\n\n"
            f"Tip: {feedback_entry['tip']}"
        ),
    })

    all_feedback = list(state.get("feedback", []))
    all_feedback.append(feedback_entry)

    return {
        "chat_history": history,
        "feedback": all_feedback,
        "current_q_index": idx + 1,
    }


# ── Node 7: Session Summary ──────────────────────────────────────────

def session_summary(state: AgentState) -> dict:
    """Generate an overall session summary and readiness scorecard."""
    feedback = state.get("feedback", [])

    if not feedback:
        return {"session_complete": True, "summary": {"message": "No practice answers to summarize."}}

    scores = [f.get("score", 5) for f in feedback]
    avg = sum(scores) / len(scores) if scores else 0

    all_strengths = []
    all_improvements = []
    for f in feedback:
        all_strengths.extend(f.get("strengths", []))
        all_improvements.extend(f.get("improvements", []))

    result = _llm_json(
        system=(
            "You are an interview coach wrapping up a practice session. "
            "Synthesize the feedback into an overall assessment.\n\n"
            "Return a JSON object with:\n"
            '- "overall_score": integer 1-10\n'
            '- "readiness_level": "not ready" | "needs work" | "almost there" | "ready"\n'
            '- "top_strengths": list of 3 standout strengths across all answers\n'
            '- "priority_improvements": list of 3 most important things to work on\n'
            '- "final_advice": 2-3 sentence personalized advice for the actual interview\n'
            "\nReturn ONLY valid JSON."
        ),
        user=(
            f"Role: {state['role']} at {state['company']}\n"
            f"Stage: {state['stage']}\n"
            f"Questions practiced: {len(feedback)}\n"
            f"Average score: {avg:.1f}/10\n"
            f"Individual scores: {scores}\n"
            f"Recurring strengths: {all_strengths[:10]}\n"
            f"Recurring improvements: {all_improvements[:10]}"
        ),
    )

    return {"summary": result, "session_complete": True}


# ── Routing Functions ─────────────────────────────────────────────────

def route_by_mode(state: AgentState) -> str:
    return "roleplay" if state.get("mode") == "roleplay" else "prep"


def check_continue(state: AgentState) -> str:
    questions = state.get("questions", [])
    idx = state.get("current_q_index", 0)
    if idx >= len(questions) or state.get("session_complete"):
        return "done"
    return "continue"
