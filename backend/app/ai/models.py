"""Find out which Gemini models a given API key can actually use (powers the model dropdown in Settings).

AI Studio keys ("AIza...") can list models directly. Vertex AI express keys ("AQ....") usually cannot, so each
well-known model is probed with a tiny request instead; only models that answer are offered. Nothing here
guesses: a model appears in the dropdown only if Google listed it for the key or it answered a real request.
"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import httpx

from app.ai.provider import LLMError

AI_STUDIO = "https://generativelanguage.googleapis.com/v1beta"
VERTEX = "https://aiplatform.googleapis.com/v1"
VERTEX_BETA = "https://aiplatform.googleapis.com/v1beta1"

# Probed only when the key cannot list models. Ordered cheapest/fastest first.
CANDIDATES = (
    "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro",
    "gemini-2.0-flash", "gemini-2.0-flash-lite",
    "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-pro-latest",
    "gemini-3-flash-preview", "gemini-3-pro-preview",
)
_SKIP = ("embedding", "tts", "imagen", "image", "live", "audio", "aqa", "veo", "robotics", "computer-use", "vision")


def _is_text_model(model_id: str) -> bool:
    return model_id.startswith("gemini") and not any(s in model_id for s in _SKIP)


def _sort_key(model_id: str) -> tuple:
    unstable = any(t in model_id for t in ("preview", "exp", "latest"))
    return (unstable, "lite" in model_id, model_id)


def _get(url: str, key: str) -> dict:
    try:
        r = httpx.get(url, headers={"x-goog-api-key": key}, timeout=20)
    except httpx.HTTPError as e:
        raise LLMError(f"could not reach Google ({type(e).__name__})") from None
    if r.status_code >= 400:
        raise LLMError(f"provider error {r.status_code}")
    try:
        return r.json()
    except ValueError:
        raise LLMError("provider returned a non-JSON response") from None


def _list_ai_studio(key: str) -> list[str]:
    ids: list[str] = []
    token = ""
    for _ in range(5):
        data = _get(f"{AI_STUDIO}/models?pageSize=1000" + (f"&pageToken={token}" if token else ""), key)
        for m in data.get("models", []):
            if "generateContent" in m.get("supportedGenerationMethods", []):
                ids.append(str(m.get("name", "")).removeprefix("models/"))
        token = data.get("nextPageToken") or ""
        if not token:
            break
    return ids


def _list_vertex(key: str) -> list[str]:
    data = _get(f"{VERTEX_BETA}/publishers/google/models?pageSize=200", key)
    return [str(m.get("name", "")).rsplit("/", 1)[-1] for m in data.get("publisherModels", [])]


def _probe(key: str, base: str, model_id: str) -> int:
    """HTTP status of a tiny generateContent request (0 = could not reach Google)."""
    try:
        r = httpx.post(f"{base}/models/{model_id}:generateContent", headers={"x-goog-api-key": key}, timeout=25,
                       json={"contents": [{"role": "user", "parts": [{"text": "Reply with: ok"}]}],
                             "generationConfig": {"maxOutputTokens": 32}})
        return r.status_code
    except httpx.HTTPError:
        return 0


def _filter(ids: list[str]) -> list[str]:
    return sorted({i for i in ids if _is_text_model(i)}, key=_sort_key)


def _worst(codes: list[int]) -> int | None:
    seen = [c for c in codes if c]
    return next((c for c in (401, 403, 400, 404, 429) if c in seen), seen[0] if seen else None)


def available_models(key: str) -> dict:
    """Returns {"models": [ids], "method": "listed" | "probed"}; raises LLMError with the most relevant reason if none work.

    "AIza" keys list models on the AI Studio host. "AQ." keys are new-style AI Studio keys OR Vertex express keys, so the
    AI Studio host is tried first, then Vertex; when listing is refused, each well-known model is probed directly."""
    hosts = [("studio", AI_STUDIO)]
    if key.startswith("AQ."):
        hosts.append(("vertex", f"{VERTEX}/publishers/google"))
    first_error: LLMError | None = None
    for kind, _ in hosts:
        try:
            ids = _filter(_list_ai_studio(key) if kind == "studio" else _list_vertex(key))
        except LLMError as e:
            if "could not reach" in str(e):
                raise
            first_error = first_error or e
            continue
        if ids or not key.startswith("AQ."):
            return {"models": ids, "method": "listed"}
    if not key.startswith("AQ."):
        raise first_error or LLMError("provider error 0")
    all_codes: list[int] = []
    for _, base in hosts:
        with ThreadPoolExecutor(max_workers=5) as pool:
            codes = list(pool.map(lambda m: _probe(key, base, m), CANDIDATES))
        ids = sorted((m for m, c in zip(CANDIDATES, codes) if c == 200), key=_sort_key)
        if ids:
            return {"models": ids, "method": "probed"}
        all_codes += codes if not all_codes else []       # report the AI Studio host's answers, not Vertex's
    worst = _worst(all_codes)
    if worst is None:
        raise LLMError("could not reach Google")
    raise LLMError(f"provider error {worst}")
