from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.runtime import RuntimeSettings


def make_settings(runtime_root: Path) -> RuntimeSettings:
    return RuntimeSettings(
        host="127.0.0.1",
        port=8765,
        data_dir=runtime_root / "data",
        log_dir=runtime_root / "logs",
        runtime_mode="test",
        build_summary_path=None,
        edgar_identity=None,
        binance_api_key=None,
        binance_secret=None,
        binance_password=None,
    )


class SettingsPreferencesTests(unittest.TestCase):
    def test_runtime_and_health_include_version_metadata(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                health = client.get("/api/v1/health")
                self.assertEqual(health.status_code, 200)
                self.assertEqual(health.json()["app_version"], "0.1.0")
                self.assertEqual(health.json()["sidecar_version"], "0.1.0")

                runtime = client.get("/api/v1/settings/runtime")
                self.assertEqual(runtime.status_code, 200)
                self.assertEqual(runtime.json()["app_version"], "0.1.0")
                self.assertEqual(runtime.json()["sidecar_version"], "0.1.0")

    def test_preferences_default_and_persist_language_density(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                defaults = client.get("/api/v1/settings/preferences")
                self.assertEqual(defaults.status_code, 200)
                self.assertEqual(defaults.json()["language"], "zh-CN")
                self.assertEqual(defaults.json()["density"], "standard")

                payload = {
                    **defaults.json(),
                    "default_view": "manual",
                    "language": "en-US",
                    "density": "compact",
                }
                updated = client.put("/api/v1/settings/preferences", json=payload)
                self.assertEqual(updated.status_code, 200)
                self.assertEqual(updated.json()["default_view"], "manual")
                self.assertEqual(updated.json()["language"], "en-US")
                self.assertEqual(updated.json()["density"], "compact")

                restored = client.get("/api/v1/settings/preferences")
                self.assertEqual(restored.status_code, 200)
                self.assertEqual(restored.json()["default_view"], "manual")
                self.assertEqual(restored.json()["language"], "en-US")
                self.assertEqual(restored.json()["density"], "compact")

    def test_ai_control_defaults_and_provider_catalog_are_secret_safe(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                session = client.post("/api/v1/security/session", json={}).json()
                headers = {"X-Pengbo-Session": session["session_id"]}
                defaults = client.get("/api/v1/settings/ai-control", headers=headers)
                self.assertEqual(defaults.status_code, 200)
                payload = defaults.json()
                self.assertFalse(payload["enabled"])
                self.assertEqual(payload["provider_mode"], "local")
                self.assertEqual(payload["cloud_api_key_env"], "PENGBO_AI_CLOUD_API_KEY")
                self.assertFalse(payload["cloud_key_configured"])
                providers = {item["provider"]: item for item in payload["available_cloud_providers"]}
                self.assertEqual(
                    set(providers),
                    {"chatgpt", "gemini", "grok", "claude", "deepseek", "qwen", "custom"},
                )
                self.assertEqual(providers["chatgpt"]["base_url"], "https://api.openai.com/v1")
                self.assertEqual(providers["deepseek"]["default_model"], "deepseek-chat")
                self.assertNotIn("sk-", str(providers).lower())

                updated = client.put(
                    "/api/v1/settings/ai-control",
                    headers=headers,
                    json={
                        "enabled": True,
                        "provider_mode": "cloud",
                        "local_model": "qwen3:8b",
                        "cloud_provider": "qwen",
                        "cloud_base_url": None,
                        "cloud_model": None,
                    },
                )
                self.assertEqual(updated.status_code, 200)
                self.assertTrue(updated.json()["enabled"])
                self.assertEqual(updated.json()["provider_mode"], "cloud")
                self.assertEqual(updated.json()["cloud_provider"], "qwen")
                self.assertEqual(updated.json()["cloud_base_url"], "https://dashscope.aliyuncs.com/compatible-mode/v1")
                self.assertEqual(updated.json()["cloud_model"], "qwen-plus")

    def test_demo_mode_status_is_no_key_safe_and_keeps_boundaries_visible(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                response = client.get("/api/v1/settings/demo-mode")
                self.assertEqual(response.status_code, 200)
                payload = response.json()

                self.assertTrue(payload["enabled"])
                self.assertTrue(payload["no_key_evaluation_ready"])
                self.assertEqual(payload["mode"], "sample_no_key_evaluation")
                self.assertIn("seeded watchlist", payload["sample_surfaces"])
                self.assertIn("portfolio sample guidance", payload["sample_surfaces"])
                self.assertIn("EDGAR identity", payload["missing_credentials"])
                self.assertIn("CoinGecko key", payload["missing_credentials"])
                self.assertIn("Binance private account state", payload["credential_gated_surfaces"])
                self.assertTrue(any("Live Binance submission remains disabled" in note for note in payload["safety_boundaries"]))

    def test_onboarding_checklist_defaults_persists_and_resets_locally(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                defaults = client.get("/api/v1/settings/onboarding")
                self.assertEqual(defaults.status_code, 200)
                default_payload = defaults.json()
                self.assertIsNone(default_payload["onboarding_seen_at"])
                self.assertEqual(
                    [item["key"] for item in default_payload["checklist"]],
                    [
                        "demo_mode",
                        "provider_setup",
                        "local_unlock",
                        "privacy_boundary",
                        "execution_boundary",
                    ],
                )
                self.assertTrue(all(item["completed_at"] is None for item in default_payload["checklist"]))

                payload = {
                    "onboarding_seen_at": "2026-05-21T10:00:00+08:00",
                    "checklist": [
                        {"key": "demo_mode", "completed_at": "2026-05-21T10:01:00+08:00"},
                        {"key": "provider_setup", "completed_at": None},
                        {"key": "local_unlock", "completed_at": "2026-05-21T10:02:00+08:00"},
                        {"key": "privacy_boundary", "completed_at": None},
                        {"key": "execution_boundary", "completed_at": None},
                    ],
                }
                updated = client.put("/api/v1/settings/onboarding", json=payload)
                self.assertEqual(updated.status_code, 200)
                self.assertEqual(updated.json()["onboarding_seen_at"], payload["onboarding_seen_at"])
                self.assertEqual(updated.json()["checklist"][0]["completed_at"], "2026-05-21T10:01:00+08:00")

                restored = client.get("/api/v1/settings/onboarding")
                self.assertEqual(restored.status_code, 200)
                self.assertEqual(restored.json()["checklist"][2]["completed_at"], "2026-05-21T10:02:00+08:00")

                reset = client.post("/api/v1/settings/onboarding/reset")
                self.assertEqual(reset.status_code, 200)
                self.assertIsNone(reset.json()["onboarding_seen_at"])
                self.assertTrue(all(item["completed_at"] is None for item in reset.json()["checklist"]))


if __name__ == "__main__":
    unittest.main()
