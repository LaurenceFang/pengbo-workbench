from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.providers.catalog import get_asset
from backend.app.runtime import RuntimeSettings
from backend.app.services.research_service import ResearchService
from backend.app.storage.sqlite_store import SqliteStore


def make_asset_workspace(*, symbol: str, stale: bool = False):
    asset_class = "crypto" if "/" in symbol else "equity"
    if symbol.endswith((".SH", ".SZ")):
        provider = "tushare"
        currency = "CNY"
        market = "SSE" if symbol.endswith(".SH") else "SZSE"
    else:
        provider = "ccxt:binance" if asset_class == "crypto" else "openbb-fallback:yahoo"
        currency = "USDT" if asset_class == "crypto" else "USD"
        market = "Binance" if asset_class == "crypto" else "NASDAQ"
    return SimpleNamespace(
        updated_at="2026-04-22T00:00:00+00:00",
        stale=stale,
        asset=SimpleNamespace(
            symbol=symbol,
            name=f"{symbol} Name",
            market=market,
            asset_class=asset_class,
            currency=currency,
            provider=provider,
        ),
        quote=SimpleNamespace(
            symbol=symbol,
            price=123.45,
            change=1.25,
            change_pct=2.3,
            currency=currency,
            provider=provider,
            as_of="2026-04-22T00:00:00+00:00",
        ),
        history=[
            SimpleNamespace(timestamp="2026-04-20T00:00:00+00:00", close=120.0, volume=1000),
            SimpleNamespace(timestamp="2026-04-21T00:00:00+00:00", close=123.45, volume=1200),
        ],
        overview=SimpleNamespace(
            symbol=symbol,
            company=f"{symbol} Corp",
            sector="Technology",
            market_cap="$1.00T",
            summary=f"{symbol} overview",
        ),
        ratios=[
            SimpleNamespace(label="Gross Margin", value="45.0%", note="healthy"),
            SimpleNamespace(label="Return on Equity", value="22.0%", note="strong"),
        ],
        filings=[SimpleNamespace(type="10-K", filed_at="2026-02-01", headline="Annual report", status="filed")],
        capabilities=SimpleNamespace(
            has_fundamentals=True,
            has_filings=True,
            fundamentals_status="available",
            filings_status="available",
            fundamentals_message="Fundamentals coverage is enabled for this symbol.",
            filings_message="SEC filings coverage is enabled for this symbol.",
            notes=["Cached note"] if stale else [],
        ),
        model_dump=lambda mode="json": {
            "updated_at": "2026-04-22T00:00:00+00:00",
            "stale": stale,
            "asset": {
                "symbol": symbol,
                "name": f"{symbol} Name",
                "market": market,
                "asset_class": asset_class,
                "currency": currency,
                "provider": provider,
            },
            "quote": {
                "symbol": symbol,
                "price": 123.45,
                "change": 1.25,
                "change_pct": 2.3,
                "currency": currency,
                "provider": provider,
                "as_of": "2026-04-22T00:00:00+00:00",
            },
            "history": [
                {"timestamp": "2026-04-20T00:00:00+00:00", "close": 120.0, "volume": 1000},
                {"timestamp": "2026-04-21T00:00:00+00:00", "close": 123.45, "volume": 1200},
            ],
            "overview": {
                "symbol": symbol,
                "company": f"{symbol} Corp",
                "sector": "Technology",
                "market_cap": "$1.00T",
                "summary": f"{symbol} overview",
            },
            "ratios": [
                {"label": "Gross Margin", "value": "45.0%", "note": "healthy"},
                {"label": "Return on Equity", "value": "22.0%", "note": "strong"},
            ],
            "filings": [
                {"type": "10-K", "filed_at": "2026-02-01", "headline": "Annual report", "status": "filed"}
            ],
            "capabilities": {
                "has_fundamentals": True,
                "has_filings": True,
                "fundamentals_status": "available",
                "filings_status": "available",
                "fundamentals_message": "Fundamentals coverage is enabled for this symbol.",
                "filings_message": "SEC filings coverage is enabled for this symbol.",
                "notes": ["Cached note"] if stale else [],
            },
        },
    )


