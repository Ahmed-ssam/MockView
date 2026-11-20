"""Settings for local mode: the person's own Gemini key. Not mounted unless LOCAL_MODE=1."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.ai.models import available_models
from app.ai.provider import DEFAULT_PING, GeminiProvider, LLMError
from app.core import local

def _only_local():
    if not local.local_mode():
        raise HTTPException(404, "Not found")


router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(_only_local)])


class SettingsIn(BaseModel):
    api_key: str | None = Field(default=None, max_length=400)
    model: str | None = Field(default=None, max_length=60)


def _view() -> dict:
    s = local.load_settings()
    key = s.get("api_key") or ""
    return {"key_set": bool(key), "key_hint": ("…" + key[-4:]) if key else None,
            "model": s.get("model") or local.DEFAULT_MODEL, "provider": "gemini" if key else "demo"}


@router.get("")
def get_settings():
    return _view()


@router.put("")
def put_settings(body: SettingsIn):
    s = local.load_settings()
    if body.api_key is not None:
        key = body.api_key.strip()
        if not local.valid_key(key):
            raise HTTPException(422, "That doesn't look like a Gemini API key. Copy it again from Google AI Studio.")
        s["api_key"] = key
    if body.model is not None:
        model = body.model.strip() or local.DEFAULT_MODEL
        if not local.valid_model(model):
            raise HTTPException(422, "Model names may only contain letters, digits, dots, dashes and underscores.")
        s["model"] = model
    local.save_settings(s)
    return _view()


@router.delete("/key")
def delete_key():
    s = local.load_settings()
    s.pop("api_key", None)
    local.save_settings(s)
    return _view()


@router.post("/models")
def list_models(body: SettingsIn):
    """Which Gemini models can this key actually use? Used to fill the dropdown (typed key, else the saved one)."""
    key = (body.api_key or local.load_settings().get("api_key") or "").strip()
    if not local.valid_key(key):
        return {"ok": False, "message": "Paste your Gemini API key first.", "models": []}
    try:
        found = available_models(key)
    except LLMError as e:
        msg = str(e)
        return {"ok": False, "message": explain(msg, key), "models": []}
    if not found["models"]:
        return {"ok": False, "models": [], "message": "This key didn't answer for any known Gemini model. Check that the Gemini API is enabled for it."}
    return {"ok": True, "models": found["models"], "method": found["method"],
            "message": f"{len(found['models'])} usable model(s) found."}


@router.post("/test")
def test_key(body: SettingsIn):
    """Make one tiny request with the typed (or saved) key so the person knows it works before interviewing."""
    s = local.load_settings()
    key = (body.api_key or s.get("api_key") or "").strip()
    model = (body.model or s.get("model") or local.DEFAULT_MODEL).strip()
    if not local.valid_key(key):
        return {"ok": False, "message": "Paste your Gemini API key first."}
    if not local.valid_model(model):
        return {"ok": False, "message": "That model name isn't valid."}
    try:
        GeminiProvider(key, model).complete(DEFAULT_PING, "ping", max_tokens=64)
    except LLMError as e:
        return {"ok": False, "message": explain(str(e), key)}
    return {"ok": True, "message": "Your key works. Real AI interviews are on."}


_HINTS = {
    "401": "The key was rejected. Check it for typos or extra spaces.",
    "403": "The key isn't allowed to use Gemini.",
    "404": "Model not found. Try gemini-2.5-flash.",
    "429": "Quota or rate limit reached. Wait a bit, or check your plan.",
    "could not reach": "Can't reach Google from this computer (firewall, proxy or no internet).",
}
def explain(msg: str, key: str) -> str:
    """A person-readable reason: what happened, then what to do. Google's raw text is kept short and last."""
    code = next((c for c in ("401", "403", "404", "429") if f"error {c}" in msg), "")
    hint = _HINTS.get(code) or next((h for k, h in _HINTS.items() if k in msg), "")
    low = msg.lower()
    if "not been used" in low or "is disabled" in low or "has not been enabled" in low:
        return ("The Gemini API (Generative Language API) is switched off for this key's Google Cloud project. Enable it at "
                "console.cloud.google.com/apis/library/generativelanguage.googleapis.com, wait a minute, then try again.")
    if code in ("401", "403"):
        return ("Google rejected this key. Check that you copied the whole key: open the key's details in Google AI Studio and use "
                "“Copy key” (the list only shows a shortened version; a full key is about 53 characters). "
                f"If it still fails, create a new key in a new project. (Google error {code})")
    detail = " ".join(msg.split())[:160]
    return f"{hint} ({detail})" if hint else detail
