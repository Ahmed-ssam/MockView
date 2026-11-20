import logging
import os
import time
import uuid

from dotenv import load_dotenv

load_dotenv()  # reads backend/.env (git-ignored); real environment variables take precedence

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.ai.provider import get_provider
from app.api import admin, history, interviewers, interviews, me, resumes, specializations
from app.core.ratelimit import RateLimiter

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

log = logging.getLogger("mockview.http")

if os.getenv("SENTRY_DSN"):  # optional error tracking; install sentry-sdk to use it
    try:
        import sentry_sdk
        sentry_sdk.init(dsn=os.environ["SENTRY_DSN"], traces_sample_rate=0.0, send_default_pii=False)
    except ImportError:
        logging.getLogger("mockview").warning("SENTRY_DSN is set but sentry-sdk is not installed")

_prod = os.getenv("APP_ENV") == "production"
# Interactive API docs are handy locally but needlessly public in production.
app = FastAPI(title="MockView API", version="1.0.0",
              docs_url=None if _prod else "/docs", redoc_url=None, openapi_url=None if _prod else "/openapi.json")


@app.middleware("http")
async def request_context(request: Request, call_next):
    rid = request.headers.get("x-request-id", "")[:64] or uuid.uuid4().hex[:12]
    t0 = time.monotonic()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("unhandled error rid=%s %s %s", rid, request.method, request.url.path)
        raise
    ms = (time.monotonic() - t0) * 1000
    # Path only: never log query strings, bodies or headers (they can hold tokens or candidate text).
    log.info("rid=%s %s %s -> %d %.0fms", rid, request.method, request.url.path, response.status_code, ms)
    response.headers["X-Request-ID"] = rid
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = response.headers.get("Cache-Control", "no-store")
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    if _prod:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

_public_limit = RateLimiter(max_requests=120, window_s=60)
app.include_router(specializations.router, prefix="/api/v1", dependencies=[Depends(_public_limit.dependency())])
app.include_router(interviewers.router, prefix="/api/v1", dependencies=[Depends(_public_limit.dependency())])
app.include_router(interviews.router, prefix="/api/v1")
app.include_router(history.router, prefix="/api/v1")
app.include_router(resumes.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(me.router, prefix="/api/v1")
from app.api import transcribe as _transcribe  # noqa: E402

app.include_router(_transcribe.router, prefix="/api/v1")

from app.core import local as _local  # noqa: E402

from app.api import settings as _settings  # noqa: E402

app.include_router(_settings.router, prefix="/api/v1")  # every route 404s unless LOCAL_MODE=1


@app.middleware("http")
async def local_host_guard(request: Request, call_next):
    # In local mode only answer requests addressed to this computer (blocks DNS-rebinding from other websites).
    if _local.local_mode() and request.url.hostname not in ("localhost", "127.0.0.1", "::1", "testserver"):
        return JSONResponse({"detail": "Local mode only accepts requests to localhost"}, status_code=400)
    return await call_next(request)


@app.get("/api/v1/config")
def public_config():
    """Tells the frontend whether it is running in local (no-login) mode."""
    return {"local_mode": _local.local_mode()}


@app.get("/health/ready")
def ready():
    """Readiness: can we reach the database? (/health stays cheap for liveness probes.)"""
    from sqlalchemy import text
    from fastapi.responses import JSONResponse
    from app.db.session import engine
    try:
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
    except Exception:
        log.exception("readiness check failed")
        return JSONResponse({"status": "unavailable"}, status_code=503)
    return {"status": "ready"}


@app.get("/health")
def health():
    provider = get_provider()
    return {
        "status": "ok",
        "ai_provider": provider.name,
        # The UI uses this to badge demo output; demo is never presented as real AI.
        "demo_mode": provider.is_demo,
    }
