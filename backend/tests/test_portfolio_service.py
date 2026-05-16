from __future__ import annotations

import time
import unittest

from backend.app.providers.catalog import get_asset
from backend.app.services.portfolio_service import PortfolioService


def make_quote(price: float, change_pct: float = 1.25) -> dict:
    return {"price": price, "change_pct": change_pct}


def make_history(*points: tuple[str, float]) -> list[dict]:
    return [{"timestamp": timestamp, "close": close} for timestamp, close in points]


class FakeSqliteStore:
    def __init__(self, rows: list[dict]):
        self.rows = rows

    def list_portfolio_transactions(self) -> list[dict]:
        return list(self.rows)


class FakeDuckStore:
    def get_latest_quote_snapshot(self, symbol: str):
        return None

    def get_latest_price_history(self, symbol: str, interval: str):
        return None


class FakeAssetService:
    def __init__(self, quotes: dict[str, tuple[dict, bool] | Exception], histories: dict[str, tuple[list[dict], bool] | Exception]):
        self.quotes = quotes
        self.histories = histories
        self.duck_store = FakeDuckStore()

    def get_quote_snapshot(self, symbol: str):
        entry = get_asset(symbol)
        if entry is None:
            raise ValueError(symbol)
        response = self.quotes[symbol]
        if isinstance(response, Exception):
            raise response
        quote, stale = response
        return entry, quote, stale

    def get_price_history_snapshot(self, symbol: str):
        entry = get_asset(symbol)
        if entry is None:
            raise ValueError(symbol)
        response = self.histories[symbol]
        if isinstance(response, Exception):
            raise response
        history, stale = response
        return entry, history, stale


class SlowAssetService(FakeAssetService):
    def get_quote_snapshot(self, symbol: str):
        time.sleep(0.05)
        return super().get_quote_snapshot(symbol)

    def get_price_history_snapshot(self, symbol: str):
        time.sleep(0.05)
        return super().get_price_history_snapshot(symbol)


