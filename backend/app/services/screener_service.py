from __future__ import annotations

from dataclasses import dataclass
from math import sqrt
from statistics import mean, pstdev
from typing import Any, Protocol
from uuid import uuid4

from ..data_seed import AssetCatalogEntry
from ..models import (
    CreateScreenerPresetVariantRequest,
    ScreenerPreset,
    ScreenerPresetVariant,
    ScreenerResult,
    ScreenerRunRequest,
    ScreenerRunResponse,
    UpdateScreenerPresetRequest,
    UpdateScreenerPresetVariantRequest,
)
from ..providers.catalog import get_asset, get_searchable_assets
from ..screener_profiles import build_variant_filters, normalize_tuning
from ..storage.sqlite_store import SqliteStore
from .asset_service import AssetService
from .data_quality_service import quality_from_missing_and_stale

SCORE_HIGH_THRESHOLD = 72.0
SCORE_MEDIUM_THRESHOLD = 50.0

EXPANDED_UNIVERSE_SYMBOLS: dict[str, list[str]] = {
    "equity": [
        "AAPL",
        "MSFT",
        "NVDA",
        "GOOGL",
        "META",
        "AMZN",
        "COST",
        "LLY",
        "600519.SH",
        "000001.SZ",
        "300750.SZ",
        "SPY",
        "QQQ",
    ],
    "etf": ["SPY", "QQQ", "TQQQ"],
    "index": ["SPY", "QQQ", "TQQQ", "DXY", "US10Y"],
    "crypto": ["BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT", "LINK/USDT", "DOGE/USDT"],
}


class UniverseSource(Protocol):
    key: str

    def assets_for(self, asset_type: str) -> list[AssetCatalogEntry]:
        ...


@dataclass
class CatalogUniverseSource:
    key: str = "catalog"

    def assets_for(self, asset_type: str) -> list[AssetCatalogEntry]:
        return [entry for entry in get_searchable_assets() if _matches_asset_type(entry, asset_type)]


@dataclass
class ExpandedUniverseSource:
    key: str = "expanded"

    def assets_for(self, asset_type: str) -> list[AssetCatalogEntry]:
        entries: list[AssetCatalogEntry] = []
        for symbol in EXPANDED_UNIVERSE_SYMBOLS.get(asset_type, []):
            entry = get_asset(symbol)
            if entry is not None and _matches_asset_type(entry, asset_type, include_etf_for_equity=True):
                entries.append(entry)
        return entries


def _matches_asset_type(
    entry: AssetCatalogEntry,
    asset_type: str,
    *,
    include_etf_for_equity: bool = False,
) -> bool:
    if asset_type == "equity":
        allowed = {"equity", "etf"} if include_etf_for_equity else {"equity"}
        return entry.asset_class in allowed
    if asset_type in {"etf", "index"}:
        return entry.asset_class in {"etf", "macro"}
    return entry.asset_class == asset_type


def _coerce_attr(item: Any, name: str, default: Any = None) -> Any:
    if isinstance(item, dict):
        return item.get(name, default)
    return getattr(item, name, default)


def _parse_ratio_value(raw_value: str | None) -> float | None:
    if not raw_value:
        return None
    normalized = raw_value.strip().replace(",", "")
    try:
        if normalized.endswith("%"):
            return float(normalized.removesuffix("%"))
        if normalized.endswith("x"):
            return float(normalized.removesuffix("x"))
        return float(normalized)
    except ValueError:
        return None


def _parse_money_value(raw_value: str | None) -> float | None:
    if not raw_value:
        return None
    normalized = raw_value.strip().replace("$", "").replace(",", "")
    multiplier = 1.0
    if normalized.endswith("T"):
        normalized = normalized.removesuffix("T")
        multiplier = 1_000_000_000_000
    elif normalized.endswith("B"):
        normalized = normalized.removesuffix("B")
        multiplier = 1_000_000_000
    elif normalized.endswith("M"):
        normalized = normalized.removesuffix("M")
        multiplier = 1_000_000
    try:
        return float(normalized) * multiplier
    except ValueError:
        return None


def _history_closes(workspace: Any) -> list[float]:
    closes: list[float] = []
    for point in _coerce_attr(workspace, "history", []):
        close = _coerce_attr(point, "close")
        if close is not None:
            closes.append(float(close))
    return closes


