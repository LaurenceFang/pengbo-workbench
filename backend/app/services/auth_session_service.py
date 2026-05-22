from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from ..models import LocalAuthSessionRequest, LocalAuthSessionResponse, RoutePermissionClassification, SessionPermission
from ..storage.sqlite_store import SqliteStore
from .security_audit_service import SecurityAuditService


DEFAULT_PERMISSIONS: list[SessionPermission] = [
    "session:read",
    "security:audit:read",
    "credentials:manage",
    "execution:manage",
    "account:read",
    "reports:export",
    "ai:context",
    "ai:generate",
]

ROUTE_PERMISSION_MAP: list[RoutePermissionClassification] = [
    RoutePermissionClassification(
        method="GET",
        path="/api/v1/security/audit",
        surface="security_audit",
        exposure="account_sensitive",
        permission="security:audit:read",
        notes="Audit history can reveal sensitive workflow timing and credential lifecycle metadata.",
    ),
    RoutePermissionClassification(
        method="DELETE",
        path="/api/v1/connections/{provider}/profile",
        surface="connections",
        exposure="account_sensitive",
        permission="credentials:manage",
        notes="Provider profile state is account-scoped metadata; raw secrets remain outside SQLite.",
    ),
    RoutePermissionClassification(
        method="GET",
        path="/api/v1/connections/binance/account",
        surface="connections",
        exposure="account_sensitive",
        permission="account:read",
        notes="Private account snapshots require a session-bound account permission.",
    ),
    RoutePermissionClassification(
        method="PUT",
        path="/api/v1/execution/binance/config",
        surface="strategy_lab",
        exposure="account_sensitive",
        permission="execution:manage",
        notes="Execution configuration changes require a session-bound execution permission.",
    ),
    RoutePermissionClassification(
        method="POST",
        path="/api/v1/execution/binance/intents",
        surface="strategy_lab",
        exposure="account_sensitive",
        permission="execution:manage",
        notes="Live-intent preparation is still confirmation-gated but must be session-bound.",
    ),
    RoutePermissionClassification(
        method="POST",
        path="/api/v1/execution/binance/intents/{intent_id}/submit",
        surface="strategy_lab",
        exposure="never_public",
        permission="execution:manage",
        notes="Any future submit path stays local, explicit, audited, and never public by default.",
    ),
    RoutePermissionClassification(
        method="POST",
        path="/api/v1/execution/binance/kill-switch",
        surface="strategy_lab",
        exposure="account_sensitive",
        permission="execution:manage",
        notes="Kill-switch changes alter execution posture and require session-bound permission.",
    ),
    RoutePermissionClassification(
        method="POST",
        path="/api/v1/strategies/reports/{artifact_id}/export",
        surface="strategy_lab",
        exposure="desktop_local",
        permission="reports:export",
        notes="Report exports can include account-sensitive evidence context and are audited.",
    ),
    RoutePermissionClassification(
        method="POST",
        path="/api/v1/data-sources/reports/export",
        surface="data_sources",
        exposure="desktop_local",
        permission="reports:export",
        notes="Data-source exports are local files but still need route classification before T56.",
    ),
    RoutePermissionClassification(
        method="GET",
        path="/api/v1/ai/permissions",
        surface="ai_assistant",
        exposure="desktop_local",
        permission="ai:context",
        notes="AI permission boundary is local metadata and records what context is allowed or blocked.",
    ),
    RoutePermissionClassification(
        method="GET",
        path="/api/v1/research/assistant/briefs/{brief_id}/context-preview",
        surface="ai_assistant",
        exposure="account_sensitive",
        permission="ai:context",
        notes="AI context preview can include selected research notes and evidence summaries, never raw secrets.",
    ),
    RoutePermissionClassification(
        method="GET",
        path="/api/v1/research/assistant/templates",
        surface="ai_assistant",
        exposure="desktop_local",
        permission="ai:context",
        notes="Prompt templates describe local evidence rules and do not contain user research context.",
    ),
    RoutePermissionClassification(
        method="GET",
        path="/api/v1/ai/cloud/status",
        surface="ai_assistant",
        exposure="desktop_local",
        permission="ai:context",
        notes="Cloud AI status exposes only configured/not-configured flags and never returns API keys.",
    ),
    RoutePermissionClassification(
        method="POST",
        path="/api/v1/research/assistant/briefs/{brief_id}/generate",
        surface="ai_assistant",
        exposure="account_sensitive",
        permission="ai:generate",
        notes="AI generation must use the bounded context preview and audit the prompt/template path.",
    ),
]


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _utc_now_iso() -> str:
    return _utc_now().isoformat()


