"""LangGraph agent nodes -- the core AI logic of InterviewPrep AI.

Each function in this module is a node in the LangGraph state machine.
Nodes receive the full AgentState, perform one focused task (usually an
LLM call), and return a partial dict of only the state fields they modify.
LangGraph merges the returned dict into the accumulated state automatically.

Architecture note: every LLM call uses JSON-mode output (response_format)
rather than function-calling/tool-use, because our nodes are deterministic
pipeline steps, not autonomous tool-selection decisions. JSON-mode gives
us structured output with lower latency and simpler error handling.
"""
from __future__ import annotations

import json
import logging
import re

import httpx
from bs4 import BeautifulSoup
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage

from app.config import settings
from app.agent.state import AgentState

logger = logging.getLogger(__name__)

# ── Stage context mapping ────────────────────────────────────────────
# Each stage type has a tailored description that gets injected into the
# question-generation prompt. This is what makes questions feel authentic
# to each interview round -- a recruiter screen produces different
# questions than a hiring manager deep-dive.
STAGE_CONTEXT = {
    "Phone/Recruiter_screen": (
        "Recruiter initialscreening call. Focus on salary expectations, availability, motivation, general fit, "
        "visa/relocation needs, basic qualification checks, and 'walk me through "
        "your resume' questions. Recruiters rarely ask deep technical questions."
        "high-level experience, and 'tell me about yourself' style questions."
    ),
    "hiring_manager": (
        "Hiring manager interview. Focus on team fit, management style alignment, "
        "how the candidate approaches problems, past project impact, and 'why this "
        "team/role' questions. Expect a mix of behavioral and light technical."
    ),
    "technical": (
        "Technical interview. Focus on technical skills, system design, high level technical questions based on the job description, industry vertical,"
        "problem-solving, deep technical questions, coding approaches, and hands-on experience."
    ),
    "behavioral": (
        "Behavioral interview. Focus on STAR-method situational questions "
        "about leadership, teamwork, conflict resolution, and professional growth."
    ),
    "final_panel": (
        "Final panel interview. Focus on strategic thinking, leadership, "
        "culture fit, 'why us/why you', technical questions, and long-term vision questions."
    ),
    "vp_round": (
        "VP round interview. Focus on strategic thinking, leadership, "
        "culture fit, 'why us/why you', and long-term vision questions."
    )
}


def _llm() -> ChatOpenAI:
    """Create a configured ChatOpenAI instance using app settings."""
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.7,
    )


def _llm_json(system: str, user: str) -> dict:
    """Call the LLM with JSON-mode output and parse the response.

    Uses OpenAI's response_format=json_object to guarantee valid JSON,
    avoiding brittle regex parsing of markdown code blocks.
    """
    llm = _llm().bind(response_format={"type": "json_object"})
    resp = llm.invoke([SystemMessage(content=system), HumanMessage(content=user)])
    return json.loads(resp.content)


def _llm_json_extract(system: str, user: str) -> dict:
    """Fast extraction path: dedicated model + temperature 0 for field parsing."""
    llm = ChatOpenAI(
        model=settings.extract_model,
        api_key=settings.openai_api_key,
        temperature=0,
    ).bind(response_format={"type": "json_object"})
    resp = llm.invoke([SystemMessage(content=system), HumanMessage(content=user)])
    return json.loads(resp.content)


def _company_intel_snippets(company: str) -> str:
    """Short web snippets to ground company_intel (best-effort, may be empty)."""
    if not company or len(company.strip()) < 2:
        return ""
    try:
        from duckduckgo_search import DDGS
        parts: list[str] = []
        queries = [
            f"{company} company employees size",
            f"{company} competitors",
        ]
        with DDGS() as ddgs:
            for q in queries:
                for r in ddgs.text(q, max_results=3):
                    body = (r.get("body") or "")[:400]
                    if body:
                        parts.append(body)
        return "\n".join(parts)[:2500]
    except Exception as e:
        logger.debug("company intel search skipped: %s", e)
        return ""


def _fetch_url(url: str) -> str:
    """Fetch a URL and extract readable text, stripping boilerplate HTML.

    Used by parse_job_posting to support "paste URL" input mode.
    Strips script/style/nav/footer tags and truncates to 8k chars to
    stay within LLM context limits.
    """
    try:
        resp = httpx.get(url, follow_redirects=True, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
        })
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        return text[:8000]
    except Exception as e:
        logger.warning(f"Failed to fetch URL {url}: {e}")
        return ""


