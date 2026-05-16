from __future__ import annotations

from ..data_seed import ASSET_CATALOG, AssetCatalogEntry


def get_asset(symbol: str) -> AssetCatalogEntry | None:
    normalized = symbol.upper() if "/" not in symbol else symbol.upper()
    return ASSET_CATALOG.get(normalized)


def get_searchable_assets() -> list[AssetCatalogEntry]:
    return [entry for entry in ASSET_CATALOG.values() if entry.searchable]

