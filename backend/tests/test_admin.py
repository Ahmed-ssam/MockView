from app.core.security import CurrentUser
from app.db.models import InterviewSession, UploadedResume, UserProfile
from tests.test_interview_engine import env, start  # noqa: F401
from tests.test_report import finish_all
from tests.test_resumes import pdf_bytes, upload

ADMIN = CurrentUser("admin1", "boss@x.y", "admin")
PATHS = ["/admin/stats", "/admin/users", "/admin/interviews", "/admin/catalog"]


def as_admin(env):
    env.state["user"] = ADMIN


def test_every_admin_endpoint_rejects_normal_users(env):
    for p in PATHS:
        assert env.client.get("/api/v1" + p).status_code == 403, p
    assert env.client.delete("/api/v1/admin/users/u1").status_code == 403


def test_stats_are_correct_and_expose_no_content(env):
    a = finish_all(env, [80] * 10)
    env.client.post(f"/api/v1/interviews/{a}/finish")
    b = start(env)["id"]
    env.client.post(f"/api/v1/interviews/{b}/abandon")
    start(env)  # one still in progress
    as_admin(env)
    s = env.client.get("/api/v1/admin/stats").json()
    assert s["users"] == 1 and s["interviews"]["total"] == 3
    assert (s["interviews"]["completed"], s["interviews"]["abandoned"], s["interviews"]["in_progress"]) == (1, 1, 1)
    assert s["interviews"]["completion_rate"] == 0.333 and s["interviews"]["last_24h"] == 3
    assert s["real_reports"]["count"] == 1 and s["real_reports"]["average_score"] == 80.0
    assert s["real_reports"]["levels"]["Very Good"] == 1
    assert sum(d["interviews"] for d in s["daily"]) == 3 and len(s["daily"]) == 14
    assert s["ai"] == {"provider": "fake", "demo_mode": False}
    rows = env.client.get("/api/v1/admin/interviews").json()
    assert len(rows) == 3
    leaked = {"answer", "text", "question", "intro", "resume", "job_description"}
    assert not any(k in leaked for r in rows for k in r)


def test_catalog_health_reports_all_64_clean(env):
    as_admin(env)
    c = env.client.get("/api/v1/admin/catalog").json()
    assert c["count"] == 64 and c["issues"] == []


def test_users_listing_counts_interviews(env):
    start(env); start(env)
    as_admin(env)
    u = env.client.get("/api/v1/admin/users").json()
    assert [(x["id"], x["interviews"]) for x in u] == [("u1", 2)]
    assert env.client.get("/api/v1/admin/users?limit=0").status_code == 422


def test_erasing_a_user_removes_everything_for_them_only(env):
    rid = upload(env, pdf_bytes()).json()["id"]
    iid = finish_all(env, [60] * 10)
    env.client.post(f"/api/v1/interviews/{iid}/finish")
    env.state["user"] = CurrentUser("u2", None, "user")
    other = start(env)["id"]
    as_admin(env)
    assert env.client.delete("/api/v1/admin/users/admin1").status_code == 422
    assert env.client.delete("/api/v1/admin/users/nobody").status_code == 404
    r = env.client.delete("/api/v1/admin/users/u1")
    assert r.status_code == 200 and r.json() == {"interviews": 1, "resumes": 1, "job_descriptions": 0}
    with env.Session() as db:
        assert db.get(UserProfile, "u1") is None and db.query(UploadedResume).count() == 0
        assert db.query(InterviewSession).filter_by(user_id="u1").count() == 0
        assert db.get(InterviewSession, other) is not None and db.get(UserProfile, "u2") is not None
