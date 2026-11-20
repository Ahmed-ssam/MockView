"""API response models. Hidden grading data (reference_elements, scores) is deliberately absent."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class AnswerIn(BaseModel):
    text: str = Field("", max_length=6000)
    skipped: bool = False
    source: Literal["text", "voice"] = "text"


class QuestionOut(BaseModel):
    id: str  # "intro" for the warm-up introduction
    position: int  # 0 for the introduction, 1..10 for main questions (follow-ups share their parent's)
    text: str
    is_followup: bool
    kind: Literal["intro", "main", "followup"] = "main"


class MessageOut(BaseModel):
    role: Literal["interviewer", "candidate"]
    text: str
    question_id: str | None = None


class Progress(BaseModel):
    answered_main: int
    total_main: int = 10
    current_position: int | None


class InterviewerOut(BaseModel):
    role_title: str
    avatar_url: str
    personality: str
    voice_gender: str = "male"


class InterviewView(BaseModel):
    id: str
    status: str
    demo_mode: bool
    specialization_slug: str
    specialization_name: str
    level: str
    difficulty: str
    language: str
    duration_min: int | None
    mode: Literal["text", "voice", "both"]
    interviewer: InterviewerOut
    progress: Progress
    current_question: QuestionOut | None
    messages: list[MessageOut]
    ready_to_finish: bool
    started_at: datetime


class AnswerResult(BaseModel):
    interviewer_message: str
    next_question: QuestionOut | None
    progress: Progress
    ready_to_finish: bool
    demo_mode: bool
