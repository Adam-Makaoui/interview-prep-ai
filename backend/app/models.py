from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    company: str
    role: str
    job_description: str
    stage: str = Field(
        pattern="^(phone_screen|technical|behavioral|final_panel)$"
    )
    resume: str = ""
    mode: str = Field(default="prep", pattern="^(prep|roleplay)$")


class AnswerSubmit(BaseModel):
    answer: str


class QuestionOut(BaseModel):
    question: str
    category: str
    why_asked: str


class FeedbackOut(BaseModel):
    question: str
    user_answer: str
    score: int
    feedback: str
    improved_answer: str


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
