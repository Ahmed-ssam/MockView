"""MockView local server: the API that the desktop window talks to. Started and stopped by the Electron app.

Runs database migrations, then serves the API on 127.0.0.1:8000 (one worker). Data and the Gemini key live in
MOCKVIEW_DATA_DIR (set by the desktop app to the per-user app-data folder).
"""
from __future__ import annotations

import os
import platform
import signal
import sys
from pathlib import Path

FROZEN = getattr(sys, "frozen", False)
ROOT = Path(__file__).resolve().parent.parent


def default_data_dir() -> Path:
    system = platform.system()
    if system == "Windows":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    elif system == "Darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return base / "MockView"


def main() -> int:
    data = Path(os.environ.get("MOCKVIEW_DATA_DIR") or default_data_dir())
    data.mkdir(parents=True, exist_ok=True)
    if FROZEN or sys.stdout is None:               # windowed build: no console, so log to a file
        log = open(data / "server.log", "a", buffering=1, encoding="utf-8")
        sys.stdout = sys.stderr = log
    port = int(os.environ.get("MOCKVIEW_API_PORT", "8000"))
    os.environ.update({
        "LOCAL_MODE": "1", "MOCKVIEW_DATA_DIR": str(data), "DATABASE_URL": f"sqlite:///{(data / 'mockview.db').as_posix()}",
        "CORS_ORIGINS": os.environ.get("MOCKVIEW_WEB_ORIGIN", "http://localhost:3000"), "LLM_PROVIDER": "demo", "APP_ENV": "production",
    })
    if not FROZEN:
        sys.path.insert(0, str(ROOT / "backend"))
    from alembic import command
    from alembic.config import Config
    cfg = Config()
    cfg.set_main_option("script_location", str(Path(sys._MEIPASS) / "migrations") if FROZEN else str(ROOT / "backend" / "migrations"))  # noqa: SLF001
    command.upgrade(cfg, "head")
    import uvicorn
    from app.main import app
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning", workers=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
