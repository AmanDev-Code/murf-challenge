"""
VoicePay API Security Middleware
================================
Auth + Rate Limiting for FastAPI services (escalation_api.py, trigger_call.py).
"""

from __future__ import annotations

import hmac
import logging
import os
import time
from collections import defaultdict

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("voicepay.security")

# --- Configuration ---
DASHBOARD_API_KEY = os.environ.get("VOICEPAY_DASHBOARD_KEY", "")
RATE_LIMIT_PER_MINUTE = int(os.environ.get("VOICEPAY_RATE_LIMIT", "60"))

# Routes that don't require auth
PUBLIC_PATHS = frozenset({"/health", "/", "/docs", "/openapi.json"})


class AuthMiddleware(BaseHTTPMiddleware):
    """Validates X-API-Key header on all non-public routes."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path.rstrip("/")

        # Public paths skip auth
        if path in PUBLIC_PATHS:
            return await call_next(request)

        # If no key configured (dev mode), pass through with warning
        if not DASHBOARD_API_KEY:
            logger.debug("AUTH: no VOICEPAY_DASHBOARD_KEY set — dev mode passthrough")
            return await call_next(request)

        # Validate API key
        api_key = request.headers.get("X-API-Key", "")
        if not api_key or not hmac.compare_digest(api_key, DASHBOARD_API_KEY):
            logger.warning(
                "AUTH DENIED: ip=%s path=%s",
                request.client.host if request.client else "?",
                path,
            )
            raise HTTPException(status_code=401, detail="Invalid or missing API key")

        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """In-memory per-IP rate limiting (sliding window, 1 minute)."""

    def __init__(self, app, limit: int = RATE_LIMIT_PER_MINUTE):
        super().__init__(app)
        self._limit = limit
        self._buckets: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        ip = request.client.host if request.client else "unknown"
        now = time.time()

        # Sliding window: keep only timestamps within the last 60s
        bucket = self._buckets[ip]
        bucket[:] = [t for t in bucket if now - t < 60]

        if len(bucket) >= self._limit:
            logger.warning("RATE LIMIT: ip=%s count=%d", ip, len(bucket))
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded ({self._limit} requests/minute)",
            )

        bucket.append(now)
        return await call_next(request)

        # Periodic cleanup (every 100 requests from this IP)
        if len(bucket) % 100 == 0:
            self._cleanup()

    def _cleanup(self) -> None:
        """Remove stale IPs to prevent memory leak."""
        now = time.time()
        stale = [ip for ip, ts in self._buckets.items() if not ts or now - ts[-1] > 300]
        for ip in stale:
            del self._buckets[ip]
