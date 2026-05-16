from __future__ import annotations

from ..data_seed import AssetCatalogEntry
from ..providers.catalog import get_asset, get_searchable_assets
from ..storage.sqlite_store import SqliteStore


class WatchlistService:
    def __init__(self, sqlite_store: SqliteStore) -> None:
        self.sqlite_store = sqlite_store

    def get_default_watchlist_entries(self) -> list[AssetCatalogEntry]:
        entries: list[AssetCatalogEntry] = []
        for symbol in self.sqlite_store.get_default_watchlist_symbols():
            entry = get_asset(symbol)
            if entry is not None:
                entries.append(entry)
        return entries

    def set_default_watchlist_entries(self, symbols: list[str]) -> list[AssetCatalogEntry]:
        normalized = []
        for symbol in symbols:
            entry = get_asset(symbol)
            if entry is None:
                raise ValueError(f"不支持的资产: {symbol}")
            normalized.append(entry.symbol)
        self.sqlite_store.set_default_watchlist_symbols(normalized)
        return self.get_default_watchlist_entries()

    def search_assets(self, query: str) -> list[AssetCatalogEntry]:
        keyword = query.strip().lower()
        candidates = get_searchable_assets()
        if not keyword:
            return candidates
        return [
            entry
            for entry in candidates
            if keyword in entry.symbol.lower()
            or keyword in entry.name.lower()
            or keyword in entry.market.lower()
        ]

