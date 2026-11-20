from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db
from app.services import history_service
from app.services.interview_engine import EngineError

router = APIRouter(tags=["history"])


def _wrap(fn):
    try:
        return fn()
    except EngineError as e:
        raise HTTPException(e.status, e.message)


@router.get("/history")
def history(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return history_service.history(db, user.id)


@router.get("/history/compare")
def compare(base: str = Query(max_length=36), other: str = Query(max_length=36),
            user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return _wrap(lambda: history_service.compare(db, user.id, base, other))


@router.delete("/interviews/{interview_id}", status_code=204)
def delete(interview_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    _wrap(lambda: history_service.delete_interview(db, user.id, interview_id))
