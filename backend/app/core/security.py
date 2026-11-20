"""Supabase JWT verification and role checks (server-side authorization)."""
from __future__ import annotations

import os
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

_bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    id: str
    email: str | None
    role: str  # "user" | "admin"


def _secret() -> str:
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Authentication is not configured")
    return secret


def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> CurrentUser:
    from app.core import local
    if local.local_mode():  # one person, own computer, server bound to localhost: no accounts
        return CurrentUser(id=local.LOCAL_USER_ID, email=None, role="user")
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    try:
        claims = jwt.decode(creds.credentials, _secret(), algorithms=["HS256"], audience="authenticated")
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    # Role comes from app_metadata (set server-side only), never from user_metadata.
    role = (claims.get("app_metadata") or {}).get("role", "user")
    return CurrentUser(id=sub, email=claims.get("email"), role="admin" if role == "admin" else "user")


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin access required")
    return user
