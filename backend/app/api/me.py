from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.ratelimit import RateLimiter
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db
from app.services import account_service

router = APIRouter(prefix="/me", tags=["account"])
_limit = RateLimiter(max_requests=5, window_s=60)


@router.delete("", dependencies=[Depends(_limit.dependency())])
def delete_my_account(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Self-service erasure: all of the caller's interviews, reports, resumes and job descriptions."""
    counts = account_service.erase_user_data(db, user.id)
    return {**counts, "login_deleted": account_service.delete_login(user.id)}
