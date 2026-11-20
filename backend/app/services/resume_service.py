"""Resume upload: validate a PDF, extract its text, keep ONLY the text (the file itself is never stored)."""
from __future__ import annotations

import re
from datetime import datetime, timezone
from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PyPdfError
from sqlalchemy.orm import Session

from app.db.models import InterviewSession, UploadedResume
from app.services.interview_engine import EngineError
from app.services.seed import ensure_profile

MAX_BYTES = 2 * 1024 * 1024
MAX_PAGES = 10
MAX_CHARS = 6000       # what is kept and what can reach a prompt
MIN_CHARS = 80         # below this the PDF is almost certainly a scan/image


def extract_text(data: bytes) -> str:
    if len(data) > MAX_BYTES:
        raise EngineError(413, "That file is larger than 2 MB. Please upload a smaller PDF.")
    if not data.startswith(b"%PDF"):
        raise EngineError(422, "Please upload a PDF file.")
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            raise EngineError(422, "This PDF is password-protected. Remove the password and try again.")
        if len(reader.pages) > MAX_PAGES:
            raise EngineError(422, f"Resumes longer than {MAX_PAGES} pages aren't supported.")
        text = "\n".join((p.extract_text() or "") for p in reader.pages)
    except EngineError:
        raise
    except (PyPdfError, ValueError, KeyError, RecursionError, OSError):
        raise EngineError(422, "We couldn't read that PDF. Try exporting it again from your editor.")
    text = re.sub(r"[ \t]+", " ", re.sub(r"[^\S\n]*\n[^\S\n]*", "\n", text))
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) < MIN_CHARS:
        raise EngineError(422, "No readable text was found. Scanned or image-only PDFs aren't supported; "
                               "export a text-based PDF instead.")
    return text[:MAX_CHARS]


def create(db: Session, user_id: str, data: bytes, consent: bool) -> dict:
    if not consent:
        raise EngineError(422, "Please confirm you agree to MockView reading your resume text to tailor questions.")
    text = extract_text(data)
    ensure_profile(db, user_id)
    r = UploadedResume(user_id=user_id, storage_path="not-stored", parsed={"text": text},
                       consent_at=datetime.now(timezone.utc))
    db.add(r)
    db.commit()
    return view(r)


def view(r: UploadedResume) -> dict:
    t = (r.parsed or {}).get("text", "")
    return {"id": r.id, "chars": len(t), "preview": t[:200], "consent_at": r.consent_at}


def list_for(db: Session, user_id: str) -> list[dict]:
    rows = (db.query(UploadedResume).filter_by(user_id=user_id, deleted_at=None)
            .order_by(UploadedResume.consent_at.desc()).all())
    return [view(r) for r in rows]


def get_owned(db: Session, user_id: str, resume_id: str) -> UploadedResume:
    r = db.query(UploadedResume).filter_by(id=resume_id, user_id=user_id, deleted_at=None).one_or_none()
    if r is None:
        raise EngineError(404, "Resume not found.")
    return r


def delete(db: Session, user_id: str, resume_id: str) -> None:
    r = get_owned(db, user_id, resume_id)
    db.query(InterviewSession).filter_by(resume_id=r.id).update({"resume_id": None})  # same result on every DB
    db.delete(r)  # hard delete: the text is gone; sessions that used it just lose the link (FK SET NULL)
    db.commit()
