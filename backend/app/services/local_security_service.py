from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from ..models import (
    LocalSecurityChangeSecretRequest,
    LocalSecurityInitializeRequest,
    LocalSecurityResetRequest,
    LocalSecurityStatus,
    LocalSecurityTouchRequest,
    LocalSecurityUnlockRequest,
)
from ..storage.sqlite_store import SqliteStore
from .security_audit_service import SecurityAuditService


IDLE_TIMEOUT_SECONDS = 10 * 60
LOCKOUT_SECONDS = 5 * 60
MAX_FAILED_ATTEMPTS = 5
RESET_CONFIRMATION = "RESET LOCAL UNLOCK"
SENSITIVE_SURFACES = [
    "connections",
    "provider_credentials",
    "execution_risk",
    "security_audit",
    "workflow_sensitive",
    "settings_runtime",
    "ai_assistant",
    "research_workspace",
    "data_sources",
    "portfolio",
    "factor_lab",
]


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _utc_now_iso() -> str:
    return _utc_now().isoformat()


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value)


def _hash_secret(secret: str, salt_hex: str) -> str:
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        secret.encode("utf-8"),
        bytes.fromhex(salt_hex),
        250_000,
    )
    return digest.hex()


class LocalSecurityService:
    def __init__(self, sqlite_store: SqliteStore, audit_service: SecurityAuditService) -> None:
        self.sqlite_store = sqlite_store
        self.audit_service = audit_service

    def get_status(self) -> LocalSecurityStatus:
        record = self.sqlite_store.get_local_security_state()
        if record is None:
            return self._status_from_record(None)
        record = self._expire_if_idle(record)
        return self._status_from_record(record)

    def initialize(self, payload: LocalSecurityInitializeRequest) -> LocalSecurityStatus:
        existing = self.sqlite_store.get_local_security_state()
        if existing is not None:
            raise ValueError("Local unlock has already been initialized.")

        now = _utc_now()
        salt_hex = secrets.token_hex(16)
        record = {
            "pin_hash": _hash_secret(payload.unlock_secret, salt_hex),
            "salt": salt_hex,
            "initialized_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "unlocked_until": (now + timedelta(seconds=IDLE_TIMEOUT_SECONDS)).isoformat(),
            "locked_at": None,
            "failed_attempts": 0,
            "lockout_until": None,
        }
        self.sqlite_store.upsert_local_security_state(record)
        self.audit_service.record(
            category="local_security",
            event_type="local_unlock_initialized",
            summary="Local unlock factor initialized.",
            surface="sidecar",
            payload={"idle_timeout_seconds": IDLE_TIMEOUT_SECONDS},
        )
        return self._status_from_record(record)

    def unlock(self, payload: LocalSecurityUnlockRequest) -> LocalSecurityStatus:
        record = self._require_initialized()
        now = _utc_now()
        lockout_until = _parse_dt(record.get("lockout_until"))
        if lockout_until and lockout_until > now:
            self.audit_service.record(
                category="local_security",
                event_type="local_unlock_failed",
                summary="Unlock blocked by active lockout.",
                surface="sidecar",
                payload={"reason": "lockout_active", "lockout_until": lockout_until.isoformat()},
            )
            raise ValueError("Local unlock is temporarily locked out.")

        expected = record["pin_hash"]
        actual = _hash_secret(payload.unlock_secret, record["salt"])
        if not hmac.compare_digest(expected, actual):
            failed_attempts = int(record.get("failed_attempts") or 0) + 1
            lockout = now + timedelta(seconds=LOCKOUT_SECONDS) if failed_attempts >= MAX_FAILED_ATTEMPTS else None
            record.update(
                {
                    "failed_attempts": failed_attempts,
                    "lockout_until": lockout.isoformat() if lockout else None,
                    "updated_at": now.isoformat(),
                    "unlocked_until": None,
                    "locked_at": now.isoformat(),
                }
            )
            self.sqlite_store.upsert_local_security_state(record)
            self.audit_service.record(
                category="local_security",
                event_type="local_unlock_failed",
                summary="Local unlock failed.",
                surface="sidecar",
                payload={
                    "failed_attempts": failed_attempts,
                    "lockout_until": record["lockout_until"],
                },
            )
            raise ValueError("Local unlock failed.")

        record.update(
            {
                "failed_attempts": 0,
                "lockout_until": None,
                "locked_at": None,
                "unlocked_until": (now + timedelta(seconds=IDLE_TIMEOUT_SECONDS)).isoformat(),
                "updated_at": now.isoformat(),
            }
        )
        self.sqlite_store.upsert_local_security_state(record)
        self.audit_service.record(
            category="local_security",
            event_type="local_unlock_succeeded",
            summary="Local unlock succeeded.",
            surface="sidecar",
            payload={"idle_timeout_seconds": IDLE_TIMEOUT_SECONDS},
        )
        return self._status_from_record(record)

    def change_secret(self, payload: LocalSecurityChangeSecretRequest) -> LocalSecurityStatus:
        record = self._require_initialized()
        self._verify_secret_or_raise(record, payload.current_unlock_secret)
        now = _utc_now()
        salt_hex = secrets.token_hex(16)
        record.update(
            {
                "pin_hash": _hash_secret(payload.new_unlock_secret, salt_hex),
                "salt": salt_hex,
                "updated_at": now.isoformat(),
                "unlocked_until": (now + timedelta(seconds=IDLE_TIMEOUT_SECONDS)).isoformat(),
                "locked_at": None,
                "failed_attempts": 0,
                "lockout_until": None,
            }
        )
        self.sqlite_store.upsert_local_security_state(record)
        self.audit_service.record(
            category="local_security",
            event_type="local_unlock_secret_changed",
            summary="Local unlock PIN or passphrase changed.",
            surface="sidecar",
            payload={"idle_timeout_seconds": IDLE_TIMEOUT_SECONDS},
        )
        return self._status_from_record(record)

    def reset(self, payload: LocalSecurityResetRequest) -> LocalSecurityStatus:
        if payload.confirmation.strip() != RESET_CONFIRMATION:
            raise ValueError(f'Type "{RESET_CONFIRMATION}" to reset the local unlock PIN or passphrase.')
        existed = self.sqlite_store.get_local_security_state() is not None
        self.sqlite_store.delete_local_security_state()
        self.audit_service.record(
            category="local_security",
            event_type="local_unlock_reset",
            summary="Local unlock PIN or passphrase reset on this device.",
            surface="sidecar",
            payload={
                "previously_initialized": existed,
                "requires_reinitialize": True,
            },
        )
        return self._status_from_record(None)

    def lock(self, reason: str = "manual") -> LocalSecurityStatus:
        record = self._require_initialized()
        now = _utc_now_iso()
        record.update(
            {
                "unlocked_until": None,
                "locked_at": now,
                "updated_at": now,
            }
        )
        self.sqlite_store.upsert_local_security_state(record)
        self.audit_service.record(
            category="local_security",
            event_type="local_idle_timeout" if reason == "idle_timeout" else "local_lock_requested",
            summary="Sensitive surfaces locked.",
            surface="sidecar",
            payload={"reason": reason},
        )
        return self._status_from_record(record)

    def touch(self, payload: LocalSecurityTouchRequest | None = None) -> LocalSecurityStatus:
        record = self._require_initialized()
        record = self._expire_if_idle(record)
        if self._is_locked(record):
            return self._status_from_record(record)

        now = _utc_now()
        record.update(
            {
                "unlocked_until": (now + timedelta(seconds=IDLE_TIMEOUT_SECONDS)).isoformat(),
                "updated_at": now.isoformat(),
            }
        )
        self.sqlite_store.upsert_local_security_state(record)
        surface = payload.surface if payload else None
        if surface:
            self.audit_service.record(
                category="local_security",
                event_type="sensitive_surface_accessed",
                summary="Sensitive surface accessed while unlocked.",
                surface="sidecar",
                subject=surface,
                payload={"surface": surface},
            )
        return self._status_from_record(record)

    def require_unlocked(self, surface: str) -> None:
        record = self._require_initialized()
        record = self._expire_if_idle(record)
        if self._is_locked(record):
            self.audit_service.record(
                category="local_security",
                event_type="sensitive_surface_blocked",
                summary="Sensitive surface blocked while locked.",
                surface="sidecar",
                subject=surface,
                payload={"surface": surface},
            )
            raise PermissionError("Local unlock is required.")

        self.touch(LocalSecurityTouchRequest(surface=surface))

    def _require_initialized(self) -> dict[str, Any]:
        record = self.sqlite_store.get_local_security_state()
        if record is None:
            raise ValueError("Local unlock has not been initialized.")
        return record

    def _verify_secret_or_raise(self, record: dict[str, Any], unlock_secret: str) -> None:
        lockout_until = _parse_dt(record.get("lockout_until"))
        if lockout_until and lockout_until > _utc_now():
            raise ValueError("Local unlock is temporarily locked out.")
        actual = _hash_secret(unlock_secret, record["salt"])
        if not hmac.compare_digest(record["pin_hash"], actual):
            self.audit_service.record(
                category="local_security",
                event_type="local_unlock_secret_change_failed",
                summary="Local unlock PIN or passphrase change failed.",
                surface="sidecar",
                payload={"reason": "current_secret_mismatch"},
            )
            raise ValueError("Current local unlock PIN or passphrase is incorrect.")

    def _expire_if_idle(self, record: dict[str, Any]) -> dict[str, Any]:
        unlocked_until = _parse_dt(record.get("unlocked_until"))
        if not unlocked_until or unlocked_until > _utc_now():
            return record
        if record.get("locked_at") == unlocked_until.isoformat():
            return record
        expected_updated_at = record["updated_at"]
        record.update(
            {
                "unlocked_until": None,
                "locked_at": unlocked_until.isoformat(),
                "updated_at": _utc_now_iso(),
            }
        )
        if not self.sqlite_store.update_local_security_state_if_unchanged(
            record,
            expected_updated_at=expected_updated_at,
        ):
            # Another request changed the security state after this request read
            # it. In particular, never let a stale idle-expiry snapshot overwrite
            # a newer successful unlock.
            return self._require_initialized()
        self.audit_service.record(
            category="local_security",
            event_type="local_idle_timeout",
            summary="Sensitive surfaces locked after idle timeout.",
            surface="sidecar",
            payload={"idle_timeout_seconds": IDLE_TIMEOUT_SECONDS},
        )
        return record

    def _is_locked(self, record: dict[str, Any]) -> bool:
        unlocked_until = _parse_dt(record.get("unlocked_until"))
        return unlocked_until is None or unlocked_until <= _utc_now()

    def _status_from_record(self, record: dict[str, Any] | None) -> LocalSecurityStatus:
        if record is None:
            return LocalSecurityStatus(
                initialized=False,
                locked=True,
                idle_timeout_seconds=IDLE_TIMEOUT_SECONDS,
                failed_attempts=0,
                max_failed_attempts=MAX_FAILED_ATTEMPTS,
                sensitive_surfaces=SENSITIVE_SURFACES,
            )

        lockout_until = _parse_dt(record.get("lockout_until"))
        return LocalSecurityStatus(
            initialized=True,
            locked=self._is_locked(record),
            unlocked_until=record.get("unlocked_until"),
            idle_timeout_seconds=IDLE_TIMEOUT_SECONDS,
            failed_attempts=int(record.get("failed_attempts") or 0),
            max_failed_attempts=MAX_FAILED_ATTEMPTS,
            lockout_until=lockout_until.isoformat() if lockout_until else None,
            sensitive_surfaces=SENSITIVE_SURFACES,
        )
