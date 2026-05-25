from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import requests

from ..data_seed import AssetCatalogEntry
from .binance import BinanceProvider


class MarketProvider:
    def __init__(self, binance_provider: BinanceProvider, *, china_fixture_mode: bool = False) -> None:
        self.binance_provider = binance_provider
        self.china_fixture_mode = china_fixture_mode
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "Mozilla/5.0 Pengbo Workbench/0.1"})

    def _fetch_yahoo_chart(self, yahoo_symbol: str, *, range_value: str, interval: str) -> dict[str, Any]:
        response = self.session.get(
            f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}",
            params={"range": range_value, "interval": interval, "includePrePost": "false"},
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        chart = payload["chart"]["result"][0]
        error = payload["chart"].get("error")
        if error:
            raise RuntimeError(error.get("description") or "Yahoo chart request failed")
        return chart

    def get_latest_quote(self, entry: AssetCatalogEntry) -> dict[str, Any]:
        if entry.provider == "tushare" and self.china_fixture_mode:
            return self._china_fixture_quote(entry)
        if entry.binance_symbol:
            return self.binance_provider.get_public_quote(entry.symbol)

        if not entry.yahoo_symbol:
            raise ValueError(f"{entry.symbol} missing yahoo symbol")
        chart = self._fetch_yahoo_chart(entry.yahoo_symbol, range_value="5d", interval="1d")
        meta = chart["meta"]
        current_price = float(meta.get("regularMarketPrice") or meta.get("previousClose"))
        previous_close = float(
            meta.get("chartPreviousClose")
            or meta.get("previousClose")
            or current_price
        )
        change = current_price - previous_close
        change_pct = 0.0 if previous_close == 0 else (change / previous_close) * 100
        return {
            "symbol": entry.symbol,
            "price": current_price,
            "change": change,
            "change_pct": change_pct,
            "currency": entry.currency,
            "provider": entry.provider,
            "as_of": datetime.now(UTC).isoformat(),
        }

    def get_price_history(
        self,
        entry: AssetCatalogEntry,
        *,
        range_value: str = "1y",
        interval: str = "1d",
    ) -> list[dict[str, Any]]:
        normalized_interval = _normalize_interval(interval)
        if entry.provider == "tushare" and self.china_fixture_mode:
            quote = self._china_fixture_quote(entry)
            return [
                {
                    "timestamp": "2026-05-20",
                    "open": round(quote["price"] * 0.98, 2),
                    "high": round(quote["price"] * 1.01, 2),
                    "low": round(quote["price"] * 0.97, 2),
                    "close": round(quote["price"] * 0.99, 2),
                    "volume": 100000.0,
                },
                {
                    "timestamp": "2026-05-21",
                    "open": round(quote["price"] * 0.99, 2),
                    "high": round(quote["price"] * 1.02, 2),
                    "low": round(quote["price"] * 0.98, 2),
                    "close": round(quote["price"] - quote["change"], 2),
                    "volume": 110000.0,
                },
                {
                    "timestamp": "2026-05-22",
                    "open": round(quote["price"] - quote["change"], 2),
                    "high": round(quote["price"] * 1.01, 2),
                    "low": round(quote["price"] * 0.98, 2),
                    "close": quote["price"],
                    "volume": 120000.0,
                },
            ]
        if entry.binance_symbol:
            binance_interval = _BINANCE_INTERVALS[normalized_interval]
            limit = _default_binance_limit(normalized_interval)
            points = self.binance_provider.get_public_history(entry.symbol, limit=limit, interval=binance_interval)
            return _aggregate_points(points, normalized_interval)

        if not entry.yahoo_symbol:
            raise ValueError(f"{entry.symbol} missing yahoo symbol")
        yahoo_range, yahoo_interval = _yahoo_request_params(normalized_interval, range_value)
        chart = self._fetch_yahoo_chart(entry.yahoo_symbol, range_value=yahoo_range, interval=yahoo_interval)
        timestamps = chart.get("timestamp") or []
        quote = chart["indicators"]["quote"][0]
        points: list[dict[str, Any]] = []
        for index, raw_timestamp in enumerate(timestamps):
            close = quote["close"][index]
            if close is None:
                continue
            parsed_timestamp = datetime.fromtimestamp(raw_timestamp, tz=UTC)
            timestamp = (
                parsed_timestamp.isoformat()
                if yahoo_interval.endswith("m")
                else parsed_timestamp.date().isoformat()
            )
            points.append(
                {
                    "timestamp": timestamp,
                    "open": float(quote["open"][index]) if quote["open"][index] is not None else None,
                    "high": float(quote["high"][index]) if quote["high"][index] is not None else None,
                    "low": float(quote["low"][index]) if quote["low"][index] is not None else None,
                    "close": float(close),
                    "volume": float(quote["volume"][index] or 0),
                }
            )
        return _aggregate_points(points, normalized_interval)

    def _china_fixture_quote(self, entry: AssetCatalogEntry) -> dict[str, Any]:
        fixture_prices = {
            "600519.SH": (1596.8, 12.8, 0.81),
            "000001.SZ": (11.23, 0.15, 1.35),
            "300750.SZ": (191.5, 3.6, 1.92),
        }
        price, change, change_pct = fixture_prices.get(entry.symbol, (100.0, 0.0, 0.0))
        return {
            "symbol": entry.symbol,
            "price": price,
            "change": change,
            "change_pct": change_pct,
            "currency": entry.currency,
            "provider": entry.provider,
            "as_of": datetime.now(UTC).isoformat(),
        }


