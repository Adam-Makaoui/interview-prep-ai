"""
AI Agent module for Interview Prep Coach.

Uses OpenAI to analyze roles, generate interview questions,
and draft personalized answers based on the candidate's resume.

In production, these calls would route through Dapr's Conversation API
(DaprChatClient) for provider-agnostic LLM access, built-in retries,
and observability via Catalyst.
"""

import os
import json
import logging

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def _get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    return OpenAI(api_key=api_key)


def analyze_role_ai(company: str, role: str, job_description: str) -> dict:
    """Analyze a job role and company from the job description."""
    client = _get_client()
    logger.info(f"Analyzing role: {role} at {company}")

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert career analyst and interview coach. "
                    "Analyze the job description and return a JSON object with:\n"
                    '- "key_skills": list of 5-8 most important skills/qualifications\n'
                    '- "culture_signals": list of 3-5 company culture indicators\n'
                    '- "what_they_value": list of 3-5 things the company values\n'
                    '- "role_focus": 2-3 sentence summary of what this role is really about\n'
                    '- "interview_tips": list of 3-5 specific tips for this role\n'
                    "\nReturn ONLY valid JSON."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Company: {company}\n"
                    f"Role: {role}\n\n"
                    f"Job Description:\n{job_description}"
                ),
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    result = json.loads(response.choices[0].message.content)
    logger.info(f"Analysis complete with keys: {list(result.keys())}")
    return result


def generate_questions_ai(
    company: str, role: str, stage: str, analysis: dict
) -> list:
    """Generate likely interview questions tailored to the role and stage."""
    client = _get_client()
    logger.info(f"Generating questions for {stage} stage")

    stage_context = {
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

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert interview coach. Generate realistic interview questions.\n\n"
                    f"Interview Stage: {stage_context.get(stage, 'General interview')}\n\n"
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
            },
            {
                "role": "user",
                "content": (
                    f"Company: {company}\nRole: {role}\nInterview Stage: {stage}"
                ),
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
    )

    result = json.loads(response.choices[0].message.content)
    questions = result.get("questions", [])
    logger.info(f"Generated {len(questions)} questions")
    return questions


def draft_answers_ai(
    questions: list,
    resume: str,
    analysis: dict,
    company: str,
    role: str,
) -> list:
    """Draft personalized answer frameworks using the candidate's resume."""
    client = _get_client()
    logger.info("Drafting personalized answers")

    questions_text = "\n".join(
        [f"{i + 1}. {q['question']}" for i, q in enumerate(questions)]
    )

    resume_section = (
        f"\n\nCandidate's Resume/Background:\n{resume}"
        if resume
        else "\n\n(No resume provided -- give general answer frameworks)"
    )

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an expert interview coach. Draft personalized answer "
                    "frameworks for each interview question.\n\n"
                    f"Role: {role} at {company}\n"
                    f"Key Skills They Want: {json.dumps(analysis.get('key_skills', []))}\n"
                    f"What They Value: {json.dumps(analysis.get('what_they_value', []))}"
                    f"{resume_section}\n\n"
                    "For each question, provide:\n"
                    "- A structured answer framework (use STAR method where applicable)\n"
                    "- Key points to hit in your answer\n"
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
            },
            {
                "role": "user",
                "content": f"Draft answers for these questions:\n{questions_text}",
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.7,
        max_tokens=4000,
    )

    result = json.loads(response.choices[0].message.content)
    answers = result.get("answers", [])
    logger.info(f"Drafted {len(answers)} answers")
    return answers
