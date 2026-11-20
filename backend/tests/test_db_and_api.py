import time

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    Base, InterviewQuestion, InterviewSession, Specialization, UserProfile,
)

SECRET = "test-secret"


@pytest.fixture()
def db():
    from tests.dbutil import make_engine
    engine = make_engine()
    with Session(engine) as s:
        s.add(UserProfile(id="u1"))
        s.add(Specialization(id="sp1", slug="x", name="X", category="C", description="d", config={}))
        s.commit()  # parents first: PostgreSQL enforces FK order, SQLite does not
        s.add(InterviewSession(id="s1", user_id="u1", specialization_id="sp1",
                               level="junior", difficulty="easy"))
        s.commit()
        yield s


def _q(pos, follow=False, parent=None, id=None):
    return InterviewQuestion(id=id, session_id="s1", position=pos, is_followup=follow,
                             parent_question_id=parent, category="fundamentals", text="t")


def test_duplicate_main_position_rejected(db):
    db.add(_q(1)); db.commit()
    db.add(_q(1))
    with pytest.raises(IntegrityError):
        db.commit()


def test_followups_share_position_with_parent(db):
    parent = _q(1, id="p1"); db.add(parent); db.commit()
    db.add(_q(1, follow=True, parent="p1")); db.add(_q(1, follow=True, parent="p1"))
    db.commit()  # follow-ups never collide with the main question record


def test_followup_requires_parent(db):
    db.add(_q(2, follow=True))
    with pytest.raises(IntegrityError):
        db.commit()


def test_position_bounds(db):
    db.add(_q(11))
    with pytest.raises(IntegrityError):
        db.commit()


def test_invalid_level_rejected(db):
    db.add(InterviewSession(user_id="u1", specialization_id="sp1", level="wizard", difficulty="easy"))
    with pytest.raises(IntegrityError):
        db.commit()


# ---- API ----

@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    from app.main import app
    return TestClient(app)


def _token(role=None, sub="u1", exp_in=3600, secret=SECRET):
    claims = {"sub": sub, "aud": "authenticated", "exp": int(time.time()) + exp_in}
    if role:
        claims["app_metadata"] = {"role": role}
    return jwt.encode(claims, secret, algorithm="HS256")


def test_health_reports_demo_mode(client, monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    body = client.get("/health").json()
    assert body["demo_mode"] is True and body["ai_provider"] == "demo"


def test_list_all_64(client):
    r = client.get("/api/v1/specializations")
    assert r.status_code == 200 and len(r.json()) == 64


def test_filter_and_search(client):
    cats = client.get("/api/v1/specializations/categories").json()
    assert len(cats) == 11  # the 11 categories from the product spec
    sec = client.get("/api/v1/specializations", params={"category": "Cybersecurity"}).json()
    assert {s["category"] for s in sec} == {"Cybersecurity"} and len(sec) == 5
    hits = client.get("/api/v1/specializations", params={"q": "kubernetes"}).json()
    assert hits and all(isinstance(h["slug"], str) for h in hits)
    assert client.get("/api/v1/specializations", params={"q": "zzzznothing"}).json() == []


def test_detail_and_404(client):
    d = client.get("/api/v1/specializations/machine-learning").json()
    assert len(d["evaluation_dimensions"]) == 6 and sum(d["question_categories"].values()) == 10
    assert client.get("/api/v1/specializations/nope").status_code == 404


def test_detail_never_exposes_internal_fields(client):
    d = client.get("/api/v1/specializations/machine-learning").json()
    assert "difficulty_config" not in d  # only declared response fields are returned


def test_auth_guard(client):
    from fastapi import Depends, FastAPI
    from app.core.security import CurrentUser, get_current_user, require_admin

    app = FastAPI()

    @app.get("/me")
    def me(u: CurrentUser = Depends(get_current_user)):
        return {"id": u.id, "role": u.role}

    @app.get("/admin")
    def admin(u: CurrentUser = Depends(require_admin)):
        return {"ok": True}

    c = TestClient(app)
    assert c.get("/me").status_code == 401
    assert c.get("/me", headers={"Authorization": f"Bearer {_token(secret='wrong')}"}).status_code == 401
    assert c.get("/me", headers={"Authorization": f"Bearer {_token(exp_in=-10)}"}).status_code == 401
    ok = c.get("/me", headers={"Authorization": f"Bearer {_token()}"})
    assert ok.status_code == 200 and ok.json() == {"id": "u1", "role": "user"}
    assert c.get("/admin", headers={"Authorization": f"Bearer {_token()}"}).status_code == 403
    assert c.get("/admin", headers={"Authorization": f"Bearer {_token('admin')}"}).status_code == 200


def test_user_metadata_cannot_grant_admin(client):
    from app.core.security import get_current_user
    from fastapi.security import HTTPAuthorizationCredentials
    claims = {"sub": "u9", "aud": "authenticated", "exp": int(time.time()) + 60,
              "user_metadata": {"role": "admin"}}
    tok = jwt.encode(claims, SECRET, algorithm="HS256")
    u = get_current_user(HTTPAuthorizationCredentials(scheme="Bearer", credentials=tok))
    assert u.role == "user"


def test_rate_limiter():
    from fastapi import HTTPException
    from app.core.ratelimit import RateLimiter
    rl = RateLimiter(2, 60)
    rl.check("a"); rl.check("a")
    with pytest.raises(HTTPException) as e:
        rl.check("a")
    assert e.value.status_code == 429
    rl.check("b")  # other clients unaffected
