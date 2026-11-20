import httpx
from fastapi import Request
from starlette.testclient import TestClient

from app.core.ratelimit import RateLimiter, client_ip
from app.core.security import CurrentUser
from app.db.models import AdminAuditLog, InterviewSession, UsageEvent, UserProfile
from app.services import account_service
from tests.test_interview_engine import env, start  # noqa: F401
from tests.test_resumes import pdf_bytes, upload

ADMIN = CurrentUser("admin1", "b@x.y", "admin")


def test_deleting_interviews_does_not_reset_the_daily_limit(env, monkeypatch):
    monkeypatch.setenv("DAILY_INTERVIEW_LIMIT", "2")
    a, b = start(env)["id"], start(env)["id"]
    from tests.test_interview_engine import CFG
    assert env.client.post("/api/v1/interviews", json=CFG).status_code == 429
    env.client.delete(f"/api/v1/interviews/{a}"); env.client.delete(f"/api/v1/interviews/{b}")
    assert env.client.post("/api/v1/interviews", json=CFG).status_code == 429   # still limited


def test_global_cap_stops_everyone(env, monkeypatch):
    monkeypatch.setenv("GLOBAL_DAILY_INTERVIEW_LIMIT", "2"); monkeypatch.setenv("DAILY_INTERVIEW_LIMIT", "5")
    from tests.test_interview_engine import CFG
    start(env)
    env.state["user"] = CurrentUser("u2", None, "user")
    start(env)
    env.state["user"] = CurrentUser("u3", None, "user")
    plans = lambda: sum(n == "QuestionPlan" for n, _ in env.provider.prompts)
    before = plans()
    r = env.client.post("/api/v1/interviews", json=CFG)
    assert r.status_code == 503 and "capacity" in r.json()["detail"]
    assert plans() == before                                                     # refused before any AI call
    monkeypatch.setenv("GLOBAL_DAILY_INTERVIEW_LIMIT", "0")                      # 0 disables the cap
    assert env.client.post("/api/v1/interviews", json=CFG).status_code == 201


def test_self_service_account_deletion(env, monkeypatch):
    upload(env, pdf_bytes()); start(env)
    env.state["user"] = CurrentUser("u2", None, "user"); other = start(env)["id"]
    env.state["user"] = CurrentUser("u1", "a@b.c", "user")
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    r = env.client.delete("/api/v1/me")
    assert r.status_code == 200 and r.json() == {"interviews": 1, "resumes": 1, "job_descriptions": 0, "login_deleted": False}
    with env.Session() as db:
        assert db.get(UserProfile, "u1") is None and db.query(InterviewSession).filter_by(user_id="u1").count() == 0
        assert db.get(InterviewSession, other) is not None                      # other user untouched
        assert db.query(UsageEvent).filter_by(user_id="u1").count() == 1       # limits can't be reset by deleting


def test_login_deletion_calls_supabase_admin_api_only_when_configured(env, monkeypatch):
    calls = []
    monkeypatch.setattr(account_service.httpx, "delete", lambda url, headers=None, timeout=None: (calls.append((url, headers)), type("R", (), {"status_code": 200})())[1])
    monkeypatch.setenv("SUPABASE_URL", "https://proj.supabase.co/"); monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "svc-key")
    r = env.client.delete("/api/v1/me")
    assert r.json()["login_deleted"] is True
    assert calls[0][0] == "https://proj.supabase.co/auth/v1/admin/users/u1" and calls[0][1]["apikey"] == "svc-key"
    monkeypatch.setattr(account_service.httpx, "delete", lambda *a, **k: (_ for _ in ()).throw(httpx.ConnectError("x")))
    assert env.client.delete("/api/v1/me").json()["login_deleted"] is False      # data erasure never depends on it


def test_admin_erase_is_audited(env):
    start(env)
    env.state["user"] = ADMIN
    assert env.client.delete("/api/v1/admin/users/u1").status_code == 200
    log = env.client.get("/api/v1/admin/audit").json()
    assert log[0]["action"] == "erase_user_data" and log[0]["actor_id"] == "admin1" and log[0]["target_id"] == "u1"
    env.state["user"] = CurrentUser("u1", None, "user")
    assert env.client.get("/api/v1/admin/audit").status_code == 403


def test_security_headers_and_request_id(env):
    r = env.client.get("/health", headers={"x-request-id": "abc123"})
    assert r.headers["x-request-id"] == "abc123" and r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY" and "frame-ancestors 'none'" in r.headers["content-security-policy"]
    assert env.client.get("/health/ready").json() == {"status": "ready"}


def _req(host, fwd=None):
    h = [(b"x-forwarded-for", fwd.encode())] if fwd else []
    return Request({"type": "http", "headers": h, "client": (host, 1)})


def test_client_ip_trusts_proxy_header_only_when_enabled(monkeypatch):
    monkeypatch.delenv("TRUST_PROXY", raising=False)
    assert client_ip(_req("10.0.0.1", "6.6.6.6")) == "10.0.0.1"            # spoofed header ignored by default
    monkeypatch.setenv("TRUST_PROXY", "1")
    assert client_ip(_req("10.0.0.1", "1.2.3.4, 5.6.7.8")) == "5.6.7.8"    # last entry = added by our proxy


def test_rate_limiter_sweeps_expired_visitors():
    rl = RateLimiter(2, 60)
    for i in range(999):
        rl.check(f"ip{i}")
    import time as t
    for q in rl._hits.values():
        q.clear(); q.append(t.monotonic() - 120)
    rl.check("fresh")                      # 1000th check triggers the sweep
    assert set(rl._hits) == {"fresh"}
