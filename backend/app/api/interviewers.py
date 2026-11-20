from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.interviewers.data import AVATARS, EXPERIENCE_LEVELS, PERSONALITIES

router = APIRouter(prefix="/interviewers", tags=["interviewers"])


class PersonalityOut(BaseModel):
    key: str
    name: str
    summary: str
    traits: list[str]


class ExperienceOut(BaseModel):
    key: str
    name: str
    summary: str


class AvatarOut(BaseModel):
    id: str
    role_title: str
    role_ar: str
    asset_url: str
    voice_gender: str


# Only descriptive fields are returned; prompt fragments never leave the server.
@router.get("/personalities", response_model=list[PersonalityOut])
def personalities():
    return [PersonalityOut(key=p.key, name=p.name, summary=p.summary, traits=list(p.traits))
            for p in PERSONALITIES.values()]


@router.get("/experience-levels", response_model=list[ExperienceOut])
def experience_levels():
    return [ExperienceOut(key=k, name=v["name"], summary=v["summary"]) for k, v in EXPERIENCE_LEVELS.items()]


@router.get("/avatars", response_model=list[AvatarOut])
def avatars():
    return [AvatarOut(**a.__dict__) for a in AVATARS]
