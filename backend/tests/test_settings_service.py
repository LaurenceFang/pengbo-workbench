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


if __name__ == "__main__":
    unittest.main()
