from tests.test_interview_engine import env, start, answer, make_turn  # noqa: F401
from app.core.security import CurrentUser
from app.db.models import InterviewReport, InterviewSession, QuestionEvaluation


def done(env, score, **over):
    iid = start(env, **over)["id"]
    env.provider.turns = [make_turn(score=score) for _ in range(10)]
    for _ in range(10):
        answer(env, iid)
    assert env.client.post(f"/api/v1/interviews/{iid}/finish").status_code == 200
    return iid


def test_history_lists_only_own_and_computes_progress(env):
    a, b = done(env, 60), done(env, 80)
    unfinished = start(env)["id"]
    env.state["user"] = CurrentUser("u2", "x@y.z", "user")
    assert env.client.get("/api/v1/history").json()["items"] == []
    env.state["user"] = CurrentUser("u1", "a@b.c", "user")
    h = env.client.get("/api/v1/history").json()
    assert len(h["items"]) == 3
    p = h["progress"]
    assert p["completed"] == 2 and p["average"] == 70.0 and p["best"] == 80.0
    assert [t["score"] for t in p["trend"]] == [60.0, 80.0]  # chronological
    assert next(i for i in h["items"] if i["id"] == unfinished)["has_report"] is False


def test_demo_reports_do_not_count_in_progress(env):
    done(env, 60)
    with env.Session() as db:
        for s in db.query(InterviewSession): s.demo_mode = True
        db.commit()
    p = env.client.get("/api/v1/history").json()["progress"]
    assert p["completed"] == 1 and p["counted"] == 0 and p["average"] is None


def test_compare_deltas_and_guards(env):
    a, b = done(env, 60), done(env, 80)
    r = env.client.get(f"/api/v1/history/compare?base={b}&other={a}")  # order of args doesn't matter
    assert r.status_code == 200
    j = r.json()
    assert j["overall_delta"] == 20.0 and j["before"]["id"] == a and j["after"]["id"] == b
    assert all(d["delta"] == 20.0 for d in j["dimensions"])
    assert env.client.get(f"/api/v1/history/compare?base={a}&other={a}").status_code == 422
    from app.api import interviews as api
    api._write_limit._hits.clear()
    other_spec = done(env, 70, specialization_slug="web-development")
    assert env.client.get(f"/api/v1/history/compare?base={a}&other={other_spec}").status_code == 422
    from app.api import interviews as api
    api._write_limit._hits.clear()
    unfinished = start(env)["id"]
    assert env.client.get(f"/api/v1/history/compare?base={a}&other={unfinished}").status_code == 409
    env.state["user"] = CurrentUser("u2", "x@y.z", "user")
    assert env.client.get(f"/api/v1/history/compare?base={a}&other={b}").status_code == 404


def test_delete_removes_everything_and_is_owner_only(env):
    iid = done(env, 70)
    env.state["user"] = CurrentUser("u2", "x@y.z", "user")
    assert env.client.delete(f"/api/v1/interviews/{iid}").status_code == 404
    env.state["user"] = CurrentUser("u1", "a@b.c", "user")
    assert env.client.delete(f"/api/v1/interviews/{iid}").status_code == 204
    assert env.client.get(f"/api/v1/interviews/{iid}").status_code == 404
    with env.Session() as db:
        assert db.query(InterviewReport).count() == 0
