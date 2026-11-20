"""Validated shapes for every structured LLM output used by the interview engine."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Verdict = Literal["correct", "partial", "incomplete", "incorrect", "unsupported", "no_answer"]
Score = Field(ge=0, le=100)


class PlannedQuestion(BaseModel):
    position: int = Field(ge=1, le=10)
    text: str = Field(min_length=15, max_length=600)
    # Hidden reference points for grading. A reference, not an exact-match answer key.
    reference_elements: list[str] = Field(min_length=2, max_length=8)


class QuestionPlan(BaseModel):
    questions: list[PlannedQuestion]

    @model_validator(mode="after")
    def _exactly_ten(self) -> "QuestionPlan":
        if sorted(q.position for q in self.questions) != list(range(1, 11)):
            raise ValueError("plan must contain exactly 10 questions at positions 1..10")
        return self


class EvalBody(BaseModel):
    correctness: int = Score
    completeness: int = Score
    depth: int = Score
    relevance: int = Score
    clarity: int = Score
    verdict: Verdict
    did_well: list[str] = Field(default_factory=list, max_length=6)
    missing: list[str] = Field(default_factory=list, max_length=8)
    incorrect_statements: list[str] = Field(default_factory=list, max_length=6)
    explanation: str = Field("", max_length=1500)
    expected_elements: list[str] = Field(default_factory=list, max_length=8)
    improved_answer: str = Field("", max_length=2500)
    tip: str = Field("", max_length=600)


class FollowUp(BaseModel):
    needed: bool = False
    question: str | None = Field(None, max_length=400)

    @field_validator("question")
    @classmethod
    def _blank(cls, v: str | None) -> str | None:
        return (v or "").strip() or None


class IntroReply(BaseModel):
    """The interviewer's spoken reaction to the candidate's self-introduction."""
    reply: str = Field(min_length=5, max_length=500)


class AnswerTurn(BaseModel):
    """One combined call per answer: evaluation + follow-up decision + short interviewer reply."""
    evaluation: EvalBody
    followup: FollowUp = Field(default_factory=FollowUp)
    reply: str = Field("", max_length=600)


class CoachSummary(BaseModel):
    """Short narrative written after the deterministic scores are final. It may not change any number."""
    summary: str = Field(min_length=20, max_length=1500)
