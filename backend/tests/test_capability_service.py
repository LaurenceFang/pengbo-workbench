from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from backend.app.providers.binance import BinanceProvider
from backend.app.providers.catalog import get_asset
from backend.app.providers.filings import FilingsProvider
from backend.app.api.factory import create_app
from backend.app.runtime import RuntimeSettings
from backend.app.services.capability_service import CAPABILITY_ORDER, CapabilityService
from backend.app.services.data_source_service import DATA_SOURCE_PROVIDERS


class CapabilityServiceTests(unittest.TestCase):
    def test_provider_catalog_maps_read_only_providers_and_seven_capabilities(self) -> None:
        settings = RuntimeSettings(
            host="127.0.0.1",
            port=8765,
            data_dir=Path("runtime-data"),
            log_dir=Path("runtime-logs"),
            runtime_mode="test",
            build_summary_path=None,
            edgar_identity=None,
            binance_api_key=None,
            binance_secret=None,
            binance_password=None,
        )
        service = CapabilityService(
            filings_provider=FilingsProvider(settings.edgar_identity),
            binance_provider=BinanceProvider(settings),
        )

        catalog = service.get_connections_catalog()
        provider_keys = [item.provider for item in catalog.providers]
        self.assertEqual(len(provider_keys), len(set(provider_keys)))
        self.assertEqual(provider_keys[:4], ["market", "fundamentals", "edgar", "binance"])
        self.assertIn("worldbank", provider_keys)
        self.assertIn("dbnomics", provider_keys)
        self.assertIn("rss_events", provider_keys)
        self.assertIn("fred", provider_keys)
        self.assertIn("coingecko", provider_keys)
        self.assertTrue(set(DATA_SOURCE_PROVIDERS).issubset(set(provider_keys)))
        self.assertTrue(all(len(item.capabilities) == len(CAPABILITY_ORDER) for item in catalog.providers))
        self.assertTrue(all(item.read_only for item in catalog.providers))
        self.assertTrue(all(not item.live_trading for item in catalog.providers))
        self.assertTrue(all(item.write_status == "read_only" for item in catalog.providers))
        self.assertTrue(all(item.endpoint_coverage for item in catalog.providers))
        self.assertTrue(all(item.matrix_summary for item in catalog.providers))
        self.assertTrue(all(item.freshness is not None and item.freshness.cache_ttl_seconds is not None for item in catalog.providers))
        self.assertTrue(all(item.freshness is not None and item.freshness.refresh_behavior for item in catalog.providers))
        self.assertTrue(all(item.freshness is not None and item.freshness.offline_behavior for item in catalog.providers))
        self.assertTrue(all(item.provenance is not None and item.provenance.source_url for item in catalog.providers))

        edgar = next(item for item in catalog.providers if item.provider == "edgar")
        self.assertTrue(edgar.testable)
        self.assertEqual(edgar.test_mode, "credential_probe")
        self.assertIn("filings", edgar.data_domains)
        self.assertIn("Supported US equities", edgar.asset_coverage)
        self.assertIn("asset filings", edgar.endpoint_coverage)
        self.assertIsNotNone(edgar.freshness)
        self.assertEqual(edgar.freshness.cache_ttl_seconds, 600)
        self.assertIsNotNone(edgar.provenance)
        filings = next(item for item in edgar.capabilities if item.key == "filings")
        self.assertTrue(filings.supported)
        self.assertTrue(filings.requires_credentials)
        self.assertEqual(filings.status_hint, "credential_required")
        self.assertTrue(filings.testable)
        self.assertTrue(filings.read_only)
        self.assertIn("filings", filings.data_domains)
        self.assertIn("asset filings", filings.endpoint_coverage)
        self.assertIsNotNone(filings.decision_note)

        edgar_account = next(item for item in edgar.capabilities if item.key == "account")
        self.assertFalse(edgar_account.supported)
        self.assertEqual(edgar_account.status_hint, "unsupported")
        self.assertIn("does not provide account", edgar_account.unsupported_reason or "")

        market = next(item for item in catalog.providers if item.provider == "market")
        self.assertEqual(market.label, "Public Market Data")
        self.assertIn("Binance public", market.provenance.upstream or "")
        quotes = next(item for item in market.capabilities if item.key == "quotes")
        self.assertTrue(quotes.supported)
        self.assertFalse(quotes.requires_credentials)
        self.assertEqual(quotes.status_hint, "available")
        self.assertFalse(market.testable)
        self.assertIn("asset workspace", market.endpoint_coverage)
        self.assertIn("price_history", market.data_domains)

        binance = next(item for item in catalog.providers if item.provider == "binance")
        self.assertIn("confirmation-gated execution APIs", binance.execution_boundary or "")
        self.assertFalse(binance.live_trading)
        self.assertEqual(binance.write_status, "read_only")
        account = next(item for item in binance.capabilities if item.key == "account")
        self.assertTrue(account.supported)
        self.assertTrue(account.requires_credentials)
        self.assertEqual(account.status_hint, "credential_required")
        self.assertTrue(account.read_only)

        rss = next(item for item in catalog.providers if item.provider == "rss_events")
        self.assertEqual(rss.label, "Google News RSS Events")
        self.assertEqual(rss.provenance.source_url, "https://news.google.com/rss/search")

        coingecko = next(item for item in catalog.providers if item.provider == "coingecko")
        history = next(item for item in coingecko.capabilities if item.key == "history")
        self.assertFalse(history.supported)
        self.assertFalse(history.requires_credentials)
        self.assertEqual(history.status_hint, "unsupported")
        self.assertIn("does not provide history", history.unsupported_reason or "")
        self.assertIn("demo or pro", coingecko.credential_note or "")

    def test_asset_applicability_distinguishes_unsupported_credentials_and_temporary_failures(self) -> None:
        settings = RuntimeSettings(
            host="127.0.0.1",
            port=8765,
            data_dir=Path("runtime-data"),
            log_dir=Path("runtime-logs"),
            runtime_mode="test",
            build_summary_path=None,
            edgar_identity=None,
            binance_api_key=None,
            binance_secret=None,
            binance_password=None,
        )
        service = CapabilityService(
            filings_provider=FilingsProvider(settings.edgar_identity),
            binance_provider=BinanceProvider(settings),
        )

        aapl = get_asset("AAPL")
        btc = get_asset("BTC/USDT")
        assert aapl is not None
        assert btc is not None

        aapl_filings = service.assess_filings(aapl, data_available=False, temporarily_unavailable=False)
        self.assertEqual(aapl_filings.status, "credential_required")

        btc_fundamentals = service.assess_fundamentals(btc, data_available=False, temporarily_unavailable=False)
        self.assertEqual(btc_fundamentals.status, "unsupported")

        aapl_fundamentals = service.assess_fundamentals(aapl, data_available=False, temporarily_unavailable=True)
        self.assertEqual(aapl_fundamentals.status, "temporarily_unavailable")


