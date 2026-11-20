"""Interview history, progress and comparison. All numbers are read from stored reports (never recomputed by AI)."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import (
    InterviewAnswer, InterviewQuestion, InterviewReport, InterviewSession, LearningRoadmap, QuestionEvaluation,
    Recommendation, SkillEvaluation, Specialization,
)
from app.services.interview_engine import EngineError, get_owned


def _row(s: InterviewSession, spec_name: str, r: InterviewReport | None) -> dict:
    return {"id": s.id, "specialization": spec_name, "level": s.level, "difficulty": s.difficulty,
            "mode": s.mode, "status": s.status, "demo_mode": s.demo_mode, "started_at": s.started_at,
            "completed_at": s.completed_at, "retry_of_id": s.retry_of_id, "overall_score": r.overall_score if r else None,
            "performance_level": r.level if r else None, "has_report": r is not None}


def history(db: Session, user_id: str) -> dict:
    rows = (db.query(InterviewSession, Specialization.name, InterviewReport)
            .join(Specialization, Specialization.id == InterviewSession.specialization_id)
            .outerjoin(InterviewReport, InterviewReport.session_id == InterviewSession.id)
            .filter(InterviewSession.user_id == user_id)
            .order_by(InterviewSession.started_at.desc()).all())
    items = [_row(s, n, r) for s, n, r in rows]
    # Progress uses real (non-demo) reports only, so simulated demo scores never inflate a user's stats.
    real = [i for i in items if i["has_report"] and not i["demo_mode"]]
    scores = [i["overall_score"] for i in real]
    progress = {
        "completed": sum(1 for i in items if i["has_report"]),
        "counted": len(real),
        "average": round(sum(scores) / len(scores), 1) if scores else None,
        "best": max(scores) if scores else None,
        # chronological, for a trend line
        "trend": [{"id": i["id"], "date": i["started_at"], "score": i["overall_score"], "specialization": i["specialization"]}
                  for i in reversed(real)],
    }
    return {"items": items, "progress": progress}


def compare(db: Session, user_id: str, base_id: str, other_id: str) -> dict:
    if base_id == other_id:
        raise EngineError(422, "Choose two different interviews to compare.")
    a, b = get_owned(db, user_id, base_id), get_owned(db, user_id, other_id)
    if a.specialization_id != b.specialization_id:
        raise EngineError(422, "Only interviews in the same specialization can be compared, because their skill axes differ.")
    reps = []
    for s in (a, b):
        r = db.query(InterviewReport).filter_by(session_id=s.id).one_or_none()
        if r is None:
            raise EngineError(409, "Both interviews need a finished report to be compared.")
        reps.append(r)
    ra, rb = reps
    # older -> newer so deltas read as "change over time"
    (older, ro), (newer, rn) = sorted([(a, ra), (b, rb)], key=lambda p: p[0].started_at)
    dims = []
    for k, new in rn.radar.items():
        old = ro.radar.get(k)
        dims.append({"skill": k, "before": old, "after": new,
                     "delta": round(new - old, 1) if old is not None and new is not None else None})
    return {
        "specialization": db.get(Specialization, a.specialization_id).name,
        "before": {"id": older.id, "date": older.started_at, "overall_score": ro.overall_score, "level": older.level,
                   "performance_level": ro.level, "demo_mode": ro.demo_mode},
        "after": {"id": newer.id, "date": newer.started_at, "overall_score": rn.overall_score, "level": newer.level,
                  "performance_level": rn.level, "demo_mode": rn.demo_mode},
        "overall_delta": round(rn.overall_score - ro.overall_score, 1),
        "dimensions": dims,
        "caveat": "Different questions are asked each time, so small changes can be noise rather than progress.",
    }


def delete_interview(db: Session, user_id: str, interview_id: str) -> None:
    s = get_owned(db, user_id, interview_id)
    # Explicit, so deletion is complete on every database (not reliant on FK cascades being enforced).
    qids = [q for (q,) in db.query(InterviewQuestion.id).filter_by(session_id=s.id)]
    rids = [r for (r,) in db.query(InterviewReport.id).filter_by(session_id=s.id)]
    if rids:
        db.query(Recommendation).filter(Recommendation.report_id.in_(rids)).delete(synchronize_session=False)
        db.query(LearningRoadmap).filter(LearningRoadmap.report_id.in_(rids)).delete(synchronize_session=False)
        db.query(InterviewReport).filter(InterviewReport.id.in_(rids)).delete(synchronize_session=False)
    db.query(SkillEvaluation).filter_by(session_id=s.id).delete(synchronize_session=False)
    if qids:
        db.query(QuestionEvaluation).filter(QuestionEvaluation.question_id.in_(qids)).delete(synchronize_session=False)
        db.query(InterviewAnswer).filter(InterviewAnswer.question_id.in_(qids)).delete(synchronize_session=False)
        # follow-ups reference their parent, so remove them first
        db.query(InterviewQuestion).filter(InterviewQuestion.id.in_(qids), InterviewQuestion.is_followup).delete(synchronize_session=False)
        db.query(InterviewQuestion).filter(InterviewQuestion.id.in_(qids)).delete(synchronize_session=False)
    db.query(InterviewSession).filter_by(retry_of_id=s.id).update({"retry_of_id": None})
    db.query(InterviewSession).filter_by(id=s.id).delete(synchronize_session=False)
    db.commit()
