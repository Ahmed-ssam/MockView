from __future__ import annotations

import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.ratelimit import RateLimiter
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db
from app.services import resume_service as svc
from app.services.interview_engine import EngineError

router = APIRouter(prefix="/resumes", tags=["resumes"])
_limit = RateLimiter(max_requests=int(os.getenv("WRITE_RATE_LIMIT", "40")), window_s=60)


def _wrap(fn):
    try:
        return fn()
    except EngineError as e:
        raise HTTPException(e.status, e.message)


@router.post("", status_code=201, dependencies=[Depends(_limit.dependency())])
async def upload(file: UploadFile = File(...), consent: bool = Form(False),
                 user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    data = await file.read(svc.MAX_BYTES + 1)  # never buffer more than the cap
    return _wrap(lambda: svc.create(db, user.id, data, consent))


@router.get("")
def list_resumes(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_for(db, user.id)


@router.delete("/{resume_id}", status_code=204)
def delete_resume(resume_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    _wrap(lambda: svc.delete(db, user.id, resume_id))