def _history_volumes(workspace: Any) -> list[float]:
    volumes: list[float] = []
    for point in _coerce_attr(workspace, "history", []):
        volume = _coerce_attr(point, "volume")
        if volume is not None:
            volumes.append(float(volume))
    return volumes


def _percent_return(closes: list[float], lookback_days: int) -> float | None:
    if len(closes) <= lookback_days:
        return None
    starting_value = closes[-lookback_days - 1]
    ending_value = closes[-1]
    if starting_value == 0:
        return None
    return ((ending_value / starting_value) - 1) * 100


def _max_drawdown_pct(closes: list[float], lookback_days: int) -> float | None:
    if len(closes) < 2:
        return None
    window = closes[-lookback_days:] if len(closes) > lookback_days else closes
    peak = window[0]
    max_drawdown = 0.0
    for close in window:
        peak = max(peak, close)
        if peak == 0:
            continue
        drawdown = ((peak - close) / peak) * 100
        max_drawdown = max(max_drawdown, drawdown)
    return max_drawdown


def _annualized_volatility_pct(closes: list[float], periods_per_year: int) -> float | None:
    if len(closes) < 3:
        return None
    returns: list[float] = []
    for previous, current in zip(closes[:-1], closes[1:]):
        if previous == 0:
            continue
        returns.append((current / previous) - 1)
    if len(returns) < 2:
        return None
    return pstdev(returns) * sqrt(periods_per_year) * 100


def _average_volume(volumes: list[float], lookback_days: int) -> float | None:
    if not volumes:
        return None
    window = volumes[-lookback_days:] if len(volumes) > lookback_days else volumes
    non_zero = [value for value in window if value > 0]
    if not non_zero:
        return None
    return mean(non_zero)


def _ratio_lookup(workspace: Any) -> dict[str, float]:
    lookup: dict[str, float] = {}
    for ratio in _coerce_attr(workspace, "ratios", []):
        label = _coerce_attr(ratio, "label")
        value = _parse_ratio_value(_coerce_attr(ratio, "value"))
        if label and value is not None:
            lookup[str(label)] = value
    return lookup


def _build_metrics(workspace: Any) -> dict[str, float | int | str]:
    quote = _coerce_attr(workspace, "quote")
    overview = _coerce_attr(workspace, "overview")
    closes = _history_closes(workspace)
    volumes = _history_volumes(workspace)
    ratios = _ratio_lookup(workspace)
    market_cap = _parse_money_value(_coerce_attr(overview, "market_cap")) if overview else None
    metrics: dict[str, float | int | str] = {
        "price": round(float(_coerce_attr(quote, "price", 0.0)), 2),
        "change_pct": round(float(_coerce_attr(quote, "change_pct", 0.0)), 2),
        "history_points": len(closes),
        "ratio_count": len(_coerce_attr(workspace, "ratios", [])),
    }
    if market_cap is not None:
        metrics["market_cap"] = _coerce_attr(overview, "market_cap")
        metrics["market_cap_billions"] = round(market_cap / 1_000_000_000, 2)

    for label, key in (
        ("Gross Margin", "gross_margin_pct"),
        ("Operating Margin", "operating_margin_pct"),
        ("Profit Margin", "profit_margin_pct"),
        ("Return on Equity", "return_on_equity_pct"),
        ("Current Ratio", "current_ratio"),
        ("Debt/Equity", "debt_to_equity"),
    ):
        value = ratios.get(label)
        if value is not None:
            metrics[key] = round(value, 2)

    for lookback, key in ((7, "seven_day_change_pct"), (30, "thirty_day_change_pct")):
        value = _percent_return(closes, lookback)
        if value is not None:
            metrics[key] = round(value, 2)

    drawdown = _max_drawdown_pct(closes, 60)
    if drawdown is not None:
        metrics["max_drawdown_pct"] = round(drawdown, 2)

    if _coerce_attr(_coerce_attr(workspace, "asset"), "asset_class") == "crypto":
        volatility = _annualized_volatility_pct(closes, 365)
    else:
        volatility = _annualized_volatility_pct(closes, 252)
    if volatility is not None:
        metrics["volatility_pct"] = round(volatility, 2)

    average_volume = _average_volume(volumes, 20)
    if average_volume is not None:
        metrics["avg_volume"] = round(average_volume, 2)

    return metrics


def _append_metric(values: list[str], item: str) -> None:
    if item not in values:
        values.append(item)


def _score_label(score: float) -> str:
    if score >= SCORE_HIGH_THRESHOLD:
        return "high"
    if score >= SCORE_MEDIUM_THRESHOLD:
        return "medium"
    return "watch"


