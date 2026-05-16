from __future__ import annotations

from typing import Any

import requests

from ..models import TranslationStatusResponse, TranslationSuggestRequest, TranslationSuggestResponse
from ..runtime import RuntimeSettings


LOCAL_GLOSSARY = {
    "Factor Lab": "因子实验室",
    "Workflow Studio": "工作流",
    "Run Factor Lab": "运行因子实验室",
    "Live Execution": "真实交易",
    "Risk acknowledgement is required.": "需要先确认风险。",
    "Live mode is off by default.": "真实交易模式默认关闭。",
}


class TranslationService:
    def __init__(self, settings: RuntimeSettings) -> None:
        self.settings = settings
        self.provider = (settings.translation_provider or "local").lower()
        self.session = requests.Session()

    @property
    def configured(self) -> bool:
        if self.provider in {"local", ""}:
            return False
        if self.provider == "libretranslate":
            return bool(self.settings.translation_base_url)
        return bool(self.settings.translation_api_key)

    def get_status(self) -> TranslationStatusResponse:
        provider = self.provider or "local"
        configured = self.configured
        if provider == "local":
            message = "Using local dictionary and i18n checks; no external translator is configured."
        elif configured:
            message = f"{provider} translation adapter is configured."
        else:
            message = f"{provider} translation adapter is available but missing required configuration."
        return TranslationStatusResponse(
            enabled=True,
            provider=provider,
            configured=configured,
            message=message,
        )

    def suggest(self, payload: TranslationSuggestRequest) -> TranslationSuggestResponse:
        if self.configured:
            translated = self._online_translate(payload)
            if translated:
                return TranslationSuggestResponse(
                    translated_text=translated,
                    provider=self.provider,
                    configured=True,
                    used_fallback=False,
                )
        return TranslationSuggestResponse(
            translated_text=self._local_translate(payload.text),
            provider="local",
            configured=False,
            used_fallback=True,
        )

    def _local_translate(self, text: str) -> str:
        translated = text
        for source, target in LOCAL_GLOSSARY.items():
            translated = translated.replace(source, target)
        return translated

    def _online_translate(self, payload: TranslationSuggestRequest) -> str | None:
        if self.provider == "libretranslate" and self.settings.translation_base_url:
            response = self.session.post(
                self.settings.translation_base_url.rstrip("/") + "/translate",
                json={
                    "q": payload.text,
                    "source": _language_code(payload.source_language),
                    "target": _language_code(payload.target_language),
                    "api_key": self.settings.translation_api_key or "",
                    "format": "text",
                },
                timeout=20,
            )
            response.raise_for_status()
            data: Any = response.json()
            if isinstance(data, dict):
                return data.get("translatedText")
        return None


def _language_code(language: str) -> str:
    return "zh" if language.startswith("zh") else "en"
