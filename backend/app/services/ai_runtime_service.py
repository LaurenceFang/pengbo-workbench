from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

import requests

from ..models import AILocalModelInfo, AIRuntimeStatusResponse
from ..runtime import RuntimeSettings

if TYPE_CHECKING:
    from .settings_service import SettingsService


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


class AIRuntimeService:
    def __init__(self, settings: RuntimeSettings, settings_service: "SettingsService | None" = None) -> None:
        self.settings = settings
        self.settings_service = settings_service
        self.session = requests.Session()

    def get_status(self, *, write_evidence: bool = False) -> AIRuntimeStatusResponse:
        checked_at = _utc_now_iso()
        enabled = self._enabled()
        local_base_url = self._local_base_url()
        local_model = self._local_model()
        if not enabled:
            response = AIRuntimeStatusResponse(
                enabled=False,
                mode="disabled",
                local_provider=self.settings.ai_local_provider,
                local_base_url=local_base_url,
                selected_model=local_model,
                health="disabled",
                checked_at=checked_at,
                message="AI assistant features are disabled by default. Enable them explicitly before generation.",
            )
            return self._with_evidence(response) if write_evidence else response

        if self.settings.ai_local_provider.lower() != "ollama":
            response = AIRuntimeStatusResponse(
                enabled=True,
                mode="local",
                local_provider=self.settings.ai_local_provider,
                local_base_url=local_base_url,
                selected_model=local_model,
                health="unavailable",
                checked_at=checked_at,
                message=f"Unsupported local AI provider: {self.settings.ai_local_provider}.",
            )
            return self._with_evidence(response) if write_evidence else response

        return self._probe_ollama(write_evidence=write_evidence)

    def probe(self) -> AIRuntimeStatusResponse:
        return self._probe_ollama(write_evidence=True)

    def _probe_ollama(self, *, write_evidence: bool) -> AIRuntimeStatusResponse:
        checked_at = _utc_now_iso()
        started = time.perf_counter()
        enabled = self._enabled()
        local_base_url = self._local_base_url()
        local_model = self._local_model()
        try:
            response = self.session.get(
                local_base_url + "/api/tags",
                timeout=max(0.25, self.settings.ai_probe_timeout_seconds),
            )
            response.raise_for_status()
            latency_ms = int((time.perf_counter() - started) * 1000)
            payload = response.json()
            models = self._parse_ollama_models(payload)
            selected = local_model or (models[0].name if models else None)
            result = AIRuntimeStatusResponse(
                enabled=enabled,
                mode="local" if enabled else "disabled",
                local_provider="ollama",
                local_base_url=local_base_url,
                selected_model=selected,
                health="available" if models else "unavailable",
                model_count=len(models),
                models=models,
                latency_ms=latency_ms,
                checked_at=checked_at,
                message=(
                    f"Ollama responded with {len(models)} local model(s)."
                    if models
                    else "Ollama responded but no local models are installed."
                ),
            )
        except requests.Timeout:
            result = AIRuntimeStatusResponse(
                enabled=enabled,
                mode="local" if enabled else "disabled",
                local_provider="ollama",
                local_base_url=local_base_url,
                selected_model=local_model,
                health="timeout",
                latency_ms=int((time.perf_counter() - started) * 1000),
                checked_at=checked_at,
                message="Ollama probe timed out before the configured short timeout.",
            )
        except Exception as error:
            result = AIRuntimeStatusResponse(
                enabled=enabled,
                mode="local" if enabled else "disabled",
                local_provider="ollama",
                local_base_url=local_base_url,
                selected_model=local_model,
                health="error",
                latency_ms=int((time.perf_counter() - started) * 1000),
                checked_at=checked_at,
                message=self._safe_error(error),
            )
        return self._with_evidence(result) if write_evidence else result

    def _ai_control(self):
        if self.settings_service is None:
            return None
        return self.settings_service.get_ai_control()

    def _enabled(self) -> bool:
        control = self._ai_control()
        return self.settings.ai_assistant_enabled or bool(
            control and control.enabled and control.provider_mode == "local"
        )

    def _local_base_url(self) -> str:
        control = self._ai_control()
        if control and control.local_base_url:
            return control.local_base_url.rstrip("/")
        return self.settings.ai_local_base_url.rstrip("/")

    def _local_model(self) -> str | None:
        control = self._ai_control()
        if control and control.local_model:
            return control.local_model
        return self.settings.ai_local_model

    def _parse_ollama_models(self, payload: dict[str, Any]) -> list[AILocalModelInfo]:
        models = payload.get("models")
        if not isinstance(models, list):
            return []
        parsed: list[AILocalModelInfo] = []
        for item in models:
            if not isinstance(item, dict):
                continue
            name = item.get("name") or item.get("model")
            if not name:
                continue
            parsed.append(
                AILocalModelInfo(
                    name=str(name),
                    size_bytes=item.get("size") if isinstance(item.get("size"), int) else None,
                    modified_at=item.get("modified_at") if isinstance(item.get("modified_at"), str) else None,
                )
            )
        return parsed

    def _with_evidence(self, response: AIRuntimeStatusResponse) -> AIRuntimeStatusResponse:
        evidence_path = self.settings.diagnostics_dir / "ai-local-runtime-probe-latest.json"
        evidence_path.parent.mkdir(parents=True, exist_ok=True)
        evidence = response.model_copy(update={"evidence_path": str(evidence_path)})
        evidence_path.write_text(
            json.dumps(evidence.model_dump(mode="json"), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return evidence

    def _safe_error(self, error: Exception) -> str:
        message = str(error)
        if self.settings.translation_api_key:
            message = message.replace(self.settings.translation_api_key, "***")
        return message
