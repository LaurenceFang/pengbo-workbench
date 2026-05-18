from __future__ import annotations

import sqlite3
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.runtime import RuntimeSettings
from backend.app.storage.sqlite_store import SqliteStore


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


class AccountScopedCredentialTests(unittest.TestCase):
    def test_existing_connection_profiles_migrate_to_default_local_profile(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            db_path = Path(temp_dir) / "data" / "pengbo.sqlite3"
            db_path.parent.mkdir(parents=True, exist_ok=True)
            connection = sqlite3.connect(db_path)
            connection.executescript(
                """
                CREATE TABLE connection_profiles (
                    provider TEXT PRIMARY KEY,
                    is_configured INTEGER NOT NULL,
                    metadata_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                INSERT INTO connection_profiles (provider, is_configured, metadata_json, updated_at)
                VALUES ('edgar', 1, '{"last_status":"ok","credential_summary":"identity stored"}', '2026-05-18T00:00:00+00:00');
                """
            )
            connection.commit()
            connection.close()

            store = SqliteStore(db_path)
            try:
                store.initialize()
                profile = store.get_connection_profile("edgar", "local_default")
                self.assertIsNotNone(profile)
                self.assertEqual(profile["profile_id"], "local_default")
                self.assertEqual(profile["profile_label"], "Local default")
                self.assertTrue(profile["is_configured"])
                self.assertEqual(profile["metadata"]["last_status"], "ok")
            finally:
                store.close()

    def test_profiles_are_selectable_and_audited_without_secret_material(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                unlock = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "2468"})
                self.assertEqual(unlock.status_code, 200)

                created = client.post("/api/v1/connections/profiles", json={"label": "Research account"})
                self.assertEqual(created.status_code, 200)
                profile_id = created.json()["profile_id"]
                self.assertEqual(created.json()["label"], "Research account")

                selected = client.put("/api/v1/connections/profiles/active", json={"profile_id": profile_id})
                self.assertEqual(selected.status_code, 200)
                self.assertTrue(selected.json()["is_active"])

                status = client.get("/api/v1/connections/status")
                self.assertEqual(status.status_code, 200)
                self.assertEqual(status.json()["active_profile"]["profile_id"], profile_id)
                self.assertTrue(all(item["profile_id"] == profile_id for item in status.json()["providers"]))

                test_response = client.post("/api/v1/connections/test", json={"provider": "edgar"})
                self.assertEqual(test_response.status_code, 200)
                self.assertEqual(test_response.json()["profile_id"], profile_id)
                self.assertEqual(test_response.json()["profile_label"], "Research account")

                session = client.post("/api/v1/security/session", json={}).json()
                audit = client.get(
                    "/api/v1/security/audit?category=credential",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(audit.status_code, 200)
                payloads = [event["payload"] for event in audit.json()]
                self.assertTrue(any(payload.get("profile_id") == profile_id for payload in payloads))
                self.assertNotIn("2468", str(payloads))


if __name__ == "__main__":
    unittest.main()
