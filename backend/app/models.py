"""Pydantic models for API request/response validation.

These models define the contract between the React frontend and the FastAPI
backend. SessionCreate is intentionally permissive (most fields optional)
so the LLM-powered parse node can fill in gaps from the job description.
"""
from pydantic import BaseModel, Field


class InterviewerInfo(BaseModel):
    name: str = ""
    title: str = ""


class SessionCreate(BaseModel):
    company: str = ""
    role: str = ""
    job_description: str = ""
    job_url: str = ""
    stage: str = "phone_screen"
    resume: str = ""
    mode: str = Field(default="prep", pattern="^(prep|roleplay)$")
    interviewers: list[InterviewerInfo] = []
    pipeline_group: str = Field(
        default="",
        description="Optional dashboard group label; defaults to normalized company name.",
    )


class AnswerSubmit(BaseModel):
    answer: str


class ResumeProfile(BaseModel):
    resume: str


class SessionOut(BaseModel):
    session_id: str
    company: str
    role: str
    stage: str
    mode: str
    status: str
    analysis: dict | None = None
    questions: list | None = None
    answers: list | None = None
    current_question: dict | None = None
    feedback: list | None = None
    summary: dict | None = None
    chat_history: list | None = None
    created_at: str = ""
    pipeline_group: str = ""
    running_competency_scores: dict | None = None
    skill_averages: dict | None = None
