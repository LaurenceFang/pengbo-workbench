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

                response = client.get("/api/v1/security/audit?category=credential")
                self.assertEqual(response.status_code, 200)
                event = next(item for item in response.json() if item["event_type"] == "redaction_probe")
                self.assertEqual(event["payload"]["api_key"], "***")
                self.assertEqual(event["payload"]["nested"]["identity"], "***")
                self.assertEqual(event["payload"]["nested"]["safe_value"], "visible")
                self.assertEqual(event["payload"]["auth_items"][0]["refresh_token"], "***")


if __name__ == "__main__":
    unittest.main()
