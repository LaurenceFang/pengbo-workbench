from __future__ import annotations

import re
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
    "unlock_secret",
    "current_unlock_secret",
    "new_unlock_secret",
    "pin",
    "passphrase",
    "apikey",
    "api-key",
}

SENSITIVE_TEXT_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"(?i)(authorization\s*[:=]\s*)(?:bearer\s+)?[A-Za-z0-9._~+/=-]{8,}"), r"\1***"),
    (re.compile(r"(?i)\b(api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|passphrase|unlock[_-]?secret|session[_-]?id)\s*[:=]\s*[^&\s,;]+"), r"\1=***"),
    (re.compile(r"(?i)\b(api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|passphrase|unlock[_-]?secret|session[_-]?id)(%3D|%3d)[^&\s,;]+"), r"\1%3D***"),
    (re.compile(r"(?i)([?&](?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|token|session)[=])[^&\s]+"), r"\1***"),
    (re.compile(r"(?i)([?&](?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|token|session)(?:%3D|%3d))[^&\s]+"), r"\1***"),
    (re.compile(r"(?i)\b(?:sk-[A-Za-z0-9_-]{12,}|sess(?:ion)?-[A-Za-z0-9_-]{8,}|xox[baprs]-[A-Za-z0-9-]{12,})\b"), "***"),
]


def redact_sensitive_text(value: str) -> str:
    redacted_text = value
    for pattern, replacement in SENSITIVE_TEXT_PATTERNS:
        redacted_text = pattern.sub(replacement, redacted_text)
    return redacted_text


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

    def redact(self, value: Any) -> Any:
        return self._redact(value)

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
        if isinstance(value, str):
            return redact_sensitive_text(value)
        return value
