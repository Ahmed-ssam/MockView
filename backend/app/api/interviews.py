from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.ai.provider import LLMError, LLMProvider, get_provider
from app.core.ratelimit import RateLimiter
from app.core.security import CurrentUser, get_current_user
from app.db.session import get_db
from app.schemas.interview import InterviewConfig
from app.schemas.views import AnswerIn, AnswerResult, InterviewView
from app.services import interview_engine as engine
from app.services import pdf_service, report_service

log = logging.getLogger("mockview.api")
router = APIRouter(prefix="/interviews", tags=["interviews"])

# Per-IP cap on expensive endpoints, on top of the daily interview limit.
_write_limit = RateLimiter(max_requests=int(os.getenv("WRITE_RATE_LIMIT", "40")), window_s=60)

AI_DOWN = "The AI interviewer is temporarily unavailable. Nothing was lost; please try again."


def _wrap(fn):
    try:
        return fn()
    except engine.EngineError as e:
        raise HTTPException(e.status, e.message)
    except LLMError:
        log.exception("LLM call failed")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, AI_DOWN)


@router.post("", response_model=InterviewView, status_code=201, dependencies=[Depends(_write_limit.dependency())])
def create(cfg: InterviewConfig, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
           provider: LLMProvider = Depends(get_provider)):
    def run():
        s = engine.create_interview(db, user.id, cfg, provider)
        return engine.build_view(db, s)
    try:
        return _wrap(run)
    except HTTPException:
        db.rollback()
        raise


@router.get("/{interview_id}", response_model=InterviewView)
def read(interview_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return _wrap(lambda: engine.build_view(db, engine.get_owned(db, user.id, interview_id)))


@router.post("/{interview_id}/abandon", response_model=InterviewView)
def abandon(interview_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return _wrap(lambda: engine.abandon(db, user.id, interview_id))


@router.post("/{interview_id}/answers", response_model=AnswerResult,
             dependencies=[Depends(_write_limit.dependency())])
def answer(interview_id: str, body: AnswerIn, user: CurrentUser = Depends(get_current_user),
           db: Session = Depends(get_db), provider: LLMProvider = Depends(get_provider)):
    try:
        return _wrap(lambda: engine.submit_answer(db, user.id, interview_id, body.text, body.skipped,
                                                  body.source, provider))
    except HTTPException:
        db.rollback()  # on any failure the answer is NOT stored, so the client can safely retry
        raise


@router.post("/{interview_id}/finish", dependencies=[Depends(_write_limit.dependency())])
def finish(interview_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
           provider: LLMProvider = Depends(get_provider)):
    try:
        return _wrap(lambda: report_service.finish_interview(db, user.id, interview_id, provider))
    except HTTPException:
        db.rollback()
        raise


@router.get("/{interview_id}/report")
def report(interview_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return _wrap(lambda: report_service.build_report_view(db, engine.get_owned(db, user.id, interview_id)))


@router.get("/{interview_id}/report.pdf", dependencies=[Depends(_write_limit.dependency())])
def report_pdf(interview_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    def run():
        s = engine.get_owned(db, user.id, interview_id)
        if s.language == "ar":
            raise engine.EngineError(422, "PDF export isn't available for Arabic reports yet. Use your browser's Print > Save as PDF.")
        return pdf_service.build_pdf(report_service.build_report_view(db, s))
    data = _wrap(run)
    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="mockview-report-{interview_id[:8]}.pdf"'})


@router.post("/{interview_id}/practice", response_model=InterviewView, status_code=201,
             dependencies=[Depends(_write_limit.dependency())])
def practice(interview_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db),
             provider: LLMProvider = Depends(get_provider)):
    def run():
        s = report_service.start_practice(db, user.id, interview_id, provider)
        return engine.build_view(db, s)
    try:
        return _wrap(run)
    except HTTPException:
        db.rollback()
        raise
