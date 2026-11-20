"""Small in-memory sliding-window rate limiter.

Fine for a single instance; swap for Redis-backed limiting when running several
replicas (documented in the README).
"""
from __future__ import annotations

import os
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class RateLimiter:
    def __init__(self, max_requests: int, window_s: int):
        self.max, self.window = max_requests, window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._checks = 0

    def check(self, key: str) -> None:
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        self._checks += 1
        if self._checks % 1000 == 0:  # sweep visitors whose window has fully expired, so memory stays bounded
            for k in [k for k, v in self._hits.items() if not v or now - v[-1] > self.window]:
                self._hits.pop(k, None)
            q = self._hits[key]
        if len(q) >= self.max:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests, slow down")
        q.append(now)

    def dependency(self):
        def _dep(request: Request) -> None:
            self.check(client_ip(request))
        return _dep


def client_ip(request: Request) -> str:
    """Caller IP. Behind a reverse proxy every request arrives from the proxy, so set TRUST_PROXY=1 to use the
    LAST X-Forwarded-For entry (the one appended by your own proxy; earlier entries can be forged by clients)."""
    if os.getenv("TRUST_PROXY") == "1":
        fwd = request.headers.get("x-forwarded-for", "")
        if fwd:
            return fwd.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"
