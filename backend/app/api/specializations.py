from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.specializations.catalog import SpecializationConfig, all_specializations

router = APIRouter(prefix="/specializations", tags=["specializations"])


class SpecializationSummary(BaseModel):
    slug: str
    name: str
    category: str
    description: str


class SpecializationDetail(SpecializationSummary):
    core_competencies: list[str]
    technical_topics: list[str]
    tools: list[str]
    question_categories: dict[str, int]
    evaluation_dimensions: list[str]
    learning_topics: list[str]


@lru_cache(maxsize=1)
def _catalog() -> tuple[SpecializationConfig, ...]:
    return tuple(all_specializations())


@router.get("", response_model=list[SpecializationSummary])
def list_specializations(
    category: str | None = None,
    q: str | None = Query(None, max_length=100, description="search name/description/topics"),
):
    items = _catalog()
    if category:
        items = tuple(s for s in items if s.category == category)
    if q:
        needle = q.strip().lower()
        items = tuple(
            s for s in items
            if needle in s.name.lower() or needle in s.description.lower()
            or any(needle in t.lower() for t in s.technical_topics + s.tools)
        )
    return [SpecializationSummary(**s.__dict__) for s in items]


@router.get("/categories", response_model=list[str])
def list_categories():
    seen: list[str] = []
    for s in _catalog():
        if s.category not in seen:
            seen.append(s.category)
    return seen


@router.get("/{slug}", response_model=SpecializationDetail)
def get_one(slug: str):
    for s in _catalog():
        if s.slug == slug:
            return SpecializationDetail(**s.__dict__)
    raise HTTPException(404, "Specialization not found")