def _resolve_stage_context(stage: str) -> str:
    """Return a human-readable description for any interview stage.

    For predefined stages, returns the curated description from STAGE_CONTEXT.
    For custom stages (e.g. "case study", "system design review"), uses the
    LLM to generate a brief description so question generation is always
    stage-aware, even for stages we haven't hardcoded.
    """
    if stage in STAGE_CONTEXT:
        return STAGE_CONTEXT[stage]

    logger.info(f"Generating context for custom stage: {stage}")
    result = _llm_json(
        system=(
            "You are an interview expert. Given an interview stage name, "
            "write a 2-3 sentence description of what this stage typically "
            "evaluates and what kinds of questions are asked. "
            'Return JSON: {"stage_context": "..."}'
        ),
        user=f"Interview stage: {stage}",
    )
    return result.get("stage_context", f"Interview stage: {stage}")


def _format_interviewers(interviewers: list) -> str:
    """Format a list of interviewer dicts into prompt context.

    Returns empty string if no interviewers are provided, so prompts
    degrade gracefully without interviewer info.
    """
    if not interviewers:
        return ""

    parts = []
    for i, person in enumerate(interviewers, 1):
        name = person.get("name", "")
        title = person.get("title", "")
        if name or title:
            parts.append(f"  {i}. {name}{' - ' + title if title else ''}")

    if not parts:
        return ""

    return (
        "\n\nInterviewer Panel:\n"
        + "\n".join(parts)
        + "\nFactor in each interviewer's likely perspective and focus areas "
        "based on their roles when generating tips."
    )


# ── Node 1: Parse Job Posting ────────────────────────────────────────

def parse_job_posting(state: AgentState) -> dict:
    """Extract structured fields from raw job description text or URL.

    This node handles three input scenarios:
    1. job_url provided -> fetch page, extract text, then LLM parse
    2. company/role already filled -> pass through (user manually entered)
    3. raw JD text only -> LLM extracts company/role from the text

    The node is idempotent: if company and role are already populated,
    it skips the LLM call entirely to save latency and cost.
    """
    jd = state.get("job_description", "")
    job_url = state.get("job_url", "")

    if job_url and re.match(r"https?://", job_url):
        logger.info(f"Fetching job URL: {job_url}")
        fetched = _fetch_url(job_url)
        if fetched:
            jd = fetched

    # Resolve stage context (LLM fallback for custom stages)
    stage = state.get("stage", "phone_screen")
    stage_ctx = _resolve_stage_context(stage)

    if state.get("company") and state.get("role") and jd:
        logger.info("Fields already provided, skipping LLM parse")
        updates = {"stage_context": stage_ctx}
        if job_url:
            updates["job_description"] = jd
        return updates

    if not jd:
        return {"stage_context": stage_ctx}

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
        "stage_context": stage_ctx,
    }


# ── Node 2: Analyze Role ─────────────────────────────────────────────

