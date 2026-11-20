from tests.test_interview_engine import env, start, answer, make_turn  # noqa: F401  (fixtures)
from app.ai.schemas import CoachSummary
from app.db.models import InterviewReport, InterviewSession, Recommendation


def finish_all(env, scores, verdict="correct"):
    view = start(env)
    iid = view["id"]
    env.provider.turns = [make_turn(verdict=verdict, score=s) for s in scores]
    for _ in scores:
        assert answer(env, iid).status_code == 200
    return iid


def test_cannot_finish_before_all_answered(env):
    iid = start(env)["id"]
    assert env.client.post(f"/api/v1/interviews/{iid}/finish").status_code == 409


def test_finish_builds_report_with_deterministic_numbers(env):
    iid = finish_all(env, [90] * 10)
    r = env.client.post(f"/api/v1/interviews/{iid}/finish")
    assert r.status_code == 200, r.text
    rep = r.json()
    assert rep["overall_score"] == 90.0 and rep["performance_level"] == "Excellent"
    assert len(rep["radar"]) == 6 and all(v == 90.0 for v in rep["radar"].values())
    assert len(rep["questions"]) == 10 and rep["recommendations"] == []
    assert rep["strengths"] and not rep["weaknesses"]
    with env.Session() as db:
        assert db.get(InterviewSession, iid).status == "completed"


def test_weak_answers_produce_grounded_recommendations(env):
    iid = finish_all(env, [30] * 10, verdict="incomplete")
    rep = env.client.post(f"/api/v1/interviews/{iid}/finish").json()
    assert rep["performance_level"] == "Needs Improvement"
    assert rep["recommendations"] and rep["recommendations"][0]["priority"] == "high"
    assert len(rep["recommendations"]) <= 6 and rep["roadmap"]
    assert rep["weaknesses"]


def test_finish_is_idempotent_and_report_readable(env):
    iid = finish_all(env, [80] * 10)
    a = env.client.post(f"/api/v1/interviews/{iid}/finish").json()
    b = env.client.post(f"/api/v1/interviews/{iid}/finish").json()
    assert a["overall_score"] == b["overall_score"]
    with env.Session() as db:
        assert db.query(InterviewReport).filter_by(session_id=iid).count() == 1
    assert env.client.get(f"/api/v1/interviews/{iid}/report").json()["id"] == iid


def test_coach_summary_failure_falls_back_to_template(env):
    iid = finish_all(env, [75] * 10)
    orig = env.provider.complete_json

    def boom(system, user, schema, retries=2):
        if schema is CoachSummary:
            from app.ai.provider import LLMError
            raise LLMError("down")
        return orig(system, user, schema, retries)
    env.provider.complete_json = boom
    r = env.client.post(f"/api/v1/interviews/{iid}/finish")
    assert r.status_code == 200 and "75" in r.json()["coach_summary"]


def test_other_user_gets_404_and_abandoned_has_no_report(env):
    from app.core.security import CurrentUser
    iid = finish_all(env, [60] * 10)
    env.state["user"] = CurrentUser("u2", "x@y.z", "user")
    assert env.client.post(f"/api/v1/interviews/{iid}/finish").status_code == 404
    assert env.client.get(f"/api/v1/interviews/{iid}/report").status_code == 404
    env.state["user"] = CurrentUser("u1", "a@b.c", "user")
    iid2 = start(env)["id"]
    env.client.post(f"/api/v1/interviews/{iid2}/abandon")
    assert env.client.post(f"/api/v1/interviews/{iid2}/finish").status_code == 409


def test_pdf_export_contains_real_report_content(env):
    import io
    from pypdf import PdfReader
    iid = finish_all(env, [90] * 10)
    env.client.post(f"/api/v1/interviews/{iid}/finish")
    r = env.client.get(f"/api/v1/interviews/{iid}/report.pdf")
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")
    text = "\n".join(p.extract_text() for p in PdfReader(io.BytesIO(r.content)).pages)
    for s in ["Interview report", "90/100", "Excellent", "Skills radar", "Question-by-question review", "Learning roadmap"]:
        assert s in text, s


def test_pdf_is_owner_only_needs_report_and_survives_odd_text(env):
    from app.core.security import CurrentUser
    iid = finish_all(env, [50] * 10)
    env.client.post(f"/api/v1/interviews/{iid}/finish")
    from app.db.models import InterviewQuestion
    with env.Session() as db:  # markup-like and non-Latin text must not break rendering
        q = db.query(InterviewQuestion).filter_by(session_id=iid, position=1, is_followup=False).one()
        q.text = "Explain <b>x & y</b> مرحبا </para> ok?"
        db.commit()
    assert env.client.get(f"/api/v1/interviews/{iid}/report.pdf").status_code == 200
    env.state["user"] = CurrentUser("u2", "x@y.z", "user")
    assert env.client.get(f"/api/v1/interviews/{iid}/report.pdf").status_code == 404
    env.state["user"] = CurrentUser("u1", "a@b.c", "user")
    from tests.test_interview_engine import start
    assert env.client.get(f"/api/v1/interviews/{start(env)['id']}/report.pdf").status_code == 404
