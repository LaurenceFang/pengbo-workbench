from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from time import monotonic
from typing import Any, Callable

from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from ..runtime import RuntimeSettings


ALLOWED_ORIGINS = {
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
    "http://127.0.0.1:4175",
    "http://localhost:4175",
    "http://127.0.0.1:4190",
    "http://localhost:4190",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
}
ALLOWED_METHODS = {"GET", "POST", "PUT", "DELETE", "OPTIONS"}
REDACTED_HEADERS = {"authorization", "cookie", "x-pengbo-session"}
RATE_LIMIT_WINDOW_SECONDS = 60.0
DEFAULT_RATE_LIMIT = 240
SENSITIVE_RATE_LIMIT = 60


SENSITIVE_PREFIXES = (
    "/api/v1/security",
    "/api/v1/connections",
    "/api/v1/execution",
    "/api/v1/research/briefs",
    "/api/v1/research/evidence",
    "/api/v1/factors/runs",
    "/api/v1/workflows/runs",
    "/api/v1/portfolio",
    "/api/v1/settings/runtime",
    "/api/v1/settings/ai-control",
    "/api/v1/strategies/reports",
    "/api/v1/data-sources/reports",
)


def is_loopback_host(host: str) -> bool:
    normalized = host.strip().lower()
    return normalized in {"127.0.0.1", "localhost", "::1"}


def validate_sidecar_bind(settings: RuntimeSettings) -> None:
    if is_loopback_host(settings.host):
        return
    raise ValueError(
        "Pengbo sidecar refuses non-loopback bind addresses by default. "
        "Keep the desktop runtime on 127.0.0.1 until a future public deployment task explicitly enables it."
    )


def allowed_origins() -> list[str]:
    return sorted(ALLOWED_ORIGINS)


@dataclass(frozen=True)
class GatewayDecision:
    allowed: bool
    status_code: int = 200
    reason: str = "allowed"


class GatewayRateLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, *, limit: int, now: float | None = None) -> bool:
        timestamp = monotonic() if now is None else now
        bucket = self._buckets[key]
        while bucket and timestamp - bucket[0] > RATE_LIMIT_WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= limit:
            return False
        bucket.append(timestamp)
        return True


def _classify_surface(path: str) -> str:
    if path.startswith("/api/v1/security"):
        return "security_gateway"
    if path.startswith("/api/v1/connections"):
        return "connections"
    if path.startswith("/api/v1/research"):
        return "research"
    if path.startswith("/api/v1/factors"):
        return "factor_lab"
    if path.startswith("/api/v1/workflows"):
        return "workflow_studio"
    if path.startswith("/api/v1/portfolio"):
        return "portfolio"
    if path.startswith("/api/v1/settings"):
        return "settings"
    if path.startswith("/api/v1/execution"):
        return "strategy_lab"
    if path.startswith("/api/v1/strategies/reports"):
        return "strategy_lab"
    if path.startswith("/api/v1/data-sources/reports"):
        return "data_sources"
    return "sidecar"


def _is_sensitive_path(path: str) -> bool:
    return path.startswith(SENSITIVE_PREFIXES)


def _redacted_headers(headers: dict[str, str]) -> dict[str, str]:
    redacted: dict[str, str] = {}
    for key, value in headers.items():
        lowered = key.lower()
        redacted[key] = "***" if lowered in REDACTED_HEADERS or "token" in lowered or "secret" in lowered else value
    return redacted


def _gateway_payload(request: Request, *, reason: str, origin: str | None) -> dict[str, Any]:
    return {
        "method": request.method,
        "path": request.url.path,
        "origin": origin,
        "reason": reason,
        "has_session_header": bool(request.headers.get("x-pengbo-session")),
        "headers": _redacted_headers(
            {
                key: value
                for key, value in request.headers.items()
                if key.lower() in {"origin", "user-agent", "host", "x-pengbo-session", "authorization", "cookie"}
            }
        ),
    }


class GatewayHardeningMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: FastAPI, *, settings: RuntimeSettings) -> None:
        super().__init__(app)
        self.settings = settings
        self.rate_limiter = GatewayRateLimiter()

    async def dispatch(self, request: Request, call_next: Callable[[Request], Any]) -> Response:
        decision = self._decide(request)
        if not decision.allowed:
            self._record(request, event_type="gateway_request_rejected", reason=decision.reason)
            return JSONResponse(status_code=decision.status_code, content={"detail": decision.reason})

        response = await call_next(request)
        if _is_sensitive_path(request.url.path) and response.status_code >= 400:
            self._record(request, event_type="gateway_sensitive_request_observed", reason=f"http_{response.status_code}")
        return response

    def _decide(self, request: Request) -> GatewayDecision:
        if request.method not in ALLOWED_METHODS:
            return GatewayDecision(False, 405, "method_not_allowed")

        origin = request.headers.get("origin")
        if origin and origin not in ALLOWED_ORIGINS:
            return GatewayDecision(False, 403, "origin_not_allowed")

        limit = SENSITIVE_RATE_LIMIT if _is_sensitive_path(request.url.path) else DEFAULT_RATE_LIMIT
        rate_key = f"{request.client.host if request.client else 'local'}:{request.method}:{request.url.path}"
        if not self.rate_limiter.allow(rate_key, limit=limit):
            return GatewayDecision(False, 429, "rate_limit_exceeded")

        return GatewayDecision(True)

    def _record(self, request: Request, *, event_type: str, reason: str) -> None:
        container = getattr(request.app.state, "container", None)
        audit_service = getattr(container, "security_audit_service", None) if container is not None else None
        if audit_service is None:
            return
        origin = request.headers.get("origin")
        audit_service.record(
            category="gateway",
            event_type=event_type,
            surface=_classify_surface(request.url.path),
            summary=f"Gateway request {reason}.",
            payload=_gateway_payload(request, reason=reason, origin=origin),
        )
