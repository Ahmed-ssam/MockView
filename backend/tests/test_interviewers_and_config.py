import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.interviewers.data import PERSONALITIES, persona_prompt
from app.schemas.interview import InterviewConfig

BASE = dict(specialization_slug="machine-learning", level="junior")


def cfg(**kw):
    return InterviewConfig(**{**BASE, **kw})


def test_defaults_valid():
    c = cfg()
    assert c.difficulty == "adaptive" and c.language == "en" and c.duration_min == 30


@pytest.mark.parametrize("kw", [
    {"specialization_slug": "nope"}, {"level": "wizard"}, {"difficulty": "insane"},
    {"language": "fr"}, {"personality": "rude"}, {"interviewer_experience": "god"},
    {"avatar_id": "zzz"}, {"duration_min": 7}, {"job_description": "x" * 8001},
    {"custom_instructions": "x" * 1001},
])
def test_invalid_config_rejected(kw):
    with pytest.raises(ValidationError):
        cfg(**kw)


def test_blank_optional_fields_become_none():
    c = cfg(target_job_title="   ", job_description="", custom_instructions="  hi  ")
    assert c.target_job_title is None and c.job_description is None and c.custom_instructions == "hi"


def test_personalities_produce_different_prompts():
    prompts = {persona_prompt(k, "experienced") for k in PERSONALITIES}
    assert len(prompts) == 4  # personality really changes the LLM instructions


def test_strict_prompt_is_respectful_and_no_hints():
    p = PERSONALITIES["strict"]
    assert "never insult" in p.prompt_fragment and p.behavior["allow_rephrase"] is False


@pytest.fixture()
def client():
    from app.main import app
    return TestClient(app)


def test_endpoints_hide_prompts(client):
    pers = client.get("/api/v1/interviewers/personalities").json()
    assert [p["key"] for p in pers] == ["friendly", "professional", "strict", "senior_technical"]
    for p in pers:
        assert "prompt_fragment" not in p and "behavior" not in p
    exp = client.get("/api/v1/interviewers/experience-levels").json()
    assert len(exp) == 3 and all("prompt_fragment" not in e for e in exp)
    av = client.get("/api/v1/interviewers/avatars").json()
    assert len(av) == 4
