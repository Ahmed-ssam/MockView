"""Idempotent seeding of reference rows (specializations, personalities, avatars) from code.

Primary keys are the stable slugs/keys so references never depend on random ids.
"""
from __future__ import annotations

from dataclasses import asdict

from sqlalchemy.orm import Session

from app.db.models import InterviewerAvatar, InterviewerPersonality, Specialization, UserProfile
from app.interviewers.data import AVATARS, PERSONALITIES
from app.specializations.catalog import SpecializationConfig


def ensure_profile(db: Session, user_id: str) -> None:
    if db.get(UserProfile, user_id) is None:
        db.add(UserProfile(id=user_id))
        db.flush()


def ensure_specialization(db: Session, spec: SpecializationConfig) -> Specialization:
    row = db.query(Specialization).filter_by(slug=spec.slug).one_or_none()
    if row is None:
        row = Specialization(slug=spec.slug, name=spec.name, category=spec.category,
                             description=spec.description, config=asdict(spec))
        db.add(row)
        db.flush()
    return row


def ensure_interviewer_refs(db: Session, personality_key: str, avatar_id: str) -> None:
    if db.get(InterviewerPersonality, personality_key) is None:
        p = PERSONALITIES[personality_key]
        db.add(InterviewerPersonality(id=p.key, key=p.key, name=p.name,
                                      system_prompt_fragment=p.prompt_fragment, behavior_params=p.behavior))
    if db.get(InterviewerAvatar, avatar_id) is None:
        a = next(x for x in AVATARS if x.id == avatar_id)
        db.add(InterviewerAvatar(id=a.id, name=a.role_title, role_title=a.role_title, asset_url=a.asset_url))  # characters have no names
    else:
        a = next(x for x in AVATARS if x.id == avatar_id)
        db.get(InterviewerAvatar, avatar_id).name = a.role_title
    db.flush()