class AuthSessionError(ValueError):
    def __init__(self, message: str, *, status_code: int = 401) -> None:
        super().__init__(message)
        self.status_code = status_code


class AuthSessionService:
    def __init__(self, sqlite_store: SqliteStore, security_audit_service: SecurityAuditService) -> None:
        self.sqlite_store = sqlite_store
        self.security_audit_service = security_audit_service

    def create_session(self, payload: LocalAuthSessionRequest | None = None) -> LocalAuthSessionResponse:
        request = payload or LocalAuthSessionRequest()
        now = _utc_now()
        ttl_minutes = request.ttl_minutes or 8 * 60
        session = LocalAuthSessionResponse(
            session_id=f"session-{uuid4().hex[:16]}",
            account_id=request.account_id or "local-default",
            account_label=request.account_label or "Local desktop user",
            created_at=now.isoformat(),
            expires_at=(now + timedelta(minutes=ttl_minutes)).isoformat(),
            permissions=list(DEFAULT_PERMISSIONS),
            status="active",
        )
        self.sqlite_store.upsert_local_auth_session(session.model_dump(mode="json"))
        self.security_audit_service.record(
            category="session",
            event_type="session_created",
            subject=session.account_id,
            summary="Created a local desktop auth session.",
            payload={
                "session_id": session.session_id,
                "account_id": session.account_id,
                "permissions": session.permissions,
                "expires_at": session.expires_at,
            },
            surface="auth_session",
        )
        return session

    def get_session(self, session_id: str | None) -> LocalAuthSessionResponse | None:
        if not session_id:
            return None
        payload = self.sqlite_store.get_local_auth_session(session_id)
        if payload is None:
            return None
        session = LocalAuthSessionResponse.model_validate(payload)
        if session.status == "active" and datetime.fromisoformat(session.expires_at) <= _utc_now():
            session.status = "expired"
            self.sqlite_store.upsert_local_auth_session(session.model_dump(mode="json"))
            self.security_audit_service.record(
                category="session",
                event_type="session_expired",
                subject=session.account_id,
                summary="Local desktop auth session expired.",
                payload={"session_id": session.session_id, "expires_at": session.expires_at},
                surface="auth_session",
            )
        return session

    def revoke_session(self, session_id: str | None) -> LocalAuthSessionResponse:
        session = self.require_session(session_id, "session:read", surface="auth_session")
        revoked_at = _utc_now_iso()
        payload = self.sqlite_store.revoke_local_auth_session(session.session_id, revoked_at)
        revoked = LocalAuthSessionResponse.model_validate(payload)
        self.security_audit_service.record(
            category="session",
            event_type="session_revoked",
            subject=revoked.account_id,
            summary="Revoked a local desktop auth session.",
            payload={"session_id": revoked.session_id, "revoked_at": revoked_at},
            surface="auth_session",
        )
        return revoked

    def require_session(
        self,
        session_id: str | None,
        permission: SessionPermission,
        *,
        surface: str,
        path: str | None = None,
    ) -> LocalAuthSessionResponse:
        session = self.get_session(session_id)
        if session is None:
            self._record_denied(None, permission, surface, path, "missing_session")
            raise AuthSessionError("A local auth session is required for this desktop-sensitive action.", status_code=401)
        if session.status != "active":
            self._record_denied(session, permission, surface, path, f"session_{session.status}")
            raise AuthSessionError(f"Local auth session is {session.status}.", status_code=401)
        if permission not in session.permissions:
            self._record_denied(session, permission, surface, path, "permission_denied")
            raise AuthSessionError("Local auth session does not include the required permission.", status_code=403)
        self.security_audit_service.record(
            category="session",
            event_type="permission_granted",
            subject=session.account_id,
            summary=f"Session permission granted for {surface}.",
            payload={
                "session_id": session.session_id,
                "permission": permission,
                "surface": surface,
                "path": path,
            },
            surface=surface,
        )
        return session

    def route_classifications(self) -> list[RoutePermissionClassification]:
        return ROUTE_PERMISSION_MAP

    def _record_denied(
        self,
        session: LocalAuthSessionResponse | None,
        permission: SessionPermission,
        surface: str,
        path: str | None,
        reason: str,
    ) -> None:
        self.security_audit_service.record(
            category="session",
            event_type="permission_denied",
            subject=session.account_id if session else None,
            summary=f"Session permission denied for {surface}.",
            payload={
                "session_id": session.session_id if session else None,
                "permission": permission,
                "surface": surface,
                "path": path,
                "reason": reason,
            },
            surface=surface,
        )