class FakeAssetService:
    def __init__(self, workspace_map):
        self.workspace_map = workspace_map

    def get_asset_workspace(self, symbol: str):
        workspace = self.workspace_map[symbol]
        if isinstance(workspace, Exception):
            raise workspace
        return workspace


class FakeScreenerService:
    def __init__(self):
        self._presets = [
            SimpleNamespace(key="quality-equities", title="Quality", asset_type="equity", active_variant_key="default"),
            SimpleNamespace(key="trend-crypto", title="Trend", asset_type="crypto", active_variant_key="default"),
        ]

    def get_presets(self):
        return list(self._presets)

    def run(self, payload):
        if payload.preset == "quality-equities":
            return SimpleNamespace(
                variant_key=payload.variant_key or "default",
                variant_name="Default",
                universe_source=payload.universe_source,
                results=[
                    SimpleNamespace(
                        symbol="AAPL",
                        score=81.5,
                        score_label="high",
                        explanations=["Strong quality signal"],
                        matched_rules=["high ROE"],
                        notes=["Realtime data"],
                        stale=False,
                    )
                ],
            )
        return SimpleNamespace(
            variant_key=payload.variant_key or "default",
            variant_name="Default",
            universe_source=payload.universe_source,
            results=[],
        )


class FakePortfolioService:
    def get_holdings(self):
        return [
            SimpleNamespace(
                symbol="AAPL",
                quantity=4.0,
                average_cost=110.0,
                valuation_status="live",
                market_value=493.8,
                cost_basis=440.0,
                notes=["Held in core portfolio"],
                current_price=123.45,
            )
        ]

    def get_transactions(self):
        return [
            SimpleNamespace(symbol="AAPL"),
            SimpleNamespace(symbol="AAPL"),
            SimpleNamespace(symbol="SPY"),
        ]


class FakeWatchlistService:
    pass


class StaticUniverseSource:
    key = "static"

    def __init__(self, symbols: list[str]) -> None:
        self.symbols = symbols

    def assets_for(self, asset_type: str):
        del asset_type
        return [get_asset(symbol) for symbol in self.symbols if get_asset(symbol) is not None]


def make_factor_workspace(symbol: str = "AAPL"):
    points = []
    for index in range(280):
        points.append(
            SimpleNamespace(
                timestamp=f"2025-01-{(index % 28) + 1:02d}T00:00:00+00:00",
                close=100.0 + index * 0.4,
                volume=1_000_000 + index,
            )
        )
    workspace = make_asset_workspace(symbol=symbol)
    workspace.history = points
    workspace.ratios = [
        SimpleNamespace(label="Trailing P/E", value="24.0x", note="valuation"),
        SimpleNamespace(label="Gross Margin", value="45.0%", note="quality"),
        SimpleNamespace(label="Profit Margin", value="22.0%", note="quality"),
        SimpleNamespace(label="Return on Assets", value="18.0%", note="quality"),
        SimpleNamespace(label="Return on Equity", value="28.0%", note="quality"),
        SimpleNamespace(label="Debt/Equity", value="0.40x", note="balance sheet"),
    ]

    def dump(mode="json"):
        payload = make_asset_workspace(symbol=symbol).model_dump(mode=mode)
        payload["history"] = [
            {"timestamp": item.timestamp, "close": item.close, "volume": item.volume}
            for item in points
        ]
        payload["ratios"] = [
            {"label": item.label, "value": item.value, "note": item.note}
            for item in workspace.ratios
        ]
        return payload

    workspace.model_dump = dump
    return workspace


class ResearchServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = TemporaryDirectory(dir=Path.cwd(), prefix="runtime_")
        self.runtime_root = Path(self.temp_dir.name)
        self.settings = RuntimeSettings(
            host="127.0.0.1",
            port=8765,
            data_dir=self.runtime_root / "data",
            log_dir=self.runtime_root / "logs",
            runtime_mode="test",
            build_summary_path=None,
            edgar_identity=None,
            binance_api_key=None,
            binance_secret=None,
            binance_password=None,
        )
        self.settings.ensure_directories()
        self.store = SqliteStore(self.settings.sqlite_path)
        self.store.initialize()

    def tearDown(self) -> None:
        self.store.close()
        self.temp_dir.cleanup()

    def make_service(self, *, stale: bool = False) -> ResearchService:
        return ResearchService(
            self.settings,
            self.store,
            FakeAssetService({"AAPL": make_asset_workspace(symbol="AAPL", stale=stale)}),
            FakeScreenerService(),
            FakePortfolioService(),
            FakeWatchlistService(),
        )

    def test_create_brief_persists_recent_context_and_portfolio_handoff(self):
        service = self.make_service()

        brief = service.create_brief(
            SimpleNamespace(
                symbol="AAPL",
                source_preset_key="quality-equities",
                source_variant_key="default",
                source_universe_source="expanded",
            )
        )

        self.assertEqual(brief.symbol, "AAPL")
        self.assertEqual(brief.screener_context.source.source_preset_key, "quality-equities")
        self.assertEqual(len(brief.screener_context.summaries), 1)
        self.assertTrue(brief.screener_context.summaries[0].matched)
        self.assertTrue(brief.portfolio_context.in_portfolio)
        self.assertEqual(brief.portfolio_context.transaction_count, 2)
        self.assertEqual(brief.portfolio_context.handoff_draft.symbol, "AAPL")
        self.assertEqual(len(brief.analysis_modules), 4)
        self.assertEqual(brief.analysis_modules[0].key, "asset_quality_snapshot")
        self.assertIsNotNone(brief.data_quality)
        self.assertIn(brief.data_quality.overall, {"complete", "partial", "limited"})
        self.assertEqual(brief.decision_review.template_key, "portfolio")
        self.assertIn("observed", [item.status for item in brief.decision_review.supporting_evidence])
        self.assertGreaterEqual(len(brief.decision_review.counter_evidence), 2)

        recent = service.list_recent_briefs()
        self.assertEqual(len(recent), 1)
        self.assertEqual(recent[0].brief_id, brief.brief_id)

    def test_china_market_brief_uses_regional_template_and_boundaries(self):
        service = ResearchService(
            self.settings,
            self.store,
            FakeAssetService({"600519.SH": make_asset_workspace(symbol="600519.SH")}),
            FakeScreenerService(),
            FakePortfolioService(),
            FakeWatchlistService(),
        )

        brief = service.create_brief(
            SimpleNamespace(
                symbol="600519.SH",
                source_preset_key=None,
                source_variant_key=None,
                source_universe_source=None,
                data_source_provider="tushare",
                data_source_kind="equity",
                data_source_query="600519.SH",
                factor_run_id=None,
                backtest_run_id=None,
                paper_session_id=None,
                intent_id=None,
            )
        )

        self.assertEqual(brief.decision_review.template_key, "china_market")
        self.assertIn("China Market Research Brief", brief.title)
        self.assertTrue(any(item.label == "China-market source handoff" for item in brief.decision_review.supporting_evidence))
        self.assertTrue(any(item.label == "Unsupported trading boundary" for item in brief.decision_review.counter_evidence))
        self.assertTrue(any("redistribution restrictions" in item for item in brief.decision_review.risks))

        export = service.export_brief(brief.brief_id)
        contents = Path(export.export_path).read_text(encoding="utf-8")
        self.assertIn("# 600519.SH China Market Research Brief", contents)
        self.assertIn("china_market", contents)
        self.assertIn("Unsupported trading boundary", contents)

    def test_notes_update_and_export_are_persisted(self):
        service = self.make_service(stale=True)
        brief = service.create_brief(SimpleNamespace(symbol="AAPL", source_preset_key=None, source_variant_key=None, source_universe_source=None))

        updated = service.update_notes(brief.brief_id, SimpleNamespace(markdown="## Thesis\n\nWatch the next filing."))
        self.assertIn("Watch the next filing.", updated.notes.markdown)

        export = service.export_brief(brief.brief_id)
        self.assertTrue(Path(export.export_path).exists())
        contents = Path(export.export_path).read_text(encoding="utf-8")
        self.assertIn("# AAPL Research Brief", contents)
        self.assertIn("Watch the next filing.", contents)
        self.assertIn("## Decision Review", contents)
        self.assertIn("## Evidence Pack Summary", contents)
        self.assertIn("Private-state boundary", contents)
        self.assertIn("### Counter-Evidence", contents)
        self.assertIn("## Portfolio Context", contents)
        self.assertIn("### Portfolio Provenance", contents)
        self.assertIn("## Analysis Modules", contents)
        self.assertIn("### Asset Quality Snapshot", contents)


