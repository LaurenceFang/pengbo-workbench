from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.models import WorkflowRunRequest
from backend.app.runtime import RuntimeSettings
from backend.app.services.workflow_service import WorkflowService
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


class FakeScreenerService:
    def run(self, payload):
        return SimpleNamespace(
            preset=payload.preset,
            variant_key=payload.variant_key or "default",
            universe_source=payload.universe_source,
            hit_count=1,
            results=[SimpleNamespace(symbol="AAPL")],
        )


class FakeResearchService:
    def __init__(self) -> None:
        self.last_payload = None

    def create_brief(self, payload):
        self.last_payload = payload
        return SimpleNamespace(
            brief_id="brief-unit",
            symbol=payload.symbol.strip().upper(),
            title=f"{payload.symbol.strip().upper()} Research Brief",
        )

    def export_brief(self, brief_id: str):
        return {
            "brief_id": brief_id,
            "artifact_id": brief_id,
            "artifact_type": "research_brief",
            "export_path": f"reports/{brief_id}.md",
        }


class FakeFactorService:
    def __init__(self) -> None:
        self.created = 0

    def run(self, payload):
        self.created += 1
        return SimpleNamespace(
            run_id=f"factor-unit-{self.created}",
            family=payload.family,
            results=[SimpleNamespace(symbol="AAPL"), SimpleNamespace(symbol="MSFT")],
        )

    def get_run(self, run_id: str):
        return SimpleNamespace(run_id=run_id, family="composite", results=[SimpleNamespace(symbol="AAPL")])


class FakeStrategyService:
    def __init__(self) -> None:
        self.backtests = 0
        self.paper_sessions = 0

    def run_backtest(self, payload):
        self.backtests += 1
        return SimpleNamespace(
            run_id=f"strategy-unit-{self.backtests}",
            factor_run_id=payload.factor_run_id,
            trades=[SimpleNamespace(symbol="AAPL")],
            positions=[SimpleNamespace(symbol="AAPL")],
        )

    def get_backtest(self, run_id: str):
        return SimpleNamespace(run_id=run_id, factor_run_id="factor-unit", trades=[], positions=[])

    def create_paper_session(self, payload):
        self.paper_sessions += 1
        return SimpleNamespace(
            session_id=f"paper-unit-{self.paper_sessions}",
            backtest_run_id=payload.backtest_run_id,
            orders=[SimpleNamespace(symbol="AAPL")],
            no_live_orders=True,
        )

    def get_paper_session(self, session_id: str):
        return SimpleNamespace(session_id=session_id, backtest_run_id="strategy-unit", orders=[], no_live_orders=True)

    def export_report(self, artifact_id: str):
        artifact_type = "paper_session" if artifact_id.startswith("paper-") else "backtest"
        return {
            "artifact_id": artifact_id,
            "artifact_type": artifact_type,
            "export_path": f"reports/{artifact_id}.md",
        }


class FakeExecutionService:
    def __init__(self) -> None:
        self.created_intents = 0
        self.submit_calls = 0
        self.config_updates = 0
        self.kill_switch_updates = 0

    def create_intent(self, payload):
        self.created_intents += 1
        return SimpleNamespace(
            intent_id=f"intent-unit-{self.created_intents}",
            status="draft",
            request=payload,
            no_live_order_until_submit=True,
        )

    def submit_intent(self, intent_id: str):  # pragma: no cover - test guard
        self.submit_calls += 1
        raise AssertionError(f"submit_intent should not be called by T42 workflows: {intent_id}")

    def update_config(self, payload):  # pragma: no cover - test guard
        self.config_updates += 1
        raise AssertionError("Workflow automation must not update live execution config")

    def set_kill_switch(self, payload):  # pragma: no cover - test guard
        self.kill_switch_updates += 1
        raise AssertionError("Workflow automation must not change kill switches")


class FakeDataSourceService:
    def get_macro_series(self, *, provider: str, series_id: str, country: str, limit: int):
        return SimpleNamespace(
            provider=provider,
            observations=[SimpleNamespace(date="2025", value=100.0)],
            provenance=SimpleNamespace(stale=False, fetched_at="2026-05-14T00:00:00+00:00"),
        )

    def get_news_events(self, *, query: str, limit: int):
        return SimpleNamespace(
            provider="rss_events",
            events=[SimpleNamespace(title=query)],
            provenance=SimpleNamespace(stale=False, fetched_at="2026-05-14T00:00:00+00:00"),
        )

    def get_crypto_markets(self, *, ids: str, limit: int):
        return SimpleNamespace(
            provider="coingecko",
            assets=[SimpleNamespace(id="bitcoin")],
            provenance=SimpleNamespace(stale=False, fetched_at="2026-05-14T00:00:00+00:00"),
        )

    def get_equity_quote(self, *, provider: str, symbol: str):
        return SimpleNamespace(
            provider=provider,
            symbol=symbol,
            price=1596.8,
            provenance=SimpleNamespace(stale=False, fetched_at="2026-05-22T00:00:00+00:00"),
        )


def make_workflow_service(sqlite_store: SqliteStore) -> tuple[WorkflowService, FakeExecutionService]:
    execution = FakeExecutionService()
    research = FakeResearchService()
    return (
        WorkflowService(
            sqlite_store,
            FakeScreenerService(),
            research,
            FakeFactorService(),
            FakeStrategyService(),
            execution,
            FakeDataSourceService(),
        ),
        execution,
    )


