from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.runtime import RuntimeSettings


def make_settings(runtime_root: Path, *, host: str = "127.0.0.1") -> RuntimeSettings:
    return RuntimeSettings(
        host=host,
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


class GatewayHardeningTests(unittest.TestCase):
    def test_sidecar_refuses_non_loopback_bind(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            with self.assertRaisesRegex(ValueError, "non-loopback"):
                create_app(make_settings(Path(temp_dir), host="0.0.0.0"))

    def test_origin_method_and_redacted_gateway_audit(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                denied = client.post(
                    "/api/v1/security/session",
                    headers={
                        "Origin": "https://evil.example",
                        "X-Pengbo-Session": "session-secret",
                        "Authorization": "Bearer raw-token",
                    },
                    json={"accountLabel": "Should not leak"},
                )
                self.assertEqual(denied.status_code, 403)

                invalid_method = client.request("TRACE", "/api/v1/health")
                self.assertEqual(invalid_method.status_code, 405)

                allowed = client.get("/api/v1/health", headers={"Origin": "tauri://localhost"})
                self.assertEqual(allowed.status_code, 200)

                vite_dev_allowed = client.get("/api/v1/health", headers={"Origin": "http://127.0.0.1:5173"})
                self.assertEqual(vite_dev_allowed.status_code, 200)

                init_response = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "2468"})
                self.assertEqual(init_response.status_code, 200)
                session = client.post("/api/v1/security/session", json={}).json()
                audit = client.get(
                    "/api/v1/security/audit?category=gateway",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(audit.status_code, 200)
                rendered = str(audit.json())
                self.assertIn("origin_not_allowed", rendered)
                self.assertIn("method_not_allowed", rendered)
                self.assertNotIn("session-secret", rendered)
                self.assertNotIn("raw-token", rendered)
                self.assertNotIn("Should not leak", rendered)

    def test_sensitive_gateway_rate_limit_hook(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                last_status = 200
                for _ in range(61):
                    last_status = client.post("/api/v1/security/session", json={}).status_code
                self.assertEqual(last_status, 429)


if __name__ == "__main__":
    unittest.main()
