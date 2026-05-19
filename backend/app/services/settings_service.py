from __future__ import annotations

import json

from ..models import (
    AppPreferences,
    OnboardingState,
    SettingsRuntimeResponse,
    UpdateAppPreferencesRequest,
    UpdateOnboardingStateRequest,
)
from ..runtime import RuntimeSettings
from ..storage.sqlite_store import SqliteStore
from ..version import APP_VERSION, SIDECAR_VERSION


DEFAULT_PREFERENCES = AppPreferences(
    default_view="dashboard",
    quote_ttl_minutes=15,
    log_collection_enabled=True,
    diagnostics_export_enabled=True,
    language="zh-CN",
    density="standard",
)


class SettingsService:
    def __init__(self, settings: RuntimeSettings, sqlite_store: SqliteStore) -> None:
        self.settings = settings
        self.sqlite_store = sqlite_store

    def get_runtime(self) -> SettingsRuntimeResponse:
        return SettingsRuntimeResponse(
            app_version=APP_VERSION,
            sidecar_version=SIDECAR_VERSION,
            base_url=self.settings.base_url,
            runtime_mode=self.settings.runtime_mode,
            data_dir=str(self.settings.data_dir),
            log_dir=str(self.settings.log_dir),
            diagnostics_dir=str(self.settings.diagnostics_dir),
            sqlite_path=str(self.settings.sqlite_path),
            duckdb_path=str(self.settings.duckdb_path),
            sidecar_stdout_path=str(self.settings.sidecar_stdout_path),
            sidecar_stderr_path=str(self.settings.sidecar_stderr_path),
            sidecar_last_error_path=str(self.settings.sidecar_last_error_path),
            sidecar_bootstrap_path=str(self.settings.sidecar_bootstrap_path),
            build_summary_path=(
                str(self.settings.build_summary_path)
                if self.settings.build_summary_path is not None
                else None
            ),
        )

    def get_preferences(self) -> AppPreferences:
        raw_values = self.sqlite_store.get_app_settings(
            [
                "default_view",
                "quote_ttl_minutes",
                "log_collection_enabled",
                "diagnostics_export_enabled",
                "language",
                "density",
            ]
        )

        values = DEFAULT_PREFERENCES.model_dump()
        for key, raw_value in raw_values.items():
            values[key] = json.loads(raw_value)
        return AppPreferences.model_validate(values)

    def update_preferences(self, payload: UpdateAppPreferencesRequest) -> AppPreferences:
        self.sqlite_store.upsert_app_settings(payload.model_dump())
        return self.get_preferences()

    def get_onboarding(self) -> OnboardingState:
        raw_values = self.sqlite_store.get_app_settings(["onboarding_seen_at"])
        raw_value = raw_values.get("onboarding_seen_at")
        onboarding_seen_at = json.loads(raw_value) if raw_value is not None else None
        return OnboardingState(onboarding_seen_at=onboarding_seen_at)

    def update_onboarding(self, payload: UpdateOnboardingStateRequest) -> OnboardingState:
        self.sqlite_store.upsert_app_settings(payload.model_dump())
        return self.get_onboarding()