def _level_threshold(level: str, *, low: float, medium: float, high: float) -> float:
    if level == "low":
        return low
    if level == "high":
        return high
    return medium


def _pick_level_config(level: str, *, low: Any, medium: Any, high: Any) -> Any:
    if level == "low":
        return low
    if level == "high":
        return high
    return medium


def _score_quality_equities(
    workspace: Any,
    tuning: dict[str, str],
) -> tuple[float, list[str], list[str], list[str], dict[str, float | int | str]]:
    metrics = _build_metrics(workspace)
    matched: list[str] = []
    explanations: list[str] = []
    missing: list[str] = []
    score = 0.0

    quality_level = tuning["quality_floor"]
    trend_level = tuning["trend_requirement"]
    size_level = tuning["size_bias"]

    size_bands = _pick_level_config(
        size_level,
        low=((200, 16, "large-cap leadership"), (50, 12, "broad large-cap"), (0, 6, "tradable cap")),
        medium=((500, 18, "mega-cap resilience"), (100, 14, "large-cap scale"), (0, 8, "tradable market cap")),
        high=((800, 20, "mega-cap dominance"), (200, 16, "ultra-large-cap scale"), (0, 6, "tradable cap")),
    )
    market_cap_billions = metrics.get("market_cap_billions")
    if isinstance(market_cap_billions, (int, float)):
        for threshold, weight, label in size_bands:
            if market_cap_billions >= threshold:
                score += weight
                matched.append(label)
                explanations.append("市值层级符合当前质量档位对大盘股稳定性的要求。")
                break
    else:
        missing.append("market_cap")

    quality_thresholds = {
        "gross_margin_pct": _level_threshold(quality_level, low=28, medium=35, high=42),
        "return_on_equity_pct": _level_threshold(quality_level, low=10, medium=15, high=20),
        "profit_margin_pct": _level_threshold(quality_level, low=8, medium=12, high=15),
    }
    for key, weight, match_label, explanation in (
        ("gross_margin_pct", 14, "strong gross margin", "毛利率达到当前质量档位要求。"),
        ("return_on_equity_pct", 14, "high ROE", "ROE 达到当前质量档位要求。"),
        ("profit_margin_pct", 10, "healthy profit margin", "净利率足以支撑质量股配置。"),
    ):
        value = metrics.get(key)
        if isinstance(value, (int, float)):
            if value >= quality_thresholds[key]:
                score += weight
                matched.append(match_label)
                explanations.append(explanation)
        else:
            missing.append(key)

    drawdown = metrics.get("max_drawdown_pct")
    drawdown_full = _level_threshold(trend_level, low=20, medium=15, high=12)
    drawdown_soft = _level_threshold(trend_level, low=30, medium=25, high=20)
    if isinstance(drawdown, (int, float)):
        if drawdown <= drawdown_full:
            score += 12
            matched.append("contained drawdown")
            explanations.append("近期回撤仍在当前趋势档位可接受范围内。")
        elif drawdown <= drawdown_soft:
            score += 8
    else:
        missing.append("max_drawdown_pct")

    thirty_day_change = metrics.get("thirty_day_change_pct")
    trend_full = _level_threshold(trend_level, low=-2, medium=2, high=6)
    trend_soft = _level_threshold(trend_level, low=-8, medium=-5, high=0)
    if isinstance(thirty_day_change, (int, float)):
        if thirty_day_change >= trend_full:
            score += 10
            matched.append("positive 30d trend")
            explanations.append("30 日趋势满足当前质量档位的趋势要求。")
        elif thirty_day_change >= trend_soft:
            score += 6
    else:
        missing.append("thirty_day_change_pct")

    ratio_count = metrics.get("ratio_count")
    ratio_requirement = int(_level_threshold(quality_level, low=3, medium=4, high=5))
    if isinstance(ratio_count, int):
        if ratio_count >= ratio_requirement:
            score += 8
            matched.append("enough ratios")
            explanations.append("当前可用比率覆盖足以支撑质量判断。")
        else:
            missing.append("profitability_ratios")

    history_points = metrics.get("history_points")
    history_requirement = int(_level_threshold(trend_level, low=60, medium=90, high=120))
    if isinstance(history_points, int):
        if history_points >= history_requirement:
            score += 6
        else:
            missing.append("price_history")

    if not _coerce_attr(workspace, "stale", False):
        score += 8
    else:
        explanations.append("当前分数仍有参考价值，但部分字段来自缓存。")

    return min(round(score, 1), 100.0), matched, explanations, missing, metrics


