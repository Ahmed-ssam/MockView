"""Smoke-test the configured AI provider:  python -m app.tools.check_llm

Sends one tiny request, validates the JSON reply the same way the app does, and explains common failures.
Never prints the API key.
"""
from __future__ import annotations

import sys
import time

from dotenv import load_dotenv
from pydantic import BaseModel

from app.ai.provider import LLMError, get_provider


class Ping(BaseModel):
    ok: bool
    word: str


HINTS = {
    "401": "The key was rejected. Check LLM_API_KEY for typos or extra spaces.",
    "403": "The key is valid but not allowed: enable the API for its project, or check key restrictions/billing.",
    "404": "Model or endpoint not found. Check LLM_MODEL (e.g. gemini-2.5-flash) and LLM_BASE_URL.",
    "429": "Rate limit or quota reached. Wait, or check the plan's quota.",
    "could not reach": "Network problem: this machine can't reach the provider (firewall/proxy/DNS).",
}


def main() -> int:
    load_dotenv()
    provider = get_provider()
    if provider.is_demo:
        print("LLM_PROVIDER is 'demo' (or unset): no real AI is configured, nothing to check.")
        return 1
    print(f"provider={provider.name} model={getattr(provider, 'model', '?')}")
    t0 = time.monotonic()
    try:
        out = provider.complete_json("You are a health check.", 'Reply with ok=true and word="pong".', Ping)
    except LLMError as e:
        msg = str(e)
        print(f"FAILED after {time.monotonic() - t0:.1f}s: {msg}")
        for key, hint in HINTS.items():
            if key in msg:
                print("hint:", hint)
                break
        return 2
    print(f"OK in {time.monotonic() - t0:.1f}s -> {out.model_dump()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