class PortfolioServiceTests(unittest.TestCase):
    def make_service(
        self,
        *,
        aapl_quote: tuple[dict, bool] | Exception,
        aapl_history: tuple[list[dict], bool] | Exception,
        spy_quote: tuple[dict, bool] | Exception = (make_quote(500.0), False),
        spy_history: tuple[list[dict], bool] | Exception = (
            make_history(("2026-04-01", 490.0), ("2026-04-02", 495.0)),
            False,
        ),
        btc_quote: tuple[dict, bool] | Exception = (make_quote(65000.0), False),
        btc_history: tuple[list[dict], bool] | Exception = (
            make_history(("2026-04-01", 63000.0), ("2026-04-02", 64000.0)),
            False,
        ),
    ) -> PortfolioService:
        store = FakeSqliteStore(
            [
                {
                    "id": 1,
                    "symbol": "AAPL",
                    "side": "buy",
                    "quantity": 2.0,
                    "price": 100.0,
                    "fees": 0.0,
                    "traded_at": "2026-04-01",
                    "notes": None,
                }
            ]
        )
        asset_service = FakeAssetService(
            quotes={
                "AAPL": aapl_quote,
                "SPY": spy_quote,
                "BTC/USDT": btc_quote,
            },
            histories={
                "AAPL": aapl_history,
                "SPY": spy_history,
                "BTC/USDT": btc_history,
            },
        )
        return PortfolioService(store, asset_service)

    def test_summary_degrades_instead_of_raising_when_quote_and_history_have_no_cache(self):
        service = self.make_service(
            aapl_quote=RuntimeError("live quote failed"),
            aapl_history=RuntimeError("live history failed"),
        )

        holdings = service.get_holdings()
        summary = service.get_summary()

        self.assertEqual(len(holdings), 1)
        self.assertEqual(holdings[0].valuation_status, "unavailable")
        self.assertIsNone(holdings[0].market_value)
        self.assertTrue(summary.degraded)
        self.assertIn("AAPL", summary.missing_symbols)
        self.assertEqual(summary.performance, [])

    def test_benchmark_failure_only_degrades_that_benchmark(self):
        service = self.make_service(
            aapl_quote=(make_quote(120.0), False),
            aapl_history=(make_history(("2026-04-01", 110.0), ("2026-04-02", 120.0)), False),
            spy_quote=RuntimeError("spy quote failed"),
            spy_history=RuntimeError("spy history failed"),
        )

        summary = service.get_summary()

        self.assertGreater(len(summary.performance), 0)
        self.assertEqual(summary.benchmark_status["SPY"], "unavailable")
        self.assertEqual(summary.benchmarks["SPY"], [])
        self.assertEqual(summary.benchmark_status["BTC/USDT"], "live")
        self.assertEqual(summary.analytics.windows[-1].benchmark_symbol, "BTC/USDT")

    def test_analytics_reports_windows_average_cost_pnl_and_allocation(self):
        store = FakeSqliteStore(
            [
                {
                    "id": 1,
                    "symbol": "AAPL",
                    "side": "buy",
                    "quantity": 2.0,
                    "price": 100.0,
                    "fees": 0.0,
                    "traded_at": "2026-04-01",
                    "notes": None,
                },
                {
                    "id": 2,
                    "symbol": "AAPL",
                    "side": "sell",
                    "quantity": 1.0,
                    "price": 130.0,
                    "fees": 0.0,
                    "traded_at": "2026-04-02",
                    "notes": None,
                },
            ]
        )
        asset_service = FakeAssetService(
            quotes={
                "AAPL": (make_quote(150.0), False),
                "SPY": (make_quote(120.0), False),
                "BTC/USDT": (make_quote(65000.0), False),
            },
            histories={
                "AAPL": (
                    make_history(("2026-04-01", 100.0), ("2026-04-02", 130.0), ("2026-04-03", 150.0)),
                    False,
                ),
                "SPY": (
                    make_history(("2026-04-01", 100.0), ("2026-04-02", 110.0), ("2026-04-03", 120.0)),
                    False,
                ),
                "BTC/USDT": (
                    make_history(("2026-04-01", 63000.0), ("2026-04-02", 64000.0), ("2026-04-03", 65000.0)),
                    False,
                ),
            },
        )
        service = PortfolioService(store, asset_service)

        summary = service.get_summary()
        windows = {window.key: window for window in summary.analytics.windows}

        self.assertEqual(summary.analytics.pnl.method, "average_cost")
        self.assertAlmostEqual(summary.analytics.pnl.realized_pnl, 30.0)
        self.assertAlmostEqual(summary.analytics.pnl.unrealized_pnl, 50.0)
        self.assertAlmostEqual(summary.analytics.concentration_pct or 0.0, 100.0)
        self.assertEqual(windows["max"].status, "live")
        self.assertIsNotNone(windows["max"].total_return_pct)
        self.assertIsNotNone(windows["max"].max_drawdown_pct)
        self.assertEqual(windows["today"].status, "unavailable")
        self.assertEqual(summary.analytics.allocation["asset"][0].key, "AAPL")
        self.assertEqual(summary.analytics.allocation["sector"][0].key, "Technology Hardware")

    def test_timeout_degrades_to_unavailable_without_waiting_for_provider_timeout(self):
        store = FakeSqliteStore(
            [
                {
                    "id": 1,
                    "symbol": "AAPL",
                    "side": "buy",
                    "quantity": 2.0,
                    "price": 100.0,
                    "fees": 0.0,
                    "traded_at": "2026-04-01",
                    "notes": None,
                }
            ]
        )
        asset_service = SlowAssetService(
            quotes={
                "AAPL": (make_quote(120.0), False),
                "SPY": (make_quote(500.0), False),
                "BTC/USDT": (make_quote(65000.0), False),
            },
            histories={
                "AAPL": (make_history(("2026-04-01", 110.0)), False),
                "SPY": (make_history(("2026-04-01", 490.0)), False),
                "BTC/USDT": (make_history(("2026-04-01", 63000.0)), False),
            },
        )
        service = PortfolioService(store, asset_service)
        service.request_timeout_seconds = 0.01

        summary = service.get_summary()

        self.assertTrue(summary.degraded)
        self.assertIn("AAPL", summary.missing_symbols)
        self.assertEqual(summary.performance, [])
        self.assertEqual(summary.analytics.windows[-1].status, "unavailable")


if __name__ == "__main__":
    unittest.main()
