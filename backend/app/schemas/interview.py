"""Validated interview configuration (the contract for POST /interviews)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.interviewers.data import AVATARS, EXPERIENCE_LEVELS, PERSONALITIES
from app.specializations.catalog import get_specialization

Level = Literal["intern", "junior", "mid", "senior", "lead"]
Difficulty = Literal["easy", "medium", "hard", "adaptive"]
Language = Literal["en", "ar"]
Mode = Literal["text", "voice", "both"]
ALLOWED_DURATIONS = (15, 30, 45, 60)


class InterviewConfig(BaseModel):
    specialization_slug: str
    level: Level
    difficulty: Difficulty = "adaptive"
    language: Language = "en"
    mode: Mode = "text"
    duration_min: int = 30
    personality: str = "professional"
    interviewer_experience: str = "experienced"
    avatar_id: str = "alex"
    target_job_title: str | None = Field(None, max_length=120)
    job_description: str | None = Field(None, max_length=8000)
    custom_instructions: str | None = Field(None, max_length=1000)
    resume_id: str | None = Field(None, max_length=36)

    @field_validator("target_job_title", "job_description", "custom_instructions", "resume_id")
    @classmethod
    def _blank_to_none(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        return v or None

    @model_validator(mode="after")
    def _check_refs(self) -> "InterviewConfig":
        if get_specialization(self.specialization_slug) is None:
            raise ValueError("unknown specialization")
        if self.personality not in PERSONALITIES:
            raise ValueError("unknown personality")
        if self.interviewer_experience not in EXPERIENCE_LEVELS:
            raise ValueError("unknown interviewer experience")
        if self.avatar_id not in {a.id for a in AVATARS}:
            raise ValueError("unknown avatar")
        if self.duration_min not in ALLOWED_DURATIONS:
            raise ValueError(f"duration must be one of {ALLOWED_DURATIONS}")
        return self
