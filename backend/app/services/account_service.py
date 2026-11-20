"""Erase everything MockView stores about a user. Used by self-service account deletion and by admins."""
from __future__ import annotations

import logging
import os

import httpx
from sqlalchemy.orm import Session

from app.db.models import InterviewSession, JobDescription, UploadedResume, UsageEvent, UserProfile
from app.services.history_service import delete_interview

log = logging.getLogger("mockview.account")


def erase_user_data(db: Session, user_id: str) -> dict:
    ids = [i for (i,) in db.query(InterviewSession.id).filter_by(user_id=user_id)]
    for iid in ids:
        delete_interview(db, user_id, iid)
    n_res = db.query(UploadedResume).filter_by(user_id=user_id).delete(synchronize_session=False)
    n_jd = db.query(JobDescription).filter_by(user_id=user_id).delete(synchronize_session=False)
    profile = db.get(UserProfile, user_id)
    if profile is not None:
        db.delete(profile)
    # Usage events are intentionally KEPT (no content, only a timestamp) so deleting an account can't reset today's limits.
    db.commit()
    return {"interviews": len(ids), "resumes": n_res, "job_descriptions": n_jd}


def delete_login(user_id: str) -> bool:
    """Remove the Supabase sign-in account. Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-side only).
    Returns False when not configured or when the call fails; the data erasure has already happened."""
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return False
    try:
        r = httpx.delete(f"{url.rstrip('/')}/auth/v1/admin/users/{user_id}",
                         headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=15)
    except httpx.HTTPError:
        log.warning("could not reach Supabase to delete login for %s", user_id)
        return False
    if r.status_code >= 400:
        log.warning("Supabase refused to delete login for %s (%s)", user_id, r.status_code)
        return False
    return True
