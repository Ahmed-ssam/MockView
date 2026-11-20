from app.core.security import CurrentUser
from app.db.models import InterviewSession
from tests.test_interview_engine import env, start, answer, make_turn  # noqa: F401
from tests.test_report import finish_all


def test_practice_creates_linked_interview_with_focus_in_prompt(env):
    iid = finish_all(env, [30] * 10, verdict="incomplete")
    env.client.post(f"/api/v1/interviews/{iid}/finish")
    assert env.client.get(f"/api/v1/interviews/{iid}/report").json()["can_practice"] is True
    env.provider.prompts.clear()
    r = env.client.post(f"/api/v1/interviews/{iid}/practice")
    assert r.status_code == 201, r.text
    new = r.json()
    assert new["id"] != iid and new["progress"]["total_main"] == 10 and new["status"] == "in_progress"
    plan = next(u for n, u in env.provider.prompts if n == "QuestionPlan")
    assert "UNTRUSTED_FOCUS" in plan and "Weak skill:" in plan and "PRACTICE interview" in plan
    with env.Session() as db:
        s2, s1 = db.get(InterviewSession, new["id"]), db.get(InterviewSession, iid)
        assert s2.retry_of_id == iid
        assert (s2.level, s2.difficulty, s2.language, s2.specialization_id) == (s1.level, s1.difficulty, s1.language, s1.specialization_id)
    # the retry appears in history with its link, and can be compared with the original
    items = {i["id"]: i for i in env.client.get("/api/v1/history").json()["items"]}
    assert items[new["id"]]["retry_of_id"] == iid


def test_practice_guards(env):
    iid = finish_all(env, [95] * 10)
    assert env.client.post(f"/api/v1/interviews/{iid}/practice").status_code == 409   # no report yet
    env.client.post(f"/api/v1/interviews/{iid}/finish")
    r = env.client.post(f"/api/v1/interviews/{iid}/practice")
    assert r.status_code == 422 and "Nothing to practice" in r.json()["detail"]        # no weak areas
    assert env.client.get(f"/api/v1/interviews/{iid}/report").json()["can_practice"] is False
    env.state["user"] = CurrentUser("u2", "x@y.z", "user")
    assert env.client.post(f"/api/v1/interviews/{iid}/practice").status_code == 404


def test_deleting_original_keeps_the_practice_interview(env):
    iid = finish_all(env, [30] * 10, verdict="incomplete")
    env.client.post(f"/api/v1/interviews/{iid}/finish")
    new = env.client.post(f"/api/v1/interviews/{iid}/practice").json()["id"]
    assert env.client.delete(f"/api/v1/interviews/{iid}").status_code == 204
    assert env.client.get(f"/api/v1/interviews/{new}").status_code == 200
    with env.Session() as db:
        assert db.get(InterviewSession, new).retry_of_id is None
