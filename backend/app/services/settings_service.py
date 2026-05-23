from __future__ import annotations

import json
from datetime import UTC, datetime

from ..models import (
    AICloudProviderDefinition,
    AIControlPreferences,
    AIProviderMode,
    AppPreferences,
    DemoModeStatus,
    OnboardingChecklistItem,
    OnboardingState,
    OnboardingStepKey,
    SettingsRuntimeResponse,
    UpdateAIControlPreferencesRequest,
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

AI_CLOUD_PROVIDERS: tuple[AICloudProviderDefinition, ...] = (
    AICloudProviderDefinition(
        provider="chatgpt",
        label="ChatGPT / OpenAI",
        base_url="https://api.openai.com/v1",
        default_model="gpt-4.1-mini",
        api_key_env="PENGBO_AI_CLOUD_API_KEY",
        documentation_url="https://platform.openai.com/docs",
    ),
    AICloudProviderDefinition(
        provider="gemini",
        label="Google Gemini",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai",
        default_model="gemini-1.5-pro",
        api_key_env="PENGBO_AI_CLOUD_API_KEY",
        documentation_url="https://ai.google.dev/gemini-api/docs/openai",
    ),
    AICloudProviderDefinition(
        provider="grok",
        label="xAI Grok",
        base_url="https://api.x.ai/v1",
        default_model="grok-3-mini",
        api_key_env="PENGBO_AI_CLOUD_API_KEY",
        documentation_url="https://docs.x.ai",
    ),
    AICloudProviderDefinition(
        provider="claude",
        label="Anthropic Claude",
        base_url="https://api.anthropic.com/v1",
        default_model="claude-3-5-sonnet-latest",
        api_key_env="PENGBO_AI_CLOUD_API_KEY",
        documentation_url="https://docs.anthropic.com",
        notes=["Native Claude messages are not OpenAI-compatible; this slot is reserved for the adapter boundary."],
    ),
    AICloudProviderDefinition(
        provider="deepseek",
        label="DeepSeek",
        base_url="https://api.deepseek.com/v1",
        default_model="deepseek-chat",
        api_key_env="PENGBO_AI_CLOUD_API_KEY",
        documentation_url="https://api-docs.deepseek.com",
    ),
    AICloudProviderDefinition(
        provider="qwen",
        label="Qwen / DashScope",
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        default_model="qwen-plus",
        api_key_env="PENGBO_AI_CLOUD_API_KEY",
        documentation_url="https://help.aliyun.com/zh/model-studio",
    ),
    AICloudProviderDefinition(
        provider="custom",
        label="Custom OpenAI-compatible",
        base_url="",
        default_model="",
        api_key_env="PENGBO_AI_CLOUD_API_KEY",
    ),
)

ONBOARDING_STEPS: tuple[OnboardingStepKey, ...] = (
    "demo_mode",
    "provider_setup",
    "local_unlock",
    "privacy_boundary",
    "execution_boundary",
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

    def get_ai_control(self) -> AIControlPreferences:
        raw_values = self.sqlite_store.get_app_settings(
            [
                "ai_control_enabled",
                "ai_control_provider_mode",
                "ai_control_local_model",
                "ai_control_cloud_provider",
                "ai_control_cloud_base_url",
                "ai_control_cloud_model",
            ]
        )
        values = {
            "enabled": self.settings.ai_assistant_enabled,
            "provider_mode": "local",
            "local_provider": self.settings.ai_local_provider,
            "local_base_url": self.settings.ai_local_base_url,
            "local_model": self.settings.ai_local_model,
            "cloud_provider": self.settings.ai_cloud_provider,
            "cloud_base_url": self.settings.ai_cloud_base_url,
            "cloud_model": self.settings.ai_cloud_model,
            "cloud_api_key_env": "PENGBO_AI_CLOUD_API_KEY",
            "cloud_key_configured": bool(self.settings.ai_cloud_api_key),
            "available_cloud_providers": list(AI_CLOUD_PROVIDERS),
        }
        key_map = {
            "ai_control_enabled": "enabled",
            "ai_control_provider_mode": "provider_mode",
            "ai_control_local_model": "local_model",
            "ai_control_cloud_provider": "cloud_provider",
            "ai_control_cloud_base_url": "cloud_base_url",
            "ai_control_cloud_model": "cloud_model",
        }
        for raw_key, value_key in key_map.items():
            if raw_key in raw_values:
                values[value_key] = json.loads(raw_values[raw_key])
        provider = next((item for item in AI_CLOUD_PROVIDERS if item.provider == values["cloud_provider"]), None)
        if provider is None:
            values["cloud_provider"] = "deepseek"
            provider = next((item for item in AI_CLOUD_PROVIDERS if item.provider == "deepseek"), None)
        if provider is not None:
            if not values["cloud_base_url"]:
                values["cloud_base_url"] = provider.base_url or None
            if not values["cloud_model"]:
                values["cloud_model"] = provider.default_model or None
        if values["provider_mode"] == "disabled":
            values["provider_mode"] = "local"
        return AIControlPreferences.model_validate(values)

    def update_ai_control(self, payload: UpdateAIControlPreferencesRequest) -> AIControlPreferences:
        provider = next((item for item in AI_CLOUD_PROVIDERS if item.provider == payload.cloud_provider), None)
        cloud_base_url = payload.cloud_base_url or (provider.base_url if provider and provider.base_url else None)
        cloud_model = payload.cloud_model or (provider.default_model if provider and provider.default_model else None)
        provider_mode: AIProviderMode = payload.provider_mode if payload.provider_mode != "disabled" else "local"
        self.sqlite_store.upsert_app_settings(
            {
                "ai_control_enabled": payload.enabled,
                "ai_control_provider_mode": provider_mode,
                "ai_control_local_model": payload.local_model,
                "ai_control_cloud_provider": payload.cloud_provider,
                "ai_control_cloud_base_url": cloud_base_url,
                "ai_control_cloud_model": cloud_model,
            }
        )
        return self.get_ai_control()

    def get_onboarding(self) -> OnboardingState:
        raw_values = self.sqlite_store.get_app_settings(["onboarding_seen_at", "onboarding_checklist"])
        raw_value = raw_values.get("onboarding_seen_at")
        onboarding_seen_at = json.loads(raw_value) if raw_value is not None else None
        raw_checklist = raw_values.get("onboarding_checklist")
        checklist_values: dict[str, str | None] = {}
        if raw_checklist is not None:
            parsed = json.loads(raw_checklist)
            if isinstance(parsed, dict):
                checklist_values = {
                    str(key): str(value) if value is not None else None
                    for key, value in parsed.items()
                }

        checklist = [
            OnboardingChecklistItem(key=step, completed_at=checklist_values.get(step))
            for step in ONBOARDING_STEPS
        ]
        return OnboardingState(onboarding_seen_at=onboarding_seen_at, checklist=checklist)

    def update_onboarding(self, payload: UpdateOnboardingStateRequest) -> OnboardingState:
        checklist = {
            item.key: item.completed_at
            for item in payload.checklist
            if item.key in ONBOARDING_STEPS
        }
        self.sqlite_store.upsert_app_settings(
            {
                "onboarding_seen_at": payload.onboarding_seen_at,
                "onboarding_checklist": checklist,
            }
        )
        return self.get_onboarding()

    def reset_onboarding(self) -> OnboardingState:
        self.sqlite_store.upsert_app_settings(
            {
                "onboarding_seen_at": None,
                "onboarding_checklist": {step: None for step in ONBOARDING_STEPS},
            }
        )
        return self.get_onboarding()

    def complete_onboarding_step(self, step: OnboardingStepKey, completed: bool) -> OnboardingState:
        state = self.get_onboarding()
        completed_at = datetime.now(UTC).isoformat() if completed else None
        checklist = {
            item.key: (completed_at if item.key == step else item.completed_at)
            for item in state.checklist
        }
        self.sqlite_store.upsert_app_settings(
            {
                "onboarding_seen_at": state.onboarding_seen_at,
                "onboarding_checklist": checklist,
            }
        )
        return self.get_onboarding()

    def get_demo_mode(self) -> DemoModeStatus:
        missing_credentials: list[str] = []
        if not self.settings.edgar_identity:
            missing_credentials.append("EDGAR identity")
        if not self.settings.fred_api_key:
            missing_credentials.append("FRED API key")
        if not (self.settings.coingecko_demo_api_key or self.settings.coingecko_pro_api_key):
            missing_credentials.append("CoinGecko key")
        if not (self.settings.binance_api_key and self.settings.binance_secret):
            missing_credentials.append("Binance account credentials")

        return DemoModeStatus(
            enabled=True,
            no_key_evaluation_ready=True,
            mode="sample_no_key_evaluation",
            sample_surfaces=[
                "dashboard market pulse",
                "seeded watchlist",
                "asset workspace",
                "screeners",
                "research templates",
                "portfolio sample guidance",
                "data-source previews",
                "workflow templates",
            ],
            credential_gated_surfaces=[
                "EDGAR filings",
                "FRED keyed macro series",
                "CoinGecko market preview",
                "Binance private account state",
                "Binance live execution",
            ],
            missing_credentials=missing_credentials,
            safety_boundaries=[
                "Demo mode is read-only for provider data and uses sample or cached context where live credentials are absent.",
                "Missing credentials stay visible as credential_required or missing_credentials states.",
                "Live Binance submission remains disabled unless the user explicitly configures credentials, acknowledges risk, and confirms submission.",
                "Local unlock, session, and gateway checks still protect sensitive surfaces.",
            ],
            notes=[
                "No hosted account, CI secret, provider key, or live trading permission is required for first evaluation.",
                "Sample data is intentionally labeled and must not be treated as real account performance.",
            ],
        )
