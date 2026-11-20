"""SQLAlchemy models. Portable types (JSON, String uuid) so tests run on SQLite
and production runs on PostgreSQL."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import false as sa_false
from sqlalchemy import text as sa_text
from sqlalchemy import (
    JSON, Boolean, CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String, Text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class UserProfile(Base):
    __tablename__ = "user_profiles"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # = Supabase auth uid
    display_name: Mapped[str | None] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(10), default="user")
    preferred_language: Mapped[str] = mapped_column(String(5), default="en")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    __table_args__ = (CheckConstraint("role IN ('user','admin')", name="ck_profile_role"),)


class Specialization(Base):
    __tablename__ = "specializations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(150))
    category: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str] = mapped_column(Text)
    config: Mapped[dict] = mapped_column(JSON)
    competencies: Mapped[list[SpecializationCompetency]] = relationship(cascade="all, delete-orphan")


class SpecializationCompetency(Base):
    __tablename__ = "specialization_competencies"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    specialization_id: Mapped[str] = mapped_column(ForeignKey("specializations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(150))
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    radar_dimension: Mapped[str] = mapped_column(String(100))


class InterviewerPersonality(Base):
    __tablename__ = "interviewer_personalities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    key: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    system_prompt_fragment: Mapped[str] = mapped_column(Text)
    behavior_params: Mapped[dict] = mapped_column(JSON, default=dict)


class InterviewerAvatar(Base):
    __tablename__ = "interviewer_avatars"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(80))
    role_title: Mapped[str] = mapped_column(String(120))
    asset_url: Mapped[str] = mapped_column(String(300))


class UploadedResume(Base):
    __tablename__ = "uploaded_resumes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("user_profiles.id", ondelete="CASCADE"), index=True)
    storage_path: Mapped[str] = mapped_column(String(300))
    parsed: Mapped[dict | None] = mapped_column(JSON)
    consent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # required: no consent, no row
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class JobDescription(Base):
    __tablename__ = "job_descriptions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("user_profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str | None] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    parsed: Mapped[dict | None] = mapped_column(JSON)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("user_profiles.id", ondelete="CASCADE"))
    specialization_id: Mapped[str] = mapped_column(ForeignKey("specializations.id"), index=True)
    level: Mapped[str] = mapped_column(String(20))
    difficulty: Mapped[str] = mapped_column(String(20))
    language: Mapped[str] = mapped_column(String(5), default="en")
    mode: Mapped[str] = mapped_column(String(10), default="text")
    duration_min: Mapped[int | None] = mapped_column(Integer)
    personality_id: Mapped[str | None] = mapped_column(ForeignKey("interviewer_personalities.id"))
    avatar_id: Mapped[str | None] = mapped_column(ForeignKey("interviewer_avatars.id"))
    interviewer_experience: Mapped[str] = mapped_column(String(20), default="experienced")
    resume_id: Mapped[str | None] = mapped_column(ForeignKey("uploaded_resumes.id", ondelete="SET NULL"))
    job_description_id: Mapped[str | None] = mapped_column(ForeignKey("job_descriptions.id", ondelete="SET NULL"))
    custom_instructions: Mapped[str | None] = mapped_column(Text)
    # Set when this interview was started from "practice my weak areas" of an earlier one.
    retry_of_id: Mapped[str | None] = mapped_column(ForeignKey("interview_sessions.id", ondelete="SET NULL"))
    # Warm-up "introduce yourself" phase. Context only: never scored, never one of the 10 main questions.
    intro_done: Mapped[bool] = mapped_column(Boolean, default=False, server_default=sa_false())
    candidate_intro: Mapped[str | None] = mapped_column(Text)  # NULL when skipped
    intro_reply: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    demo_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    questions: Mapped[list[InterviewQuestion]] = relationship(cascade="all, delete-orphan", order_by="InterviewQuestion.id")
    __table_args__ = (
        CheckConstraint("status IN ('in_progress','completed','abandoned')", name="ck_session_status"),
        CheckConstraint("level IN ('intern','junior','mid','senior','lead')", name="ck_session_level"),
        CheckConstraint("difficulty IN ('easy','medium','hard','adaptive')", name="ck_session_difficulty"),
        Index("ix_sessions_user_started", "user_id", started_at.desc()),
    )


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    parent_question_id: Mapped[str | None] = mapped_column(ForeignKey("interview_questions.id", ondelete="CASCADE"))
    is_followup: Mapped[bool] = mapped_column(Boolean, default=False)
    category: Mapped[str] = mapped_column(String(30))
    text: Mapped[str] = mapped_column(Text)
    reference_elements: Mapped[list | None] = mapped_column(JSON)  # hidden from clients
    __table_args__ = (
        CheckConstraint("position BETWEEN 1 AND 10", name="ck_question_position"),
        CheckConstraint("(NOT is_followup) OR (parent_question_id IS NOT NULL)", name="ck_followup_has_parent"),
        # exactly one MAIN question per (session, position); follow-ups share their parent's position
        Index("uq_main_question_position", "session_id", "position", unique=True,
              sqlite_where=sa_text("NOT is_followup"), postgresql_where=sa_text("NOT is_followup")),
    )


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    question_id: Mapped[str] = mapped_column(ForeignKey("interview_questions.id", ondelete="CASCADE"), index=True)
    text: Mapped[str] = mapped_column(Text)
    transcript_source: Mapped[str] = mapped_column(String(10), default="text")
    reply: Mapped[str | None] = mapped_column(Text)  # interviewer's reply, kept for the saved transcript
    skipped: Mapped[bool] = mapped_column(Boolean, default=False, server_default=sa_false())
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class QuestionEvaluation(Base):
    __tablename__ = "question_evaluations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    question_id: Mapped[str] = mapped_column(ForeignKey("interview_questions.id", ondelete="CASCADE"), unique=True)
    correctness: Mapped[float] = mapped_column(Float)
    completeness: Mapped[float] = mapped_column(Float)
    depth: Mapped[float] = mapped_column(Float)
    relevance: Mapped[float] = mapped_column(Float)
    clarity: Mapped[float] = mapped_column(Float)
    verdict: Mapped[str] = mapped_column(String(20))
    score: Mapped[float] = mapped_column(Float)
    did_well: Mapped[list] = mapped_column(JSON, default=list)
    missing: Mapped[list] = mapped_column(JSON, default=list)
    incorrect_statements: Mapped[list] = mapped_column(JSON, default=list)
    explanation: Mapped[str] = mapped_column(Text, default="")
    expected_elements: Mapped[list] = mapped_column(JSON, default=list)
    improved_answer: Mapped[str] = mapped_column(Text, default="")
    tip: Mapped[str] = mapped_column(Text, default="")
    __table_args__ = (
        CheckConstraint("verdict IN ('correct','partial','incomplete','incorrect','unsupported','no_answer')", name="ck_eval_verdict"),
        CheckConstraint("score BETWEEN 0 AND 100", name="ck_eval_score"),
    )


class SkillEvaluation(Base):
    __tablename__ = "skill_evaluations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True)
    skill: Mapped[str] = mapped_column(String(150))
    dimension_key: Mapped[str] = mapped_column(String(100))
    score: Mapped[float | None] = mapped_column(Float)  # NULL = not assessed
    level: Mapped[str | None] = mapped_column(String(30))
    supporting_question_ids: Mapped[list] = mapped_column(JSON, default=list)
    evidence: Mapped[list] = mapped_column(JSON, default=list)
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    improvements: Mapped[list] = mapped_column(JSON, default=list)


class InterviewReport(Base):
    __tablename__ = "interview_reports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True)
    overall_score: Mapped[float] = mapped_column(Float)
    level: Mapped[str] = mapped_column(String(30))
    radar: Mapped[dict] = mapped_column(JSON)
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    weaknesses: Mapped[list] = mapped_column(JSON, default=list)
    coach_summary: Mapped[str] = mapped_column(Text, default="")
    scoring_version: Mapped[str] = mapped_column(String(10))
    demo_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    pdf_path: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Recommendation(Base):
    __tablename__ = "recommendations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    report_id: Mapped[str] = mapped_column(ForeignKey("interview_reports.id", ondelete="CASCADE"), index=True)
    priority: Mapped[str] = mapped_column(String(16))
    topic: Mapped[str] = mapped_column(String(200))
    explanation: Mapped[str] = mapped_column(Text)
    why_it_matters: Mapped[str] = mapped_column(Text)
    related_question_id: Mapped[str | None] = mapped_column(ForeignKey("interview_questions.id", ondelete="SET NULL"))
    activity: Mapped[str] = mapped_column(Text)
    expected_improvement: Mapped[str] = mapped_column(Text)
    __table_args__ = (CheckConstraint("priority IN ('high','medium','recommended')", name="ck_rec_priority"),)


class LearningRoadmap(Base):
    __tablename__ = "learning_roadmaps"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    report_id: Mapped[str] = mapped_column(ForeignKey("interview_reports.id", ondelete="CASCADE"), unique=True)
    plan: Mapped[list] = mapped_column(JSON)


class InterviewComparison(Base):
    __tablename__ = "interview_comparisons"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("user_profiles.id", ondelete="CASCADE"), index=True)
    base_session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"))
    compare_session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"))
    deltas: Mapped[dict] = mapped_column(JSON)


class AIUsageLog(Base):
    __tablename__ = "ai_usage_log"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("user_profiles.id", ondelete="SET NULL"), index=True)
    provider: Mapped[str] = mapped_column(String(40))
    purpose: Mapped[str] = mapped_column(String(40))
    tokens: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class UsageEvent(Base):
    """One row per interview started. Daily limits count THESE (not sessions), so deleting an interview
    can't be used to dodge the per-user limit or the global AI spending cap."""
    __tablename__ = "usage_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), index=True)  # deliberately not a FK
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class AdminAuditLog(Base):
    """Who did what to whom. No candidate content is ever stored here."""
    __tablename__ = "admin_audit_log"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    actor_id: Mapped[str] = mapped_column(String(36), index=True)
    action: Mapped[str] = mapped_column(String(60))
    target_id: Mapped[str | None] = mapped_column(String(36))
    detail: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
