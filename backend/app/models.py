"""Pydantic models for API request/response validation.

These models define the contract between the React frontend and the FastAPI
backend. SessionCreate is intentionally permissive (most fields optional)
so the LLM-powered parse node can fill in gaps from the job description.
"""
from pydantic import BaseModel, Field, model_validator

from app.resume_store import MAX_SLOTS, MAX_TEXT_LEN


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
    resume: str = Field(default="", max_length=MAX_TEXT_LEN)


class ResumeSlot(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    label: str = Field(default="", max_length=120)
    text: str = Field(default="", max_length=MAX_TEXT_LEN)


class PutResumesRequest(BaseModel):
    default_id: str = Field(min_length=1, max_length=80)
    items: list[ResumeSlot] = Field(min_length=1, max_length=MAX_SLOTS)

    @model_validator(mode="after")
    def _validate_ids(self) -> "PutResumesRequest":
        ids = [s.id for s in self.items]
        if len(set(ids)) != len(ids):
            raise ValueError("Resume slot ids must be unique")
        if self.default_id not in ids:
            raise ValueError("default_id must match a resume slot id")
        return self


class SavedResumesResponse(BaseModel):
    default_id: str
    items: list[ResumeSlot]


class LlmModelUpdate(BaseModel):
    llm_model: str = Field(min_length=1, max_length=80)


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
