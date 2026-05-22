from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.runtime import RuntimeSettings
from backend.tests.test_research_service import (
    FakePortfolioService,
    FakeScreenerService,
    make_asset_workspace,
    FakeAssetService,
)


def make_settings(
    runtime_root: Path,
    *,
    ai_enabled: bool = False,
    cloud_enabled: bool = False,
) -> RuntimeSettings:
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
        ai_cloud_enabled=cloud_enabled,
        ai_cloud_provider="deepseek",
        ai_cloud_model="deepseek-chat",
    )


def install_offline_research_fixtures(app) -> None:
    fake_asset_service = FakeAssetService({"AAPL": make_asset_workspace(symbol="AAPL")})
    research_service = app.state.container.research_service
    research_service.asset_service = fake_asset_service
    research_service.screener_service = FakeScreenerService()
    research_service.portfolio_service = FakePortfolioService()


class ResearchAssistantBoundaryTests(unittest.TestCase):
    def test_permission_boundary_is_route_classified(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                install_offline_research_fixtures(app)
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

                templates = client.get(
                    "/api/v1/research/assistant/templates",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(templates.status_code, 200)
                template_keys = {item["template_key"] for item in templates.json()}
                self.assertEqual(
                    template_keys,
                    {
                        "research_summary",
                        "thesis",
                        "counter_thesis",
                        "earnings_review",
                        "portfolio_risk",
                        "provider_limitation",
                        "report_rewrite",
                    },
                )
                self.assertTrue(all(item["language_rules"] for item in templates.json()))

                cloud = client.get(
                    "/api/v1/ai/cloud/status",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(cloud.status_code, 200)
                cloud_payload = cloud.json()
                self.assertFalse(cloud_payload["enabled"])
                self.assertFalse(cloud_payload["configured"])
                self.assertFalse(cloud_payload["credential_configured"])
                self.assertTrue(cloud_payload["requires_explicit_confirmation"])

                routes = client.get("/api/v1/security/route-classification").json()
                ai_routes = [item for item in routes if item["surface"] == "ai_assistant"]
                self.assertGreaterEqual(len(ai_routes), 4)
                self.assertTrue(any(item["permission"] == "ai:generate" for item in ai_routes))

    def test_context_preview_requires_unlock_redacts_notes_and_audits(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                install_offline_research_fixtures(app)
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
                install_offline_research_fixtures(app)
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

    def test_cloud_generation_requires_opt_in_and_current_preview(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir), ai_enabled=True, cloud_enabled=True))
            with TestClient(app) as client:
                install_offline_research_fixtures(app)
                session = client.post("/api/v1/security/session", json={}).json()
                client.post("/api/v1/security/local/initialize", json={"unlock_secret": "1234"})
                brief = client.post("/api/v1/research/briefs", json={"symbol": "AAPL"}).json()

                no_confirm = client.post(
                    f"/api/v1/research/assistant/briefs/{brief['brief_id']}/generate",
                    headers={"X-Pengbo-Session": session["session_id"]},
                    json={"providerMode": "cloud", "templateKey": "research_summary"},
                )
                self.assertEqual(no_confirm.status_code, 200)
                no_confirm_payload = no_confirm.json()
                self.assertEqual(no_confirm_payload["status"], "blocked")
                self.assertEqual(no_confirm_payload["provider"], "cloud")
                self.assertIn("cloud_opt_in_required", no_confirm_payload["blocked_reasons"])

                stale_ack = client.post(
                    f"/api/v1/research/assistant/briefs/{brief['brief_id']}/generate",
                    headers={"X-Pengbo-Session": session["session_id"]},
                    json={
                        "providerMode": "cloud",
                        "templateKey": "research_summary",
                        "cloudOptInConfirmed": True,
                        "cloudContextAcknowledgedChars": 1,
                    },
                )
                self.assertEqual(stale_ack.status_code, 200)
                stale_payload = stale_ack.json()
                self.assertEqual(stale_payload["status"], "blocked")
                self.assertIn("cloud_context_preview_stale", stale_payload["blocked_reasons"])

                preview = client.get(
                    f"/api/v1/research/assistant/briefs/{brief['brief_id']}/context-preview",
                    headers={"X-Pengbo-Session": session["session_id"]},
                ).json()
                missing_key = client.post(
                    f"/api/v1/research/assistant/briefs/{brief['brief_id']}/generate",
                    headers={"X-Pengbo-Session": session["session_id"]},
                    json={
                        "providerMode": "cloud",
                        "templateKey": "research_summary",
                        "cloudOptInConfirmed": True,
                        "cloudContextAcknowledgedChars": preview["estimated_input_chars"],
                    },
                )
                self.assertEqual(missing_key.status_code, 200)
                missing_payload = missing_key.json()
                self.assertEqual(missing_payload["status"], "blocked")
                self.assertIn("cloud_credentials_missing", missing_payload["blocked_reasons"])

    def test_generate_returns_grounded_local_output_when_enabled(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir), ai_enabled=True))
            with TestClient(app) as client:
                install_offline_research_fixtures(app)
                session = client.post("/api/v1/security/session", json={}).json()
                client.post("/api/v1/security/local/initialize", json={"unlock_secret": "1234"})
                brief = client.post("/api/v1/research/briefs", json={"symbol": "AAPL"}).json()

                response = client.post(
                    f"/api/v1/research/assistant/briefs/{brief['brief_id']}/generate",
                    headers={"X-Pengbo-Session": session["session_id"]},
                    json={"templateKey": "provider_limitation"},
                )
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertEqual(payload["status"], "completed")
                self.assertEqual(payload["template_key"], "provider_limitation")
                self.assertEqual(payload["provider"], "local")
                self.assertTrue(payload["grounded"])
                self.assertGreaterEqual(len(payload["citations"]), 2)
                self.assertTrue(any("No external web claim" in item for item in payload["limitations"]))
                self.assertTrue(any("Provider limitation" in item for item in payload["risks"]))
                self.assertIn("Boundary:", payload["output_markdown"])
                self.assertNotIn("price target", payload["output_markdown"].lower())
                self.assertNotIn("earnings date", payload["output_markdown"].lower())
                self.assertNotIn("submit", " ".join(payload["questions"]).lower())


if __name__ == "__main__":
    unittest.main()
