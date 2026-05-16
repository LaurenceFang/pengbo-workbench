from __future__ import annotations

import unittest
from unittest.mock import patch

from backend.app.data_seed import AssetCatalogEntry
from backend.app.providers.fundamentals import FundamentalProvider


class FundamentalProviderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.provider = FundamentalProvider()
        self.entry = AssetCatalogEntry(
            symbol="AAPL",
            name="Apple Inc.",
            market="NASDAQ",
            asset_class="equity",
            currency="USD",
            provider="yahoo",
            summary="Catalog summary",
            sector="Technology",
            yahoo_symbol="AAPL",
            binance_symbol=None,
            is_us_equity=True,
        )

    @patch(
        "backend.app.providers.fundamentals._get_ticker_info",
        return_value={
            "longName": "Apple Inc.",
            "sector": "Consumer Electronics",
            "longBusinessSummary": "Detailed business summary",
            "marketCap": 3_971_820_552_192,
            "grossMargins": 0.47325,
            "operatingMargins": 0.35374,
            "profitMargins": 0.27037,
            "returnOnAssets": 0.24377,
            "returnOnEquity": 1.5202099,
            "currentRatio": 0.974,
            "quickRatio": 0.845,
            "debtToEquity": 102.63,
            "trailingPE": 34.249683,
        },
    )
    def test_overview_and_ratios_preserve_expected_shape(self, _: object) -> None:
        overview = self.provider.get_overview(self.entry)
        ratios = self.provider.get_ratios(self.entry)

        self.assertEqual(overview["symbol"], "AAPL")
        self.assertEqual(overview["company"], "Apple Inc.")
        self.assertEqual(overview["sector"], "Consumer Electronics")
        self.assertEqual(overview["market_cap"], "$3.97T")
        self.assertEqual(overview["summary"], "Detailed business summary")
        self.assertEqual(len(ratios), 6)
        self.assertEqual(ratios[0]["label"], "Gross Margin")
        self.assertEqual(ratios[0]["value"], "47.3%")
        self.assertEqual(ratios[3]["label"], "Return on Assets")
        self.assertEqual(ratios[3]["value"], "24.4%")
        self.assertEqual(ratios[5]["label"], "Current Ratio")
        self.assertEqual(ratios[5]["value"], "0.97x")
        self.assertTrue(all(item["note"] == "Yahoo Finance info snapshot" for item in ratios))


if __name__ == "__main__":
    unittest.main()
