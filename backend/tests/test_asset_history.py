from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.providers.market import _aggregate_points
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


class AssetHistoryApiTests(unittest.TestCase):
    def test_yearly_interval_aggregates_daily_or_monthly_bars(self) -> None:
        points = [
            {"timestamp": "2024-01-01", "open": 10.0, "high": 12.0, "low": 9.0, "close": 11.0, "volume": 100.0},
            {"timestamp": "2024-12-31", "open": 11.0, "high": 15.0, "low": 10.0, "close": 14.0, "volume": 150.0},
            {"timestamp": "2025-01-01", "open": 20.0, "high": 22.0, "low": 18.0, "close": 21.0, "volume": 200.0},
        ]

        yearly = _aggregate_points(points, "1y")

        self.assertEqual(len(yearly), 2)
        self.assertEqual(yearly[0]["timestamp"], "2024-01-01")
        self.assertEqual(yearly[0]["open"], 10.0)
        self.assertEqual(yearly[0]["high"], 15.0)
        self.assertEqual(yearly[0]["low"], 9.0)
        self.assertEqual(yearly[0]["close"], 14.0)
        self.assertEqual(yearly[0]["volume"], 250.0)

    def test_price_history_supports_intraday_and_yearly_intervals(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                calls: list[tuple[str, str]] = []

                def fake_history(entry, *, range_value="1y", interval="1d"):
                    calls.append((range_value, interval))
                    return [
                        {
                            "timestamp": "2026-05-15T01:00:00+00:00" if interval.endswith("m") else "2026-05-15",
                            "open": 100.0,
                            "high": 102.0,
                            "low": 99.0,
                            "close": 101.0,
                            "volume": 1000.0,
                        }
                    ]

                app.state.container.asset_service.market_provider.get_price_history = fake_history

                intraday = client.get("/api/v1/prices/history?symbol=AAPL&interval=30m&range=1mo")
                self.assertEqual(intraday.status_code, 200)
                self.assertEqual(intraday.json()[0]["close"], 101.0)

                yearly = client.get("/api/v1/prices/history?symbol=AAPL&interval=1y&range=10y")
                self.assertEqual(yearly.status_code, 200)
                self.assertEqual(calls, [("1mo", "30m"), ("10y", "1y")])

    def test_price_history_rejects_invalid_interval(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                response = client.get("/api/v1/prices/history?symbol=AAPL&interval=3h")
                self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
