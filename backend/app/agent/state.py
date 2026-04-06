"""LangGraph agent state definition.

AgentState is a TypedDict that flows through every node in the graph.
LangGraph persists this state via its checkpointer between invocations,
enabling session resumability and human-in-the-loop patterns.

Design decision: we use a flat TypedDict rather than nested Pydantic models
because LangGraph's state merging works best with simple dict-like structures.
Each node returns a partial dict of only the fields it modifies.
"""
from __future__ import annotations

from typing import NotRequired, TypedDict


class AgentState(TypedDict):
    # -- Input fields (provided by user at session creation) --
    company: str
    role: str
    job_description: str
    job_url: str
    stage: str                # e.g. "phone_screen", "technical", or custom
    stage_context: str        # human-readable description of what this stage evaluates
    resume: str
    interviewers: list        # list of {"name": str, "title": str} dicts
    llm_model: NotRequired[str]  # OpenAI model id for this session (from user preference)

    # -- Computed fields (populated by agent nodes) --
    analysis: dict            # output of analyze_role node
    questions: list           # output of generate_questions node
    answers: list             # output of draft_answers node (prep mode only)

    # -- Role-play state --
    mode: str                 # "prep" or "roleplay"
    chat_history: list        # conversation messages in role-play
    current_q_index: int      # tracks which question we're on
    feedback: list            # per-question evaluation results
    running_competency_scores: dict  # per-dimension {key: {"sum": float, "count": int}}
    summary: dict             # final session scorecard
    session_complete: bool