SUPPORTED_PRICE_INTERVALS = {"15m", "30m", "1h", "2h", "4h", "8h", "1d", "1wk", "1mo", "1y"}

_BINANCE_INTERVALS = {
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "2h": "2h",
    "4h": "4h",
    "8h": "8h",
    "1d": "1d",
    "1wk": "1w",
    "1mo": "1M",
    "1y": "1M",
}

_YAHOO_DIRECT_INTERVALS = {
    "15m": ("5d", "15m"),
    "30m": ("1mo", "30m"),
    "1h": ("3mo", "60m"),
    "1d": ("1y", "1d"),
    "1wk": ("5y", "1wk"),
    "1mo": ("10y", "1mo"),
    "1y": ("10y", "1mo"),
}


def _normalize_interval(interval: str) -> str:
    normalized = interval.strip()
    aliases = {"1w": "1wk", "1M": "1mo", "1month": "1mo", "1year": "1y"}
    normalized = aliases.get(normalized, normalized)
    if normalized not in SUPPORTED_PRICE_INTERVALS:
        raise ValueError(f"Unsupported price interval: {interval}")
    return normalized


def _default_binance_limit(interval: str) -> int:
    if interval in {"15m", "30m", "1h"}:
        return 500
    if interval in {"2h", "4h", "8h"}:
        return 400
    if interval == "1y":
        return 120
    if interval == "1mo":
        return 120
    if interval == "1wk":
        return 260
    return 365


def _yahoo_request_params(interval: str, range_value: str) -> tuple[str, str]:
    if interval in {"2h", "4h", "8h"}:
        return range_value if range_value != "1y" else "6mo", "60m"
    return _YAHOO_DIRECT_INTERVALS[interval]


def _parse_timestamp(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _aggregate_points(points: list[dict[str, Any]], interval: str) -> list[dict[str, Any]]:
    if interval not in {"2h", "4h", "8h", "1y"}:
        return points
    if interval == "1y":
        return _aggregate_calendar(points, "%Y")
    hours = {"2h": 2, "4h": 4, "8h": 8}[interval]
    buckets: dict[tuple[str, int], list[dict[str, Any]]] = {}
    for point in points:
        parsed = _parse_timestamp(str(point["timestamp"]))
        bucket_hour = (parsed.hour // hours) * hours
        buckets.setdefault((parsed.date().isoformat(), bucket_hour), []).append(point)
    return [_combine_bucket(items) for _, items in sorted(buckets.items()) if items]


def _aggregate_calendar(points: list[dict[str, Any]], strftime_key: str) -> list[dict[str, Any]]:
    buckets: dict[str, list[dict[str, Any]]] = {}
    for point in points:
        parsed = _parse_timestamp(str(point["timestamp"]))
        buckets.setdefault(parsed.strftime(strftime_key), []).append(point)
    return [_combine_bucket(items, timestamp=f"{key}-01-01") for key, items in sorted(buckets.items()) if items]


def _combine_bucket(items: list[dict[str, Any]], timestamp: str | None = None) -> dict[str, Any]:
    first = items[0]
    last = items[-1]
    highs = [float(item["high"]) for item in items if item.get("high") is not None]
    lows = [float(item["low"]) for item in items if item.get("low") is not None]
    return {
        "timestamp": timestamp or str(first["timestamp"]),
        "open": first.get("open"),
        "high": max(highs) if highs else last.get("close"),
        "low": min(lows) if lows else last.get("close"),
        "close": float(last["close"]),
        "volume": sum(float(item.get("volume") or 0.0) for item in items),
    }
