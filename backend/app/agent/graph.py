"""LangGraph state machine definition for the InterviewIntel agent.

Checkpointer selection:
- If DATABASE_URL is set, uses PostgresSaver (sessions survive restarts).
- Otherwise, falls back to MemorySaver (local dev, ephemeral).
"""
import logging
import os

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

from app.agent.state import AgentState
from app.agent.nodes import (
    parse_job_posting,
    analyze_role,
    generate_questions,
    draft_answers,
    roleplay_ask,
    evaluate_answer,
    session_summary,
    route_by_mode,
    check_continue,
)
from app.config import settings

logger = logging.getLogger(__name__)


def build_graph() -> StateGraph:
    """Build the LangGraph state machine for the InterviewIntel agent."""
    graph = StateGraph(AgentState)

    graph.add_node("parse", parse_job_posting)
    graph.add_node("analyze", analyze_role)
    graph.add_node("generate", generate_questions)
    graph.add_node("draft", draft_answers)
    graph.add_node("roleplay_ask", roleplay_ask)
    graph.add_node("evaluate", evaluate_answer)
    graph.add_node("summary", session_summary)

    graph.add_edge(START, "parse")
    graph.add_edge("parse", "analyze")
    graph.add_edge("analyze", "generate")
    graph.add_conditional_edges(
        "generate",
        route_by_mode,
        {"prep": "draft", "roleplay": "roleplay_ask"},
    )
    graph.add_edge("draft", "summary")
    graph.add_edge("summary", END)

    graph.add_edge("roleplay_ask", "evaluate")
    graph.add_conditional_edges(
        "evaluate",
        check_continue,
        {"continue": "roleplay_ask", "done": "summary"},
    )

    return graph

    
def _make_checkpointer():
    """Make the checkpointer for the LangGraph state machine."""
    if settings.use_postgres:
        # Try to use the PostgresSaver.
        try:
            # Import the PostgresSaver.
            from langgraph.checkpoint.postgres import PostgresSaver
            # Import the psycopg library.
            import psycopg

            # Set up the connection to the Postgres database.
            setup_conn = psycopg.connect(settings.database_url, autocommit=True)
            PostgresSaver(setup_conn).setup()
            setup_conn.close()

            conn = psycopg.connect(settings.database_url)
            cp = PostgresSaver(conn)
            logger.info("Using PostgresSaver (Postgres)")
            return cp
        except Exception as e:
            # If the PostgresSaver fails, fall back to the MemorySaver.
            raw = (
                settings.langgraph_memory_fallback
                or os.environ.get("LANGGRAPH_MEMORY_FALLBACK", "")
            )
            # If the MemorySaver is allowed, return it.
            allow = raw.strip().lower() in ("1", "true", "yes")
            if allow:
                logger.warning(
                    "Postgres checkpointer unavailable (%s); LANGGRAPH_MEMORY_FALLBACK is set — "
                    "using MemorySaver (ephemeral; not for production).",
                    e,
                )
                return MemorySaver()
            # If the MemorySaver is not allowed, raise an exception.
            logger.exception(
                "DATABASE_URL is set but Postgres checkpointer failed; refusing to fall back "
                "to MemorySaver in production. Fix the connection string or unset DATABASE_URL "
                "for local-only in-memory mode. Optional dev override: LANGGRAPH_MEMORY_FALLBACK=1"
            )
            raise

    # If the PostgresSaver is not allowed, use the MemorySaver.
    logger.info("Using MemorySaver (ephemeral)")
    return MemorySaver()


# Create the checkpointer for the LangGraph state machine.
checkpointer = _make_checkpointer()

# Compile the LangGraph state machine.
agent = build_graph().compile(
    # Set the checkpointer.
    checkpointer=checkpointer,
    # Set the interrupt before the evaluate node.
    interrupt_before=["evaluate"],
    # Set the interrupt after the evaluate node.
    interrupt_after=["evaluate"],
)
