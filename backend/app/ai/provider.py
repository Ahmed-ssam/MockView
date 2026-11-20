"""Provider-independent LLM layer.

Business logic only ever calls `complete_json(...)`. Providers are chosen by the
LLM_PROVIDER env var: `openai_compatible` (OpenAI, Groq, OpenRouter, Together,
Ollama, vLLM...), `gemini` (native Google API: AI Studio keys and Vertex AI express keys), `anthropic`, or `demo`.
"""
from __future__ import annotations

import json
import base64
import os
import re
from abc import ABC, abstractmethod
from typing import Type, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)


class LLMError(RuntimeError):
    pass


DEFAULT_PING = 'Reply with the JSON object {"ok": true}.'
DEFAULT_MODEL = "gemini-2.5-flash"


class LLMProvider(ABC):
    name: str = "base"
    is_demo: bool = False

    @abstractmethod
    def complete(self, system: str, user: str, max_tokens: int = 2000) -> str:
        """Return raw text from the model."""

    def complete_json(self, system: str, user: str, schema: Type[T], retries: int = 2) -> T:
        """Call the model, validate against `schema`, retry with the error appended."""
        prompt = user + "\n\nRespond with a single JSON object only, matching this schema:\n" + json.dumps(
            schema.model_json_schema()
        )
        last_err: Exception | None = None
        for _ in range(retries + 1):
            raw = self.complete(system, prompt)
            try:
                return schema.model_validate_json(_extract_json(raw))
            except (ValidationError, ValueError) as e:
                last_err = e
                prompt = (
                    user
                    + "\n\nYour previous reply was invalid: "
                    + str(e)[:500]
                    + "\nReturn corrected JSON only."
                )
        raise LLMError(f"model returned invalid JSON after {retries + 1} attempts: {last_err}")


def _extract_json(text: str) -> str:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object found")
    return text[start : end + 1]


def _post(url: str, headers: dict, body: dict, secret: str) -> dict:
    """POST and return JSON. Every failure becomes LLMError; the API key never appears in the message."""
    try:
        r = httpx.post(url, headers=headers, json=body, timeout=60)
    except httpx.HTTPError as e:
        raise LLMError(f"could not reach the AI provider ({type(e).__name__})") from None
    if r.status_code >= 400:
        snippet = r.text[:200].replace(secret, "***") if secret else r.text[:200]
        raise LLMError(f"provider error {r.status_code}: {snippet}")
    try:
        return r.json()
    except ValueError:
        raise LLMError("provider returned a non-JSON response") from None


class OpenAICompatibleProvider(LLMProvider):
    name = "openai_compatible"

    def __init__(self, base_url: str, api_key: str, model: str):
        self.base_url, self.api_key, self.model = base_url.rstrip("/"), api_key, model

    def complete(self, system: str, user: str, max_tokens: int = 2000) -> str:
        data = _post(f"{self.base_url}/chat/completions", {"Authorization": f"Bearer {self.api_key}"}, {
            "model": self.model, "max_tokens": max_tokens, "temperature": 0.3,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}, self.api_key)
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            raise LLMError("unexpected response shape from the AI provider") from None


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str):
        self.api_key, self.model = api_key, model

    def complete(self, system: str, user: str, max_tokens: int = 2000) -> str:
        data = _post("https://api.anthropic.com/v1/messages",
                     {"x-api-key": self.api_key, "anthropic-version": "2023-06-01"},
                     {"model": self.model, "max_tokens": max_tokens, "system": system,
                      "messages": [{"role": "user", "content": user}]}, self.api_key)
        try:
            return data["content"][0]["text"]
        except (KeyError, IndexError, TypeError):
            raise LLMError("unexpected response shape from the AI provider") from None


AI_STUDIO_BASE = "https://generativelanguage.googleapis.com/v1beta"
VERTEX_BASE = "https://aiplatform.googleapis.com/v1/publishers/google"
_WORKING_BASE: dict[str, str] = {}   # key -> the host that accepted it (memory only, never written to disk)


def _status(e: LLMError) -> int:
    m = re.search(r"error (\d{3})", str(e))
    return int(m.group(1)) if m else 0


