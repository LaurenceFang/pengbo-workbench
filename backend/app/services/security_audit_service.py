from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from ..models import SecurityAuditEvent
from ..storage.sqlite_store import SqliteStore


SENSITIVE_KEYS = {
    "api_key",
    "secret",
    "password",
    "session",
    "token",
    "access_token",
    "authorization",
    "cookie",
    "refresh_token",
    "private_key",
    "identity",
}


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


class SecurityAuditService:
    def __init__(self, sqlite_store: SqliteStore) -> None:
        self.sqlite_store = sqlite_store

    def record(
        self,
        *,
        category: str,
        event_type: str,
        summary: str,
        subject: str | None = None,
        payload: dict[str, Any] | None = None,
        actor: str = "local_user",
        surface: str = "sidecar",
    ) -> SecurityAuditEvent:
        event = SecurityAuditEvent(
            event_id=f"security-{uuid4().hex[:12]}",
            created_at=_utc_now_iso(),
            category=category,
            event_type=event_type,
            actor=actor,
            surface=surface,
            subject=subject,
            summary=summary,
            payload=self._redact(payload or {}),
        )
        self.sqlite_store.create_security_audit_event(event.model_dump(mode="json"))
        return event

    def list_events(self, limit: int = 100, category: str | None = None) -> list[SecurityAuditEvent]:
        return [
            SecurityAuditEvent.model_validate(item)
            for item in self.sqlite_store.list_security_audit_events(limit=limit, category=category)
        ]

    def _redact(self, value: Any) -> Any:
        if isinstance(value, dict):
            redacted: dict[str, Any] = {}
            for key, item in value.items():
                lowered = str(key).lower()
                if any(sensitive in lowered for sensitive in SENSITIVE_KEYS):
                    redacted[key] = "***"
                else:
                    redacted[key] = self._redact(item)
            return redacted
        if isinstance(value, list):
            return [self._redact(item) for item in value]
        return value
