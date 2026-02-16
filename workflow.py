"""
Dapr Workflow definition for Interview Prep Coach.

Orchestrates a multi-step pipeline:
  1. Analyze the role (AI)
  2. Generate tailored interview questions (AI)
  3. Draft personalized answers using resume (AI)

Each step is a durable activity -- if the process crashes mid-step,
Dapr Workflow resumes from the last completed checkpoint.
"""

import json
import logging

import dapr.ext.workflow as wf
from dapr.clients import DaprClient

from agent import analyze_role_ai, generate_questions_ai, draft_answers_ai

logger = logging.getLogger(__name__)

STORE_NAME = "statestore"

wfr = wf.WorkflowRuntime()


def _update_interview_state(interview_id: str, updates: dict):
    """Helper to read-modify-write an interview in the Dapr state store."""
    with DaprClient() as client:
        state = client.get_state(STORE_NAME, f"interview:{interview_id}")
        if state.data:
            interview = json.loads(state.data.decode())
            interview.update(updates)
            client.save_state(
                STORE_NAME,
                f"interview:{interview_id}",
                json.dumps(interview),
            )
            logger.info(
                f"Updated interview {interview_id}: "
                f"{list(updates.keys())}"
            )


# ─── Workflow Definition ──────────────────────────────────────────────


@wfr.workflow(name="interview_prep_workflow")
def interview_prep_workflow(ctx: wf.DaprWorkflowContext, input_data: dict):
    """
    Orchestrate the full interview preparation pipeline.

    This workflow is durable: each yield point is a checkpoint.
    If the process crashes, it resumes from the last completed step.
    """
    interview_id = input_data["id"]

    # Step 1: Mark as analyzing
    yield ctx.call_activity(
        update_status_activity,
        input={"id": interview_id, "status": "analyzing"},
    )

    # Step 2: AI analyzes the role
    analysis = yield ctx.call_activity(
        analyze_role_activity,
        input={
            "company": input_data["company"],
            "role": input_data["role"],
            "job_description": input_data["job_description"],
        },
    )

    # Step 3: Save analysis, move to question generation
    yield ctx.call_activity(
        save_progress_activity,
        input={
            "id": interview_id,
            "updates": {
                "analysis": analysis,
                "status": "generating_questions",
            },
        },
    )

    # Step 4: AI generates interview questions
    questions = yield ctx.call_activity(
        generate_questions_activity,
        input={
            "company": input_data["company"],
            "role": input_data["role"],
            "stage": input_data["stage"],
            "analysis": analysis,
        },
    )

    # Step 5: Save questions, move to answer drafting
    yield ctx.call_activity(
        save_progress_activity,
        input={
            "id": interview_id,
            "updates": {
                "questions": questions,
                "status": "drafting_answers",
            },
        },
    )

    # Step 6: AI drafts personalized answers
    answers = yield ctx.call_activity(
        draft_answers_activity,
        input={
            "questions": questions,
            "resume": input_data.get("resume", ""),
            "analysis": analysis,
            "company": input_data["company"],
            "role": input_data["role"],
        },
    )

    # Step 7: Save answers, mark complete
    yield ctx.call_activity(
        save_progress_activity,
        input={
            "id": interview_id,
            "updates": {
                "answers": answers,
                "status": "complete",
            },
        },
    )

    return {"status": "complete", "interview_id": interview_id}


# ─── Activity Definitions ─────────────────────────────────────────────


@wfr.activity(name="update_status_activity")
def update_status_activity(ctx, input_data: dict):
    """Update the interview status in the state store."""
    _update_interview_state(input_data["id"], {"status": input_data["status"]})
    return {"status": input_data["status"]}


@wfr.activity(name="save_progress_activity")
def save_progress_activity(ctx, input_data: dict):
    """Save intermediate workflow progress to the state store."""
    _update_interview_state(input_data["id"], input_data["updates"])
    return {"saved": list(input_data["updates"].keys())}


@wfr.activity(name="analyze_role_activity")
def analyze_role_activity(ctx, input_data: dict):
    """Call the AI agent to analyze the role and company."""
    logger.info(
        f"[Activity] Analyzing: {input_data['role']} at {input_data['company']}"
    )
    return analyze_role_ai(
        company=input_data["company"],
        role=input_data["role"],
        job_description=input_data["job_description"],
    )


@wfr.activity(name="generate_questions_activity")
def generate_questions_activity(ctx, input_data: dict):
    """Call the AI agent to generate interview questions."""
    logger.info(f"[Activity] Generating questions for stage: {input_data['stage']}")
    return generate_questions_ai(
        company=input_data["company"],
        role=input_data["role"],
        stage=input_data["stage"],
        analysis=input_data["analysis"],
    )


@wfr.activity(name="draft_answers_activity")
def draft_answers_activity(ctx, input_data: dict):
    """Call the AI agent to draft personalized answers."""
    logger.info("[Activity] Drafting personalized answers")
    return draft_answers_ai(
        questions=input_data["questions"],
        resume=input_data.get("resume", ""),
        analysis=input_data["analysis"],
        company=input_data.get("company", ""),
        role=input_data.get("role", ""),
    )