def _score_growth_rebound(
    workspace: Any,
    tuning: dict[str, str],
) -> tuple[float, list[str], list[str], list[str], dict[str, float | int | str]]:
    metrics = _build_metrics(workspace)
    matched: list[str] = []
    explanations: list[str] = []
    missing: list[str] = []
    score = 0.0

    rebound_level = tuning["rebound_strength"]
    pullback_level = tuning["pullback_window"]
    quality_level = tuning["quality_guardrail"]

    seven_day_change = metrics.get("seven_day_change_pct")
    rebound_min = _level_threshold(rebound_level, low=-1, medium=0, high=1)
    if isinstance(seven_day_change, (int, float)):
        if seven_day_change >= rebound_min:
            score += 14
            matched.append("short-term rebound")
            explanations.append("7 日走势已达到当前反弹强度档位要求。")
    else:
        missing.append("seven_day_change_pct")

    thirty_day_change = metrics.get("thirty_day_change_pct")
    recovery_band = _pick_level_config(
        rebound_level,
        low=(0, 28, -10, 0),
        medium=(5, 35, -5, 5),
        high=(8, 25, 0, 8),
    )
    full_min, full_max, soft_min, soft_max = recovery_band
    if isinstance(thirty_day_change, (int, float)):
        if full_min <= thirty_day_change <= full_max:
            score += 20
            matched.append("30d recovery range")
            explanations.append("30 日表现仍处在当前反弹档位偏好的修复区间。")
        elif soft_min <= thirty_day_change <= soft_max:
            score += 10
    else:
        missing.append("thirty_day_change_pct")

    drawdown = metrics.get("max_drawdown_pct")
    pullback_band = _pick_level_config(
        pullback_level,
        low=(5, 28, 40),
        medium=(8, 35, 45),
        high=(12, 30, 38),
    )
    full_min, full_max, hard_cap = pullback_band
    if isinstance(drawdown, (int, float)):
        if full_min <= drawdown <= full_max:
            score += 18
            matched.append("pullback base")
            explanations.append("近期回撤仍符合当前回撤窗口档位的底部修复形态。")
        elif drawdown < full_min or drawdown <= hard_cap:
            score += 8
    else:
        missing.append("max_drawdown_pct")

    change_pct = metrics.get("change_pct")
    one_day_cap = _level_threshold(rebound_level, low=10, medium=8, high=6)
    if isinstance(change_pct, (int, float)):
        if -6 <= change_pct <= one_day_cap:
            score += 10
            matched.append("not overheated today")
            explanations.append("单日涨跌幅仍处于可承受的修复区间。")

    ratio_count = metrics.get("ratio_count")
    ratio_requirement = int(_level_threshold(quality_level, low=1, medium=2, high=3))
    if isinstance(ratio_count, int):
        if ratio_count >= ratio_requirement:
            score += 10
            matched.append("fundamentals available")
            explanations.append("当前反弹配置仍有足够基本面支撑。")
        else:
            missing.append("fundamental_ratios")

    margin_thresholds = _pick_level_config(
        quality_level,
        low=(30, 15, 8),
        medium=(35, 18, 10),
        high=(40, 22, 12),
    )
    margin_candidates = [
        metrics.get("gross_margin_pct"),
        metrics.get("operating_margin_pct"),
        metrics.get("profit_margin_pct"),
    ]
    if any(
        isinstance(value, (int, float)) and value >= threshold
        for value, threshold in zip(margin_candidates, margin_thresholds)
    ):
        score += 12
        matched.append("quality held through pullback")
        explanations.append("利润质量仍满足当前护栏，说明回撤更像修复而非破坏。")
    else:
        missing.append("quality_margins")

    history_points = metrics.get("history_points")
    history_requirement = int(_level_threshold(pullback_level, low=45, medium=60, high=75))
    if isinstance(history_points, int):
        if history_points >= history_requirement:
            score += 8
        else:
            missing.append("price_history")

    if not _coerce_attr(workspace, "stale", False):
        score += 8
    else:
        explanations.append("反弹分数基于缓存数据，正式判断前仍需刷新确认。")

    return min(round(score, 1), 100.0), matched, explanations, missing, metrics


