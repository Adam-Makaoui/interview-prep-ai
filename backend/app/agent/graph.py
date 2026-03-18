"""LangGraph state machine definition for the interview prep agent.

The graph has 7 nodes connected by explicit edges and two conditional
routing points. This is fundamentally different from a simple ReAct agent
loop (think -> act -> observe) because:

1. The flow is a DAG with branches, not a flat loop
2. Human-in-the-loop is built in via interrupt_before
3. Each node has a single responsibility and deterministic output
4. State is checkpointed after every node, enabling session resumability

The two conditional edges are:
- route_by_mode: after question generation, routes to either "draft answers"
  (prep mode) or "roleplay_ask" (interactive practice)
- check_continue: after evaluating a role-play answer, either loops back
  for the next question or exits to the summary node
"""
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


def build_graph() -> StateGraph:
    """Construct the 7-node interview prep state machine.

    Graph topology:
        START -> parse -> analyze -> generate --(mode?)--> draft -> summary -> END
                                                    |                          ^
                                                    +--> roleplay_ask          |
                                                           |                   |
                                                         evaluate --(done?)----+
                                                           |
                                                           +-- (continue) --> roleplay_ask
    """
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


checkpointer = MemorySaver()

# Two interrupt points create the roleplay feedback loop:
# 1. interrupt_before=["evaluate"] -- pauses so the user can type their answer
# 2. interrupt_after=["evaluate"]  -- pauses so the user can READ their feedback
#    before the next question loads. A separate /continue call advances.
agent = build_graph().compile(
    checkpointer=checkpointer,
    interrupt_before=["evaluate"],
    interrupt_after=["evaluate"],
)