def analyze_role(state: AgentState) -> dict:
    """Analyze the role, company, and JD to extract prep-relevant insights.

    This is the "reasoning" step that transforms raw job description text
    into structured intelligence. The analysis output feeds into both
    question generation and answer drafting, creating a context chain
    where each node builds on the previous one's output.
    """
    logger.info(f"Analyzing role: {state['role']} at {state['company']}")

    interviewer_ctx = _format_interviewers(state.get("interviewers", []))

    titles = [p.get("title", "") for p in state.get("interviewers", []) if p.get("title")]
    interviewer_focus_prompt = ""
    if titles:
        titles_str = ", ".join(titles)
        interviewer_focus_prompt = (
            f'- "interviewer_focus": list of 2-3 things the interviewers '
            f'({titles_str}) will likely focus on\n'
        )

    web_ctx = _company_intel_snippets(state.get("company", ""))
    web_section = (
        f"\n\nWeb search snippets (may be incomplete; verify important facts):\n{web_ctx}"
        if web_ctx
        else ""
    )

    resume = (state.get("resume") or "").strip()
    resume_section = (
        f"\n\nCandidate resume (for jd_fit only):\n{resume[:6000]}"
        if resume
        else "\n\n(No resume provided -- jd_fit should note limited signal.)"
    )

    result = _llm_json(
        system=(
            "You are an expert career analyst and interview coach. "
            "Analyze the job description and return a JSON object with:\n"
            '- "key_skills": list of 5-8 most important skills/qualifications\n'
            '- "culture_signals": list of 3-5 company culture indicators\n'
            '- "what_they_value": list of 3-5 things the company values\n'
            '- "role_focus": 2-3 sentence summary of what this role is really about\n'
            '- "interview_tips": list of 3-5 specific tips for this role\n'
            '- "scorecard_dimensions": array of 4-7 objects for THIS role, each with:\n'
            '    "key": stable snake_case id (e.g. technical_depth, discovery, storytelling),\n'
            '    "label": short display name,\n'
            '    "why_it_matters": one sentence why this competency matters for this role\n'
            "  Tailor dimensions to the role (e.g. SE: technical, discovery, storytelling, "
            "partnership, business_acumen; IC engineer: system design, coding, collaboration).\n"
            '- "company_intel": object with:\n'
            '    "employee_size_band": string e.g. "200-500" or "10k+" or "unknown",\n'
            '    "market_position": one sentence (how they position in market),\n'
            '    "industry": string e.g. "E-commerce", "FinTech", "DevTools", "B2B SaaS",\n'
            '    "problem_they_solve": one sentence describing the core problem the company solves for customers,\n'
            '    "main_products": array of 2-4 { "name": string, "description": one sentence } -- key products/services,\n'
            '    "competitors": array of { "name": string, "one_liner": string, "domain": string (main website domain e.g. "stripe.com") } (3-5 items),\n'
            '    "data_quality_note": short disclaimer if web/snippets missing\n'
            '- "jd_fit": object with:\n'
            '    "aligned_strengths": bullets where resume matches JD,\n'
            '    "gaps_vs_jd": bullets where resume is weak vs JD requirements,\n'
            '    "risk_areas": bullets that could hurt in interview,\n'
            '    "missing_keywords": skills/terms in JD not evident on resume\n'
            + interviewer_focus_prompt
            + "\nReturn ONLY valid JSON."
        ),
        user=(
            f"Company: {state['company']}\n"
            f"Role: {state['role']}\n\n"
            f"Job Description:\n{state['job_description'][:12000]}"
            f"{interviewer_ctx}"
            f"{web_section}"
            f"{resume_section}"
        ),
    )
    logger.info(f"Analysis complete: {list(result.keys())}")
    return {"analysis": result}


# ── Node 3: Generate Questions ────────────────────────────────────────

def generate_questions(state: AgentState) -> dict:
    """Generate stage-specific interview questions.

    Uses the stage_context (either predefined or LLM-generated) and the
    analysis from the previous node to produce questions that feel
    authentic to the specific interview round. This is the key
    differentiator from generic "top 10 interview questions" lists.
    """
    stage = state.get("stage", "phone_screen")
    stage_ctx = state.get("stage_context", STAGE_CONTEXT.get(stage, "General interview"))
    analysis = state.get("analysis", {})
    logger.info(f"Generating questions for stage: {stage}")

    interviewers = state.get("interviewers", [])
    interviewer_ctx = _format_interviewers(interviewers) if interviewers else ""

    asked_by_field = ""
    named = [p.get("name", "") for p in interviewers if p.get("name")]
    if len(named) >= 2:
        asked_by_field = (
            '"likely_asked_by": "name of the interviewer most likely to ask this '
            f'(choose from: {", ".join(named)})", '
        )

    result = _llm_json(
        system=(
            "You are an expert interview coach. Generate realistic interview questions.\n\n"
            f"Interview Stage: {stage_ctx}\n\n"
            "Role Analysis:\n"
            f"- Key Skills: {json.dumps(analysis.get('key_skills', []))}\n"
            f"- What They Value: {json.dumps(analysis.get('what_they_value', []))}\n"
            f"- Role Focus: {analysis.get('role_focus', '')}\n\n"
            + (f"Interviewer Panel Context:{interviewer_ctx}\n"
               "IMPORTANT: Adjust question depth and technical specificity based on each "
               "interviewer's seniority and domain. A VP of Engineering or CTO conducting "
               "even an early-stage round will ask higher-level strategic and technical "
               "questions than a recruiter would. The interview stage sets the baseline "
               "topic areas; the interviewer's background shifts the depth and distribution.\n\n"
               if interviewer_ctx else "")
            + "Generate 8-10 likely interview questions. Return a JSON object with:\n"
            '"questions": [\n'
            '  {"question": "...", '
            '"category": "technical|behavioral|situational|general", '
            '"theme": "descriptive theme label, e.g. Technical Depth, Soft Skills & Communication, '
            "Leadership & Management, Problem Solving, Culture Fit & Motivation, "
            "Stakeholder Management, Strategic Thinking, Partnership & Collaboration, "
            'Domain Knowledge, Self-Awareness & Growth", '
            + asked_by_field
            + '"why_asked": "brief reason why they\'d ask this"}\n'
            "]\n\nReturn ONLY valid JSON."
        ),
        user=f"Company: {state['company']}\nRole: {state['role']}\nInterview Stage: {stage}",
    )
    questions = result.get("questions", [])
    logger.info(f"Generated {len(questions)} questions")
    return {"questions": questions, "current_q_index": 0}