def _score_trend_crypto(
    workspace: Any,
    tuning: dict[str, str],
) -> tuple[float, list[str], list[str], list[str], dict[str, float | int | str]]:
    metrics = _build_metrics(workspace)
    matched: list[str] = []
    explanations: list[str] = []
    missing: list[str] = []
    score = 0.0

    momentum_level = tuning["momentum_bias"]
    liquidity_level = tuning["liquidity_floor"]
    volatility_level = tuning["volatility_tolerance"]

    change_pct = metrics.get("change_pct")
    day_momentum = _level_threshold(momentum_level, low=-1, medium=0, high=1)
    if isinstance(change_pct, (int, float)):
        if change_pct > day_momentum:
            score += 18
            matched.append("positive 24h momentum")
            explanations.append("24 小时走势与当前动量档位保持一致。")
        else:
            missing.append("positive_24h_momentum")

    seven_day_change = metrics.get("seven_day_change_pct")
    seven_day_threshold = _level_threshold(momentum_level, low=1, medium=3, high=5)
    seven_day_soft = _level_threshold(momentum_level, low=-2, medium=0, high=2)
    if isinstance(seven_day_change, (int, float)):
        if seven_day_change >= seven_day_threshold:
            score += 20
            matched.append("7d trend up")
            explanations.append("7 日动量满足当前趋势配置要求。")
        elif seven_day_change >= seven_day_soft:
            score += 10
    else:
        missing.append("seven_day_change_pct")

    thirty_day_change = metrics.get("thirty_day_change_pct")
    thirty_day_threshold = _level_threshold(momentum_level, low=5, medium=10, high=15)
    thirty_day_soft = _level_threshold(momentum_level, low=0, medium=0, high=5)
    if isinstance(thirty_day_change, (int, float)):
        if thirty_day_change >= thirty_day_threshold:
            score += 20
            matched.append("30d trend up")
            explanations.append("30 日趋势仍符合当前动量档位。")
        elif thirty_day_change >= thirty_day_soft:
            score += 10
    else:
        missing.append("thirty_day_change_pct")

    avg_volume = metrics.get("avg_volume")
    liquidity_full = _level_threshold(liquidity_level, low=80_000_000, medium=150_000_000, high=250_000_000)
    liquidity_soft = _level_threshold(liquidity_level, low=30_000_000, medium=50_000_000, high=100_000_000)
    if isinstance(avg_volume, (int, float)):
        if avg_volume >= liquidity_full:
            score += 18
            matched.append("high liquidity")
            explanations.append("流动性满足当前趋势币筛选档位。")
        elif avg_volume >= liquidity_soft:
            score += 10
    else:
        missing.append("avg_volume")

    volatility = metrics.get("volatility_pct")
    volatility_full = _level_threshold(volatility_level, low=90, medium=120, high=150)
    volatility_soft = _level_threshold(volatility_level, low=140, medium=180, high=220)
    if isinstance(volatility, (int, float)):
        if volatility <= volatility_full:
            score += 14
            matched.append("volatility controlled")
            explanations.append("波动率仍处于当前容忍档位内。")
        elif volatility <= volatility_soft:
            score += 8
    else:
        missing.append("volatility_pct")

    history_points = metrics.get("history_points")
    history_requirement = int(_level_threshold(momentum_level, low=45, medium=60, high=75))
    if isinstance(history_points, int):
        if history_points >= history_requirement:
            score += 10
        else:
            missing.append("price_history")

    if not _coerce_attr(workspace, "stale", False):
        score += 10
    else:
        explanations.append("趋势分数当前依赖缓存行情，正式执行前仍应刷新。")

    return min(round(score, 1), 100.0), matched, explanations, missing, metrics


