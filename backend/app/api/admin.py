from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.ai.provider import LLMProvider, get_provider
from app.core.security import CurrentUser, require_admin
from app.db.session import get_db
from app.services import admin_service as svc
from app.services.interview_engine import EngineError

log = logging.getLogger("mockview.admin")
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/stats")
def stats(db: Session = Depends(get_db), provider: LLMProvider = Depends(get_provider)):
    return svc.stats(db, provider)


@router.get("/users")
def users(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0), db: Session = Depends(get_db)):
    return svc.users(db, limit, offset)


@router.get("/interviews")
def interviews(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    return svc.recent_interviews(db, limit)


@router.get("/catalog")
def catalog(db: Session = Depends(get_db)):
    return svc.catalog_health(db)


@router.get("/audit")
def audit(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    return svc.audit(db, limit)


@router.delete("/users/{user_id}")
def erase_user(user_id: str, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    try:
        return svc.delete_user_data(db, admin.id, user_id)
    except EngineError as e:
        raise HTTPException(e.status, e.message)
