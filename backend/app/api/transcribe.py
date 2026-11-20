"""Speech to text for spoken answers when the app runs as a desktop program (no browser speech engine there).

The recording is read into memory, sent to Gemini with the person's own key for this one request, and discarded.
Nothing is written to disk or the database.
"""
from __future__ import annotations

import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.ai.provider import GeminiProvider, LLMError, get_provider
from app.core.ratelimit import RateLimiter
from app.core.security import CurrentUser, get_current_user

router = APIRouter(prefix="/transcribe", tags=["voice"])
_limit = RateLimiter(max_requests=int(os.getenv("WRITE_RATE_LIMIT", "40")), window_s=60)

MAX_BYTES = 5 * 1024 * 1024
ALLOWED = ("audio/webm", "audio/ogg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/aac")


@router.post("", dependencies=[Depends(_limit.dependency())])
def transcribe(file: UploadFile = File(...), language: str = Form("en"), user: CurrentUser = Depends(get_current_user)):
    mime = (file.content_type or "").split(";")[0].strip().lower()
    if mime not in ALLOWED:
        raise HTTPException(415, "Unsupported audio format.")
    audio = file.file.read(MAX_BYTES + 1)
    if len(audio) > MAX_BYTES:
        raise HTTPException(413, "That recording is too long. Please answer in shorter parts.")
    if len(audio) < 1000:
        return {"text": ""}
    provider = get_provider()
    if not isinstance(provider, GeminiProvider):
        raise HTTPException(409, "Voice answers need a Gemini API key. Add it in Settings, or type your answer.")
    try:
        text = provider.transcribe(audio, mime, "ar" if language == "ar" else "en")
    except LLMError as e:
        from app.api.settings import explain
        raise HTTPException(502, explain(str(e), provider.api_key)) from None
    return {"text": text}