def _score_majors_crypto(
    workspace: Any,
    tuning: dict[str, str],
) -> tuple[float, list[str], list[str], list[str], dict[str, float | int | str]]:
    metrics = _build_metrics(workspace)
    matched: list[str] = []
    explanations: list[str] = []
    missing: list[str] = []
    score = 0.0

    liquidity_level = tuning["liquidity_bias"]
    trend_level = tuning["trend_requirement"]
    exhaustion_level = tuning["exhaustion_guardrail"]

    avg_volume = metrics.get("avg_volume")
    liquidity_bands = _pick_level_config(
        liquidity_level,
        low=((250_000_000, 24, "majors liquidity"), (80_000_000, 16, "liquid large-cap"), (0, 8, "tradable crypto")),
        medium=((500_000_000, 24, "institutional liquidity"), (150_000_000, 16, "liquid majors"), (0, 8, "tradable crypto")),
        high=((750_000_000, 24, "top-tier liquidity"), (250_000_000, 16, "deep majors liquidity"), (0, 8, "tradable crypto")),
    )
    if isinstance(avg_volume, (int, float)):
        for threshold, weight, label in liquidity_bands:
            if avg_volume >= threshold:
                score += weight
                matched.append(label)
                explanations.append("成交深度满足当前主流币流动性档位。")
                break
    else:
        missing.append("avg_volume")

    thirty_day_change = metrics.get("thirty_day_change_pct")
    trend_full = _level_threshold(trend_level, low=2, medium=5, high=8)
    trend_soft = _level_threshold(trend_level, low=-3, medium=0, high=2)
    if isinstance(thirty_day_change, (int, float)):
        if thirty_day_change >= trend_full:
            score += 18
            matched.append("30d strength")
            explanations.append("30 日强度仍符合当前主流币趋势档位。")
        elif thirty_day_change >= trend_soft:
            score += 10
    else:
        missing.append("thirty_day_change_pct")

    change_pct = metrics.get("change_pct")
    exhaustion_cap = _level_threshold(exhaustion_level, low=12, medium=8, high=6)
    if isinstance(change_pct, (int, float)):
        if abs(change_pct) <= exhaustion_cap:
            score += 12
            matched.append("24h move not blown out")
            explanations.append("24 小时波动尚未达到过热警戒线。")

    seven_day_change = metrics.get("seven_day_change_pct")
    seven_day_floor = _level_threshold(trend_level, low=-2, medium=0, high=2)
    if isinstance(seven_day_change, (int, float)):
        if seven_day_change >= seven_day_floor:
            score += 10
    else:
        missing.append("seven_day_change_pct")

    volatility = metrics.get("volatility_pct")
    volatility_full = _level_threshold(exhaustion_level, low=160, medium=130, high=110)
    volatility_soft = _level_threshold(exhaustion_level, low=230, medium=200, high=170)
    if isinstance(volatility, (int, float)):
        if volatility <= volatility_full:
            score += 16
            matched.append("volatility acceptable")
            explanations.append("波动率仍在当前主流币护栏以内。")
        elif volatility <= volatility_soft:
            score += 8
    else:
        missing.append("volatility_pct")

    history_points = metrics.get("history_points")
    history_requirement = int(_level_threshold(trend_level, low=60, medium=90, high=120))
    if isinstance(history_points, int):
        if history_points >= history_requirement:
            score += 10
        else:
            missing.append("price_history")

    if not _coerce_attr(workspace, "stale", False):
        score += 10
    else:
        explanations.append("当前主流币分数依赖缓存数据，正式判断前建议刷新。")

    return min(round(score, 1), 100.0), matched, explanations, missing, metrics


PRESET_SCORERS = {
    "quality-equities": _score_quality_equities,
    "growth-rebound": _score_growth_rebound,
    "trend-crypto": _score_trend_crypto,
    "majors-crypto": _score_majors_crypto,
}


def _universe_label(universe_key: str, asset_type: str, evaluated_count: int) -> str:
    if universe_key == "expanded":
        if asset_type == "equity":
            return f"Expanded equity + ETF universe ({evaluated_count} tracked names)"
        if asset_type == "crypto":
            return f"Expanded Binance majors universe ({evaluated_count} tracked pairs)"
    if asset_type == "equity":
        return f"Catalog-only equity universe ({evaluated_count} searchable names)"
    return f"Catalog-only crypto universe ({evaluated_count} searchable pairs)"


def _data_source_note(universe_key: str) -> str:
    if universe_key == "expanded":
        return (
            "This run uses a repo-maintained expanded universe. It stays intentionally bounded and does not perform "
            "full-market discovery, so the desktop/runtime contract remains predictable."
        )
    return (
        "This run uses the stable searchable catalog as a fallback universe. Switch to the expanded universe when you "
        "want broader but still controlled coverage."
    )


