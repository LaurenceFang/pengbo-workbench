from __future__ import annotations

import unittest

from backend.app.providers.catalog import get_asset
from backend.app.providers.fundamentals import FundamentalProvider
from backend.app.providers.market import MarketProvider


class ExplicitMarketFixtureModeTests(unittest.TestCase):
    def test_explicit_fixture_mode_avoids_external_market_and_fundamental_calls(self) -> None:
        entry = get_asset("AAPL")
        self.assertIsNotNone(entry)
        market = MarketProvider(None, market_fixture_mode=True)  # type: ignore[arg-type]
        fundamentals = FundamentalProvider(market_fixture_mode=True)

        quote = market.get_latest_quote(entry)
        history = market.get_price_history(entry)
        overview = fundamentals.get_overview(entry)
        ratios = fundamentals.get_ratios(entry)

        self.assertEqual(quote["provider"], "explicit-test-fixture")
        self.assertGreaterEqual(len(history), 8)
        self.assertEqual(overview["company"], entry.name)
        self.assertGreaterEqual(len(ratios), 3)


if __name__ == "__main__":
    unittest.main()
