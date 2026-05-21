from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from ..models import (
    BinanceAccountSnapshot,
    ConnectionCheckResponse,
    ConnectionStatusItem,
    ConnectionsCatalogResponse,
    ConnectionsStatusResponse,
    CreateCredentialProfileRequest,
    CredentialProfile,
    SetActiveCredentialProfileRequest,
)
from ..providers.binance import BinanceProvider
from ..providers.catalog import get_asset
from ..providers.filings import FilingsProvider
from ..storage.duckdb_store import DuckDbStore
from ..storage.sqlite_store import SqliteStore
from .capability_service import CapabilityService
from .data_source_service import DATA_SOURCE_PROVIDERS, KEYED_DATA_SOURCE_PROVIDERS, DataSourceService
from .security_audit_service import SecurityAuditService


class ConnectionsService:
    edgar_probe_symbol = "AAPL"

    def __init__(
        self,
        sqlite_store: SqliteStore,
        duck_store: DuckDbStore,
        binance_provider: BinanceProvider,
        filings_provider: FilingsProvider,
        capability_service: CapabilityService,
        data_source_service: DataSourceService,
        security_audit_service: SecurityAuditService | None = None,
    ) -> None:
        self.sqlite_store = sqlite_store
        self.duck_store = duck_store
        self.binance_provider = binance_provider
        self.filings_provider = filings_provider
        self.capability_service = capability_service
        self.data_source_service = data_source_service
        self.security_audit_service = security_audit_service

    def _profile(self, provider: str) -> dict[str, Any]:
        profile = self.sqlite_store.get_connection_profile(provider)
        if profile is None:
            active = self.sqlite_store.get_active_credential_profile()
            return {
                "profile_id": active["profile_id"],
                "profile_label": active["label"],
                "provider": provider,
                "is_configured": False,
                "metadata": {},
                "updated_at": None,
            }

        metadata = dict(profile["metadata"])
        if "last_status" not in metadata and metadata.get("last_health"):
            metadata["last_status"] = metadata["last_health"]
        profile["metadata"] = metadata
        return profile

    def _now_iso(self) -> str:
        return datetime.now(UTC).isoformat()

    def _parse_iso(self, value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)

    def _age_seconds(self, value: str | None) -> int | None:
        parsed = self._parse_iso(value)
        if parsed is None:
            return None
        return max(0, int((datetime.now(UTC) - parsed.astimezone(UTC)).total_seconds()))

    def _provider_summary(self, provider: str) -> str | None:
        if provider == "binance":
            return self.binance_provider.credential_summary
        if provider == "edgar":
            return self.filings_provider.credential_summary
        if provider in KEYED_DATA_SOURCE_PROVIDERS:
            return self.data_source_service.credential_summary(provider)
        return None

    def _credential_contract(
        self,
        provider: str,
        *,
        configured: bool,
        health: str,
        requires_credentials: bool,
        message: str | None,
    ) -> dict[str, str | None]:
        if not requires_credentials and provider != "binance":
            return {
                "credential_state": "read_only",
                "credential_state_label": "Read-only",
                "credential_next_action": "No credential action is required for this read-only provider.",
                "credential_action_kind": "none",
                "credential_state_reason": "Provider is available through the public read-only catalog.",
            }

        if provider == "binance" and configured and health in {"ok", "cached", "planned"}:
            return {
                "credential_state": "trading_gated",
                "credential_state_label": "Trading gated",
                "credential_next_action": "Account credentials are loaded; live order submission still requires explicit risk gates and user confirmation.",
                "credential_action_kind": "confirm_trading_gate",
                "credential_state_reason": "Binance account readiness is separate from live execution permission.",
            }

        if not configured or health == "missing_credentials":
            return {
                "credential_state": "missing",
                "credential_state_label": "Missing credentials",
                "credential_next_action": self._missing_credential_action(provider),
                "credential_action_kind": "save_credentials",
                "credential_state_reason": message or "Provider credentials are not configured for the active local profile.",
            }

        if health == "error":
            return {
                "credential_state": "invalid",
                "credential_state_label": "Needs attention",
                "credential_next_action": self._invalid_credential_action(provider),
                "credential_action_kind": "check_permissions",
                "credential_state_reason": message or "The latest provider check failed with stored credentials.",
            }

        if health == "unavailable":
            return {
                "credential_state": "blocked",
                "credential_state_label": "Blocked",
                "credential_next_action": "Retry after provider availability recovers or inspect the cached state before relying on fresh data.",
                "credential_action_kind": "test_connection",
                "credential_state_reason": message or "Provider is temporarily unavailable.",
            }

        if health == "unsupported":
            return {
                "credential_state": "disabled",
                "credential_state_label": "Disabled",
                "credential_next_action": "No credential can enable this unsupported provider in the current desktop contract.",
                "credential_action_kind": "none",
                "credential_state_reason": message or "Provider is unsupported.",
            }

        return {
            "credential_state": "configured",
            "credential_state_label": "Configured",
            "credential_next_action": "Run Test connection to refresh readiness for the active local profile.",
            "credential_action_kind": "test_connection",
            "credential_state_reason": message or "Credentials are loaded for the active local profile.",
        }

    def _missing_credential_action(self, provider: str) -> str:
        if provider == "edgar":
            return "Save an EDGAR identity, restart the sidecar, and test filings access."
        if provider == "binance":
            return "Save Binance API credentials, then test the private-account readiness path."
        if provider == "fred":
            return "Add a FRED API key before testing this macro data source."
        if provider == "coingecko":
            return "Add a CoinGecko demo or pro key before testing crypto market context."
        return "Save the required provider credential before testing readiness."

    def _invalid_credential_action(self, provider: str) -> str:
        if provider == "edgar":
            return "Check the EDGAR identity format and retry the filings probe."
        if provider == "binance":
            return "Check Binance key permissions, IP restrictions, and secret value, then retry."
        if provider in {"fred", "coingecko"}:
            return "Check the API key, plan permissions, and provider availability, then retry."
        return "Check provider credentials and retry the readiness test."

    def _provider_cache_state(self, provider: str) -> tuple[str | None, int | None]:
        if provider == "binance":
            updated_at = self.duck_store.get_latest_binance_account_snapshot_fetched_at()
        elif provider == "edgar":
            updated_at = self.duck_store.get_latest_filings_fetched_at(self.edgar_probe_symbol)
        elif provider in DATA_SOURCE_PROVIDERS:
            updated_at = self.duck_store.get_latest_data_source_fetched_at(provider)
        else:
            updated_at = None
        return updated_at, self._age_seconds(updated_at)

    def _sync_provider_snapshot(
        self,
        provider: str,
        *,
        configured: bool,
        credential_summary: str | None,
        cache_updated_at: str | None,
        cache_age_seconds: int | None,
    ) -> dict[str, Any]:
        profile = self._profile(provider)
        metadata = profile["metadata"]
        sync_fields = {
            "credential_summary": credential_summary,
            "cache_updated_at": cache_updated_at,
            "cache_age_seconds": cache_age_seconds,
        }
        if any(metadata.get(key) != value for key, value in sync_fields.items()) or profile["is_configured"] != configured:
            self.sqlite_store.upsert_connection_profile(
                provider,
                is_configured=configured,
                metadata=sync_fields,
            )
            profile = self._profile(provider)
        return profile

    def _build_provider_item(
        self,
        provider: str,
        *,
        label: str,
        configured: bool,
        default_ready_message: str,
        default_missing_message: str,
    ) -> ConnectionStatusItem:
        credential_summary = self._provider_summary(provider)
        cache_updated_at, cache_age_seconds = self._provider_cache_state(provider)
        visible_cache_updated_at = cache_updated_at if configured else None
        visible_cache_age_seconds = cache_age_seconds if configured else None
        profile = self._sync_provider_snapshot(
            provider,
            configured=configured,
            credential_summary=credential_summary,
            cache_updated_at=visible_cache_updated_at,
            cache_age_seconds=visible_cache_age_seconds,
        )
        metadata = profile["metadata"]
        last_status = metadata.get("last_status")

        if not configured:
            health = "missing_credentials"
            message = default_missing_message
        else:
            health = last_status if last_status in {"ok", "error", "cached"} else "planned"
            message = metadata.get("last_message") if health != "planned" else default_ready_message

        stale = bool(metadata.get("stale", False) or health == "cached")
        credential_contract = self._credential_contract(
            provider,
            configured=configured,
            health=health,
            requires_credentials=not configured,
            message=message,
        )
        return ConnectionStatusItem(
            provider=provider,
            label=label,
            configured=configured,
            health=health,
            last_message=message,
            stale=stale,
            requires_credentials=not configured,
            **credential_contract,
            credential_summary=metadata.get("credential_summary"),
            last_tested_at=metadata.get("last_tested_at"),
            last_success_at=metadata.get("last_success_at"),
            cache_updated_at=metadata.get("cache_updated_at"),
            cache_age_seconds=metadata.get("cache_age_seconds"),
            profile_id=profile["profile_id"],
            profile_label=profile["profile_label"],
        )

    def _build_public_provider_item(self, provider: str) -> ConnectionStatusItem:
        definition = self.capability_service.get_source_definition(provider)
        profile = self._profile(provider)
        if definition is None:
            return ConnectionStatusItem(
                provider=provider,
                label=provider,
                configured=False,
                health="unsupported",
                last_message=f"{provider} is not registered in the provider source catalog.",
                stale=False,
                requires_credentials=False,
                profile_id=profile["profile_id"],
                profile_label=profile["profile_label"],
            )

        metadata = profile["metadata"]
        status = metadata.get("last_status")
        if status not in {"ok", "error", "cached", "planned", "unsupported", "missing_credentials", "unavailable"}:
            status = "ok"
        runtime_status = self.data_source_service.get_provider_status(provider) if provider in DATA_SOURCE_PROVIDERS else None
        if runtime_status is not None and runtime_status.requires_credentials:
            status = "missing_credentials"
        credential_summary = self._provider_summary(provider)
        configured = runtime_status.configured if runtime_status is not None else True
        requires_credentials = runtime_status.requires_credentials if runtime_status is not None else False
        message = metadata.get("last_message") or (runtime_status.message if runtime_status is not None else definition.description)
        credential_contract = self._credential_contract(
            definition.provider,
            configured=configured,
            health=status,
            requires_credentials=requires_credentials,
            message=message,
        )
        return ConnectionStatusItem(
            provider=definition.provider,
            label=definition.label,
            configured=configured,
            health=status,
            last_message=message,
            stale=bool(metadata.get("stale", False) or status == "cached"),
            requires_credentials=requires_credentials,
            **credential_contract,
            credential_summary=credential_summary or metadata.get("credential_summary"),
            last_tested_at=metadata.get("last_tested_at"),
            last_success_at=metadata.get("last_success_at"),
            cache_updated_at=metadata.get("cache_updated_at") or (runtime_status.cache_updated_at if runtime_status is not None else None),
            cache_age_seconds=metadata.get("cache_age_seconds") or (runtime_status.cache_age_seconds if runtime_status is not None else None),
            profile_id=profile["profile_id"],
            profile_label=profile["profile_label"],
        )

    def _persist_connection_result(
        self,
        provider: str,
        *,
        configured: bool,
        response: ConnectionCheckResponse,
    ) -> ConnectionCheckResponse:
        tested_at = self._now_iso()
        cache_updated_at, cache_age_seconds = self._provider_cache_state(provider)
        if not configured:
            cache_updated_at = None
            cache_age_seconds = None
        credential_summary = self._provider_summary(provider)
        metadata: dict[str, Any] = {
            "credential_summary": credential_summary,
            "last_status": response.status,
            "last_message": response.message,
            "last_tested_at": tested_at,
            "stale": response.stale,
            "cache_updated_at": cache_updated_at,
            "cache_age_seconds": cache_age_seconds,
        }
        if response.status == "ok":
            metadata["last_success_at"] = tested_at

        self.sqlite_store.upsert_connection_profile(
            provider,
            is_configured=configured,
            metadata=metadata,
        )
        profile = self._profile(provider)
        response.credential_summary = profile["metadata"].get("credential_summary")
        response.last_tested_at = profile["metadata"].get("last_tested_at")
        response.last_success_at = profile["metadata"].get("last_success_at")
        response.cache_updated_at = profile["metadata"].get("cache_updated_at")
        response.cache_age_seconds = profile["metadata"].get("cache_age_seconds")
        response.profile_id = profile["profile_id"]
        response.profile_label = profile["profile_label"]
        credential_contract = self._credential_contract(
            provider,
            configured=configured,
            health=response.status,
            requires_credentials=response.requires_credentials,
            message=response.message,
        )
        response.credential_state = str(credential_contract["credential_state"])
        response.credential_state_label = str(credential_contract["credential_state_label"])
        response.credential_next_action = str(credential_contract["credential_next_action"])
        response.credential_action_kind = str(credential_contract["credential_action_kind"])
        response.credential_state_reason = credential_contract["credential_state_reason"]
        return response

    def _persist_provider_state(
        self,
        provider: str,
        *,
        configured: bool,
        status: str,
        message: str,
        stale: bool,
        refresh_success: bool = False,
    ) -> None:
        cache_updated_at, cache_age_seconds = self._provider_cache_state(provider)
        metadata: dict[str, Any] = {
            "credential_summary": self._provider_summary(provider),
            "last_status": status,
            "last_message": message,
            "stale": stale,
            "cache_updated_at": cache_updated_at,
            "cache_age_seconds": cache_age_seconds,
        }
        if refresh_success:
            metadata["last_success_at"] = self._now_iso()

        self.sqlite_store.upsert_connection_profile(
            provider,
            is_configured=configured,
            metadata=metadata,
        )

    def get_status(self) -> ConnectionsStatusResponse:
        items = [
            *[
                self._build_public_provider_item(definition.provider)
                for definition in self.capability_service.source_definitions()
                if definition.provider not in {"edgar", "binance"}
            ],
            self._build_provider_item(
                "edgar",
                label="SEC EDGAR",
                configured=self.filings_provider.is_configured,
                default_ready_message="Identity is loaded. Run Test connection to verify filings access.",
                default_missing_message="Add an EDGAR identity to enable filings.",
            ),
            self._build_provider_item(
                "binance",
                label="Binance Account",
                configured=self.binance_provider.is_configured,
                default_ready_message="Credentials are loaded. Run Test connection to verify the private account path.",
                default_missing_message="Add Binance API credentials in the desktop app.",
            ),
        ]
        profiles = [CredentialProfile.model_validate(item) for item in self.sqlite_store.list_credential_profiles()]
        active_profile = CredentialProfile.model_validate(self.sqlite_store.get_active_credential_profile())
        return ConnectionsStatusResponse(providers=items, profiles=profiles, active_profile=active_profile)

    def get_catalog(self) -> ConnectionsCatalogResponse:
        return self.capability_service.get_connections_catalog()

    def list_profiles(self) -> list[CredentialProfile]:
        return [CredentialProfile.model_validate(item) for item in self.sqlite_store.list_credential_profiles()]

    def create_profile(self, payload: CreateCredentialProfileRequest) -> CredentialProfile:
        normalized_label = " ".join(payload.label.split())
        profile_id = self._profile_id_from_label(normalized_label)
        existing = self.sqlite_store.get_credential_profile(profile_id)
        if existing is not None:
            suffix = datetime.now(UTC).strftime("%H%M%S")
            profile_id = f"{profile_id}-{suffix}"
        profile = self.sqlite_store.upsert_credential_profile(profile_id, label=normalized_label, is_active=False)
        self._audit_profile_event("credential_profile_created", profile)
        return CredentialProfile.model_validate(profile)

    def set_active_profile(self, payload: SetActiveCredentialProfileRequest) -> CredentialProfile:
        profile = self.sqlite_store.set_active_credential_profile(payload.profile_id)
        self._audit_profile_event("credential_profile_selected", profile)
        return CredentialProfile.model_validate(profile)

    def _profile_id_from_label(self, label: str) -> str:
        slug = "".join(character.lower() if character.isalnum() else "-" for character in label)
        slug = "-".join(part for part in slug.split("-") if part)
        return f"local_{slug or 'profile'}"[:80]

    def _audit_profile_event(self, event_type: str, profile: dict[str, Any]) -> None:
        if self.security_audit_service is None:
            return
        self.security_audit_service.record(
            category="credential",
            event_type=event_type,
            subject=profile["profile_id"],
            summary=f"Credential profile {profile['label']} updated.",
            payload={
                "profile_id": profile["profile_id"],
                "profile_label": profile["label"],
                "is_active": profile["is_active"],
            },
        )

    def clear_connection_profile(self, provider: str) -> None:
        normalized = provider.lower()
        if normalized not in {"binance", "edgar", *DATA_SOURCE_PROVIDERS}:
            raise ValueError(f"Unsupported provider: {provider}")
        self.sqlite_store.delete_connection_profile(normalized)
        if self.security_audit_service is not None:
            self.security_audit_service.record(
                category="credential",
                event_type="connection_profile_cleared",
                subject=normalized,
                summary=f"Cleared cached connection profile for {normalized}.",
                payload={
                    "provider": normalized,
                    "profile_id": self.sqlite_store.get_active_credential_profile()["profile_id"],
                    "profile_label": self.sqlite_store.get_active_credential_profile()["label"],
                },
            )

    def test_connection(self, provider: str) -> ConnectionCheckResponse:
        normalized = provider.lower()
        if normalized == "binance":
            response = self.test_binance_connection()
        elif normalized == "edgar":
            response = self.test_edgar_connection()
        else:
            definition = self.capability_service.get_source_definition(normalized)
            if definition is not None and normalized in DATA_SOURCE_PROVIDERS:
                data_response = self.data_source_service.test_provider(normalized)
                response = self._persist_connection_result(
                    normalized,
                    configured=not data_response.requires_credentials,
                    response=data_response,
                )
            elif definition is not None:
                response = ConnectionCheckResponse(
                    provider=normalized,
                    status="planned",
                    message=f"{definition.label} is a read-only source registered in the catalog; live probe automation is planned for the Data Sources workspace.",
                    requires_credentials=False,
                )
                response = self._persist_connection_result(
                    normalized,
                    configured=True,
                    response=response,
                )
            else:
                response = ConnectionCheckResponse(
                    provider=normalized,
                    status="unsupported",
                    message=f"{provider} is not registered in this provider catalog.",
                )
        self._audit_connection_test(response)
        return response

    def _audit_connection_test(self, response: ConnectionCheckResponse) -> None:
        if self.security_audit_service is None:
            return
        self.security_audit_service.record(
            category="credential",
            event_type="connection_tested",
            subject=response.provider,
            summary=f"Connection test for {response.provider} returned {response.status}.",
            payload={
                "provider": response.provider,
                "profile_id": response.profile_id,
                "profile_label": response.profile_label,
                "status": response.status,
                "credential_state": response.credential_state,
                "credential_action_kind": response.credential_action_kind,
                "stale": response.stale,
                "requires_credentials": response.requires_credentials,
                "credential_summary": response.credential_summary,
            },
        )

    def test_edgar_connection(self) -> ConnectionCheckResponse:
        if not self.filings_provider.is_configured:
            response = ConnectionCheckResponse(
                provider="edgar",
                status="missing_credentials",
                message="EDGAR identity is not configured.",
                requires_credentials=True,
            )
            return self._persist_connection_result(
                "edgar",
                configured=False,
                response=response,
            )

        try:
            entry = get_asset(self.edgar_probe_symbol)
            filings = [] if entry is None else self.filings_provider.get_filings(entry)
            if entry is not None:
                self.duck_store.replace_filings(entry.symbol, "edgartools", filings)
            response = ConnectionCheckResponse(
                provider="edgar",
                status="ok",
                message=f"EDGAR connection verified with {len(filings)} recent {self.edgar_probe_symbol} filings.",
            )
        except Exception as error:
            cached = self.duck_store.get_latest_filings(self.edgar_probe_symbol)
            if cached:
                response = ConnectionCheckResponse(
                    provider="edgar",
                    status="cached",
                    message=f"EDGAR live request failed, served cached {self.edgar_probe_symbol} filings instead: {error}",
                    stale=True,
                )
            else:
                response = ConnectionCheckResponse(
                    provider="edgar",
                    status="error",
                    message=f"EDGAR request failed: {error}",
                )

        return self._persist_connection_result(
            "edgar",
            configured=self.filings_provider.is_configured,
            response=response,
        )

    def test_binance_connection(self) -> ConnectionCheckResponse:
        if not self.binance_provider.is_configured:
            response = ConnectionCheckResponse(
                provider="binance",
                status="missing_credentials",
                message="Binance credentials are not configured.",
                requires_credentials=True,
            )
            return self._persist_connection_result(
                "binance",
                configured=False,
                response=response,
            )

        try:
            ok, message = self.binance_provider.test_private_connection()
            response = ConnectionCheckResponse(
                provider="binance",
                status="ok" if ok else "error",
                message=message,
            )
        except Exception as error:
            cached = self.duck_store.get_latest_binance_account_snapshot()
            if cached is not None:
                response = ConnectionCheckResponse(
                    provider="binance",
                    status="cached",
                    message=f"Binance live test failed, but cached balances are still available: {error}",
                    stale=True,
                )
            else:
                response = ConnectionCheckResponse(
                    provider="binance",
                    status="error",
                    message=f"Binance request failed: {error}",
                )

        return self._persist_connection_result(
            "binance",
            configured=self.binance_provider.is_configured,
            response=response,
        )

    def get_binance_account(self) -> BinanceAccountSnapshot:
        if not self.binance_provider.is_configured:
            raise ValueError("Binance credentials are not configured.")

        try:
            snapshot = self.binance_provider.get_account_snapshot()
            self.duck_store.put_binance_account_snapshot(snapshot.model_dump(mode="json"))
            self._persist_provider_state(
                "binance",
                configured=self.binance_provider.is_configured,
                status="ok",
                message="Fetched Binance balances successfully.",
                stale=False,
                refresh_success=True,
            )
            return snapshot
        except Exception as error:
            cached = self.duck_store.get_latest_binance_account_snapshot()
            if cached is None:
                self._persist_provider_state(
                    "binance",
                    configured=self.binance_provider.is_configured,
                    status="error",
                    message=f"Binance request failed: {error}",
                    stale=False,
                )
                raise

            self._persist_provider_state(
                "binance",
                configured=self.binance_provider.is_configured,
                status="cached",
                message=f"Binance live request failed, served cached balances instead: {error}",
                stale=True,
            )
            return BinanceAccountSnapshot.model_validate({**cached, "stale": True})
