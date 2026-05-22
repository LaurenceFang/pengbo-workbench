from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.runtime import RuntimeSettings


def make_settings(runtime_root: Path, *, ai_enabled: bool = False) -> RuntimeSettings:
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
        ai_assistant_enabled=ai_enabled,
        ai_local_model="qwen3:8b",
    )


class ResearchAssistantBoundaryTests(unittest.TestCase):
    def test_permission_boundary_is_route_classified(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                session = client.post("/api/v1/security/session", json={}).json()

                boundary = client.get(
                    "/api/v1/ai/permissions",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(boundary.status_code, 200)
                payload = boundary.json()
                self.assertIn("structured data-quality status, limitations, and machine tags", payload["allowed_context"])
                self.assertTrue(any("raw provider credentials" in item for item in payload["forbidden_context"]))
                self.assertIn("ai_context_preview_created", payload["audit_events"])

                routes = client.get("/api/v1/security/route-classification").json()
                ai_routes = [item for item in routes if item["surface"] == "ai_assistant"]
                self.assertGreaterEqual(len(ai_routes), 3)
                self.assertTrue(any(item["permission"] == "ai:generate" for item in ai_routes))

    def test_context_preview_requires_unlock_redacts_notes_and_audits(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                session = client.post("/api/v1/security/session", json={}).json()
                brief = client.post("/api/v1/research/briefs", json={"symbol": "AAPL"}).json()
                note = "User note with api_key=unit-secret and sk-testsecret123456789."
                note_response = client.put(
                    f"/api/v1/research/briefs/{brief['brief_id']}/notes",
                    json={"markdown": note},
                )
                self.assertEqual(note_response.status_code, 200)

                locked = client.get(
                    f"/api/v1/research/assistant/briefs/{brief['brief_id']}/context-preview",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(locked.status_code, 423)

                init = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "1234"})
                self.assertEqual(init.status_code, 200)
                preview = client.get(
                    f"/api/v1/research/assistant/briefs/{brief['brief_id']}/context-preview",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(preview.status_code, 200)
                payload = preview.json()
                self.assertEqual(payload["brief_id"], brief["brief_id"])
                self.assertIn("credentials", payload["blocked_sections"])
                self.assertFalse(payload["cloud_transmission_allowed"])
                self.assertTrue(payload["audited_event_id"].startswith("security-"))
                self.assertNotIn("unit-secret", payload["prompt_context_preview"])
                self.assertNotIn("sk-testsecret", payload["prompt_context_preview"])
                self.assertIn("[redacted]", payload["prompt_context_preview"])

                audit = client.get(
                    "/api/v1/security/audit?category=ai_assistant",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(audit.status_code, 200)
                event_types = {item["event_type"] for item in audit.json()}
                self.assertIn("ai_context_preview_created", event_types)
                self.assertNotIn("unit-secret", str(audit.json()))

    def test_generate_blocks_when_ai_disabled_and_audits(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                session = client.post("/api/v1/security/session", json={}).json()
                client.post("/api/v1/security/local/initialize", json={"unlock_secret": "1234"})
                brief = client.post("/api/v1/research/briefs", json={"symbol": "AAPL"}).json()

                response = client.post(
                    f"/api/v1/research/assistant/briefs/{brief['brief_id']}/generate",
                    headers={"X-Pengbo-Session": session["session_id"]},
                    json={"templateKey": "research_summary"},
                )
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertEqual(payload["status"], "blocked")
                self.assertIn("ai_disabled", payload["blocked_reasons"])
                self.assertEqual(payload["provider"], "disabled")

                audit = client.get(
                    "/api/v1/security/audit?category=ai_assistant",
                    headers={"X-Pengbo-Session": session["session_id"]},
                ).json()
                event_types = {item["event_type"] for item in audit}
                self.assertIn("ai_generation_requested", event_types)
                self.assertIn("ai_generation_blocked", event_types)

    def test_generate_returns_grounded_local_output_when_enabled(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir), ai_enabled=True))
            with TestClient(app) as client:
                session = client.post("/api/v1/security/session", json={}).json()
                client.post("/api/v1/security/local/initialize", json={"unlock_secret": "1234"})
                brief = client.post("/api/v1/research/briefs", json={"symbol": "AAPL"}).json()

                response = client.post(
                    f"/api/v1/research/assistant/briefs/{brief['brief_id']}/generate",
                    headers={"X-Pengbo-Session": session["session_id"]},
                    json={"templateKey": "research_summary"},
                )
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertEqual(payload["status"], "completed")
                self.assertEqual(payload["provider"], "local")
                self.assertTrue(payload["grounded"])
                self.assertGreaterEqual(len(payload["citations"]), 2)
                self.assertTrue(any("No external web claim" in item for item in payload["limitations"]))
                self.assertIn("Boundary:", payload["output_markdown"])
                self.assertNotIn("submit", " ".join(payload["questions"]).lower())


if __name__ == "__main__":
    unittest.main()
