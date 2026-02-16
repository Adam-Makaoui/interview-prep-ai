"""
Interview Prep Coach -- Main Application

A FastAPI web app that uses Dapr APIs to orchestrate AI-powered
interview preparation:
  - State Management: persist interviews, prep materials, index
  - Pub/Sub: event-driven workflow triggering
  - Workflow: durable multi-step prep pipeline
  - AI (OpenAI): role analysis, question generation, answer drafting
"""

import json
import uuid
import logging
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from dapr.ext.fastapi import DaprApp
from dapr.clients import DaprClient
import dapr.ext.workflow as wf
from dotenv import load_dotenv

load_dotenv()

from workflow import wfr, interview_prep_workflow  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

STORE_NAME = "statestore"
PUBSUB_NAME = "pubsub"
TOPIC_NEW_INTERVIEW = "new-interview"


# ─── Lifespan: start/stop Dapr Workflow runtime ──────────────────────


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    wfr.start()
    logger.info("Dapr Workflow runtime started")
    yield
    wfr.shutdown()
    logger.info("Dapr Workflow runtime shut down")


app = FastAPI(title="Interview Prep Coach", lifespan=lifespan)
dapr_app = DaprApp(app)
templates = Jinja2Templates(directory="templates")


# ─── State Management Helpers ─────────────────────────────────────────


def save_interview(interview: dict):
    """Save an interview to Dapr state store and maintain the index."""
    with DaprClient() as client:
        # Save the interview record
        client.save_state(
            STORE_NAME,
            f"interview:{interview['id']}",
            json.dumps(interview),
        )
        # Maintain an index of all interview IDs for listing
        index_state = client.get_state(STORE_NAME, "interview_index")
        ids = json.loads(index_state.data.decode()) if index_state.data else []
        if interview["id"] not in ids:
            ids.append(interview["id"])
            client.save_state(STORE_NAME, "interview_index", json.dumps(ids))


def get_interview(interview_id: str) -> dict | None:
    """Retrieve a single interview from Dapr state store."""
    with DaprClient() as client:
        state = client.get_state(STORE_NAME, f"interview:{interview_id}")
        if state.data:
            return json.loads(state.data.decode())
    return None


def get_all_interviews() -> list:
    """Retrieve all interviews, sorted by creation date (newest first)."""
    with DaprClient() as client:
        index_state = client.get_state(STORE_NAME, "interview_index")
        if not index_state.data:
            return []
        ids = json.loads(index_state.data.decode())
        interviews = []
        for iid in ids:
            state = client.get_state(STORE_NAME, f"interview:{iid}")
            if state.data:
                interviews.append(json.loads(state.data.decode()))
        interviews.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return interviews


# ─── Web UI Routes ────────────────────────────────────────────────────


@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    """Dashboard: list all interview preps."""
    interviews = get_all_interviews()
    return templates.TemplateResponse(
        "index.html", {"request": request, "interviews": interviews}
    )


@app.get("/submit", response_class=HTMLResponse)
async def submit_form(request: Request):
    """Form to submit a new interview for preparation."""
    return templates.TemplateResponse("submit.html", {"request": request})


@app.post("/interviews")
async def create_interview(
    company: str = Form(...),
    role: str = Form(...),
    job_description: str = Form(...),
    stage: str = Form(...),
    interview_date: str = Form(""),
    notes: str = Form(""),
    resume: str = Form(""),
):
    """Create a new interview record and publish an event to trigger the workflow."""
    interview_id = str(uuid.uuid4())[:8]
    interview = {
        "id": interview_id,
        "company": company,
        "role": role,
        "job_description": job_description,
        "stage": stage,
        "interview_date": interview_date,
        "notes": notes,
        "resume": resume,
        "status": "submitted",
        "created_at": datetime.now().isoformat(),
        "analysis": None,
        "questions": None,
        "answers": None,
        "workflow_id": None,
    }

    # Dapr State Management: persist the interview
    save_interview(interview)
    logger.info(f"Created interview {interview_id}: {role} at {company}")

    # Dapr Pub/Sub: publish event to trigger the prep workflow
    with DaprClient() as client:
        client.publish_event(
            pubsub_name=PUBSUB_NAME,
            topic_name=TOPIC_NEW_INTERVIEW,
            data=json.dumps(interview),
            data_content_type="application/json",
        )
    logger.info(f"Published '{TOPIC_NEW_INTERVIEW}' event for {interview_id}")

    return RedirectResponse(url=f"/interviews/{interview_id}", status_code=303)


@app.get("/interviews/{interview_id}", response_class=HTMLResponse)
async def interview_detail(request: Request, interview_id: str):
    """Detail page: view prep materials for a specific interview."""
    interview = get_interview(interview_id)
    if not interview:
        return HTMLResponse("<h1>Interview not found</h1>", status_code=404)
    return templates.TemplateResponse(
        "detail.html", {"request": request, "interview": interview}
    )


# ─── API Endpoint (for polling status) ────────────────────────────────


@app.get("/api/interviews/{interview_id}")
async def interview_api(interview_id: str):
    """JSON API for polling interview status from the frontend."""
    interview = get_interview(interview_id)
    if not interview:
        return JSONResponse({"error": "not found"}, status_code=404)
    return JSONResponse(interview)


# ─── Dapr Pub/Sub Subscription ────────────────────────────────────────


@dapr_app.subscribe(pubsub=PUBSUB_NAME, topic=TOPIC_NEW_INTERVIEW)
async def handle_new_interview(event_data: dict):
    """
    Pub/Sub handler: triggered when a 'new-interview' event arrives.
    Starts the Dapr Workflow to prepare interview materials.
    """
    # Extract interview data from CloudEvent
    data = event_data.get("data", event_data)
    if isinstance(data, str):
        data = json.loads(data)

    interview_id = data.get("id")
    if not interview_id:
        logger.error("Received event without interview ID")
        return {"status": "error"}

    logger.info(f"Pub/Sub received 'new-interview' for {interview_id}")

    # Dapr Workflow: schedule the prep workflow
    wf_client = wf.DaprWorkflowClient()
    instance_id = wf_client.schedule_new_workflow(
        workflow=interview_prep_workflow,
        input=data,
    )
    logger.info(f"Started workflow {instance_id} for interview {interview_id}")

    # Update the interview record with the workflow instance ID
    interview = get_interview(interview_id)
    if interview:
        interview["workflow_id"] = instance_id
        interview["status"] = "processing"
        save_interview(interview)

    return {"status": "ok"}


# ─── Entrypoint ───────────────────────────────────────────────────────


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
