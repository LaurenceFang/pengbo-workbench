from __future__ import annotations

import hashlib
import xml.etree.ElementTree as ET
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any

import requests

from ..models import (
    ConnectionCheckResponse,
    CryptoMarketItem,
    CryptoMarketsResponse,
    DataSourceProvenance,
    DataSourceReportExportRequest,
    DataSourceReportExportResponse,
    DataSourceReportSourceSummary,
    DataSourceRuntimeStatus,
    FreshnessState,
    DataSourceStatusResponse,
    MacroSeriesPoint,
    MacroSeriesResponse,
    NewsEventItem,
    NewsEventsResponse,
    SourceFreshnessMetadata,
)
from ..runtime import RuntimeSettings
from ..storage.duckdb_store import DuckDbStore
from .capability_service import CapabilityService
from .data_quality_service import quality_from_provider_state


PUBLIC_DATA_SOURCE_PROVIDERS = {"worldbank", "dbnomics", "rss_events"}
KEYED_DATA_SOURCE_PROVIDERS = {"fred", "coingecko"}
DATA_SOURCE_PROVIDERS = PUBLIC_DATA_SOURCE_PROVIDERS | KEYED_DATA_SOURCE_PROVIDERS


class DataSourceService:
    def __init__(
        self,
        settings: RuntimeSettings,
        duck_store: DuckDbStore,
        capability_service: CapabilityService,
    ) -> None:
        self.settings = settings
        self.duck_store = duck_store
        self.capability_service = capability_service
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "Pengbo Workbench/0.1 data-source-research"})

    def _now_iso(self) -> str:
        return datetime.now(UTC).isoformat()

    def _cache_key(self, payload: dict[str, Any]) -> str:
        items = sorted((key, str(value)) for key, value in payload.items())
        digest = hashlib.sha256(repr(items).encode("utf-8")).hexdigest()
        return digest[:32]

    def _age_seconds(self, value: str | None) -> int | None:
        if not value:
            return None
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        return max(0, int((datetime.now(UTC) - parsed.astimezone(UTC)).total_seconds()))

    def _definition_label(self, provider: str) -> str:
        definition = self.capability_service.get_source_definition(provider)
        return provider if definition is None else definition.label

    def _freshness(self, provider: str) -> SourceFreshnessMetadata:
        definition = self.capability_service.get_source_definition(provider)
        if definition is None:
            return SourceFreshnessMetadata(label="No freshness contract registered.")
        return SourceFreshnessMetadata(
            label=definition.freshness_label or "Latest successful source response.",
            expected_lag=definition.expected_lag,
            as_of_field=definition.as_of_field,
            cache_ttl_seconds=definition.cache_ttl_seconds,
            stale_after_seconds=definition.stale_after_seconds,
            refresh_behavior=definition.refresh_behavior,
            offline_behavior=definition.offline_behavior,
        )

    def _freshness_state(
        self,
        provider: str,
        *,
        configured: bool,
        health: str,
        cache_updated_at: str | None,
        refresh_failed: bool = False,
    ) -> FreshnessState:
        definition = self.capability_service.get_source_definition(provider)
        if definition is None:
            return "unsupported"
        if health == "missing_credentials" or (provider in KEYED_DATA_SOURCE_PROVIDERS and not configured):
            return "credential_required"
        if health == "unsupported":
            return "unsupported"
        if health == "unavailable" and not cache_updated_at:
            return "offline"
        cache_age_seconds = self._age_seconds(cache_updated_at)
        if refresh_failed and cache_updated_at:
            return "refresh_failed"
        if cache_age_seconds is None:
            return "unknown" if health in {"ok", "planned"} else "unavailable"
        ttl = definition.cache_ttl_seconds
        stale_after = definition.stale_after_seconds or ttl
        if stale_after is not None and cache_age_seconds > stale_after:
            return "stale"
        if ttl is not None and cache_age_seconds > ttl:
            return "cached"
        return "fresh"

    def _provenance(
        self,
        provider: str,
        *,
        source_url: str,
        fetched_at: str | None,
        stale: bool = False,
        unavailable_reason: str | None = None,
    ) -> DataSourceProvenance:
        state = self._freshness_state(
            provider,
            configured=self._configured(provider),
            health="cached" if stale else "ok",
            cache_updated_at=fetched_at,
            refresh_failed=stale and unavailable_reason is not None,
        )
        return DataSourceProvenance(
            provider=provider,
            label=self._definition_label(provider),
            source_url=source_url,
            fetched_at=fetched_at,
            freshness=self._freshness(provider),
            freshness_state=state,
            cache_age_seconds=self._age_seconds(fetched_at),
            stale=stale,
            unavailable_reason=unavailable_reason,
            data_quality=quality_from_provider_state(
                provider=provider,
                health="cached" if stale else "ok",
                freshness_state=state,
                configured=self._configured(provider),
                stale=stale,
                limitations=[unavailable_reason] if unavailable_reason else [],
                source_confidence="official" if provider in {"worldbank", "fred"} else "public",
            ),
        )

    def _cached_payload_after_refresh_failure(
        self,
        provider: str,
        cached: dict[str, Any],
        unavailable_reason: str,
    ) -> dict[str, Any]:
        provenance = cached.get("provenance") or {}
        fetched_at = provenance.get("fetched_at")
        freshness = provenance.get("freshness") or self._freshness(provider).model_dump()
        cache_age_seconds = self._age_seconds(fetched_at)
        state = self._freshness_state(
            provider,
            configured=self._configured(provider),
            health="cached",
            cache_updated_at=fetched_at,
            refresh_failed=True,
        )
        return {
            **cached,
            "provenance": {
                **provenance,
                "freshness": freshness,
                "freshness_state": state,
                "cache_age_seconds": cache_age_seconds,
                "stale": state in {"cached", "stale", "refresh_failed"},
                "unavailable_reason": unavailable_reason,
                "data_quality": quality_from_provider_state(
                    provider=provider,
                    health="cached",
                    freshness_state=state,
                    configured=self._configured(provider),
                    stale=True,
                    limitations=[unavailable_reason],
                    source_confidence="official" if provider in {"worldbank", "fred"} else "public",
                ).model_dump(mode="json"),
            },
        }

    def _configured(self, provider: str) -> bool:
        if provider == "fred":
            return bool(self.settings.fred_api_key)
        if provider == "coingecko":
            return bool(self.settings.coingecko_demo_api_key or self.settings.coingecko_pro_api_key)
        return provider in PUBLIC_DATA_SOURCE_PROVIDERS

    def credential_summary(self, provider: str) -> str | None:
        normalized = provider.lower()
        if normalized == "fred":
            return self._masked_key_summary("FRED", self.settings.fred_api_key)
        if normalized == "coingecko":
            demo = self._masked_key_summary("CoinGecko demo", self.settings.coingecko_demo_api_key)
            pro = self._masked_key_summary("CoinGecko pro", self.settings.coingecko_pro_api_key)
            return " / ".join(item for item in [demo, pro] if item) or None
        return None

    def _masked_key_summary(self, label: str, value: str | None) -> str | None:
        if not value:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        if len(cleaned) <= 8:
            return f"{label} key configured"
        return f"{label} key ...{cleaned[-4:]}"

    def safe_error_message(self, error: Exception) -> str:
        message = str(error)
        for secret in [
            self.settings.fred_api_key,
            self.settings.coingecko_demo_api_key,
            self.settings.coingecko_pro_api_key,
        ]:
            if secret:
                message = message.replace(secret, "***")
        return message

    def list_status(self) -> DataSourceStatusResponse:
        return DataSourceStatusResponse(
            providers=[self.get_provider_status(provider) for provider in sorted(DATA_SOURCE_PROVIDERS)]
        )

    def get_provider_status(self, provider: str) -> DataSourceRuntimeStatus:
        normalized = provider.lower()
        definition = self.capability_service.get_source_definition(normalized)
        if definition is None or normalized not in DATA_SOURCE_PROVIDERS:
            return DataSourceRuntimeStatus(
                provider=normalized,
                label=provider,
                configured=False,
                health="unsupported",
                message=f"{provider} is not registered as a data source.",
            )
        configured = self._configured(normalized)
        cache_updated_at = self.duck_store.get_latest_data_source_fetched_at(normalized)
        health = "ok" if configured else "missing_credentials"
        message = definition.description
        if normalized == "fred" and not configured:
            message = "Save a FRED API key in the desktop Data Sources panel or set PENGBO_FRED_API_KEY/FRED_API_KEY."
        if normalized == "coingecko" and not configured:
            message = "Save a CoinGecko demo or pro API key in the desktop Data Sources panel or set PENGBO_COINGECKO_DEMO_API_KEY/PENGBO_COINGECKO_PRO_API_KEY."
        freshness_state = self._freshness_state(
            normalized,
            configured=configured,
            health=health,
            cache_updated_at=cache_updated_at,
        )
        return DataSourceRuntimeStatus(
            provider=normalized,
            label=definition.label,
            configured=configured,
            health=health,
            message=message,
            stale=freshness_state in {"cached", "stale", "refresh_failed"},
            requires_credentials=normalized in KEYED_DATA_SOURCE_PROVIDERS and not configured,
            cache_updated_at=cache_updated_at,
            cache_age_seconds=self._age_seconds(cache_updated_at),
            freshness_state=freshness_state,
            freshness=self._freshness(normalized),
            last_success_at=cache_updated_at,
            data_quality=quality_from_provider_state(
                provider=normalized,
                health=health,
                freshness_state=freshness_state,
                configured=configured,
                requires_credentials=normalized in KEYED_DATA_SOURCE_PROVIDERS,
                stale=freshness_state in {"cached", "stale", "refresh_failed"},
                limitations=[message] if health in {"missing_credentials", "unavailable"} else [],
                source_confidence="official" if normalized in {"worldbank", "fred"} else "public",
            ),
            registration_url=self.registration_url(normalized),
            paid_setup_url="https://www.coingecko.com/en/api/pricing" if normalized == "coingecko" else None,
        )

    def registration_url(self, provider: str) -> str | None:
        if provider == "fred":
            return "https://fred.stlouisfed.org/docs/api/api_key.html"
        if provider == "coingecko":
            return "https://docs.coingecko.com/docs/setting-up-your-api-key"
        return None

    def test_provider(self, provider: str) -> ConnectionCheckResponse:
        normalized = provider.lower()
        if normalized not in DATA_SOURCE_PROVIDERS:
            return ConnectionCheckResponse(
                provider=normalized,
                status="unsupported",
                message=f"{provider} is not registered as a data source.",
            )
        if normalized in KEYED_DATA_SOURCE_PROVIDERS and not self._configured(normalized):
            return ConnectionCheckResponse(
                provider=normalized,
                status="missing_credentials",
                message=self.get_provider_status(normalized).message,
                requires_credentials=True,
            )
        try:
            if normalized == "worldbank":
                self.get_macro_series(provider="worldbank", series_id="NY.GDP.MKTP.CD", country="CN", limit=3)
            elif normalized == "dbnomics":
                self.get_macro_series(provider="dbnomics", series_id="WB/WDI/A-NY.GDP.MKTP.CD-CHN", limit=3)
            elif normalized == "rss_events":
                self.get_news_events(query="market", limit=3)
            elif normalized == "fred":
                self.get_macro_series(provider="fred", series_id="GDP", limit=3)
            elif normalized == "coingecko":
                self.get_crypto_markets(ids="bitcoin,ethereum", limit=2)
            return ConnectionCheckResponse(
                provider=normalized,
                status="ok",
                message=f"{self._definition_label(normalized)} probe succeeded.",
            )
        except Exception as error:
            safe_error = self.safe_error_message(error)
            cache_updated_at = self.duck_store.get_latest_data_source_fetched_at(normalized)
            if cache_updated_at:
                return ConnectionCheckResponse(
                    provider=normalized,
                    status="cached",
                    message=f"{self._definition_label(normalized)} live probe failed; cached data is available: {safe_error}",
                    stale=True,
                    cache_updated_at=cache_updated_at,
                    cache_age_seconds=self._age_seconds(cache_updated_at),
                )
            return ConnectionCheckResponse(
                provider=normalized,
                status="unavailable",
                message=f"{self._definition_label(normalized)} probe unavailable: {safe_error}",
            )

    def get_macro_series(
        self,
        *,
        provider: str = "worldbank",
        series_id: str = "NY.GDP.MKTP.CD",
        country: str = "CN",
        limit: int = 20,
    ) -> MacroSeriesResponse:
        normalized = provider.lower()
        cache_key = self._cache_key({"kind": "macro", "provider": normalized, "series": series_id, "country": country, "limit": limit})
        try:
            if normalized == "worldbank":
                payload = self._fetch_worldbank_series(series_id=series_id, country=country, limit=limit)
            elif normalized == "dbnomics":
                payload = self._fetch_dbnomics_series(series_id=series_id, country=country, limit=limit)
            elif normalized == "fred":
                if not self.settings.fred_api_key:
                    raise ValueError("FRED API key is not configured.")
                payload = self._fetch_fred_series(series_id=series_id, limit=limit)
            else:
                raise ValueError(f"Unsupported macro provider: {provider}")
            self.duck_store.put_data_source_snapshot(normalized, cache_key, payload)
            return MacroSeriesResponse.model_validate(payload)
        except Exception as error:
            safe_error = self.safe_error_message(error)
            cached = self.duck_store.get_data_source_snapshot(normalized, cache_key)
            if cached is not None:
                return MacroSeriesResponse.model_validate(
                    self._cached_payload_after_refresh_failure(normalized, cached, safe_error)
                )
            raise RuntimeError(safe_error) from error

    def _fetch_worldbank_series(self, *, series_id: str, country: str, limit: int) -> dict[str, Any]:
        url = f"https://api.worldbank.org/v2/country/{country}/indicator/{series_id}"
        response = self.session.get(url, params={"format": "json", "per_page": limit, "MRV": limit}, timeout=20)
        response.raise_for_status()
        payload = response.json()
        rows = payload[1] if isinstance(payload, list) and len(payload) > 1 and isinstance(payload[1], list) else []
        observations = [
            {"date": str(row.get("date")), "value": row.get("value")}
            for row in rows
            if row.get("date") is not None
        ]
        observations.sort(key=lambda item: item["date"])
        title = rows[0].get("indicator", {}).get("value") if rows else series_id
        geography = rows[0].get("country", {}).get("value") if rows else country
        fetched_at = self._now_iso()
        return {
            "provider": "worldbank",
            "series_id": series_id,
            "title": title or series_id,
            "geography": geography,
            "frequency": "annual",
            "unit": None,
            "observations": observations,
            "provenance": self._provenance("worldbank", source_url=response.url, fetched_at=fetched_at).model_dump(),
        }

    def _dbnomics_wdi_series_id(self, series_id: str, country: str) -> str:
        normalized = series_id.strip()
        if normalized.startswith("WB/WDI/A-"):
            return normalized
        if normalized.startswith("WB/WDI/"):
            tail = normalized.removeprefix("WB/WDI/")
            if "." in tail:
                country_code, indicator = tail.split(".", 1)
                return f"WB/WDI/A-{indicator.replace('_', '.')}-{country_code}"
            return normalized
        if normalized.startswith("A-"):
            return f"WB/WDI/{normalized}"
        return f"WB/WDI/A-{normalized.replace('_', '.')}-{country}"

    def _fetch_dbnomics_series(self, *, series_id: str, country: str, limit: int) -> dict[str, Any]:
        normalized_series_id = self._dbnomics_wdi_series_id(series_id, country)
        url = f"https://api.db.nomics.world/v22/series/{normalized_series_id}"
        response = self.session.get(url, params={"format": "json", "observations": 1}, timeout=20)
        response.raise_for_status()
        payload = response.json()
        series = payload.get("series", {})
        docs = series.get("docs") or []
        doc = docs[0] if docs else {}
        periods = doc.get("period") or []
        values = doc.get("value") or []
        points = list(zip(periods, values, strict=False))[-limit:]
        observations = [{"date": str(period), "value": value} for period, value in points]
        fetched_at = self._now_iso()
        return {
            "provider": "dbnomics",
            "series_id": normalized_series_id,
            "title": doc.get("series_name") or doc.get("name") or series_id,
            "geography": (doc.get("dimensions") or {}).get("country") or doc.get("Country") or doc.get("country"),
            "frequency": (doc.get("dimensions") or {}).get("frequency") or doc.get("frequency"),
            "unit": doc.get("unit"),
            "observations": observations,
            "provenance": self._provenance("dbnomics", source_url=response.url, fetched_at=fetched_at).model_dump(),
        }

    def _fetch_fred_series(self, *, series_id: str, limit: int) -> dict[str, Any]:
        url = "https://api.stlouisfed.org/fred/series/observations"
        response = self.session.get(
            url,
            params={
                "series_id": series_id,
                "api_key": self.settings.fred_api_key,
                "file_type": "json",
                "sort_order": "desc",
                "limit": limit,
            },
            timeout=20,
        )
        response.raise_for_status()
        rows = response.json().get("observations") or []
        observations = []
        for row in rows:
            raw_value = row.get("value")
            try:
                value = None if raw_value in {None, "."} else float(raw_value)
            except (TypeError, ValueError):
                value = None
            observations.append({"date": str(row.get("date")), "value": value})
        observations.sort(key=lambda item: item["date"])
        fetched_at = self._now_iso()
        return {
            "provider": "fred",
            "series_id": series_id,
            "title": series_id,
            "geography": "US",
            "frequency": None,
            "unit": None,
            "observations": observations,
            "provenance": self._provenance("fred", source_url=response.url.split("api_key=")[0] + "api_key=***", fetched_at=fetched_at).model_dump(),
        }

    def get_crypto_markets(self, *, ids: str = "bitcoin,ethereum", limit: int = 10) -> CryptoMarketsResponse:
        provider = "coingecko"
        cache_key = self._cache_key({"kind": "crypto", "ids": ids, "limit": limit})
        try:
            if not self._configured(provider):
                raise ValueError("CoinGecko demo or pro API key is not configured.")
            url = "https://api.coingecko.com/api/v3/coins/markets"
            headers: dict[str, str] = {}
            if self.settings.coingecko_demo_api_key:
                headers["x-cg-demo-api-key"] = self.settings.coingecko_demo_api_key
            if self.settings.coingecko_pro_api_key:
                headers["x-cg-pro-api-key"] = self.settings.coingecko_pro_api_key
            response = self.session.get(
                url,
                params={"vs_currency": "usd", "ids": ids, "per_page": limit, "page": 1},
                headers=headers,
                timeout=20,
            )
            response.raise_for_status()
            rows = response.json()
            fetched_at = self._now_iso()
            payload = {
                "provider": provider,
                "assets": [
                    {
                        "id": str(row.get("id")),
                        "symbol": str(row.get("symbol", "")).upper(),
                        "name": str(row.get("name") or row.get("id")),
                        "price_usd": row.get("current_price"),
                        "market_cap_usd": row.get("market_cap"),
                        "volume_24h_usd": row.get("total_volume"),
                        "price_change_24h_pct": row.get("price_change_percentage_24h"),
                        "as_of": row.get("last_updated"),
                    }
                    for row in rows
                ],
                "provenance": self._provenance(provider, source_url=response.url, fetched_at=fetched_at).model_dump(),
            }
            self.duck_store.put_data_source_snapshot(provider, cache_key, payload)
            return CryptoMarketsResponse.model_validate(payload)
        except Exception as error:
            safe_error = self.safe_error_message(error)
            cached = self.duck_store.get_data_source_snapshot(provider, cache_key)
            if cached is not None:
                return CryptoMarketsResponse.model_validate(
                    self._cached_payload_after_refresh_failure(provider, cached, safe_error)
                )
            raise RuntimeError(safe_error) from error

    def get_news_events(self, *, query: str = "market", limit: int = 20) -> NewsEventsResponse:
        provider = "rss_events"
        cache_key = self._cache_key({"kind": "news", "query": query, "limit": limit})
        try:
            url = "https://news.google.com/rss/search"
            response = self.session.get(url, params={"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"}, timeout=20)
            response.raise_for_status()
            root = ET.fromstring(response.text)
            events: list[dict[str, Any]] = []
            for item in root.findall(".//item")[:limit]:
                title = item.findtext("title") or "Untitled event"
                link = item.findtext("link") or response.url
                published = self._parse_rss_timestamp(item.findtext("pubDate"))
                source_node = item.find("source")
                events.append(
                    {
                        "title": title,
                        "source": source_node.text if source_node is not None and source_node.text else "RSS",
                        "url": link,
                        "published_at": published,
                        "summary": item.findtext("description"),
                        "symbols": self._extract_symbols(title),
                    }
                )
            fetched_at = self._now_iso()
            payload = {
                "provider": provider,
                "query": query,
                "events": events,
                "provenance": self._provenance(provider, source_url=response.url, fetched_at=fetched_at).model_dump(),
            }
            self.duck_store.put_data_source_snapshot(provider, cache_key, payload)
            return NewsEventsResponse.model_validate(payload)
        except Exception as error:
            safe_error = self.safe_error_message(error)
            cached = self.duck_store.get_data_source_snapshot(provider, cache_key)
            if cached is not None:
                return NewsEventsResponse.model_validate(
                    self._cached_payload_after_refresh_failure(provider, cached, safe_error)
                )
            raise RuntimeError(safe_error) from error

    def _parse_rss_timestamp(self, value: str | None) -> str | None:
        if not value:
            return None
        try:
            return parsedate_to_datetime(value).astimezone(UTC).isoformat()
        except (TypeError, ValueError):
            return None

    def _extract_symbols(self, title: str) -> list[str]:
        symbols = []
        for token in title.replace("(", " ").replace(")", " ").replace(",", " ").split():
            cleaned = token.strip("$:;")
            if 1 < len(cleaned) <= 8 and cleaned.isupper() and any(char.isalpha() for char in cleaned):
                symbols.append(cleaned)
        return symbols[:5]

    def export_report(self, payload: DataSourceReportExportRequest) -> DataSourceReportExportResponse:
        generated_at = self._now_iso()
        reports_dir = self.settings.diagnostics_dir / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        report_path = reports_dir / f"data-sources-{generated_at.replace(':', '').replace('+', 'z')}.md"
        catalog = self.capability_service.get_connections_catalog()
        catalog_by_provider = {item.provider: item for item in catalog.providers}

        summaries: list[DataSourceReportSourceSummary] = []
        sections: list[str] = [
            "# Data Sources Report",
            "",
            f"Generated at: {generated_at}",
            "",
            "## Evidence Pack Summary",
            "",
            "- Evidence pack: `data_sources`",
            "- Provider status: `catalog health, credential readiness, cache state, and read-only boundary`",
            "- Data quality: `completeness, timeliness, source confidence, and limitation notes are included where available`",
            "- Private-state boundary: `no API keys, Stronghold vaults, unlock secrets, session tokens, runtime databases, or diagnostics bundles are included`",
            "- Audit references: `provider health and provenance only; security audit records are not exported from this report`",
            "",
            "## Source Status",
            "",
        ]

        for provider in sorted(DATA_SOURCE_PROVIDERS):
            status = self.get_provider_status(provider)
            catalog_item = catalog_by_provider.get(provider)
            summary = DataSourceReportSourceSummary(
                provider=status.provider,
                label=status.label,
                health=status.health,
                configured=status.configured,
                stale=status.stale,
                fetched_at=status.cache_updated_at,
                freshness_state=status.freshness_state,
                cache_age_seconds=status.cache_age_seconds,
                cache_ttl_seconds=status.freshness.cache_ttl_seconds if status.freshness else None,
                refresh_behavior=status.freshness.refresh_behavior if status.freshness else None,
                offline_behavior=status.freshness.offline_behavior if status.freshness else None,
                data_quality=status.data_quality,
                unavailable_reason=status.message if status.health in {"missing_credentials", "unavailable"} else None,
                read_only=True if catalog_item is None else catalog_item.read_only,
                live_trading=False if catalog_item is None else catalog_item.live_trading,
                source_url=None if catalog_item is None or catalog_item.provenance is None else catalog_item.provenance.source_url,
            )
            summaries.append(summary)
            sections.extend(
                [
                    f"- {summary.label} (`{summary.provider}`): health={summary.health}, freshness={summary.freshness_state}, quality={summary.data_quality.overall if summary.data_quality else 'unknown'}, configured={summary.configured}, cache_age_seconds={summary.cache_age_seconds if summary.cache_age_seconds is not None else 'not cached'}, read_only={summary.read_only}, live_trading={summary.live_trading}",
                ]
            )

        sample_summaries = self._collect_report_samples(payload)
        summaries_by_provider = {item.provider: item for item in summaries}
        for sample in sample_summaries:
            summaries_by_provider[sample.provider] = sample
        summaries = list(summaries_by_provider.values())

        sections.extend(["", "## Sample Queries", ""])
        sections.extend(self._render_report_sample_lines(sample_summaries))
        sections.extend(["", "## Provenance Summary", ""])
        provenance_summary = [
            f"{item.label}: health={item.health}, freshness={item.freshness_state}, stale={item.stale}, fetched_at={item.fetched_at or 'not fetched'}, cache_age_seconds={item.cache_age_seconds if item.cache_age_seconds is not None else 'not cached'}, source={item.source_url or 'catalog'}"
            + (f", quality={item.data_quality.overall}" if item.data_quality else "")
            + (f", unavailable={item.unavailable_reason}" if item.unavailable_reason else "")
            for item in summaries
        ]
        sections.extend(f"- {line}" for line in provenance_summary)
        sections.extend(
            [
                "",
                "## Evidence Quality Table",
                "",
                "| Provider | Health | Freshness | Cache age | TTL | Read-only | Live trading | Source |",
                "| --- | --- | --- | --- | --- | --- | --- | --- |",
            ]
        )
        for item in summaries:
            sections.append(
                f"| {item.provider} | {item.health} | {item.freshness_state} | {item.cache_age_seconds if item.cache_age_seconds is not None else 'not cached'} | {item.cache_ttl_seconds if item.cache_ttl_seconds is not None else 'not specified'} | {item.read_only} | {item.live_trading} | {item.source_url or 'catalog'} |"
            )
        sections.extend(
            [
                "",
                "## Data Quality Table",
                "",
                "| Provider | Overall | Completeness | Timeliness | Source confidence | Limitations |",
                "| --- | --- | --- | --- | --- | --- |",
            ]
        )
        for item in summaries:
            quality = item.data_quality
            limitations = "; ".join(quality.limitations) if quality and quality.limitations else "none"
            sections.append(
                f"| {item.provider} | {quality.overall if quality else 'unknown'} | {quality.completeness.level if quality else 'unknown'} | {quality.timeliness.level if quality else 'unknown'} | {quality.source_confidence.level if quality else 'unknown'} | {limitations} |"
            )
        sections.extend(
            [
                "",
                "## Safety",
                "",
                "- All listed data sources are read-only in this catalog.",
                "- Non-Binance sources do not expose live trading or order submission paths.",
                "- This export excludes credentials, Stronghold state, session tokens, runtime databases, and private local diagnostics.",
            ]
        )

        report_path.write_text("\n".join(sections) + "\n", encoding="utf-8")
        return DataSourceReportExportResponse(
            export_path=str(report_path),
            generated_at=generated_at,
            included_sources=summaries,
            provenance_summary=provenance_summary,
        )

    def _collect_report_samples(self, payload: DataSourceReportExportRequest) -> list[DataSourceReportSourceSummary]:
        samples: list[DataSourceReportSourceSummary] = []

        try:
            macro = self.get_macro_series(
                provider=payload.macro_provider,
                series_id=payload.macro_series_id,
                country=payload.macro_country,
                limit=5,
            )
            samples.append(self._summary_from_provenance(macro.provenance, health="cached" if macro.provenance.stale else "ok"))
        except Exception as error:
            samples.append(self._summary_from_status(payload.macro_provider, health="unavailable", reason=str(error)))

        try:
            news = self.get_news_events(query=payload.news_query, limit=5)
            samples.append(self._summary_from_provenance(news.provenance, health="cached" if news.provenance.stale else "ok"))
        except Exception as error:
            samples.append(self._summary_from_status("rss_events", health="unavailable", reason=str(error)))

        if self._configured("coingecko"):
            try:
                crypto = self.get_crypto_markets(ids=payload.crypto_ids, limit=5)
                samples.append(self._summary_from_provenance(crypto.provenance, health="cached" if crypto.provenance.stale else "ok"))
            except Exception as error:
                samples.append(self._summary_from_status("coingecko", health="unavailable", reason=str(error)))
        else:
            samples.append(self._summary_from_status("coingecko", health="missing_credentials", reason=self.get_provider_status("coingecko").message))

        return samples

    def _summary_from_provenance(self, provenance: DataSourceProvenance, *, health: str) -> DataSourceReportSourceSummary:
        definition = self.capability_service.get_source_definition(provenance.provider)
        return DataSourceReportSourceSummary(
            provider=provenance.provider,
            label=provenance.label,
            health=health,
            configured=self._configured(provenance.provider),
            stale=provenance.stale,
            fetched_at=provenance.fetched_at,
            freshness_state=provenance.freshness_state,
            cache_age_seconds=provenance.cache_age_seconds,
            cache_ttl_seconds=provenance.freshness.cache_ttl_seconds if provenance.freshness else None,
            refresh_behavior=provenance.freshness.refresh_behavior if provenance.freshness else None,
            offline_behavior=provenance.freshness.offline_behavior if provenance.freshness else None,
            data_quality=provenance.data_quality,
            source_url=provenance.source_url,
            unavailable_reason=provenance.unavailable_reason,
            read_only=True if definition is None else definition.read_only,
            live_trading=False if definition is None else definition.live_trading,
        )

    def _summary_from_status(self, provider: str, *, health: str, reason: str) -> DataSourceReportSourceSummary:
        status = self.get_provider_status(provider)
        definition = self.capability_service.get_source_definition(status.provider)
        freshness_state = self._freshness_state(
            status.provider,
            configured=status.configured,
            health=health,
            cache_updated_at=status.cache_updated_at,
        )
        return DataSourceReportSourceSummary(
            provider=status.provider,
            label=status.label,
            health=health,
            configured=status.configured,
            stale=freshness_state in {"cached", "stale", "refresh_failed"},
            fetched_at=status.cache_updated_at,
            freshness_state=freshness_state,
            cache_age_seconds=status.cache_age_seconds,
            cache_ttl_seconds=status.freshness.cache_ttl_seconds if status.freshness else None,
            refresh_behavior=status.freshness.refresh_behavior if status.freshness else None,
            offline_behavior=status.freshness.offline_behavior if status.freshness else None,
            data_quality=quality_from_provider_state(
                provider=status.provider,
                health=health,
                freshness_state=freshness_state,
                configured=status.configured,
                requires_credentials=status.requires_credentials,
                stale=freshness_state in {"cached", "stale", "refresh_failed"},
                limitations=[reason],
                source_confidence="official" if status.provider in {"worldbank", "fred"} else "public",
            ),
            source_url=None if definition is None else definition.provenance_source_url,
            unavailable_reason=reason,
            read_only=True if definition is None else definition.read_only,
            live_trading=False if definition is None else definition.live_trading,
        )

    def _render_report_sample_lines(self, samples: list[DataSourceReportSourceSummary]) -> list[str]:
        if not samples:
            return ["- No sample source queries were included."]
        return [
            f"- {item.label}: health={item.health}, freshness={item.freshness_state}, quality={item.data_quality.overall if item.data_quality else 'unknown'}, stale={item.stale}, fetched_at={item.fetched_at or 'not fetched'}, cache_age_seconds={item.cache_age_seconds if item.cache_age_seconds is not None else 'not cached'}"
            + (f", unavailable={item.unavailable_reason}" if item.unavailable_reason else "")
            for item in samples
        ]
