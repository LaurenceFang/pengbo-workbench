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
from backend.app.storage.duckdb_store import DuckDbStore


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
        asset=SimpleNamespace(
            symbol=symbol,
            name=f"{symbol} Name",
            market="NASDAQ",
            asset_class="equity",
            currency="USD",
            provider="test",
        ),
        quote=SimpleNamespace(
            symbol=symbol,
            price=price,
            change=1.0,
            change_pct=2.5,
            currency="USD",
            provider="test",
            as_of="2026-04-29T00:00:00+00:00",
        ),
        history=history,
        overview=SimpleNamespace(
            symbol=symbol,
            company=f"{symbol} Corp",
            sector="Technology",
            market_cap="$1.00T",
            summary=f"{symbol} overview",
        ),
        ratios=ratios,
        filings=[SimpleNamespace(type="10-K", filed_at="2026-02-01", headline="Annual report", status="filed")],
        capabilities=SimpleNamespace(
            has_fundamentals=True,
            has_filings=True,
            fundamentals_status="available",
            filings_status="available",
            fundamentals_message="Fundamentals coverage is enabled for this symbol.",
            filings_message="SEC filings coverage is enabled for this symbol.",
            notes=[],
        ),
        model_dump=lambda mode="json": {
            "updated_at": "2026-04-29T00:00:00+00:00",
            "stale": stale,
            "asset": {
                "symbol": symbol,
                "name": f"{symbol} Name",
                "market": "NASDAQ",
                "asset_class": "equity",
                "currency": "USD",
                "provider": "test",
            },
            "quote": {
                "symbol": symbol,
                "price": price,
                "change": 1.0,
                "change_pct": 2.5,
                "currency": "USD",
                "provider": "test",
                "as_of": "2026-04-29T00:00:00+00:00",
            },
            "history": [
                {"timestamp": item.timestamp, "close": item.close, "volume": item.volume}
                for item in history
            ],
            "overview": {
                "symbol": symbol,
                "company": f"{symbol} Corp",
                "sector": "Technology",
                "market_cap": "$1.00T",
                "summary": f"{symbol} overview",
            },
            "ratios": [{"label": item.label, "value": item.value, "note": item.note} for item in ratios],
            "filings": [{"type": "10-K", "filed_at": "2026-02-01", "headline": "Annual report", "status": "filed"}],
            "capabilities": {
                "has_fundamentals": True,
                "has_filings": True,
                "fundamentals_status": "available",
                "filings_status": "available",
                "fundamentals_message": "Fundamentals coverage is enabled for this symbol.",
                "filings_message": "SEC filings coverage is enabled for this symbol.",
                "notes": [],
            },
        },
    )


class FakeAssetService:
    def __init__(self):
        self.workspaces = {
            "AAPL": make_workspace("AAPL", price=190.0, step=0.24, pe="18.0x"),
            "NVDA": make_workspace("NVDA", price=900.0, step=0.05, pe="65.0x", stale=True),
        }

    def get_asset_workspace(self, symbol: str):
        return self.workspaces[symbol]


class FakeUniverseSource:
    def assets_for(self, asset_type: str):
        return [get_asset("AAPL"), get_asset("NVDA")]


class FakeScreenerService:
    def __init__(self):
        self.universe_sources = {"expanded": FakeUniverseSource(), "catalog": FakeUniverseSource()}


class FactorServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = TemporaryDirectory(dir=Path.cwd(), prefix="runtime_")
        self.duck_store = DuckDbStore(Path(self.temp_dir.name) / "pengbo.duckdb")
        self.duck_store.initialize()

    def tearDown(self) -> None:
        self.duck_store.close()
        self.temp_dir.cleanup()

    def test_factor_run_ranks_persists_and_restores_snapshot(self):
        service = FactorService(self.duck_store, FakeAssetService(), FakeScreenerService())

        run = service.run(SimpleNamespace(universe_source="expanded", asset_type="equity", family="composite"))

        self.assertEqual(run.evaluated_count, 2)
        self.assertEqual(run.result_count, 2)
        self.assertEqual(run.results[0].rank, 1)
        self.assertIsNotNone(run.results[0].composite_score)
        self.assertGreater(len(run.results[0].contributions), 1)
        self.assertGreater(len(run.results[0].score_history), 0)

        restored = service.get_run(run.run_id)
        self.assertEqual(restored.run_id, run.run_id)
        self.assertEqual(restored.results[0].symbol, run.results[0].symbol)

        recents = service.list_recent_runs()
        self.assertEqual(recents[0].run_id, run.run_id)

    def test_research_context_extracts_symbol_factor_row(self):
        service = FactorService(self.duck_store, FakeAssetService(), FakeScreenerService())
        run = service.run(SimpleNamespace(universe_source="expanded", asset_type="equity", family="value"))

        context = service.get_research_context(run.run_id, "AAPL")

        self.assertIsNotNone(context)
        self.assertEqual(context.symbol, "AAPL")
        self.assertEqual(context.family, "value")
        self.assertEqual(len(context.contributions), 1)

    def test_crypto_and_index_factor_families_are_research_only(self):
        service = FactorService(self.duck_store, FakeAssetService(), FakeScreenerService())

        crypto_run = service.run(
            SimpleNamespace(universe_source="expanded", asset_type="crypto", family="crypto_momentum_strength")
        )
        index_run = service.run(
            SimpleNamespace(universe_source="expanded", asset_type="index", family="index_trend_breadth")
        )

        self.assertEqual(crypto_run.asset_type, "crypto")
        self.assertEqual(index_run.asset_type, "index")
        self.assertTrue(crypto_run.diagnostics["research_only"])
        self.assertEqual(crypto_run.results[0].contributions[0].family, "crypto_momentum_strength")
        self.assertEqual(index_run.results[0].contributions[0].family, "index_trend_breadth")


class FactorApiTests(unittest.TestCase):
    def test_factor_api_and_research_handoff(self):
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            runtime_root = Path(temp_dir)
            app = create_app(
                RuntimeSettings(
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
            )

            with TestClient(app) as client:
                unlock_response = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "2468"})
                self.assertEqual(unlock_response.status_code, 200)
                session = client.post("/api/v1/security/session", json={}).json()
                session_headers = {"X-Pengbo-Session": session["session_id"]}
                container = app.state.container
                fake_assets = FakeAssetService()
                container.asset_service.get_asset_workspace = fake_assets.get_asset_workspace
                container.factor_service.asset_service = container.asset_service
                container.factor_service.screener_service = FakeScreenerService()
                container.research_service.asset_service = container.asset_service
                container.research_service.factor_service = container.factor_service
                container.research_service.screener_service.run = lambda payload: SimpleNamespace(
                    variant_key="default",
                    variant_name="Default",
                    universe_source="expanded",
                    results=[],
                )

                families = client.get("/api/v1/factors/families")
                self.assertEqual(families.status_code, 200)
                self.assertGreaterEqual(len(families.json()), 12)
                self.assertIn("simple_description", families.json()[0])

                run_response = client.post(
                    "/api/v1/factors/runs",
                    json={"universeSource": "expanded", "assetType": "equity", "family": "composite"},
                )
                self.assertEqual(run_response.status_code, 200)
                run = run_response.json()
                self.assertEqual(run["result_count"], 2)

                brief_response = client.post(
                    "/api/v1/research/briefs",
                    json={"symbol": "AAPL", "factorRunId": run["run_id"], "sourceUniverseSource": "expanded"},
                )
                self.assertEqual(brief_response.status_code, 200)
                brief = brief_response.json()
                self.assertEqual(brief["factor_context"]["run_id"], run["run_id"])

                export_response = client.post(f"/api/v1/research/briefs/{brief['brief_id']}/export", headers=session_headers)
                self.assertEqual(export_response.status_code, 200)
                contents = Path(export_response.json()["export_path"]).read_text(encoding="utf-8")
                self.assertIn("## Factor Context", contents)
                self.assertIn("research-only", contents)


if __name__ == "__main__":
    unittest.main()