class WorkflowServiceTest(unittest.TestCase):
    def make_store(self, runtime_root: Path) -> SqliteStore:
        store = SqliteStore(runtime_root / "pengbo.sqlite3")
        store.initialize()
        return store

    def test_templates_include_t42_policy_categories(self):
        with TemporaryDirectory() as temp_dir:
            store = self.make_store(Path(temp_dir))
            service, _ = make_workflow_service(store)

            templates = service.list_templates()

            self.assertEqual(
                [item.template_key for item in templates],
                [
                    "screener_to_research",
                    "data_sources_to_research",
                    "research_to_factor",
                    "factor_to_backtest",
                    "backtest_to_paper",
                    "paper_to_binance_intent",
                    "evidence_report_export",
                ],
            )
            policies = {step.policy for template in templates for step in template.steps}
            self.assertEqual(
                policies,
                {
                    "read_only",
                    "local_analysis",
                    "local_simulation",
                    "binance_intent",
                    "user_confirmed_binance_submit",
                },
            )
            store.close()

    def test_each_template_runs_and_persists_history(self):
        cases = [
            ("screener_to_research", {}),
            ("data_sources_to_research", {"symbol": "AAPL", "dataSourceKind": "macro", "dataSourceProvider": "worldbank"}),
            ("data_sources_to_research", {"symbol": "600519.SH", "dataSourceKind": "equity", "dataSourceProvider": "tushare"}),
            ("research_to_factor", {"symbol": "AAPL"}),
            ("factor_to_backtest", {}),
            ("backtest_to_paper", {}),
            ("paper_to_binance_intent", {"symbol": "BTC/USDT", "side": "buy", "quantity": 0.01}),
            ("evidence_report_export", {}),
        ]
        with TemporaryDirectory() as temp_dir:
            store = self.make_store(Path(temp_dir))
            service, _ = make_workflow_service(store)

            for template_key, input_payload in cases:
                run = service.run(WorkflowRunRequest(templateKey=template_key, input=input_payload))
                self.assertIn(run.status, {"completed", "blocked"})
                self.assertGreaterEqual(len(run.steps), 2)
                self.assertTrue(run.audit_events)
                restored = service.get_run(run.run_id)
                self.assertEqual(restored.run_id, run.run_id)
                self.assertEqual(restored.template_key, template_key)

            self.assertEqual(len(service.list_recent_runs(20)), len(cases))
            store.close()

    def test_restart_safe_restore_keeps_artifacts(self):
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            store = self.make_store(root)
            service, _ = make_workflow_service(store)
            run = service.run(WorkflowRunRequest(templateKey="backtest_to_paper", input={}))
            store.close()

            reopened = self.make_store(root)
            restored = WorkflowService(
                reopened,
                FakeScreenerService(),
                FakeResearchService(),
                FakeFactorService(),
                FakeStrategyService(),
                FakeExecutionService(),
                FakeDataSourceService(),
            ).get_run(run.run_id)

            self.assertEqual(restored.run_id, run.run_id)
            self.assertTrue(any(ref.artifact_type == "paper_session" for ref in restored.artifact_refs))
            reopened.close()

    def test_blocked_steps_are_inspectable_and_keep_completed_steps(self):
        with TemporaryDirectory() as temp_dir:
            store = self.make_store(Path(temp_dir))
            service, _ = make_workflow_service(store)

            run = service.run(WorkflowRunRequest(templateKey="paper_to_binance_intent", input={}))

            self.assertEqual(run.status, "blocked")
            self.assertTrue(run.blocked_reasons)
            self.assertTrue(any(step.status == "completed" for step in run.steps))
            self.assertEqual(run.steps[-1].status, "blocked")
            self.assertIn("symbol", run.steps[-1].blocked_reasons[0])
            store.close()

    def test_binance_intent_workflow_stops_for_manual_confirmation(self):
        with TemporaryDirectory() as temp_dir:
            store = self.make_store(Path(temp_dir))
            service, execution = make_workflow_service(store)

            run = service.run(
                WorkflowRunRequest(
                    templateKey="paper_to_binance_intent",
                    input={"symbol": "BTC/USDT", "side": "buy", "quantity": 0.01},
                )
            )

            self.assertEqual(run.status, "blocked")
            self.assertTrue(run.manual_confirmation_required)
            self.assertEqual(run.manual_confirmation_policy, "user_confirmed_binance_submit")
            self.assertEqual(execution.created_intents, 1)
            self.assertEqual(execution.submit_calls, 0)
            self.assertEqual(execution.config_updates, 0)
            self.assertEqual(execution.kill_switch_updates, 0)
            self.assertTrue(any(ref.artifact_type == "binance_intent" for ref in run.artifact_refs))
            self.assertEqual(run.steps[-1].status, "manual_required")
            store.close()

    def test_api_routes_are_additive_and_return_workflow_shapes(self):
        with TemporaryDirectory() as temp_dir:
            settings = make_settings(Path(temp_dir))
            settings.ensure_directories()
            app = create_app(settings)
            with TestClient(app) as client:
                response = client.get("/api/v1/workflows/templates")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(len(response.json()), 7)

                container = client.app.state.container
                container.workflow_service, _ = make_workflow_service(container.sqlite_store)
                unlock = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "2468"})
                self.assertEqual(unlock.status_code, 200)
                create_response = client.post(
                    "/api/v1/workflows/runs",
                    json={"templateKey": "paper_to_binance_intent", "input": {}},
                )
                self.assertEqual(create_response.status_code, 200)
                body = create_response.json()
                self.assertEqual(body["status"], "blocked")
                self.assertTrue(body["blocked_reasons"])


if __name__ == "__main__":
    unittest.main()
