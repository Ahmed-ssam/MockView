"""Admin read models. Metadata only: admins never see candidates' answers, resumes or job descriptions."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import (
    AdminAuditLog, InterviewReport, InterviewSession, JobDescription, Specialization, UploadedResume, UserProfile,
)
from app.services import account_service
from app.services.interview_engine import EngineError, slots_for
from app.specializations.catalog import all_specializations

log = logging.getLogger("mockview.admin")
LEVELS = ["Excellent", "Very Good", "Good", "Needs Improvement"]


def _day(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")


def stats(db: Session, provider) -> dict:
    now = datetime.now(timezone.utc)
    sessions = db.query(InterviewSession.status, InterviewSession.demo_mode, InterviewSession.started_at,
                        InterviewSession.language, InterviewSession.mode).all()
    by_status = {k: 0 for k in ("in_progress", "completed", "abandoned")}
    series = {_day(now - timedelta(days=i)): 0 for i in range(13, -1, -1)}
    langs: dict[str, int] = {}
    modes: dict[str, int] = {}
    demo = last24 = last7 = 0
    for st, dm, started, lang, mode in sessions:
        by_status[st] = by_status.get(st, 0) + 1
        demo += 1 if dm else 0
        started = started if started.tzinfo else started.replace(tzinfo=timezone.utc)
        last24 += started >= now - timedelta(days=1)
        last7 += started >= now - timedelta(days=7)
        if _day(started) in series:
            series[_day(started)] += 1
        langs[lang] = langs.get(lang, 0) + 1
        modes[mode] = modes.get(mode, 0) + 1
    real = db.query(InterviewReport.overall_score, InterviewReport.level).filter_by(demo_mode=False).all()
    total = len(sessions)
    top = (db.query(Specialization.name, func.count(InterviewSession.id))
           .join(InterviewSession, InterviewSession.specialization_id == Specialization.id)
           .group_by(Specialization.name).order_by(func.count(InterviewSession.id).desc()).limit(10).all())
    return {
        "ai": {"provider": provider.name, "demo_mode": provider.is_demo},
        "users": db.query(UserProfile).count(),
        "interviews": {"total": total, **by_status, "last_24h": last24, "last_7d": last7, "demo": demo,
                       "completion_rate": round(by_status["completed"] / total, 3) if total else None},
        "daily": [{"date": d, "interviews": n} for d, n in series.items()],
        "real_reports": {"count": len(real),
                         "average_score": round(sum(s for s, _ in real) / len(real), 1) if real else None,
                         "levels": {lv: sum(1 for _, l in real if l == lv) for lv in LEVELS}},
        "languages": langs, "modes": modes,
        "top_specializations": [{"name": n, "interviews": c} for n, c in top],
        "resumes_stored": db.query(UploadedResume).count(),
        "note": "Error and latency telemetry is not collected yet; check server logs for AI failures.",
    }


def users(db: Session, limit: int, offset: int) -> list[dict]:
    rows = (db.query(UserProfile, func.count(InterviewSession.id), func.max(InterviewSession.started_at))
            .outerjoin(InterviewSession, InterviewSession.user_id == UserProfile.id)
            .group_by(UserProfile.id).order_by(UserProfile.created_at.desc()).limit(limit).offset(offset).all())
    return [{"id": u.id, "display_name": u.display_name, "role": u.role, "created_at": u.created_at,
             "interviews": n, "last_interview_at": last} for u, n, last in rows]


def recent_interviews(db: Session, limit: int) -> list[dict]:
    rows = (db.query(InterviewSession, Specialization.name, InterviewReport.overall_score)
            .join(Specialization, Specialization.id == InterviewSession.specialization_id)
            .outerjoin(InterviewReport, InterviewReport.session_id == InterviewSession.id)
            .order_by(InterviewSession.started_at.desc()).limit(limit).all())
    return [{"id": s.id, "user_id": s.user_id, "specialization": n, "level": s.level, "status": s.status,
             "demo_mode": s.demo_mode, "started_at": s.started_at, "overall_score": sc} for s, n, sc in rows]


def catalog_health(db: Session) -> dict:
    """Integrity of the specialization catalog plus real usage per specialization."""
    used = dict(db.query(Specialization.slug, func.count(InterviewSession.id))
                .outerjoin(InterviewSession, InterviewSession.specialization_id == Specialization.id)
                .group_by(Specialization.slug).all())
    items, issues = [], []
    for s in all_specializations():
        problems = []
        try:
            slots_for(s)
        except AssertionError as e:
            problems.append(str(e))
        if len(s.evaluation_dimensions) != 6:
            problems.append(f"{len(s.evaluation_dimensions)} radar dimensions (expected 6)")
        if not s.technical_topics:
            problems.append("no technical topics")
        if set(s.difficulty_config) != {"intern", "junior", "mid", "senior", "lead"}:
            problems.append("difficulty config does not cover all five levels")
        items.append({"slug": s.slug, "name": s.name, "category": s.category, "interviews": used.get(s.slug, 0),
                      "problems": problems})
        issues += [f"{s.slug}: {p}" for p in problems]
    return {"count": len(items), "issues": issues, "items": items}


def delete_user_data(db: Session, admin_id: str, user_id: str) -> dict:
    """Erase everything MockView stores about a user (privacy requests). Does not remove the Supabase login."""
    if user_id == admin_id:
        raise EngineError(422, "Admins can't erase their own data from here.")
    if db.get(UserProfile, user_id) is None:
        raise EngineError(404, "User not found.")
    counts = account_service.erase_user_data(db, user_id)
    db.add(AdminAuditLog(actor_id=admin_id, action="erase_user_data", target_id=user_id, detail=counts))
    db.commit()
    log.warning("admin %s erased data of user %s %s", admin_id, user_id, counts)
    return counts


def audit(db: Session, limit: int) -> list[dict]:
    rows = db.query(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(limit).all()
    return [{"id": r.id, "actor_id": r.actor_id, "action": r.action, "target_id": r.target_id,
             "detail": r.detail, "created_at": r.created_at} for r in rows]
