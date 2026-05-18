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


class AuthSessionServiceTests(unittest.TestCase):
    def test_session_creation_status_and_redacted_audit(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                init_response = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "2468"})
                self.assertEqual(init_response.status_code, 200)
                created = client.post(
                    "/api/v1/security/session",
                    json={"accountLabel": "Unit account", "ttlMinutes": 5},
                )
                self.assertEqual(created.status_code, 200)
                session_id = created.json()["session_id"]

                status = client.get("/api/v1/security/session", headers={"X-Pengbo-Session": session_id})
                self.assertEqual(status.status_code, 200)
                self.assertEqual(status.json()["status"], "active")
                self.assertIn("execution:manage", status.json()["permissions"])

                audit = client.get(
                    "/api/v1/security/audit?category=session",
                    headers={"X-Pengbo-Session": session_id},
                )
                self.assertEqual(audit.status_code, 200)
                event_types = [item["event_type"] for item in audit.json()]
                self.assertIn("session_created", event_types)
                self.assertNotIn("Unit account", str(audit.json()))

    def test_sensitive_routes_require_session_permission(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                init_response = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "2468"})
                self.assertEqual(init_response.status_code, 200)
                denied = client.get("/api/v1/security/audit")
                self.assertEqual(denied.status_code, 401)

                session = client.post("/api/v1/security/session", json={}).json()
                allowed = client.get(
                    "/api/v1/security/audit",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(allowed.status_code, 200)

    def test_route_classification_maps_t56_inputs(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                response = client.get("/api/v1/security/route-classification")
                self.assertEqual(response.status_code, 200)
                routes = {(item["method"], item["path"]): item for item in response.json()}
                self.assertEqual(
                    routes[("POST", "/api/v1/execution/binance/intents/{intent_id}/submit")]["exposure"],
                    "never_public",
                )
                self.assertEqual(
                    routes[("GET", "/api/v1/connections/binance/account")]["permission"],
                    "account:read",
                )


if __name__ == "__main__":
    unittest.main()
