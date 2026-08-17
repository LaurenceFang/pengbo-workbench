from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

from ..data_seed import ASSET_CATALOG
from ..models import DashboardOverviewResponse
from ..providers.binance import BinanceProvider
from ..providers.market import MarketProvider
from ..storage.duckdb_store import DuckDbStore
from ..storage.sqlite_store import SqliteStore
from .asset_service import AssetService
from .watchlist_service import WatchlistService


class DashboardService:
    def __init__(
        self,
        watchlist_service: WatchlistService,
        asset_service: AssetService,
        market_provider: MarketProvider,
        sqlite_store: SqliteStore,
        duck_store: DuckDbStore,
        binance_provider: BinanceProvider,
    ) -> None:
        self.watchlist_service = watchlist_service
        self.asset_service = asset_service
        self.market_provider = market_provider
        self.sqlite_store = sqlite_store
        self.duck_store = duck_store
        self.binance_provider = binance_provider

    def get_overview(self, *, refresh: bool = False) -> DashboardOverviewResponse:
        watchlist_entries = self.watchlist_service.get_default_watchlist_entries()
        watchlist_items = []
        stale = False

        def load_watchlist_workspace(entry):
            try:
                return self.asset_service.get_asset_workspace(entry.symbol, refresh=refresh)
            except Exception:
                return None

        with ThreadPoolExecutor(
            max_workers=max(1, min(len(watchlist_entries), 6)),
            thread_name_prefix="dashboard-watchlist",
        ) as executor:
            workspaces = list(executor.map(load_watchlist_workspace, watchlist_entries))
        for entry, workspace in zip(watchlist_entries, workspaces, strict=True):
            if workspace is None:
                stale = True
                continue
            stale = stale or workspace.stale
            watchlist_items.append(
                {
                    "symbol": entry.symbol,
                    "name": entry.name,
                    "market": entry.market,
                    "asset_class": entry.asset_class,
                    "currency": entry.currency,
                    "provider": entry.provider,
                    "price": workspace.quote.price,
                    "change": workspace.quote.change,
                    "change_pct": workspace.quote.change_pct,
                    "trend": [point.close for point in workspace.history[-8:]],
                    "summary": entry.summary,
                }
            )

        pulse_specs = [
            ("QQQ", "纳指 100"),
            ("DXY", "美元指数"),
            ("US10Y", "10Y 美债"),
            ("BTC/USDT", "BTC/USDT"),
        ]
        def load_pulse(spec: tuple[str, str]) -> dict | None:
            symbol, label = spec
            entry = ASSET_CATALOG[symbol]
            try:
                quote = None if refresh else self.duck_store.get_latest_quote_snapshot(entry.symbol)
                quote = quote or self.market_provider.get_latest_quote(entry)
                tone = "neutral"
                if quote["change_pct"] > 0:
                    tone = "up"
                elif quote["change_pct"] < 0:
                    tone = "down"
                return {
                    "label": label,
                    "symbol": entry.symbol,
                    "value": quote["price"],
                    "change_pct": quote["change_pct"],
                    "currency": quote["currency"],
                    "tone": tone,
                }
            except Exception:
                return None

        with ThreadPoolExecutor(max_workers=len(pulse_specs), thread_name_prefix="dashboard-pulse") as executor:
            pulse_results = list(executor.map(load_pulse, pulse_specs))
        market_pulse = [item for item in pulse_results if item is not None]
        stale = stale or len(market_pulse) != len(pulse_specs)

        return DashboardOverviewResponse.model_validate(
            {
                "updated_at": datetime.now(UTC).isoformat(),
                "stale": stale,
                "market_pulse": market_pulse,
                "watchlist": watchlist_items,
                "focus_asset": watchlist_items[0] if watchlist_items else None,
                "connection_summary": {
                    "binance_configured": self.binance_provider.is_configured,
                    "binance_account_healthy": None,
                    "watchlist_count": len(watchlist_items),
                    "data_mode": "cached" if stale else "live",
                },
            }
        )