# ── Node 4: Draft Answers (prep mode) ────────────────────────────────

def draft_answers(state: AgentState) -> dict:
    """Draft personalized answer frameworks for all questions.

    Only runs in prep mode. Uses the candidate's resume (if provided)
    to tailor examples and talking points. Each answer follows the
    STAR method where applicable, giving the user a structured
    framework rather than a scripted response.
    """
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
            "For each question, provide a comprehensive coaching breakdown.\n\n"
            "Return a JSON object with:\n"
            '"answers": [\n'
            "  {\n"
            '    "question": "the original question",\n'
            '    "answer_framework": "3-5 sentence structured answer using STAR method where applicable",\n'
            '    "key_points": ["point 1", "point 2", "point 3"],\n'
            '    "example_to_use": "specific example from resume/background to mention",\n'
            '    "avoid": "what not to say",\n'
            '    "timing_guidance": "recommended answer length and pacing, e.g. 60-90 seconds, keep concise",\n'
            '    "red_flags": ["specific thing that would hurt the candidate", "another red flag"],\n'
            '    "response_strategy": "approach advice, e.g. Lead with metrics, then explain the process"\n'
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
    """Present the next interview question as a realistic interviewer.

    The LLM adopts the interviewer persona -- professional, conversational,
    and stage-appropriate. It doesn't reveal that it's AI or that this is
    practice. This creates an immersive mock interview experience.
    """
    questions = state.get("questions", [])
    idx = state.get("current_q_index", 0)

    if idx >= len(questions):
        return {"session_complete": True}

    q = questions[idx]

    interviewers = state.get("interviewers", [])
    persona = "a professional interviewer"
    asker = q.get("likely_asked_by", "")
    if asker:
        match = next((p for p in interviewers if p.get("name") == asker), None)
        if match and match.get("title"):
            persona = f"{asker}, {match['title']},"
        else:
            persona = f"{asker},"
    elif len(interviewers) == 1:
        p = interviewers[0]
        name = p.get("name", "")
        title = p.get("title", "")
        if name:
            persona = f"{name}, {title}," if title else f"{name},"

    llm = _llm()
    resp = llm.invoke([
        SystemMessage(content=(
            f"You are {persona} conducting a real interview at {state['company']}. "
            "Present the following question naturally, as if you were sitting across "
            "from the candidate. Be conversational but professional. "
            "Adapt your tone and depth to your role — a VP asks differently than a recruiter. "
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

def _merge_competency_running(
    prev: dict | None,
    competency_scores: dict,
    dimension_keys: list[str],
) -> dict:
    """Accumulate running sum/count per competency key for session averages."""
    out = dict(prev) if prev else {}
    for k in dimension_keys:
        if k not in competency_scores:
            continue
        raw = competency_scores[k]
        try:
            sc = int(float(raw))
        except (TypeError, ValueError):
            continue
        sc = max(1, min(10, sc))
        cur = out.get(k) or {"sum": 0.0, "count": 0}
        out[k] = {
            "sum": float(cur["sum"]) + sc,
            "count": int(cur["count"]) + 1,
        }
    return out


def evaluate_answer(state: AgentState) -> dict:
    """Score the user's answer and provide actionable coaching feedback.

    This is the human-in-the-loop node: LangGraph pauses BEFORE this node
    (via interrupt_before=["evaluate"]) to wait for user input. When the
    user submits their answer, the graph resumes and this node runs.

    The evaluation considers the role context, key skills, and what the
    company values -- not just whether the answer is "good" in isolation.
    """
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

    dims = analysis.get("scorecard_dimensions") or []
    dim_keys = [d.get("key") for d in dims if isinstance(d, dict) and d.get("key")]
    dim_summary = json.dumps(
        [{"key": d.get("key"), "label": d.get("label", d.get("key"))} for d in dims if d.get("key")]
    )

    competency_block = ""
    if dim_keys:
        competency_block = (
            f"\nScorecard dimensions for this role: {dim_summary}\n"
            'Also return "competency_scores": JSON object mapping EACH listed "key" '
            "to an integer 1-10 scoring ONLY this answer on that dimension.\n"
        )

    result = _llm_json(
        system=(
            "You are an expert interview coach evaluating a candidate's answer.\n\n"
            f"Role: {state['role']} at {state['company']}\n"
            f"Key Skills: {json.dumps(analysis.get('key_skills', []))}\n"
            f"What They Value: {json.dumps(analysis.get('what_they_value', []))}\n"
            f"Question theme/category: {q.get('theme', '')} / {q.get('category', '')}\n"
            + competency_block
            + "\nEvaluate the answer and return a JSON object with:\n"
            '- "score": integer 1-10 overall\n'
            '- "strengths": list of 2-3 things done well\n'
            '- "improvements": list of 2-3 specific improvements\n'
            '- "improved_answer": a stronger version of their answer (3-5 sentences)\n'
            '- "tip": one actionable tip for next time\n'
            + ('- "competency_scores": object as described above\n' if dim_keys else "")
            + "\nReturn ONLY valid JSON."
        ),
        user=(
            f"Question: {q.get('question', '')}\n"
            f"Why this is asked: {q.get('why_asked', '')}\n\n"
            f"Candidate's answer: {last_user_msg['content']}"
        ),
    )

    comp_raw = result.get("competency_scores") if isinstance(result.get("competency_scores"), dict) else {}
    running = _merge_competency_running(
        state.get("running_competency_scores"),
        comp_raw,
        dim_keys,
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
    if comp_raw:
        feedback_entry["competency_scores"] = comp_raw

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
        "running_competency_scores": running,
    }


# ── Node 7: Session Summary ──────────────────────────────────────────

def session_summary(state: AgentState) -> dict:
    """Synthesize all per-question feedback into a readiness scorecard.

    This final node aggregates individual scores, strengths, and
    improvement areas into a holistic assessment. The readiness_level
    ("ready", "almost there", "needs work", "not ready") gives the
    user a clear signal of their preparation status.
    """
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

    analysis = state.get("analysis", {})
    key_skills = analysis.get("key_skills", [])
    dims = analysis.get("scorecard_dimensions") or []
    dim_labels = [
        f"{d.get('key')}: {d.get('label', d.get('key'))}"
        for d in dims
        if isinstance(d, dict) and d.get("key")
    ]

    running = state.get("running_competency_scores") or {}
    running_avgs: dict[str, float] = {}
    for k, v in running.items():
        if isinstance(v, dict) and v.get("count"):
            running_avgs[k] = round(float(v["sum"]) / int(v["count"]), 1)

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
            '- "skills_breakdown": array of objects, each with:\n'
            '    "skill": use the human-readable label matching scorecard dimensions when provided,\n'
            '    "score": integer 1-10,\n'
            '    "note": one sentence explaining this rating\n'
            "  Cover each scorecard dimension when dimension list is provided; otherwise 5-7 role-relevant skills. "
            "Honor running session averages when provided unless narrative strongly conflicts.\n"
            "\nReturn ONLY valid JSON."
        ),
        user=(
            f"Role: {state['role']} at {state['company']}\n"
            f"Stage: {state['stage']}\n"
            f"Key skills for this role: {json.dumps(key_skills)}\n"
            f"Scorecard dimensions: {json.dumps(dim_labels)}\n"
            f"Running competency averages (this session): {json.dumps(running_avgs)}\n"
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
    """Conditional edge: route to prep (draft answers) or roleplay (interactive)."""
    return "roleplay" if state.get("mode") == "roleplay" else "prep"


def check_continue(state: AgentState) -> str:
    """Conditional edge: continue to the next question or finish the session."""
    questions = state.get("questions", [])
    idx = state.get("current_q_index", 0)
    if idx >= len(questions) or state.get("session_complete"):
        return "done"
    return "continue"
