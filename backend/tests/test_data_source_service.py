from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.runtime import RuntimeSettings


class FakeResponse:
    def __init__(self, payload=None, text: str | None = None, url: str = "https://example.test/source") -> None:
        self._payload = payload
        self.text = text or ""
        self.url = url

    def raise_for_status(self) -> None:
        return None

    def json(self):
        return self._payload


class QueueSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.headers = {}
        self.requests = []

    def get(self, url, **kwargs):
        self.requests.append((url, kwargs))
        if not self.responses:
            raise RuntimeError("no queued response")
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def make_settings(
    runtime_root: Path,
    *,
    fred_api_key: str | None = None,
    coingecko_key: str | None = None,
    coingecko_pro_key: str | None = None,
) -> RuntimeSettings:
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
        fred_api_key=fred_api_key,
        coingecko_demo_api_key=coingecko_key,
        coingecko_pro_api_key=coingecko_pro_key,
    )


class DataSourceServiceTests(unittest.TestCase):
    def test_status_lists_initial_connector_pack_sources(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                response = client.get("/api/v1/data-sources/status")
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                providers = {item["provider"]: item for item in payload["providers"]}

                self.assertGreaterEqual(len(providers), 5)
                self.assertEqual(providers["worldbank"]["health"], "ok")
                self.assertEqual(providers["worldbank"]["freshness_state"], "unknown")
                self.assertEqual(providers["worldbank"]["data_quality"]["overall"], "unknown")
                self.assertIsNotNone(providers["worldbank"]["freshness"]["cache_ttl_seconds"])
                self.assertEqual(providers["dbnomics"]["health"], "ok")
                self.assertEqual(providers["rss_events"]["health"], "ok")
                self.assertEqual(providers["fred"]["health"], "missing_credentials")
                self.assertEqual(providers["fred"]["freshness_state"], "credential_required")
                self.assertEqual(providers["fred"]["data_quality"]["overall"], "blocked")
                self.assertEqual(providers["coingecko"]["health"], "missing_credentials")
                self.assertEqual(providers["coingecko"]["freshness_state"], "credential_required")
                self.assertTrue(providers["fred"]["requires_credentials"])
                self.assertTrue(providers["coingecko"]["requires_credentials"])

    def test_worldbank_macro_series_fetch_and_cached_fallback(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                service = app.state.container.data_source_service
                service.session = QueueSession(
                    [
                        FakeResponse(
                            [
                                {},
                                [
                                    {
                                        "date": "2025",
                                        "value": 100.5,
                                        "indicator": {"value": "GDP"},
                                        "country": {"value": "China"},
                                    }
                                ],
                            ],
                            url="https://api.worldbank.org/v2/country/CN/indicator/NY.GDP.MKTP.CD",
                        ),
                        RuntimeError("offline"),
                    ]
                )

                first = client.get("/api/v1/data-sources/macro/series?provider=worldbank&seriesId=NY.GDP.MKTP.CD&country=CN&limit=1")
                self.assertEqual(first.status_code, 200)
                self.assertEqual(first.json()["observations"][0]["value"], 100.5)
                self.assertFalse(first.json()["provenance"]["stale"])
                self.assertEqual(first.json()["provenance"]["freshness_state"], "fresh")
                self.assertEqual(first.json()["provenance"]["data_quality"]["overall"], "complete")

                cached = client.get("/api/v1/data-sources/macro/series?provider=worldbank&seriesId=NY.GDP.MKTP.CD&country=CN&limit=1")
                self.assertEqual(cached.status_code, 200)
                self.assertTrue(cached.json()["provenance"]["stale"])
                self.assertEqual(cached.json()["provenance"]["freshness_state"], "refresh_failed")
                self.assertEqual(cached.json()["provenance"]["data_quality"]["overall"], "limited")
                self.assertIn("offline", cached.json()["provenance"]["unavailable_reason"])

    def test_status_marks_cached_and_stale_by_provider_ttl(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                service = app.state.container.data_source_service
                service.session = QueueSession(
                    [
                        FakeResponse(
                            [
                                {},
                                [
                                    {
                                        "date": "2025",
                                        "value": 100.5,
                                        "indicator": {"value": "GDP"},
                                        "country": {"value": "China"},
                                    }
                                ],
                            ],
                            url="https://api.worldbank.org/v2/country/CN/indicator/NY.GDP.MKTP.CD",
                        ),
                    ]
                )

                first = client.get("/api/v1/data-sources/macro/series?provider=worldbank&seriesId=NY.GDP.MKTP.CD&country=CN&limit=1")
                self.assertEqual(first.status_code, 200)
                fresh = client.get("/api/v1/data-sources/sources/worldbank/status").json()
                self.assertEqual(fresh["freshness_state"], "fresh")
                self.assertFalse(fresh["stale"])

                stale_timestamp = datetime.now(UTC) - timedelta(days=8)
                service.duck_store.connection.execute(
                    "UPDATE data_source_snapshots SET fetched_at = ? WHERE provider = ?",
                    [stale_timestamp.isoformat(), "worldbank"],
                )

                stale = client.get("/api/v1/data-sources/sources/worldbank/status").json()
                self.assertEqual(stale["freshness_state"], "stale")
                self.assertTrue(stale["stale"])
                self.assertGreater(stale["cache_age_seconds"], stale["freshness"]["stale_after_seconds"])

    def test_dbnomics_macro_series_fetch_and_cached_fallback(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                service = app.state.container.data_source_service
                service.session = QueueSession(
                    [
                        FakeResponse(
                            {
                                "series": {
                                    "docs": [
                                        {
                                            "series_name": "China GDP",
                                            "Country": "China",
                                            "frequency": "annual",
                                            "unit": "current US$",
                                            "period": ["2024", "2025"],
                                            "value": [90.0, 110.0],
                                        }
                                    ]
                                }
                            },
                            url="https://api.db.nomics.world/v22/series/WB/WDI/A-NY.GDP.MKTP.CD-CHN?format=json&observations=1",
                        ),
                        RuntimeError("dbnomics offline"),
                    ]
                )

                first = client.get("/api/v1/data-sources/macro/series?provider=dbnomics&seriesId=WB/WDI/A-NY.GDP.MKTP.CD-CHN&limit=2")
                self.assertEqual(first.status_code, 200)
                payload = first.json()
                self.assertEqual(payload["title"], "China GDP")
                self.assertEqual(payload["series_id"], "WB/WDI/A-NY.GDP.MKTP.CD-CHN")
                self.assertEqual(payload["observations"][-1]["value"], 110.0)
                self.assertEqual(payload["provenance"]["provider"], "dbnomics")
                self.assertFalse(payload["provenance"]["stale"])
                self.assertIsNotNone(payload["provenance"]["freshness"])

                cached = client.get("/api/v1/data-sources/macro/series?provider=dbnomics&seriesId=WB/WDI/A-NY.GDP.MKTP.CD-CHN&limit=2")
                self.assertEqual(cached.status_code, 200)
                self.assertTrue(cached.json()["provenance"]["stale"])
                self.assertEqual(cached.json()["provenance"]["freshness_state"], "refresh_failed")
                self.assertIn("dbnomics offline", cached.json()["provenance"]["unavailable_reason"])

    def test_dbnomics_legacy_wdi_id_is_normalized(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                service = app.state.container.data_source_service
                service.session = QueueSession(
                    [
                        FakeResponse(
                            {
                                "series": {
                                    "docs": [
                                        {
                                            "series_name": "China GDP",
                                            "period": ["2025"],
                                            "value": [110.0],
                                        }
                                    ]
                                }
                            },
                            url="https://api.db.nomics.world/v22/series/WB/WDI/A-NY.GDP.MKTP.CD-CHN?format=json&observations=1",
                        ),
                    ]
                )

                response = client.get("/api/v1/data-sources/macro/series?provider=dbnomics&seriesId=WB/WDI/CHN.NY_GDP_MKTP_CD&limit=1")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["series_id"], "WB/WDI/A-NY.GDP.MKTP.CD-CHN")
                self.assertEqual(service.session.requests[0][0], "https://api.db.nomics.world/v22/series/WB/WDI/A-NY.GDP.MKTP.CD-CHN")
                self.assertEqual(service.session.requests[0][1]["params"]["observations"], 1)

    def test_fred_macro_series_fetch_masks_key_and_cached_fallback(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir), fred_api_key="fred-key"))
            with TestClient(app) as client:
                service = app.state.container.data_source_service
                service.session = QueueSession(
                    [
                        FakeResponse(
                            {
                                "observations": [
                                    {"date": "2025-01-01", "value": "101.2"},
                                    {"date": "2025-04-01", "value": "."},
                                ]
                            },
                            url="https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key=fred-key&file_type=json",
                        ),
                        RuntimeError("fred offline"),
                    ]
                )

                first = client.get("/api/v1/data-sources/macro/series?provider=fred&seriesId=GDP&limit=2")
                self.assertEqual(first.status_code, 200)
                payload = first.json()
                self.assertEqual(payload["provider"], "fred")
                self.assertEqual(payload["observations"][0]["value"], 101.2)
                self.assertIsNone(payload["observations"][1]["value"])
                self.assertIn("api_key=***", payload["provenance"]["source_url"])
                self.assertNotIn("fred-key", payload["provenance"]["source_url"])
                self.assertFalse(payload["provenance"]["stale"])

                cached = client.get("/api/v1/data-sources/macro/series?provider=fred&seriesId=GDP&limit=2")
                self.assertEqual(cached.status_code, 200)
                self.assertTrue(cached.json()["provenance"]["stale"])
                self.assertEqual(cached.json()["provenance"]["freshness_state"], "refresh_failed")
                self.assertIn("fred offline", cached.json()["provenance"]["unavailable_reason"])

    def test_fred_macro_series_error_redacts_key_without_cache(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir), fred_api_key="fred-key"))
            with TestClient(app) as client:
                service = app.state.container.data_source_service
                service.session = QueueSession(
                    [
                        RuntimeError(
                            "400 Client Error: Bad Request for url: "
                            "https://api.stlouisfed.org/fred/series/observations?series_id=BAD&api_key=fred-key&file_type=json"
                        ),
                    ]
                )

                response = client.get("/api/v1/data-sources/macro/series?provider=fred&seriesId=BAD&limit=2")
                self.assertEqual(response.status_code, 503)
                self.assertIn("api_key=***", response.json()["detail"])
                self.assertNotIn("fred-key", response.json()["detail"])

    def test_keyed_sources_report_missing_credentials_without_network(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                fred = client.get("/api/v1/data-sources/sources/fred/status").json()
                coingecko = client.get("/api/v1/data-sources/sources/coingecko/status").json()
                self.assertEqual(fred["health"], "missing_credentials")
                self.assertTrue(fred["requires_credentials"])
                self.assertEqual(coingecko["health"], "missing_credentials")
                self.assertTrue(coingecko["requires_credentials"])
                self.assertIn("demo or pro", coingecko["message"])

                unlock_response = client.post("/api/v1/security/local/initialize", json={"unlock_secret": "2468"})
                self.assertEqual(unlock_response.status_code, 200)
                probe = client.post("/api/v1/connections/test", json={"provider": "fred"}).json()
                self.assertEqual(probe["status"], "missing_credentials")
                self.assertTrue(probe["requires_credentials"])

    def test_coingecko_market_fetch_uses_configured_pro_key(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir), coingecko_pro_key="pro-key"))
            with TestClient(app) as client:
                service = app.state.container.data_source_service
                service.session = QueueSession(
                    [
                        FakeResponse(
                            [
                                {
                                    "id": "ethereum",
                                    "symbol": "eth",
                                    "name": "Ethereum",
                                    "current_price": 3200.0,
                                    "market_cap": 380_000_000_000,
                                    "total_volume": 20_000_000_000,
                                    "price_change_percentage_24h": -0.4,
                                    "last_updated": "2026-05-13T00:00:00Z",
                                }
                            ],
                            url="https://api.coingecko.com/api/v3/coins/markets",
                        ),
                    ]
                )

                response = client.get("/api/v1/data-sources/crypto/markets?ids=ethereum&limit=1")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["assets"][0]["symbol"], "ETH")
                self.assertEqual(service.session.requests[0][1]["headers"]["x-cg-pro-api-key"], "pro-key")

    def test_coingecko_market_fetch_uses_configured_demo_key_and_cached_fallback(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir), coingecko_key="demo-key"))
            with TestClient(app) as client:
                service = app.state.container.data_source_service
                service.session = QueueSession(
                    [
                        FakeResponse(
                            [
                                {
                                    "id": "bitcoin",
                                    "symbol": "btc",
                                    "name": "Bitcoin",
                                    "current_price": 65000.0,
                                    "market_cap": 1_200_000_000_000,
                                    "total_volume": 40_000_000_000,
                                    "price_change_percentage_24h": 1.2,
                                    "last_updated": "2026-05-13T00:00:00Z",
                                }
                            ],
                            url="https://api.coingecko.com/api/v3/coins/markets",
                        ),
                        RuntimeError("coingecko offline"),
                    ]
                )
                response = client.get("/api/v1/data-sources/crypto/markets?ids=bitcoin&limit=1")
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertEqual(payload["assets"][0]["symbol"], "BTC")
                self.assertEqual(payload["assets"][0]["price_usd"], 65000.0)
                self.assertEqual(service.session.requests[0][1]["headers"]["x-cg-demo-api-key"], "demo-key")
                self.assertFalse(payload["provenance"]["stale"])

                cached = client.get("/api/v1/data-sources/crypto/markets?ids=bitcoin&limit=1")
                self.assertEqual(cached.status_code, 200)
                self.assertTrue(cached.json()["provenance"]["stale"])
                self.assertEqual(cached.json()["provenance"]["freshness_state"], "refresh_failed")
                self.assertIn("coingecko offline", cached.json()["provenance"]["unavailable_reason"])

    def test_rss_events_fetch_and_cached_fallback(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                service = app.state.container.data_source_service
                service.session = QueueSession(
                    [
                        FakeResponse(
                            text="""<?xml version="1.0" encoding="UTF-8"?>
<rss><channel>
  <item>
    <title>AAPL Earnings Update</title>
    <link>https://example.test/aapl</link>
    <pubDate>Wed, 13 May 2026 10:00:00 GMT</pubDate>
    <source>Example Wire</source>
    <description>Apple earnings preview.</description>
  </item>
</channel></rss>""",
                            url="https://news.google.com/rss/search?q=AAPL",
                        ),
                        RuntimeError("rss offline"),
                    ]
                )

                first = client.get("/api/v1/data-sources/news/events?query=AAPL&limit=1")
                self.assertEqual(first.status_code, 200)
                payload = first.json()
                self.assertEqual(payload["events"][0]["source"], "Example Wire")
                self.assertEqual(payload["events"][0]["symbols"], ["AAPL"])
                self.assertFalse(payload["provenance"]["stale"])
                self.assertIsNotNone(payload["provenance"]["freshness"])

                cached = client.get("/api/v1/data-sources/news/events?query=AAPL&limit=1")
                self.assertEqual(cached.status_code, 200)
                self.assertTrue(cached.json()["provenance"]["stale"])
                self.assertEqual(cached.json()["provenance"]["freshness_state"], "refresh_failed")
                self.assertIn("rss offline", cached.json()["provenance"]["unavailable_reason"])

    def test_public_connector_probe_reports_unavailable_without_cache(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                service = app.state.container.data_source_service
                service.session = QueueSession([RuntimeError("worldbank down")])

                response = client.post("/api/v1/connections/test", json={"provider": "worldbank"})
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertEqual(payload["status"], "unavailable")
                self.assertIn("worldbank down", payload["message"])

    def test_data_source_report_export_records_provenance_and_missing_credentials(self) -> None:
        with TemporaryDirectory() as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                service = app.state.container.data_source_service
                service.session = QueueSession(
                    [
                        FakeResponse(
                            [
                                {},
                                [
                                    {
                                        "date": "2025",
                                        "value": 100.5,
                                        "indicator": {"value": "GDP"},
                                        "country": {"value": "China"},
                                    }
                                ],
                            ],
                            url="https://api.worldbank.org/v2/country/CN/indicator/NY.GDP.MKTP.CD",
                        ),
                        RuntimeError("rss unavailable"),
                    ]
                )

                session = client.post("/api/v1/security/session", json={}).json()
                response = client.post(
                    "/api/v1/data-sources/reports/export",
                    headers={"X-Pengbo-Session": session["session_id"]},
                    json={
                        "macroProvider": "worldbank",
                        "macroSeriesId": "NY.GDP.MKTP.CD",
                        "macroCountry": "CN",
                        "newsQuery": "AAPL",
                        "cryptoIds": "bitcoin",
                    },
                )
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                export_path = Path(payload["export_path"])
                self.assertTrue(export_path.exists())
                contents = export_path.read_text(encoding="utf-8")
                self.assertIn("# Data Sources Report", contents)
                self.assertIn("## Evidence Pack Summary", contents)
                self.assertIn("## Provider Catalog Contract", contents)
                self.assertIn("| market | True | False | read_only | not testable | 7 | none |", contents)
                self.assertIn("| binance | True | False | read_only | credential_probe | 7 | account |", contents)
                self.assertIn("## Evidence Quality Table", contents)
                self.assertIn("Freshness", contents)
                self.assertIn("Cache age", contents)
                self.assertIn("## Data Quality Table", contents)
                self.assertIn("Private-state boundary", contents)
                self.assertIn("World Bank Indicators", contents)
                self.assertIn("CoinGecko Public Crypto", contents)
                self.assertIn("missing_credentials", contents)
                self.assertIn("read_only=True", contents)
                self.assertIn("live_trading=False", contents)

                summaries = {item["provider"]: item for item in payload["included_sources"]}
                self.assertEqual(summaries["worldbank"]["health"], "ok")
                self.assertEqual(summaries["worldbank"]["freshness_state"], "fresh")
                self.assertEqual(summaries["worldbank"]["data_quality"]["overall"], "complete")
                self.assertEqual(summaries["rss_events"]["health"], "unavailable")
                self.assertEqual(summaries["rss_events"]["freshness_state"], "offline")
                self.assertEqual(summaries["rss_events"]["data_quality"]["overall"], "blocked")
                self.assertEqual(summaries["coingecko"]["health"], "missing_credentials")
                self.assertEqual(summaries["coingecko"]["freshness_state"], "credential_required")
                self.assertEqual(summaries["coingecko"]["data_quality"]["overall"], "blocked")
                self.assertFalse(any(item["live_trading"] for item in payload["included_sources"]))
                self.assertTrue(all(item["read_only"] for item in payload["included_sources"]))
                self.assertGreaterEqual(len(payload["provenance_summary"]), 5)


if __name__ == "__main__":
    unittest.main()