class GeminiProvider(LLMProvider):
    """Google's native generateContent API, authenticated with an `x-goog-api-key` header.

    Since May 2026 Google AI Studio issues keys that start with "AQ." (older ones start with "AIza"); both work with
    generativelanguage.googleapis.com. Keys that start with "AQ." can also be Vertex AI express keys, which use
    aiplatform.googleapis.com, so for "AQ." keys the AI Studio host is tried first and Vertex second, and whichever
    answers is remembered. LLM_BASE_URL overrides all of this.
    """

    name = "gemini"

    def __init__(self, api_key: str, model: str, base_url: str | None = None):
        self.api_key, self.model = api_key, model
        if base_url:
            self.bases = [base_url.rstrip("/")]
        elif api_key.startswith("AQ."):
            self.bases = [AI_STUDIO_BASE, VERTEX_BASE]
        else:
            self.bases = [AI_STUDIO_BASE]
        known = _WORKING_BASE.get(api_key)
        if known in self.bases:
            self.bases = [known] + [b for b in self.bases if b != known]

    @property
    def base(self) -> str:
        return self.bases[0]

    def _call(self, body: dict) -> dict:
        """POST to the first host that accepts the key (AQ. keys: AI Studio host, then Vertex), remembering the winner."""
        first_error: LLMError | None = None
        for idx, base in enumerate(self.bases):
            try:
                data = _post(f"{base}/models/{self.model}:generateContent", {"x-goog-api-key": self.api_key}, body, self.api_key)
                _WORKING_BASE[self.api_key] = base
                return data
            except LLMError as e:
                if idx == 0:
                    first_error = e                       # the first host's reason is the most relevant one
                if _status(e) not in (400, 401, 403, 404):
                    raise                                 # network / quota / server problem: another host would not help
                if idx == len(self.bases) - 1:
                    raise first_error or e
        raise first_error or LLMError("no provider host answered")  # pragma: no cover

    @staticmethod
    def _text(data: dict) -> str:
        try:
            cand = data["candidates"][0]
            text = "".join(p.get("text", "") for p in cand["content"]["parts"])
        except (KeyError, IndexError, TypeError):
            reason = (data.get("promptFeedback") or {}).get("blockReason") if isinstance(data, dict) else None
            raise LLMError("the AI provider returned no answer" + (f" (blocked: {reason})" if reason else "")) from None
        return text

    def complete(self, system: str, user: str, max_tokens: int = 2000) -> str:
        text = self._text(self._call({
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            # Gemini 2.5 "thinking" tokens count against the output limit, so leave generous headroom.
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": max(max_tokens, 4096),
                                 "responseMimeType": "application/json"}}))
        if not text.strip():
            raise LLMError("the AI provider returned an empty answer")
        return text

    def transcribe(self, audio: bytes, mime: str, language: str) -> str:
        """Speech to text for a spoken interview answer. The audio is sent to Google for this one request and never stored."""
        lang = "Arabic" if language == "ar" else "English"
        text = self._text(self._call({
            "contents": [{"role": "user", "parts": [
                {"text": f"Transcribe this spoken interview answer verbatim in {lang}. Keep technical terms and code names in "
                         "their original Latin spelling. Output only the transcript text, with punctuation. If there is no "
                         "speech, output nothing."},
                {"inlineData": {"mimeType": mime, "data": base64.b64encode(audio).decode("ascii")}}]}],
            "generationConfig": {"temperature": 0, "maxOutputTokens": 4096}}))
        return text.strip()


class DemoProvider(LLMProvider):
    """No real AI. Every result produced through it must be labelled DEMO in the UI."""

    name = "demo"
    is_demo = True

    def complete(self, system: str, user: str, max_tokens: int = 2000) -> str:
        raise LLMError("demo provider has no model; callers must use their explicit demo fallbacks")


def get_provider() -> LLMProvider:
    from app.core import local  # local import: keeps the provider layer free of web concerns
    if local.local_mode():
        s = local.load_settings()
        if s.get("api_key"):  # the person's own key, typed into Settings
            return GeminiProvider(s["api_key"], s.get("model") or DEFAULT_MODEL)
    kind = os.getenv("LLM_PROVIDER", "demo")
    if kind == "openai_compatible":
        return OpenAICompatibleProvider(
            os.environ["LLM_BASE_URL"], os.environ["LLM_API_KEY"], os.environ["LLM_MODEL"]
        )
    if kind == "gemini":
        return GeminiProvider(os.environ["LLM_API_KEY"], os.environ.get("LLM_MODEL") or "gemini-2.5-flash",
                              os.environ.get("LLM_BASE_URL") or None)
    if kind == "anthropic":
        return AnthropicProvider(os.environ["LLM_API_KEY"], os.environ["LLM_MODEL"])
    return DemoProvider()
