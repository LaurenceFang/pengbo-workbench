from __future__ import annotations

import math
from threading import Lock
from time import monotonic
from typing import Any

from ..data_seed import AssetCatalogEntry


RATIO_FIELDS: tuple[tuple[str, str], ...] = (
    ("Gross Margin", "grossMargins"),
    ("Operating Margin", "operatingMargins"),
    ("Profit Margin", "profitMargins"),
    ("Return on Assets", "returnOnAssets"),
    ("Return on Equity", "returnOnEquity"),
    ("Current Ratio", "currentRatio"),
    ("Quick Ratio", "quickRatio"),
    ("Debt/Equity", "debtToEquity"),
    ("Trailing P/E", "trailingPE"),
)


INFO_CACHE_TTL_SECONDS = 5 * 60
_INFO_CACHE: dict[str, tuple[float, dict[str, Any]]] = {}
_INFO_CACHE_LOCK = Lock()


def _get_ticker_info(symbol: str) -> dict[str, Any]:
    now = monotonic()
    with _INFO_CACHE_LOCK:
        cached = _INFO_CACHE.get(symbol)
        if cached is not None and now - cached[0] <= INFO_CACHE_TTL_SECONDS:
            return dict(cached[1])

    from yfinance import Ticker

    info = dict(Ticker(symbol).info)
    with _INFO_CACHE_LOCK:
        _INFO_CACHE[symbol] = (monotonic(), info)
    return dict(info)


def _coerce_numeric(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, dict):
        raw_value = value.get("raw")
        value = raw_value if raw_value is not None else value.get("fmt")
    if isinstance(value, str):
        try:
            value = float(value.replace(",", ""))
        except ValueError:
            return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(numeric):
        return None
    return numeric


def _format_human_number(value: Any) -> str | None:
    numeric = _coerce_numeric(value)
    if numeric is None:
        return None
    units = [
        (1_000_000_000_000, "T"),
        (1_000_000_000, "B"),
        (1_000_000, "M"),
    ]
    for threshold, suffix in units:
        if abs(numeric) >= threshold:
            return f"${numeric / threshold:.2f}{suffix}"
    return f"${numeric:,.0f}"


def _format_ratio(label: str, value: float) -> str:
    if math.isinf(value):
        return "N/A"
    if "Margin" in label or "Return on" in label:
        return f"{value * 100:.1f}%"
    if "Ratio" in label or "/" in label or "P/E" in label:
        return f"{value:.2f}x"
    return f"{value:.2f}"


class FundamentalProvider:
    def __init__(self, *, market_fixture_mode: bool = False) -> None:
        self.market_fixture_mode = market_fixture_mode

    def get_overview(self, entry: AssetCatalogEntry) -> dict[str, str | None]:
        if self.market_fixture_mode:
            return {
                "symbol": entry.symbol,
                "company": entry.name,
                "sector": entry.sector,
                "market_cap": "$100.00B",
                "summary": entry.summary,
            }
        info = _get_ticker_info(entry.symbol)
        return {
            "symbol": entry.symbol,
            "company": str(info.get("longName") or entry.name),
            "sector": str(info.get("sector") or entry.sector) if info.get("sector") or entry.sector else None,
            "market_cap": _format_human_number(info.get("marketCap")),
            "summary": str(info.get("longBusinessSummary") or entry.summary),
        }

    def get_ratios(self, entry: AssetCatalogEntry) -> list[dict[str, str]]:
        if not entry.is_us_equity:
            return []

        if self.market_fixture_mode:
            return [
                {"label": "Gross Margin", "value": "40.0%", "note": "Explicit isolated test fixture"},
                {"label": "Return on Equity", "value": "18.0%", "note": "Explicit isolated test fixture"},
                {"label": "Trailing P/E", "value": "20.00x", "note": "Explicit isolated test fixture"},
            ]

        info = _get_ticker_info(entry.symbol)
        items: list[dict[str, str]] = []
        for label, field in RATIO_FIELDS:
            numeric = _coerce_numeric(info.get(field))
            if numeric is None:
                continue
            items.append(
                {
                    "label": label,
                    "value": _format_ratio(label, numeric),
                    "note": "Yahoo Finance info snapshot",
                }
            )
            if len(items) >= 6:
                break
        return items
