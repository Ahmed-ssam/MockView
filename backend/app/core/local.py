"""Local mode: MockView running on one person's own computer.

Enabled with LOCAL_MODE=1. There are no accounts (one fixed local user), usage limits are off (the person is
spending their own Gemini quota), and the Gemini API key is typed into the Settings page and stored in a file on
this machine (permissions 600). The key is never returned by the API and never logged.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

LOCAL_USER_ID = "local-user"
DEFAULT_MODEL = "gemini-2.5-flash"
_MODEL_RE = re.compile(r"^[A-Za-z0-9._-]{1,60}$")
_KEY_RE = re.compile(r"^[A-Za-z0-9._\-]{20,400}$")


def local_mode() -> bool:
    return os.getenv("LOCAL_MODE", "0") == "1"


def settings_path() -> Path:
    return Path(os.getenv("MOCKVIEW_DATA_DIR", "./data")) / "settings.json"


def load_settings() -> dict:
    try:
        data = json.loads(settings_path().read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def save_settings(data: dict) -> None:
    p = settings_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f)
    os.replace(tmp, p)


def valid_key(key: str) -> bool:
    return bool(_KEY_RE.match(key))


def valid_model(model: str) -> bool:
    return bool(_MODEL_RE.match(model))
