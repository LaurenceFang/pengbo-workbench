from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.providers.catalog import get_asset
from backend.app.runtime import RuntimeSettings
from backend.app.services.factor_service import FactorService
from backend.app.services.strategy_service import StrategyService
from backend.app.storage.duckdb_store import DuckDbStore
from backend.app.storage.sqlite_store import SqliteStore


def make_history(start: float, step: float, count: int = 260) -> list[SimpleNamespace]:
    return [
        SimpleNamespace(timestamp=f"2025-01-{(index % 28) + 1:02d}", close=start + index * step, volume=1_000_000 + index)
        for index in range(count)
    ]


def make_workspace(symbol: str, *, price: float, step: float, pe: str, stale: bool = False):
    history = make_history(price - 40, step)
    ratios = [
        SimpleNamespace(label="Trailing P/E", value=pe, note="test"),
        SimpleNamespace(label="Gross Margin", value="55.0%", note="test"),
        SimpleNamespace(label="Profit Margin", value="26.0%", note="test"),
        SimpleNamespace(label="Return on Assets", value="12.0%", note="test"),
        SimpleNamespace(label="Return on Equity", value="31.0%", note="test"),
        SimpleNamespace(label="Debt/Equity", value="0.35x", note="test"),
    ]
    return SimpleNamespace(
        updated_at="2026-04-29T00:00:00+00:00",
        stale=stale,
        asset=SimpleNamespace(symbol=symbol, name=f"{symbol} Name", market="NASDAQ", asset_class="equity", currency="USD", provider="test"),
        quote=SimpleNamespace(symbol=symbol, price=price, change=1.0, change_pct=2.5, currency="USD", provider="test", as_of="2026-04-29T00:00:00+00:00"),
        history=history,
        overview=SimpleNamespace(symbol=symbol, company=f"{symbol} Corp", sector="Technology", market_cap="$1.00T", summary=f"{symbol} overview"),
        ratios=ratios,
        filings=[],
        capabilities=SimpleNamespace(notes=[]),
    )


class FakeAssetService:
    def __init__(self):
        self.workspaces = {
            "AAPL": make_workspace("AAPL", price=190.0, step=0.24, pe="18.0x"),
            "NVDA": make_workspace("NVDA", price=900.0, step=0.05, pe="65.0x", stale=True),
            "SPY": make_workspace("SPY", price=510.0, step=0.11, pe="24.0x"),
        }

    def get_asset_workspace(self, symbol: str):
        return self.workspaces[symbol]


class FakeUniverseSource:
    def assets_for(self, asset_type: str):
        return [get_asset("AAPL"), get_asset("NVDA")]


class FakeScreenerService:
    def __init__(self):
        self.universe_sources = {"expanded": FakeUniverseSource(), "catalog": FakeUniverseSource()}


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


class StrategyServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = TemporaryDirectory(dir=Path.cwd(), prefix="runtime_")
        runtime_root = Path(self.temp_dir.name)
        self.settings = make_settings(runtime_root)
        self.settings.ensure_directories()
        self.duck_store = DuckDbStore(self.settings.duckdb_path)
        self.sqlite_store = SqliteStore(self.settings.sqlite_path)
        self.duck_store.initialize()
        self.sqlite_store.initialize()
        self.asset_service = FakeAssetService()
        self.factor_service = FactorService(self.duck_store, self.asset_service, FakeScreenerService())
        self.strategy_service = StrategyService(self.settings, self.duck_store, self.sqlite_store, self.asset_service)

    def tearDown(self) -> None:
        self.sqlite_store.close()
        self.duck_store.close()
        self.temp_dir.cleanup()

    def test_strategy_backtest_persists_restores_and_exports(self):
        factor_run = self.factor_service.run(SimpleNamespace(universe_source="expanded", asset_type="equity", family="composite"))

        backtest = self.strategy_service.run_backtest(
            SimpleNamespace(
                template_key="top_n_factor_rotation",
                factor_run_id=factor_run.run_id,
                top_n=2,
                rebalance_interval="monthly",
                initial_capital=100000,
                max_position_weight=0.25,
                cash_reserve_pct=0.05,
                benchmark_symbol="SPY",
                transaction_cost_bps=5,
                slippage_bps=10,
                model_dump=lambda mode="json", by_alias=True: {
                    "templateKey": "top_n_factor_rotation",
                    "factorRunId": factor_run.run_id,
                    "topN": 2,
                    "rebalanceInterval": "monthly",
                    "initialCapital": 100000,
                    "maxPositionWeight": 0.25,
                    "cashReservePct": 0.05,
                    "benchmarkSymbol": "SPY",
                    "transactionCostBps": 5,
                    "slippageBps": 10,
                },
            )
        )

        self.assertEqual(backtest.factor_run_id, factor_run.run_id)
        self.assertGreater(len(backtest.equity_curve), 0)
        self.assertEqual(len(backtest.trades), 2)
        self.assertTrue(backtest.diagnostics.no_live_orders)
        self.assertIn("snapshot", " ".join(backtest.diagnostics.warnings).lower())

        restored = self.strategy_service.get_backtest(backtest.run_id)
        self.assertEqual(restored.run_id, backtest.run_id)

        export = self.strategy_service.export_report(backtest.run_id)
        contents = Path(export.export_path).read_text(encoding="utf-8")
        self.assertIn("Strategy Rules", contents)
        self.assertIn("Live orders: `none`", contents)

    def test_paper_session_records_orders_ledger_and_no_live_orders(self):
        factor_run = self.factor_service.run(SimpleNamespace(universe_source="expanded", asset_type="equity", family="composite"))
        backtest = self.strategy_service.run_backtest(
            SimpleNamespace(
                template_key="top_n_factor_rotation",
                factor_run_id=factor_run.run_id,
                top_n=1,
                rebalance_interval="monthly",
                initial_capital=50000,
                max_position_weight=0.25,
                cash_reserve_pct=0.05,
                benchmark_symbol="SPY",
                transaction_cost_bps=5,
                slippage_bps=10,
                model_dump=lambda mode="json", by_alias=True: {
                    "templateKey": "top_n_factor_rotation",
                    "factorRunId": factor_run.run_id,
                    "topN": 1,
                    "rebalanceInterval": "monthly",
                    "initialCapital": 50000,
                    "maxPositionWeight": 0.25,
                    "cashReservePct": 0.05,
                    "benchmarkSymbol": "SPY",
                    "transactionCostBps": 5,
                    "slippageBps": 10,
                },
            )
        )

        session = self.strategy_service.create_paper_session(
            SimpleNamespace(backtest_run_id=backtest.run_id, label="Unit test paper")
        )

        self.assertEqual(session.backtest_run_id, backtest.run_id)
        self.assertEqual(session.execution_mode, "paper")
        self.assertTrue(session.no_live_orders)
        self.assertEqual(len(session.orders), 1)
        self.assertGreaterEqual(len(session.cash_ledger), 2)

        recents = self.strategy_service.list_recent_paper_sessions()
        self.assertEqual(recents[0].session_id, session.session_id)


class StrategyApiTests(unittest.TestCase):
    def test_strategy_api_flow(self):
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                container = app.state.container
                fake_assets = FakeAssetService()
                container.asset_service.get_asset_workspace = fake_assets.get_asset_workspace
                container.factor_service.asset_service = container.asset_service
                container.factor_service.screener_service = FakeScreenerService()
                container.strategy_service.asset_service = container.asset_service

                factor_response = client.post(
                    "/api/v1/factors/runs",
                    json={"universeSource": "expanded", "assetType": "equity", "family": "composite"},
                )
                self.assertEqual(factor_response.status_code, 200)
                factor_run = factor_response.json()

                templates = client.get("/api/v1/strategies/templates")
                self.assertEqual(templates.status_code, 200)
                self.assertEqual(templates.json()[0]["key"], "top_n_factor_rotation")

                backtest_response = client.post(
                    "/api/v1/strategies/backtests",
                    json={
                        "templateKey": "top_n_factor_rotation",
                        "factorRunId": factor_run["run_id"],
                        "topN": 2,
                        "rebalanceInterval": "monthly",
                        "initialCapital": 100000,
                        "maxPositionWeight": 0.25,
                        "cashReservePct": 0.05,
                        "benchmarkSymbol": "SPY",
                        "transactionCostBps": 5,
                        "slippageBps": 10,
                    },
                )
                self.assertEqual(backtest_response.status_code, 200)
                backtest = backtest_response.json()
                self.assertEqual(backtest["factor_run_id"], factor_run["run_id"])
                self.assertTrue(backtest["diagnostics"]["no_live_orders"])

                paper_response = client.post(
                    "/api/v1/strategies/paper/sessions",
                    json={"backtestRunId": backtest["run_id"], "label": "API paper"},
                )
                self.assertEqual(paper_response.status_code, 200)
                paper = paper_response.json()
                self.assertEqual(paper["execution_mode"], "paper")
                self.assertTrue(paper["no_live_orders"])

                session = client.post("/api/v1/security/session", json={}).json()
                export_response = client.post(
                    f"/api/v1/strategies/reports/{paper['session_id']}/export",
                    headers={"X-Pengbo-Session": session["session_id"]},
                )
                self.assertEqual(export_response.status_code, 200)
                contents = Path(export_response.json()["export_path"]).read_text(encoding="utf-8")
                self.assertIn("Paper Session", contents)
                self.assertIn("Live orders: `none`", contents)


if __name__ == "__main__":
    unittest.main()
