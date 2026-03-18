from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    company: str = ""
    role: str = ""
    job_description: str = ""
    job_url: str = ""
    stage: str = Field(
        default="phone_screen",
        pattern="^(phone_screen|technical|behavioral|final_panel)$",
    )
    resume: str = ""
    mode: str = Field(default="prep", pattern="^(prep|roleplay)$")
    interviewer_name: str = ""
    interviewer_title: str = ""


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
