from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.runtime import RuntimeSettings


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self):
        return self._payload


class QueueSession:
    def __init__(self, responses):
        self.responses = list(responses)

    def get(self, url, **kwargs):
        if not self.responses:
            raise RuntimeError("no queued response")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def make_settings(runtime_root: Path, *, enabled: bool = False) -> RuntimeSettings:
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
        ai_assistant_enabled=enabled,
        ai_local_model="qwen3:8b",
        ai_probe_timeout_seconds=0.5,
    )


class AIRuntimeServiceTests(unittest.TestCase):
    def test_ai_runtime_status_is_disabled_by_default(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                response = client.get("/api/v1/ai/runtime/status")
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertFalse(payload["enabled"])
                self.assertEqual(payload["mode"], "disabled")
                self.assertEqual(payload["health"], "disabled")
                self.assertIn("disabled by default", payload["message"])

    def test_ai_runtime_probe_records_ollama_models_without_secret_output(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir), enabled=True))
            with TestClient(app) as client:
                service = app.state.container.ai_runtime_service
                service.session = QueueSession(
                    [
                        FakeResponse(
                            {
                                "models": [
                                    {
                                        "name": "qwen3:8b",
                                        "size": 5_200_000_000,
                                        "modified_at": "2026-05-23T00:00:00Z",
                                    }
                                ]
                            }
                        )
                    ]
                )

                response = client.post("/api/v1/ai/runtime/probe")
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload["enabled"])
                self.assertEqual(payload["mode"], "local")
                self.assertEqual(payload["health"], "available")
                self.assertEqual(payload["model_count"], 1)
                self.assertEqual(payload["models"][0]["name"], "qwen3:8b")

                evidence_path = Path(payload["evidence_path"])
                self.assertTrue(evidence_path.exists())
                contents = evidence_path.read_text(encoding="utf-8")
                self.assertIn("qwen3:8b", contents)
                self.assertNotIn("api_key", contents.lower())
                self.assertNotIn("secret", contents.lower())


if __name__ == "__main__":
    unittest.main()