class ConnectionsCatalogApiTests(unittest.TestCase):
    def test_connections_catalog_endpoint_returns_provider_capability_catalog(self) -> None:
        with TemporaryDirectory() as temp_dir:
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
                response = client.get("/api/v1/connections/catalog")
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                provider_keys = [item["provider"] for item in payload["providers"]]
                self.assertEqual(provider_keys[:4], ["market", "fundamentals", "edgar", "binance"])
                self.assertIn("worldbank", provider_keys)
                self.assertIn("coingecko", provider_keys)
                self.assertEqual(len(payload["providers"][0]["capabilities"]), 7)
                self.assertTrue(all(item["read_only"] for item in payload["providers"]))
                self.assertTrue(all(not item["live_trading"] for item in payload["providers"]))
                self.assertTrue(all(item["write_status"] == "read_only" for item in payload["providers"]))
                self.assertTrue(all(item["endpoint_coverage"] for item in payload["providers"]))
                market = next(item for item in payload["providers"] if item["provider"] == "market")
                self.assertEqual(market["health"] if "health" in market else None, None)
                self.assertIn("quotes", market["data_domains"])
                self.assertIsNotNone(market["freshness"])
                self.assertIsNotNone(market["provenance"])
                unsupported = next(item for item in market["capabilities"] if item["key"] == "filings")
                self.assertEqual(unsupported["status_hint"], "unsupported")
                self.assertIn("does not provide filings", unsupported["unsupported_reason"])

    def test_public_read_only_provider_test_records_planned_health_without_credentials(self) -> None:
        with TemporaryDirectory() as temp_dir:
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
                baseline = client.get("/api/v1/connections/status").json()
                market = next(item for item in baseline["providers"] if item["provider"] == "market")
                fundamentals = next(item for item in baseline["providers"] if item["provider"] == "fundamentals")
                self.assertEqual(market["health"], "ok")
                self.assertFalse(market["requires_credentials"])
                self.assertEqual(fundamentals["health"], "ok")
                self.assertFalse(fundamentals["requires_credentials"])

                test_response = client.post("/api/v1/connections/test", json={"provider": "market"}).json()
                self.assertEqual(test_response["status"], "planned")
                self.assertFalse(test_response["requires_credentials"])
                self.assertIsNotNone(test_response["last_tested_at"])

                after_test = client.get("/api/v1/connections/status").json()
                market_after = next(item for item in after_test["providers"] if item["provider"] == "market")
                self.assertEqual(market_after["health"], "planned")
                self.assertFalse(market_after["requires_credentials"])
                self.assertIsNotNone(market_after["last_tested_at"])

    def test_unregistered_provider_test_is_explicitly_unsupported(self) -> None:
        with TemporaryDirectory() as temp_dir:
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
                response = client.post("/api/v1/connections/test", json={"provider": "not-real"})
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertEqual(payload["status"], "unsupported")
                self.assertFalse(payload["requires_credentials"])


if __name__ == "__main__":
    unittest.main()
