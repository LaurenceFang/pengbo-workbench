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


class SecurityAuditServiceTests(unittest.TestCase):
    def test_security_audit_redacts_sensitive_payload_fields(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                app.state.container.security_audit_service.record(
                    category="credential",
                    event_type="redaction_probe",
                    subject="unit",
                    summary="Probe sensitive payload redaction.",
                    payload={
                        "provider": "binance",
                        "api_key": "unit-key",
                        "nested": {
                            "identity": "unit@example.com",
                            "safe_value": "visible",
                        },
                        "auth_items": [{"refresh_token": "unit-refresh"}],
                    },
                )

                init_response = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "1234"})
                self.assertEqual(init_response.status_code, 200)
                session = client.post("/api/v1/security/session", json={}).json()
                response = client.get(
                    "/api/v1/security/audit?category=credential",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(response.status_code, 200)
                event = next(item for item in response.json() if item["event_type"] == "redaction_probe")
                self.assertEqual(event["payload"]["api_key"], "***")
                self.assertEqual(event["payload"]["nested"]["identity"], "***")
                self.assertEqual(event["payload"]["nested"]["safe_value"], "visible")
                self.assertEqual(event["payload"]["auth_items"][0]["refresh_token"], "***")

    def test_local_unlock_gates_sensitive_audit_and_records_events(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                status = client.get("/api/v1/security/local/status")
                self.assertEqual(status.status_code, 200)
                self.assertFalse(status.json()["initialized"])
                self.assertTrue(status.json()["locked"])

                blocked = client.get("/api/v1/security/audit")
                self.assertEqual(blocked.status_code, 423)

                initialized = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "2468"})
                self.assertEqual(initialized.status_code, 200)
                self.assertTrue(initialized.json()["initialized"])
                self.assertFalse(initialized.json()["locked"])

                locked = client.post("/api/v1/security/local/lock")
                self.assertEqual(locked.status_code, 200)
                self.assertTrue(locked.json()["locked"])

                failed = client.post("/api/v1/security/local/unlock", json={"unlock_secret": "wrong"})
                self.assertEqual(failed.status_code, 400)
                failed_status = client.get("/api/v1/security/local/status")
                self.assertEqual(failed_status.json()["failed_attempts"], 1)

                unlocked = client.post("/api/v1/security/local/unlock", json={"unlock_secret": "2468"})
                self.assertEqual(unlocked.status_code, 200)
                self.assertFalse(unlocked.json()["locked"])

                session = client.post("/api/v1/security/session", json={}).json()
                audit = client.get(
                    "/api/v1/security/audit?category=local_security",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(audit.status_code, 200)
                event_types = {event["event_type"] for event in audit.json()}
                self.assertIn("local_unlock_initialized", event_types)
                self.assertIn("local_unlock_failed", event_types)
                self.assertIn("local_unlock_succeeded", event_types)

                stored = app.state.container.sqlite_store.get_local_security_state()
                self.assertIsNotNone(stored)
                self.assertNotIn("2468", str(stored))


if __name__ == "__main__":
    unittest.main()
