from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
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


class WatchlistServiceTests(unittest.TestCase):
    def test_searchable_universe_includes_leveraged_nasdaq_and_crypto(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                results = client.get("/api/v1/search/assets", params={"q": ""})
                self.assertEqual(results.status_code, 200)
                symbols = {item["symbol"] for item in results.json()}

                self.assertIn("TQQQ", symbols)
                self.assertIn("ETH/USDT", symbols)
                self.assertIn("MSFT", symbols)
                self.assertNotIn("DXY", symbols)

    def test_default_watchlist_can_add_and_remove_supported_assets(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                updated = client.put("/api/v1/watchlist/default", json={"symbols": ["AAPL", "TQQQ", "ETH/USDT"]})
                self.assertEqual(updated.status_code, 200)
                self.assertEqual(updated.json()["symbols"], ["AAPL", "TQQQ", "ETH/USDT"])

                removed = client.put("/api/v1/watchlist/default", json={"symbols": ["TQQQ"]})
                self.assertEqual(removed.status_code, 200)
                self.assertEqual(removed.json()["symbols"], ["TQQQ"])


if __name__ == "__main__":
    unittest.main()