class ResearchApiTests(unittest.TestCase):
    def test_api_create_read_update_export_research_brief(self):
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
                container.asset_service.get_asset_workspace = lambda symbol: make_asset_workspace(symbol=symbol)
                container.research_service.asset_service = container.asset_service
                container.research_service.screener_service = FakeScreenerService()
                container.research_service.portfolio_service = FakePortfolioService()

                create_response = client.post(
                    "/api/v1/research/briefs",
                    json={
                        "symbol": "AAPL",
                        "sourcePresetKey": "quality-equities",
                        "sourceVariantKey": "default",
                        "sourceUniverseSource": "expanded",
                    },
                )
                self.assertEqual(create_response.status_code, 200)
                created = create_response.json()
                self.assertEqual(created["symbol"], "AAPL")
                self.assertEqual(len(created["analysis_modules"]), 4)
                self.assertEqual(created["decision_review"]["template_key"], "portfolio")
                brief_id = created["brief_id"]

                recent_response = client.get("/api/v1/research/briefs/recent")
                self.assertEqual(recent_response.status_code, 200)
                self.assertEqual(len(recent_response.json()), 1)

                get_response = client.get(f"/api/v1/research/briefs/{brief_id}")
                self.assertEqual(get_response.status_code, 200)
                self.assertEqual(get_response.json()["brief_id"], brief_id)
                self.assertEqual(len(get_response.json()["analysis_modules"]), 4)
                self.assertIn("conclusion", get_response.json()["decision_review"])

                notes_response = client.put(
                    f"/api/v1/research/briefs/{brief_id}/notes",
                    json={"markdown": "Saved from API"},
                )
                self.assertEqual(notes_response.status_code, 200)
                self.assertEqual(notes_response.json()["notes"]["markdown"], "Saved from API")

                export_response = client.post(f"/api/v1/research/briefs/{brief_id}/export", headers=session_headers)
                self.assertEqual(export_response.status_code, 200)
                export_path = Path(export_response.json()["export_path"])
                self.assertTrue(export_path.exists())

    def test_api_builds_evidence_snapshot_and_exports_chain(self):
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
                container.asset_service.get_asset_workspace = lambda symbol: make_factor_workspace("AAPL")
                container.screener_service.asset_service = container.asset_service
                container.screener_service.universe_sources["catalog"] = StaticUniverseSource(["AAPL"])
                container.factor_service.asset_service = container.asset_service

                factor_response = client.post(
                    "/api/v1/factors/runs",
                    json={"universeSource": "catalog", "assetType": "equity", "family": "composite"},
                )
                self.assertEqual(factor_response.status_code, 200)
                factor_run_id = factor_response.json()["run_id"]

                screener_response = client.post(
                    "/api/v1/screeners/run",
                    json={"preset": "quality-equities", "asset_type": "equity", "universeSource": "catalog"},
                )
                self.assertEqual(screener_response.status_code, 200)
                self.assertEqual(screener_response.json()["results"][0]["factor_context"]["run_id"], factor_run_id)

                backtest_response = client.post(
                    "/api/v1/strategies/backtests",
                    json={
                        "templateKey": "top_n_factor_rotation",
                        "factorRunId": factor_run_id,
                        "topN": 1,
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
                backtest_run_id = backtest_response.json()["run_id"]

                paper_response = client.post(
                    "/api/v1/strategies/paper/sessions",
                    json={"backtestRunId": backtest_run_id, "label": "Evidence paper"},
                )
                self.assertEqual(paper_response.status_code, 200)
                paper_session_id = paper_response.json()["session_id"]
                intent_response = client.post(
                    "/api/v1/execution/binance/intents",
                    headers=session_headers,
                    json={
                        "symbol": "BTC/USDT",
                        "side": "buy",
                        "quantity": 0.001,
                        "orderType": "market",
                        "strategyRunId": backtest_run_id,
                        "paperSessionId": paper_session_id,
                        "clientOrderId": "evidence-test",
                    },
                )
                self.assertEqual(intent_response.status_code, 200)
                intent_id = intent_response.json()["intent_id"]
                submit_response = client.post(
                    f"/api/v1/execution/binance/intents/{intent_id}/submit",
                    headers=session_headers,
                )
                self.assertEqual(submit_response.status_code, 200)
                self.assertEqual(submit_response.json()["status"], "blocked")
                portfolio_response = client.post(
                    "/api/v1/portfolio/transactions",
                    json={
                        "symbol": "AAPL",
                        "side": "buy",
                        "quantity": 1,
                        "price": 110,
                        "fees": 0,
                        "traded_at": "2026-04-22",
                        "notes": "Evidence test position",
                    },
                )
                self.assertEqual(portfolio_response.status_code, 200)

                evidence_response = client.get(
                    f"/api/v1/research/evidence/AAPL?factorRunId={factor_run_id}&backtestRunId={backtest_run_id}&paperSessionId={paper_session_id}&intentId={intent_id}"
                )
                self.assertEqual(evidence_response.status_code, 200)
                evidence = evidence_response.json()
                self.assertEqual(evidence["factor"]["run_id"], factor_run_id)
                self.assertEqual(evidence["backtest"]["run_id"], backtest_run_id)
                self.assertEqual(evidence["paper_session"]["session_id"], paper_session_id)
                self.assertEqual(evidence["execution"]["intent_id"], intent_id)
                self.assertIn("live_mode", evidence["execution"]["blocked_checks"])
                self.assertGreaterEqual(evidence["audit"]["event_count"], 2)

                brief_response = client.post(
                    "/api/v1/research/briefs",
                    json={
                        "symbol": "AAPL",
                        "factorRunId": factor_run_id,
                        "backtestRunId": backtest_run_id,
                        "paperSessionId": paper_session_id,
                        "intentId": intent_id,
                    },
                )
                self.assertEqual(brief_response.status_code, 200)
                brief = brief_response.json()
                self.assertEqual(brief["evidence_context"]["execution"]["intent_id"], intent_id)
                self.assertIn("simulated", [item["status"] for item in brief["decision_review"]["supporting_evidence"]])
                self.assertIn("Portfolio provenance", [item["label"] for item in brief["decision_review"]["provenance"]])

                export_response = client.post(f"/api/v1/research/briefs/{brief['brief_id']}/export", headers=session_headers)
                self.assertEqual(export_response.status_code, 200)
                contents = Path(export_response.json()["export_path"]).read_text(encoding="utf-8")
                self.assertIn("## Decision Review", contents)
                self.assertIn("## Evidence Pack Summary", contents)
                self.assertIn("Audit references", contents)
                self.assertIn("Audit IDs", contents)
                self.assertIn("## Portfolio Context", contents)
                self.assertIn("portfolio:holding:AAPL:valuation", contents)
                self.assertIn("## Evidence Chain", contents)
                self.assertIn("Binance intent", contents)


if __name__ == "__main__":
    unittest.main()
