from __future__ import annotations

from datetime import UTC, datetime

from ..data_seed import AssetCatalogEntry
from ..models import AssetWorkspaceResponse, PriceHistoryInterval
from ..providers.catalog import get_asset
from ..providers.filings import FilingsProvider
from ..providers.fundamentals import FundamentalProvider
from ..providers.market import MarketProvider
from ..storage.duckdb_store import DuckDbStore
from .capability_service import CapabilityService


class AssetService:
    filings_cache_ttl_seconds = 600

    def __init__(
        self,
        market_provider: MarketProvider,
        fundamental_provider: FundamentalProvider,
        filings_provider: FilingsProvider,
        duck_store: DuckDbStore,
        capability_service: CapabilityService,
    ) -> None:
        self.market_provider = market_provider
        self.fundamental_provider = fundamental_provider
        self.filings_provider = filings_provider
        self.duck_store = duck_store
        self.capability_service = capability_service

    def _get_entry(self, symbol: str) -> AssetCatalogEntry:
        entry = get_asset(symbol)
        if entry is None:
            raise ValueError(f"Asset not found: {symbol}")
        return entry

    def _resolve_quote(self, entry: AssetCatalogEntry) -> tuple[dict, bool]:
        try:
            quote = self.market_provider.get_latest_quote(entry)
            self.duck_store.put_quote_snapshot(entry.symbol, entry.provider, quote)
            return quote, False
        except Exception:
            cached = self.duck_store.get_latest_quote_snapshot(entry.symbol)
            if cached is None:
                raise
            return cached, True

    def _resolve_history(
        self,
        entry: AssetCatalogEntry,
        *,
        interval: PriceHistoryInterval = "1d",
        range_value: str = "1y",
    ) -> tuple[list[dict], bool]:
        try:
            history = self.market_provider.get_price_history(entry, range_value=range_value, interval=interval)
            self.duck_store.replace_price_history(entry.symbol, interval, entry.provider, history)
            return history, False
        except Exception:
            cached = self.duck_store.get_latest_price_history(entry.symbol, interval)
            if cached is None and interval != "1d":
                cached = self.duck_store.get_latest_price_history(entry.symbol, "1d")
            if cached is None:
                raise
            return cached, True

    def _resolve_overview(self, entry: AssetCatalogEntry) -> tuple[dict | None, bool]:
        if not entry.is_us_equity:
            return None, False
        try:
            overview = self.fundamental_provider.get_overview(entry)
            self.duck_store.put_fundamental_snapshot(
                entry.symbol,
                "overview",
                "yfinance",
                overview,
            )
            return overview, False
        except Exception:
            cached = self.duck_store.get_latest_fundamental_snapshot(entry.symbol, "overview")
            if cached is None:
                return None, True
            return cached, True

    def _resolve_ratios(self, entry: AssetCatalogEntry) -> tuple[list[dict], bool]:
        if not entry.is_us_equity:
            return [], False
        try:
            ratios = self.fundamental_provider.get_ratios(entry)
            self.duck_store.put_fundamental_snapshot(
                entry.symbol,
                "ratios",
                "yfinance",
                ratios,
            )
            return ratios, False
        except Exception:
            cached = self.duck_store.get_latest_fundamental_snapshot(entry.symbol, "ratios")
            if cached is None:
                return [], True
            return list(cached), True

    def _resolve_filings(self, entry: AssetCatalogEntry) -> tuple[list[dict], bool]:
        if not entry.is_us_equity:
            return [], False
        cached = self._recent_cached_filings(entry.symbol)
        if cached is not None:
            return cached, False
        try:
            filings = self.filings_provider.get_filings(entry)
            self.duck_store.replace_filings(entry.symbol, "edgartools", filings)
            return filings, False
        except Exception:
            cached = self.duck_store.get_latest_filings(entry.symbol)
            if cached is None:
                return [], True
            return cached, True

    def _recent_cached_filings(self, symbol: str) -> list[dict] | None:
        fetched_at = self.duck_store.get_latest_filings_fetched_at(symbol)
        if not fetched_at:
            return None
        try:
            parsed = datetime.fromisoformat(fetched_at)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=UTC)
        age_seconds = (datetime.now(UTC) - parsed.astimezone(UTC)).total_seconds()
        if age_seconds > self.filings_cache_ttl_seconds:
            return None
        return self.duck_store.get_latest_filings(symbol)

    def get_quote_snapshot(self, symbol: str) -> tuple[AssetCatalogEntry, dict, bool]:
        entry = self._get_entry(symbol)
        quote, stale = self._resolve_quote(entry)
        return entry, quote, stale

    def get_price_history_snapshot(
        self,
        symbol: str,
        *,
        interval: PriceHistoryInterval = "1d",
        range_value: str = "1y",
    ) -> tuple[AssetCatalogEntry, list[dict], bool]:
        entry = self._get_entry(symbol)
        history, stale = self._resolve_history(entry, interval=interval, range_value=range_value)
        return entry, history, stale

    def get_asset_workspace(self, symbol: str) -> AssetWorkspaceResponse:
        entry = self._get_entry(symbol)
        quote, quote_stale = self._resolve_quote(entry)
        history, history_stale = self._resolve_history(entry)
        overview, overview_stale = self._resolve_overview(entry)
        ratios, ratios_stale = self._resolve_ratios(entry)
        filings, filings_stale = self._resolve_filings(entry)
        fundamentals_assessment = self.capability_service.assess_fundamentals(
            entry,
            data_available=overview is not None or bool(ratios),
            temporarily_unavailable=overview_stale or ratios_stale,
        )
        filings_assessment = self.capability_service.assess_filings(
            entry,
            data_available=bool(filings),
            temporarily_unavailable=filings_stale,
        )

        notes: list[str] = []
        for assessment in (fundamentals_assessment, filings_assessment):
            if assessment.status != "available":
                notes.append(assessment.message)
        if any([quote_stale, history_stale, overview_stale, ratios_stale, filings_stale]):
            notes.append("Some fields are served from the local cache.")

        return AssetWorkspaceResponse.model_validate(
            {
                "updated_at": datetime.now(UTC).isoformat(),
                "stale": any([quote_stale, history_stale, overview_stale, ratios_stale, filings_stale]),
                "asset": {
                    "symbol": entry.symbol,
                    "name": entry.name,
                    "market": entry.market,
                    "asset_class": entry.asset_class,
                    "currency": entry.currency,
                    "provider": entry.provider,
                },
                "quote": quote,
                "history": history,
                "overview": overview,
                "ratios": ratios,
                "filings": filings,
                "capabilities": {
                    "has_fundamentals": fundamentals_assessment.status == "available",
                    "has_filings": filings_assessment.status == "available",
                    "fundamentals_status": fundamentals_assessment.status,
                    "filings_status": filings_assessment.status,
                    "fundamentals_message": fundamentals_assessment.message,
                    "filings_message": filings_assessment.message,
                    "notes": notes,
                },
            }
        )