class ScreenerService:
    def __init__(self, sqlite_store: SqliteStore, asset_service: AssetService) -> None:
        self.sqlite_store = sqlite_store
        self.asset_service = asset_service
        self.factor_service: Any | None = None
        self.universe_sources: dict[str, UniverseSource] = {
            "catalog": CatalogUniverseSource(),
            "expanded": ExpandedUniverseSource(),
        }

    def attach_factor_service(self, factor_service: Any) -> None:
        self.factor_service = factor_service

    def _factor_context_for_symbol(self, symbol: str):
        if self.factor_service is None:
            return None
        for item in self.factor_service.list_recent_runs(20):
            context = self.factor_service.get_research_context(item.run_id, symbol)
            if context is not None:
                return context
        return None

    def get_presets(self) -> list[ScreenerPreset]:
        return [ScreenerPreset.model_validate(item) for item in self.sqlite_store.list_screener_presets()]

    def get_variants(self, preset_key: str) -> list[ScreenerPresetVariant]:
        preset = self.sqlite_store.get_screener_preset(preset_key)
        if preset is None:
            raise ValueError(f"Screener preset not found: {preset_key}")
        return [
            ScreenerPresetVariant.model_validate(item)
            for item in self.sqlite_store.list_screener_preset_variants(preset_key)
        ]

    def create_variant(
        self,
        preset_key: str,
        payload: CreateScreenerPresetVariantRequest,
    ) -> ScreenerPresetVariant:
        preset = self.sqlite_store.get_screener_preset(preset_key)
        if preset is None:
            raise ValueError(f"Screener preset not found: {preset_key}")

        source_variant = self.sqlite_store.get_active_screener_preset_variant(preset_key)
        if source_variant is None:
            raise ValueError(f"Active screener variant not found for preset: {preset_key}")

        description = payload.description.strip() if payload.description else f"从 {source_variant['name']} 复制的自定义配置。"
        variant = self.sqlite_store.create_screener_preset_variant(
            preset_key,
            variant_key=f"custom-{uuid4().hex[:8]}",
            name=payload.name.strip(),
            description=description,
            tuning=source_variant["tuning"],
            filters=build_variant_filters(preset_key, source_variant["tuning"]),
            is_system_default=False,
            is_active=False,
            last_hit_count=source_variant["last_hit_count"],
        )
        return ScreenerPresetVariant.model_validate(variant)

    def update_variant(
        self,
        preset_key: str,
        variant_key: str,
        payload: UpdateScreenerPresetVariantRequest,
    ) -> ScreenerPresetVariant:
        current = self.sqlite_store.get_screener_preset_variant(preset_key, variant_key)
        if current is None:
            raise ValueError(f"Screener variant not found: {preset_key}/{variant_key}")

        if current["is_system_default"] and (
            payload.name is not None or payload.description is not None or payload.tuning is not None
        ):
            raise ValueError("System default screener variants are read-only")

        next_tuning = normalize_tuning(preset_key, payload.tuning or current["tuning"])
        updated = self.sqlite_store.update_screener_preset_variant(
            preset_key,
            variant_key,
            name=payload.name.strip() if payload.name is not None else None,
            description=payload.description.strip() if payload.description is not None else None,
            tuning=next_tuning,
            filters=build_variant_filters(preset_key, next_tuning),
        )
        if updated is None:
            raise ValueError(f"Screener variant not found: {preset_key}/{variant_key}")
        return ScreenerPresetVariant.model_validate(updated)

    def activate_variant(self, preset_key: str, variant_key: str) -> ScreenerPresetVariant:
        updated = self.sqlite_store.activate_screener_preset_variant(preset_key, variant_key)
        if updated is None:
            raise ValueError(f"Screener variant not found: {preset_key}/{variant_key}")
        return ScreenerPresetVariant.model_validate(updated)

    def delete_variant(self, preset_key: str, variant_key: str) -> None:
        deleted = self.sqlite_store.delete_screener_preset_variant(preset_key, variant_key)
        if not deleted:
            raise ValueError(f"Screener variant not found: {preset_key}/{variant_key}")

    def update_preset(self, preset_key: str, payload: UpdateScreenerPresetRequest) -> ScreenerPreset:
        updated = self.sqlite_store.update_screener_preset(
            preset_key,
            title=payload.title,
            badge=payload.badge,
            description=payload.description,
            filters=payload.filters,
            asset_type=payload.asset_type,
        )
        if updated is None:
            raise ValueError(f"Screener preset not found: {preset_key}")
        return ScreenerPreset.model_validate(updated)

    def _score_workspace(
        self,
        preset_key: str,
        workspace: Any,
        tuning: dict[str, str],
    ) -> tuple[float, list[str], list[str], list[str], dict[str, float | int | str]]:
        scorer = PRESET_SCORERS.get(preset_key)
        if scorer is None:
            raise ValueError(f"Unsupported screener preset: {preset_key}")
        return scorer(workspace, tuning)

    def run(self, payload: ScreenerRunRequest) -> ScreenerRunResponse:
        preset = self.sqlite_store.get_screener_preset(payload.preset)
        if preset is None:
            raise ValueError(f"Screener preset not found: {payload.preset}")

        source = self.universe_sources.get(payload.universe_source)
        if source is None:
            raise ValueError(f"Unsupported universe source: {payload.universe_source}")

        variant = (
            self.sqlite_store.get_screener_preset_variant(payload.preset, payload.variant_key)
            if payload.variant_key
            else self.sqlite_store.get_active_screener_preset_variant(payload.preset)
        )
        if variant is None:
            raise ValueError(f"Screener variant not found: {payload.preset}/{payload.variant_key or 'active'}")

        tuning = normalize_tuning(payload.preset, variant["tuning"])
        asset_type = payload.asset_type or preset["asset_type"]
        results: list[ScreenerResult] = []

        for entry in source.assets_for(asset_type):
            try:
                workspace = self.asset_service.get_asset_workspace(
                    entry.symbol,
                    cache_only=not bool(getattr(self.asset_service, "explicit_fixture_mode", False)),
                )
                score, matched, explanations, missing, metrics = self._score_workspace(preset["key"], workspace, tuning)
                notes = list(_coerce_attr(_coerce_attr(workspace, "capabilities"), "notes", []))
                if _coerce_attr(workspace, "stale", False):
                    _append_metric(notes, "Some fields are currently served from cache.")
                if not explanations:
                    explanations.append("This name is still being tracked, but the current profile evidence is limited.")

                results.append(
                    ScreenerResult(
                        symbol=entry.symbol,
                        name=entry.name,
                        market=entry.market,
                        asset_class=entry.asset_class,
                        price=float(_coerce_attr(_coerce_attr(workspace, "quote"), "price", 0.0)),
                        change_pct=float(_coerce_attr(_coerce_attr(workspace, "quote"), "change_pct", 0.0)),
                        score=score,
                        score_label=_score_label(score),
                        stale=bool(_coerce_attr(workspace, "stale", False)),
                        data_source=str(_coerce_attr(_coerce_attr(workspace, "asset"), "provider", entry.provider)),
                        matched_rules=matched,
                        explanations=explanations,
                        missing_metrics=missing,
                        notes=notes,
                        metrics=metrics,
                        factor_context=self._factor_context_for_symbol(entry.symbol),
                        data_quality=quality_from_missing_and_stale(
                            provider=str(_coerce_attr(_coerce_attr(workspace, "asset"), "provider", entry.provider)),
                            stale=bool(_coerce_attr(workspace, "stale", False)),
                            missing_items=missing,
                            limitations=notes,
                        ),
                    )
                )
            except Exception as error:
                results.append(
                    ScreenerResult(
                        symbol=entry.symbol,
                        name=entry.name,
                        market=entry.market,
                        asset_class=entry.asset_class,
                        price=0.0,
                        change_pct=0.0,
                        score=0.0,
                        score_label="watch",
                        stale=True,
                        data_source=entry.provider,
                        matched_rules=[],
                        explanations=["Provider data is currently unavailable, so this name stays on watch only."],
                        missing_metrics=["provider_data"],
                        notes=[f"Provider data unavailable: {error}"],
                        metrics={},
                        factor_context=self._factor_context_for_symbol(entry.symbol),
                        data_quality=quality_from_missing_and_stale(
                            provider=entry.provider,
                            stale=True,
                            missing_items=["provider_data"],
                            limitations=[f"Provider data unavailable: {error}"],
                            unavailable=True,
                        ),
                    )
                )

        results.sort(key=lambda item: (-item.score, item.stale, item.symbol))
        hit_count = sum(1 for item in results if item.score_label != "watch")
        self.sqlite_store.update_screener_preset_variant(
            payload.preset,
            variant["variant_key"],
            last_hit_count=hit_count,
        )
        if variant["is_active"]:
            self.sqlite_store.update_screener_preset(preset["key"], hit_count=hit_count)

        return ScreenerRunResponse(
            preset=preset["key"],
            asset_type=asset_type,
            universe_source=payload.universe_source,
            variant_key=variant["variant_key"],
            variant_name=variant["name"],
            evaluated_count=len(results),
            hit_count=hit_count,
            universe_label=_universe_label(payload.universe_source, asset_type, len(results)),
            results=results,
            data_source_note=_data_source_note(payload.universe_source),
        )
