from __future__ import annotations

from typing import TypedDict
from langgraph.graph import add_messages


class AgentState(TypedDict):
    company: str
    role: str
    job_description: str
    stage: str
    resume: str

    analysis: dict
    questions: list
    answers: list

    mode: str
    chat_history: list
    current_q_index: int
    feedback: list
    summary: dict
    session_complete: bool
