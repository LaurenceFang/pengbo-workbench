from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.runtime import RuntimeSettings


class TranslationServiceTests(unittest.TestCase):
    def test_translation_status_and_local_suggestion_without_api_key(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            runtime_root = Path(temp_dir)
            app = create_app(
                RuntimeSettings(
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
            )
            with TestClient(app) as client:
                status = client.get("/api/v1/translation/status")
                self.assertEqual(status.status_code, 200)
                self.assertEqual(status.json()["provider"], "local")
                self.assertFalse(status.json()["configured"])

                suggestion = client.post(
                    "/api/v1/translation/suggest",
                    json={"text": "Run Factor Lab", "sourceLanguage": "en-US", "targetLanguage": "zh-CN"},
                )
                self.assertEqual(suggestion.status_code, 200)
                self.assertEqual(suggestion.json()["translated_text"], "Run 因子实验室")
                self.assertTrue(suggestion.json()["used_fallback"])


if __name__ == "__main__":
    unittest.main()
