from __future__ import annotations

import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.runtime import RuntimeSettings
from backend.tests.test_research_service import FakeAssetService, FakePortfolioService, FakeScreenerService, make_asset_workspace


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
    def test_stale_idle_expiry_cannot_overwrite_a_newer_unlock(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                initialized = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "2468"})
                self.assertEqual(initialized.status_code, 200)

                store = app.state.container.sqlite_store
                stale_record = store.get_local_security_state()
                self.assertIsNotNone(stale_record)
                stale_record["unlocked_until"] = (datetime.now(UTC) - timedelta(seconds=1)).isoformat()
                stale_record["updated_at"] = (datetime.now(UTC) - timedelta(seconds=2)).isoformat()
                store.upsert_local_security_state(stale_record)
                stale_snapshot = store.get_local_security_state()

                unlocked = client.post("/api/v1/security/local/unlock", json={"unlock_secret": "2468"})
                self.assertEqual(unlocked.status_code, 200)
                self.assertFalse(unlocked.json()["locked"])

                resolved = app.state.container.local_security_service._expire_if_idle(stale_snapshot)
                self.assertIsNotNone(resolved["unlocked_until"])
                status = client.get("/api/v1/security/local/status")
                self.assertEqual(status.status_code, 200)
                self.assertFalse(status.json()["locked"])

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
                        "message": "Authorization: Bearer unit-secret-token api_key=unit-key-in-text",
                        "url": "https://example.test/path?token=unit-query-token&symbol=AAPL",
                        "encoded_url": "https://example.test/rss?q=api_key%3Dunit-encoded-key&hl=en-US",
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
                self.assertNotIn("unit-secret-token", str(event["payload"]))
                self.assertNotIn("unit-key-in-text", str(event["payload"]))
                self.assertNotIn("unit-query-token", str(event["payload"]))
                self.assertNotIn("unit-encoded-key", str(event["payload"]))

    def test_sensitive_workspaces_require_unlock_and_report_exports_are_audited(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                research_service = app.state.container.research_service
                research_service.asset_service = FakeAssetService({"AAPL": make_asset_workspace(symbol="AAPL")})
                research_service.screener_service = FakeScreenerService()
                research_service.portfolio_service = FakePortfolioService()
                locked_research = client.get("/api/v1/research/briefs/recent")
                self.assertEqual(locked_research.status_code, 423)
                locked_portfolio = client.get("/api/v1/portfolio/transactions")
                self.assertEqual(locked_portfolio.status_code, 423)
                locked_runtime = client.get("/api/v1/settings/runtime")
                self.assertEqual(locked_runtime.status_code, 423)

                init_response = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "2468"})
                self.assertEqual(init_response.status_code, 200)

                session = client.post("/api/v1/security/session", json={}).json()
                created = client.post(
                    "/api/v1/research/briefs",
                    json={"symbol": "AAPL"},
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(created.status_code, 200)
                brief_id = created.json()["brief_id"]
                updated = client.put(
                    f"/api/v1/research/briefs/{brief_id}/notes",
                    json={
                        "markdown": (
                            "Do not leak api_key=unit-export-secret "
                            "or Authorization: Bearer unit-export-token in exports."
                        )
                    },
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(updated.status_code, 200)
                self.assertNotIn("unit-export-secret", str(updated.json()))
                self.assertNotIn("unit-export-token", str(updated.json()))
                exported = client.post(
                    f"/api/v1/research/briefs/{brief_id}/export",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(exported.status_code, 200)
                contents = Path(exported.json()["export_path"]).read_text(encoding="utf-8")
                self.assertNotIn("unit-export-secret", contents)
                self.assertNotIn("unit-export-token", contents)

                stored_briefs = str(app.state.container.sqlite_store.get_research_brief(brief_id))
                self.assertNotIn("unit-export-secret", stored_briefs)
                self.assertNotIn("unit-export-token", stored_briefs)

                audit = client.get(
                    "/api/v1/security/audit?category=report_export",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(audit.status_code, 200)
                event_types = {event["event_type"] for event in audit.json()}
                self.assertIn("report_exported", event_types)

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

    def test_local_unlock_change_secret_and_reset_do_not_store_plaintext(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                initialized = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "old-pin"})
                self.assertEqual(initialized.status_code, 200)

                changed = client.post(
                    "/api/v1/security/local/change-secret",
                    json={"current_unlock_secret": "old-pin", "new_unlock_secret": "new-pin"},
                )
                self.assertEqual(changed.status_code, 200)
                self.assertFalse(changed.json()["locked"])

                client.post("/api/v1/security/local/lock")
                old_unlock = client.post("/api/v1/security/local/unlock", json={"unlock_secret": "old-pin"})
                self.assertEqual(old_unlock.status_code, 400)
                new_unlock = client.post("/api/v1/security/local/unlock", json={"unlock_secret": "new-pin"})
                self.assertEqual(new_unlock.status_code, 200)
                self.assertFalse(new_unlock.json()["locked"])

                stored = app.state.container.sqlite_store.get_local_security_state()
                self.assertNotIn("old-pin", str(stored))
                self.assertNotIn("new-pin", str(stored))

                reset = client.post(
                    "/api/v1/security/local/reset",
                    json={"confirmation": "RESET LOCAL UNLOCK"},
                )
                self.assertEqual(reset.status_code, 200)
                self.assertFalse(reset.json()["initialized"])
                self.assertTrue(reset.json()["locked"])
                self.assertIsNone(app.state.container.sqlite_store.get_local_security_state())

                reinitialized = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "fresh-pin"})
                self.assertEqual(reinitialized.status_code, 200)

                session = client.post("/api/v1/security/session", json={}).json()
                audit = client.get(
                    "/api/v1/security/audit?category=local_security",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                payloads = str(audit.json())
                self.assertIn("local_unlock_secret_changed", payloads)
                self.assertIn("local_unlock_reset", payloads)
                self.assertNotIn("old-pin", payloads)
                self.assertNotIn("new-pin", payloads)


if __name__ == "__main__":
    unittest.main()
