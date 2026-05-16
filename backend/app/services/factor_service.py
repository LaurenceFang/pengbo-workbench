from __future__ import annotations

from datetime import UTC, datetime
from math import sqrt
from statistics import mean, pstdev
from typing import Any
from uuid import uuid4

from ..data_seed import AssetCatalogEntry
from ..models import (
    FactorContribution,
    FactorFamilyDefinition,
    FactorFamilyKey,
    FactorResult,
    FactorRunListItem,
    FactorRunRequest,
    FactorRunResponse,
    PortfolioValuePoint,
    ResearchFactorContext,
    ResearchFactorContribution,
)
from ..storage.duckdb_store import DuckDbStore
from .asset_service import AssetService
from .screener_service import ScreenerService


FAMILY_DEFINITIONS: tuple[FactorFamilyDefinition, ...] = (
    FactorFamilyDefinition(
        key="momentum_12_1",
        label="12-1 Momentum",
        description="Ranks assets by trailing 12-month price strength while skipping the most recent month.",
        simple_description="观察过去一年中较持久的价格强势。",
        required_metrics=["one_year_history", "price_return_12_1"],
        research_only_note="Research signal only; it is not an execution instruction.",
    ),
    FactorFamilyDefinition(
        key="value",
        label="Value",
        description="Uses local valuation ratios such as trailing P/E where available.",
        simple_description="用可得估值指标寻找相对便宜的资产。",
        required_metrics=["trailing_pe"],
        research_only_note="Low valuation can reflect real business risk and needs separate review.",
    ),
    FactorFamilyDefinition(
        key="quality_profitability",
        label="Quality / Profitability",
        description="Combines margins, return metrics, balance-sheet leverage, and local fundamentals coverage.",
        simple_description="偏好利润率、ROE 和资产回报更扎实的标的。",
        required_metrics=["gross_margin_pct", "profit_margin_pct", "return_on_equity_pct"],
        research_only_note="Quality evidence depends on local fundamental snapshots and can be incomplete.",
    ),
    FactorFamilyDefinition(
        key="conservative_growth",
        label="Conservative Growth",
        description="Prefers moderate positive trend, contained drawdown, and limited leverage.",
        simple_description="寻找上涨仍在延续但回撤不过分的成长资产。",
        required_metrics=["thirty_day_change_pct", "max_drawdown_pct", "debt_to_equity"],
        research_only_note="Growth evidence is bounded to locally available proxies in this release.",
    ),
    FactorFamilyDefinition(
        key="low_volatility_risk",
        label="Low Volatility / Risk",
        description="Scores lower realized volatility, smaller drawdowns, and stronger history coverage.",
        simple_description="偏好波动和回撤都更可控的资产。",
        required_metrics=["volatility_pct", "max_drawdown_pct", "history_points"],
        research_only_note="Lower volatility does not remove loss risk.",
    ),
    FactorFamilyDefinition(
        key="crypto_momentum_strength",
        label="Crypto Momentum Strength",
        description="Combines short and medium horizon Binance price momentum for liquid crypto pairs.",
        simple_description="衡量主流加密货币近期趋势是否真正走强。",
        required_metrics=["seven_day_change_pct", "thirty_day_change_pct"],
        research_only_note="Crypto momentum is volatile and should be reviewed with liquidity and overheat guards.",
    ),
    FactorFamilyDefinition(
        key="crypto_volume_confirmation",
        label="Crypto Volume Confirmation",
        description="Checks whether recent crypto price moves are supported by stronger traded volume.",
        simple_description="确认上涨是否伴随成交量放大，而不只是价格跳动。",
        required_metrics=["recent_volume_ratio", "thirty_day_change_pct"],
        research_only_note="Volume confirmation uses public market bars only and is not a liquidity guarantee.",
    ),
    FactorFamilyDefinition(
        key="crypto_overheat_guardrail",
        label="Crypto Overheat Guardrail",
        description="Penalizes extreme short-term crypto moves and excessive realized volatility.",
        simple_description="帮助回避短期过热、波动已经太拥挤的币种。",
        required_metrics=["seven_day_change_pct", "volatility_pct", "max_drawdown_pct"],
        research_only_note="Overheat guards can miss fast reversals and do not predict tops.",
    ),
    FactorFamilyDefinition(
        key="index_trend_breadth",
        label="Index Trend Breadth",
        description="Uses local index or ETF history to estimate broad trend health from moving-average alignment.",
        simple_description="判断大盘指数或 ETF 是否处在更健康的趋势结构里。",
        required_metrics=["above_50d_ma", "above_200d_ma", "thirty_day_change_pct"],
        research_only_note="Index trend breadth is a proxy built from available ETF or macro history.",
    ),
    FactorFamilyDefinition(
        key="index_defensive_quality",
        label="Index Defensive Quality",
        description="Scores index or ETF proxies by drawdown control, volatility, and trend persistence.",
        simple_description="偏好回撤较浅、波动更稳的大盘代理资产。",
        required_metrics=["volatility_pct", "max_drawdown_pct", "quarter_change_pct"],
        research_only_note="Defensive quality is a risk screen, not a hedge guarantee.",
    ),
    FactorFamilyDefinition(
        key="short_term_reversal",
        label="Short-Term Reversal",
        description="Looks for recent pullbacks inside assets that still retain medium-term support.",
        simple_description="寻找中期趋势尚可但短期回撤后的反转候选。",
        required_metrics=["five_day_change_pct", "thirty_day_change_pct"],
        research_only_note="Short-term reversal is timing-sensitive and should be paired with risk controls.",
    ),
    FactorFamilyDefinition(
        key="composite",
        label="Composite",
        description="Blends only factor families with enough evidence and reports coverage explicitly.",
        simple_description="把当前可用因子合成为一个研究排序。",
        required_metrics=["available_family_scores"],
        research_only_note="Composite rank is a research triage tool, not a trading recommendation.",
    ),
)

FAMILY_LABELS = {item.key: item.label for item in FAMILY_DEFINITIONS}
COMPOSITE_WEIGHTS: dict[FactorFamilyKey, float] = {
    "momentum_12_1": 0.22,
    "value": 0.18,
    "quality_profitability": 0.24,
    "conservative_growth": 0.18,
    "low_volatility_risk": 0.18,
    "crypto_momentum_strength": 0.16,
    "crypto_volume_confirmation": 0.12,
    "crypto_overheat_guardrail": 0.12,
    "index_trend_breadth": 0.14,
    "index_defensive_quality": 0.12,
    "short_term_reversal": 0.10,
    "composite": 0.0,
}


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


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


def _history_closes(workspace: Any) -> list[float]:
    closes: list[float] = []
    for point in _coerce_attr(workspace, "history", []):
        close = _coerce_attr(point, "close")
        if close is not None:
            closes.append(float(close))
    return closes


def _history_points(workspace: Any) -> list[tuple[str, float]]:
    points: list[tuple[str, float]] = []
    for point in _coerce_attr(workspace, "history", []):
        close = _coerce_attr(point, "close")
        timestamp = _coerce_attr(point, "timestamp")
        if close is not None and timestamp:
            points.append((str(timestamp)[:10], float(close)))
    return points


def _ratio_lookup(workspace: Any) -> dict[str, float]:
    lookup: dict[str, float] = {}
    for ratio in _coerce_attr(workspace, "ratios", []):
        label = _coerce_attr(ratio, "label")
        value = _parse_ratio_value(_coerce_attr(ratio, "value"))
        if label and value is not None:
            lookup[str(label)] = value
    return lookup


def _percent_return(closes: list[float], lookback_days: int) -> float | None:
    if len(closes) <= lookback_days:
        return None
    start = closes[-lookback_days - 1]
    end = closes[-1]
    if start == 0:
        return None
    return ((end / start) - 1) * 100


def _momentum_12_1(closes: list[float]) -> float | None:
    if len(closes) < 253:
        return None
    start = closes[-253]
    end = closes[-22]
    if start == 0:
        return None
    return ((end / start) - 1) * 100


def _max_drawdown_pct(closes: list[float], lookback_days: int = 252) -> float | None:
    if len(closes) < 2:
        return None
    window = closes[-lookback_days:] if len(closes) > lookback_days else closes
    peak = window[0]
    max_drawdown = 0.0
    for close in window:
        peak = max(peak, close)
        if peak:
            max_drawdown = max(max_drawdown, ((peak - close) / peak) * 100)
    return max_drawdown


def _annualized_volatility_pct(closes: list[float], periods_per_year: int = 252) -> float | None:
    if len(closes) < 3:
        return None
    returns = [(current / previous) - 1 for previous, current in zip(closes[:-1], closes[1:]) if previous]
    if len(returns) < 2:
        return None
    return pstdev(returns) * sqrt(periods_per_year) * 100


def _moving_average(closes: list[float], window: int) -> float | None:
    if len(closes) < window:
        return None
    return mean(closes[-window:])


def _recent_volume_ratio(volumes: list[float], recent_days: int = 7, baseline_days: int = 30) -> float | None:
    if len(volumes) < recent_days + baseline_days:
        return None
    recent = mean(volumes[-recent_days:])
    baseline = mean(volumes[-(recent_days + baseline_days):-recent_days])
    if baseline <= 0:
        return None
    return recent / baseline


def _clamp_score(value: float) -> float:
    return round(max(0.0, min(value, 100.0)), 1)


def _score_inverse(value: float, *, excellent: float, poor: float) -> float:
    if value <= excellent:
        return 92.0
    if value >= poor:
        return 20.0
    return 92.0 - ((value - excellent) / (poor - excellent)) * 72.0


def _score_positive(value: float, *, poor: float, excellent: float) -> float:
    if value <= poor:
        return 20.0
    if value >= excellent:
        return 92.0
    return 20.0 + ((value - poor) / (excellent - poor)) * 72.0


class FactorService:
    def __init__(
        self,
        duck_store: DuckDbStore,
        asset_service: AssetService,
        screener_service: ScreenerService,
    ) -> None:
        self.duck_store = duck_store
        self.asset_service = asset_service
        self.screener_service = screener_service

    def list_families(self) -> list[FactorFamilyDefinition]:
        return list(FAMILY_DEFINITIONS)

    def list_recent_runs(self, limit: int = 20) -> list[FactorRunListItem]:
        return [FactorRunListItem.model_validate(item) for item in self.duck_store.list_recent_factor_snapshots(limit)]

    def get_run(self, run_id: str) -> FactorRunResponse:
        snapshot = self.duck_store.get_factor_snapshot(run_id)
        if snapshot is None:
            raise ValueError(f"Factor run not found: {run_id}")
        return FactorRunResponse.model_validate(snapshot)

    def get_research_context(self, run_id: str, symbol: str) -> ResearchFactorContext | None:
        snapshot = self.duck_store.get_factor_snapshot(run_id)
        if snapshot is None:
            return None
        result = next((item for item in snapshot.get("results", []) if item.get("symbol") == symbol), None)
        if result is None:
            return None
        return ResearchFactorContext(
            run_id=snapshot["run_id"],
            family=snapshot["family"],
            universe_source=snapshot["universe_source"],
            asset_type=snapshot["asset_type"],
            as_of=snapshot["as_of"],
            symbol=symbol,
            rank=result.get("rank"),
            percentile=result.get("percentile"),
            composite_score=result.get("composite_score"),
            bucket=result.get("bucket", "insufficient"),
            missing_data=list(result.get("missing_data", [])),
            contributions=[
                ResearchFactorContribution.model_validate(item)
                for item in result.get("contributions", [])
            ],
        )

    def run(self, payload: FactorRunRequest) -> FactorRunResponse:
        source = self.screener_service.universe_sources.get(payload.universe_source)
        if source is None:
            raise ValueError(f"Unsupported universe source: {payload.universe_source}")

        as_of = _utc_now_iso()
        run_id = f"factor-{uuid4().hex[:12]}"
        entries = source.assets_for(payload.asset_type)
        results: list[FactorResult] = []
        source_timestamps: dict[str, str | None] = {}
        diagnostics = {
            "research_only": True,
            "unsupported_execution": "No orders, broker calls, or strategy deployment are performed by Factor Lab.",
            "family": payload.family,
            "asset_type": payload.asset_type,
            "universe_note": "Controlled local universe; this is not full-market discovery.",
        }

        for entry in entries:
            result = self._score_entry(entry, payload.family)
            source_timestamps[entry.symbol] = result.metrics.get("latest_price_timestamp") if result.metrics else None
            results.append(result)

        ranked = [item for item in results if item.composite_score is not None]
        ranked.sort(key=lambda item: (-(item.composite_score or 0), item.symbol))
        ranked_count = len(ranked)
        for index, item in enumerate(ranked, start=1):
            item.rank = index
            item.percentile = round(((ranked_count - index + 1) / ranked_count) * 100, 1) if ranked_count else None
        results.sort(key=lambda item: (item.rank is None, item.rank or 9999, item.symbol))
        bucket_counts: dict[str, int] = {}
        for item in results:
            bucket_counts[item.bucket] = bucket_counts.get(item.bucket, 0) + 1

        response = FactorRunResponse(
            run_id=run_id,
            universe_source=payload.universe_source,
            asset_type=payload.asset_type,
            family=payload.family,
            as_of=as_of,
            evaluated_count=len(entries),
            result_count=len(results),
            source_timestamps=source_timestamps,
            diagnostics={
                **diagnostics,
                "ranked_count": ranked_count,
                "insufficient_count": len(results) - ranked_count,
                "bucket_counts": bucket_counts,
            },
            results=results,
        )
        self.duck_store.put_factor_snapshot(response.model_dump(mode="json"))
        return response

    def _score_entry(self, entry: AssetCatalogEntry, family: FactorFamilyKey) -> FactorResult:
        try:
            workspace = self.asset_service.get_asset_workspace(entry.symbol)
            metrics = self._build_metrics(workspace)
            contributions = self._build_contributions(metrics)
            selected = contributions if family == "composite" else [item for item in contributions if item.family == family]
            score = self._composite_score(selected)
            missing_data = sorted({metric for item in selected for metric in item.missing_metrics})
            if family == "composite":
                metrics["factor_coverage"] = len([item for item in selected if item.score is not None])
                if metrics["factor_coverage"] == 0:
                    missing_data.append("available_family_scores")

            return FactorResult(
                symbol=entry.symbol,
                name=entry.name,
                market=entry.market,
                asset_class=entry.asset_class,
                composite_score=score,
                bucket=self._bucket(score),
                stale=bool(_coerce_attr(workspace, "stale", False)),
                data_source=str(_coerce_attr(_coerce_attr(workspace, "asset"), "provider", entry.provider)),
                price=metrics.get("price") if isinstance(metrics.get("price"), (int, float)) else None,
                change_pct=metrics.get("change_pct") if isinstance(metrics.get("change_pct"), (int, float)) else None,
                metrics=metrics,
                contributions=selected,
                missing_data=missing_data,
                notes=self._notes(workspace, missing_data),
                score_history=self._score_history(workspace),
            )
        except Exception as error:
            return FactorResult(
                symbol=entry.symbol,
                name=entry.name,
                market=entry.market,
                asset_class=entry.asset_class,
                composite_score=None,
                bucket="insufficient",
                stale=True,
                data_source=entry.provider,
                missing_data=["provider_data"],
                notes=[f"Provider data unavailable: {error}"],
            )

    def _build_metrics(self, workspace: Any) -> dict[str, Any]:
        quote = _coerce_attr(workspace, "quote")
        ratios = _ratio_lookup(workspace)
        closes = _history_closes(workspace)
        volumes = [
            float(_coerce_attr(point, "volume", 0.0) or 0.0)
            for point in _coerce_attr(workspace, "history", [])
        ]
        metrics: dict[str, Any] = {
            "price": round(float(_coerce_attr(quote, "price", 0.0)), 2),
            "change_pct": round(float(_coerce_attr(quote, "change_pct", 0.0)), 2),
            "history_points": len(closes),
            "latest_price_timestamp": _coerce_attr(quote, "as_of") or _coerce_attr(workspace, "updated_at"),
        }
        for label, key in (
            ("Trailing P/E", "trailing_pe"),
            ("Gross Margin", "gross_margin_pct"),
            ("Operating Margin", "operating_margin_pct"),
            ("Profit Margin", "profit_margin_pct"),
            ("Return on Assets", "return_on_assets_pct"),
            ("Return on Equity", "return_on_equity_pct"),
            ("Debt/Equity", "debt_to_equity"),
        ):
            value = ratios.get(label)
            if value is not None:
                metrics[key] = round(value, 2)

        for lookback, key in (
            (5, "five_day_change_pct"),
            (7, "seven_day_change_pct"),
            (30, "thirty_day_change_pct"),
            (63, "quarter_change_pct"),
            (252, "one_year_change_pct"),
        ):
            value = _percent_return(closes, lookback)
            if value is not None:
                metrics[key] = round(value, 2)

        momentum = _momentum_12_1(closes)
        if momentum is not None:
            metrics["momentum_12_1_pct"] = round(momentum, 2)
        drawdown = _max_drawdown_pct(closes)
        if drawdown is not None:
            metrics["max_drawdown_pct"] = round(drawdown, 2)
        volatility = _annualized_volatility_pct(closes)
        if volatility is not None:
            metrics["volatility_pct"] = round(volatility, 2)
        ma50 = _moving_average(closes, 50)
        ma200 = _moving_average(closes, 200)
        latest = closes[-1] if closes else None
        if latest is not None and ma50 is not None:
            metrics["above_50d_ma"] = latest >= ma50
            metrics["distance_to_50d_ma_pct"] = round(((latest / ma50) - 1) * 100, 2) if ma50 else None
        if latest is not None and ma200 is not None:
            metrics["above_200d_ma"] = latest >= ma200
            metrics["distance_to_200d_ma_pct"] = round(((latest / ma200) - 1) * 100, 2) if ma200 else None
        volume_ratio = _recent_volume_ratio(volumes)
        if volume_ratio is not None:
            metrics["recent_volume_ratio"] = round(volume_ratio, 2)
        return metrics

    def _build_contributions(self, metrics: dict[str, Any]) -> list[FactorContribution]:
        return [
            self._momentum_contribution(metrics),
            self._value_contribution(metrics),
            self._quality_contribution(metrics),
            self._growth_contribution(metrics),
            self._risk_contribution(metrics),
            self._crypto_momentum_contribution(metrics),
            self._crypto_volume_contribution(metrics),
            self._crypto_overheat_contribution(metrics),
            self._index_trend_contribution(metrics),
            self._index_defensive_contribution(metrics),
            self._short_term_reversal_contribution(metrics),
        ]

    def _momentum_contribution(self, metrics: dict[str, Any]) -> FactorContribution:
        value = metrics.get("momentum_12_1_pct")
        if not isinstance(value, (int, float)):
            return self._missing("momentum_12_1", ["one_year_history", "price_return_12_1"])
        score = _clamp_score(_score_positive(value, poor=-25, excellent=35))
        return FactorContribution(
            family="momentum_12_1",
            label=FAMILY_LABELS["momentum_12_1"],
            score=score,
            weight=COMPOSITE_WEIGHTS["momentum_12_1"],
            evidence=[f"12-1 momentum is {value:.2f}%."],
        )

    def _value_contribution(self, metrics: dict[str, Any]) -> FactorContribution:
        trailing_pe = metrics.get("trailing_pe")
        if not isinstance(trailing_pe, (int, float)):
            return self._missing("value", ["trailing_pe"])
        score = _clamp_score(_score_inverse(trailing_pe, excellent=12, poor=55))
        return FactorContribution(
            family="value",
            label=FAMILY_LABELS["value"],
            score=score,
            weight=COMPOSITE_WEIGHTS["value"],
            evidence=[f"Trailing P/E is {trailing_pe:.2f}x."],
        )

    def _quality_contribution(self, metrics: dict[str, Any]) -> FactorContribution:
        components: list[float] = []
        evidence: list[str] = []
        missing: list[str] = []
        for key, label, poor, excellent in (
            ("gross_margin_pct", "Gross margin", 20, 60),
            ("profit_margin_pct", "Profit margin", 5, 30),
            ("return_on_equity_pct", "ROE", 5, 35),
            ("return_on_assets_pct", "ROA", 2, 18),
        ):
            value = metrics.get(key)
            if isinstance(value, (int, float)):
                components.append(_score_positive(value, poor=poor, excellent=excellent))
                evidence.append(f"{label} is {value:.2f}%.")
            else:
                missing.append(key)
        debt = metrics.get("debt_to_equity")
        if isinstance(debt, (int, float)):
            components.append(_score_inverse(debt, excellent=0.2, poor=2.2))
            evidence.append(f"Debt/equity is {debt:.2f}x.")
        else:
            missing.append("debt_to_equity")
        if not components:
            return self._missing("quality_profitability", missing)
        return FactorContribution(
            family="quality_profitability",
            label=FAMILY_LABELS["quality_profitability"],
            score=_clamp_score(mean(components)),
            weight=COMPOSITE_WEIGHTS["quality_profitability"],
            evidence=evidence,
            missing_metrics=missing,
        )

    def _growth_contribution(self, metrics: dict[str, Any]) -> FactorContribution:
        components: list[float] = []
        evidence: list[str] = []
        missing: list[str] = []
        change = metrics.get("thirty_day_change_pct")
        if isinstance(change, (int, float)):
            trend_score = 92.0 - min(abs(change - 8.0), 28.0) / 28.0 * 72.0
            components.append(trend_score)
            evidence.append(f"30-day change is {change:.2f}%.")
        else:
            missing.append("thirty_day_change_pct")
        drawdown = metrics.get("max_drawdown_pct")
        if isinstance(drawdown, (int, float)):
            components.append(_score_inverse(drawdown, excellent=8, poor=45))
            evidence.append(f"Max drawdown is {drawdown:.2f}%.")
        else:
            missing.append("max_drawdown_pct")
        debt = metrics.get("debt_to_equity")
        if isinstance(debt, (int, float)):
            components.append(_score_inverse(debt, excellent=0.3, poor=2.5))
            evidence.append(f"Debt/equity guardrail is {debt:.2f}x.")
        else:
            missing.append("debt_to_equity")
        if not components:
            return self._missing("conservative_growth", missing)
        return FactorContribution(
            family="conservative_growth",
            label=FAMILY_LABELS["conservative_growth"],
            score=_clamp_score(mean(components)),
            weight=COMPOSITE_WEIGHTS["conservative_growth"],
            evidence=evidence,
            missing_metrics=missing,
        )

    def _risk_contribution(self, metrics: dict[str, Any]) -> FactorContribution:
        components: list[float] = []
        evidence: list[str] = []
        missing: list[str] = []
        volatility = metrics.get("volatility_pct")
        if isinstance(volatility, (int, float)):
            components.append(_score_inverse(volatility, excellent=14, poor=75))
            evidence.append(f"Annualized volatility is {volatility:.2f}%.")
        else:
            missing.append("volatility_pct")
        drawdown = metrics.get("max_drawdown_pct")
        if isinstance(drawdown, (int, float)):
            components.append(_score_inverse(drawdown, excellent=8, poor=45))
            evidence.append(f"Max drawdown is {drawdown:.2f}%.")
        else:
            missing.append("max_drawdown_pct")
        history_points = metrics.get("history_points")
        if isinstance(history_points, int):
            components.append(92.0 if history_points >= 252 else _score_positive(history_points, poor=30, excellent=252))
            evidence.append(f"History coverage has {history_points} points.")
        else:
            missing.append("history_points")
        if not components:
            return self._missing("low_volatility_risk", missing)
        return FactorContribution(
            family="low_volatility_risk",
            label=FAMILY_LABELS["low_volatility_risk"],
            score=_clamp_score(mean(components)),
            weight=COMPOSITE_WEIGHTS["low_volatility_risk"],
            evidence=evidence,
            missing_metrics=missing,
        )

    def _crypto_momentum_contribution(self, metrics: dict[str, Any]) -> FactorContribution:
        seven_day = metrics.get("seven_day_change_pct")
        thirty_day = metrics.get("thirty_day_change_pct")
        missing = [
            key
            for key, value in (("seven_day_change_pct", seven_day), ("thirty_day_change_pct", thirty_day))
            if not isinstance(value, (int, float))
        ]
        if missing:
            return self._missing("crypto_momentum_strength", missing)
        score = mean([
            _score_positive(float(seven_day), poor=-10, excellent=18),
            _score_positive(float(thirty_day), poor=-20, excellent=45),
        ])
        return FactorContribution(
            family="crypto_momentum_strength",
            label=FAMILY_LABELS["crypto_momentum_strength"],
            score=_clamp_score(score),
            weight=COMPOSITE_WEIGHTS["crypto_momentum_strength"],
            evidence=[f"7-day change is {seven_day:.2f}%.", f"30-day change is {thirty_day:.2f}%."],
        )

    def _crypto_volume_contribution(self, metrics: dict[str, Any]) -> FactorContribution:
        volume_ratio = metrics.get("recent_volume_ratio")
        change = metrics.get("thirty_day_change_pct")
        missing = [
            key
            for key, value in (("recent_volume_ratio", volume_ratio), ("thirty_day_change_pct", change))
            if not isinstance(value, (int, float))
        ]
        if missing:
            return self._missing("crypto_volume_confirmation", missing)
        volume_score = _score_positive(float(volume_ratio), poor=0.65, excellent=1.8)
        trend_score = _score_positive(float(change), poor=-12, excellent=35)
        return FactorContribution(
            family="crypto_volume_confirmation",
            label=FAMILY_LABELS["crypto_volume_confirmation"],
            score=_clamp_score(mean([volume_score, trend_score])),
            weight=COMPOSITE_WEIGHTS["crypto_volume_confirmation"],
            evidence=[f"Recent volume is {volume_ratio:.2f}x the prior baseline.", f"30-day change is {change:.2f}%."],
        )

    def _crypto_overheat_contribution(self, metrics: dict[str, Any]) -> FactorContribution:
        seven_day = metrics.get("seven_day_change_pct")
        volatility = metrics.get("volatility_pct")
        drawdown = metrics.get("max_drawdown_pct")
        missing = [
            key
            for key, value in (
                ("seven_day_change_pct", seven_day),
                ("volatility_pct", volatility),
                ("max_drawdown_pct", drawdown),
            )
            if not isinstance(value, (int, float))
        ]
        if missing:
            return self._missing("crypto_overheat_guardrail", missing)
        heat_score = _score_inverse(abs(float(seven_day)), excellent=4, poor=42)
        vol_score = _score_inverse(float(volatility), excellent=45, poor=180)
        drawdown_score = _score_inverse(float(drawdown), excellent=12, poor=70)
        return FactorContribution(
            family="crypto_overheat_guardrail",
            label=FAMILY_LABELS["crypto_overheat_guardrail"],
            score=_clamp_score(mean([heat_score, vol_score, drawdown_score])),
            weight=COMPOSITE_WEIGHTS["crypto_overheat_guardrail"],
            evidence=[
                f"7-day move magnitude is {abs(float(seven_day)):.2f}%.",
                f"Annualized volatility is {volatility:.2f}%.",
                f"Max drawdown is {drawdown:.2f}%.",
            ],
        )

    def _index_trend_contribution(self, metrics: dict[str, Any]) -> FactorContribution:
        above_50 = metrics.get("above_50d_ma")
        above_200 = metrics.get("above_200d_ma")
        change = metrics.get("thirty_day_change_pct")
        missing = [
            key
            for key, value in (("above_50d_ma", above_50), ("above_200d_ma", above_200), ("thirty_day_change_pct", change))
            if not isinstance(value, (bool, int, float))
        ]
        if missing:
            return self._missing("index_trend_breadth", missing)
        components = [
            88.0 if bool(above_50) else 28.0,
            92.0 if bool(above_200) else 24.0,
            _score_positive(float(change), poor=-12, excellent=18),
        ]
        return FactorContribution(
            family="index_trend_breadth",
            label=FAMILY_LABELS["index_trend_breadth"],
            score=_clamp_score(mean(components)),
            weight=COMPOSITE_WEIGHTS["index_trend_breadth"],
            evidence=[
                f"Above 50-day average: {bool(above_50)}.",
                f"Above 200-day average: {bool(above_200)}.",
                f"30-day change is {change:.2f}%.",
            ],
        )

    def _index_defensive_contribution(self, metrics: dict[str, Any]) -> FactorContribution:
        volatility = metrics.get("volatility_pct")
        drawdown = metrics.get("max_drawdown_pct")
        quarter = metrics.get("quarter_change_pct")
        missing = [
            key
            for key, value in (("volatility_pct", volatility), ("max_drawdown_pct", drawdown), ("quarter_change_pct", quarter))
            if not isinstance(value, (int, float))
        ]
        if missing:
            return self._missing("index_defensive_quality", missing)
        return FactorContribution(
            family="index_defensive_quality",
            label=FAMILY_LABELS["index_defensive_quality"],
            score=_clamp_score(
                mean([
                    _score_inverse(float(volatility), excellent=10, poor=55),
                    _score_inverse(float(drawdown), excellent=6, poor=35),
                    _score_positive(float(quarter), poor=-10, excellent=15),
                ])
            ),
            weight=COMPOSITE_WEIGHTS["index_defensive_quality"],
            evidence=[
                f"Annualized volatility is {volatility:.2f}%.",
                f"Max drawdown is {drawdown:.2f}%.",
                f"Quarter change is {quarter:.2f}%.",
            ],
        )

    def _short_term_reversal_contribution(self, metrics: dict[str, Any]) -> FactorContribution:
        five_day = metrics.get("five_day_change_pct")
        thirty_day = metrics.get("thirty_day_change_pct")
        missing = [
            key
            for key, value in (("five_day_change_pct", five_day), ("thirty_day_change_pct", thirty_day))
            if not isinstance(value, (int, float))
        ]
        if missing:
            return self._missing("short_term_reversal", missing)
        pullback_score = 92.0 - min(abs(float(five_day) + 4.0), 18.0) / 18.0 * 72.0
        trend_support_score = _score_positive(float(thirty_day), poor=-8, excellent=22)
        return FactorContribution(
            family="short_term_reversal",
            label=FAMILY_LABELS["short_term_reversal"],
            score=_clamp_score(mean([pullback_score, trend_support_score])),
            weight=COMPOSITE_WEIGHTS["short_term_reversal"],
            evidence=[f"5-day pullback/change is {five_day:.2f}%.", f"30-day support change is {thirty_day:.2f}%."],
        )

    def _missing(self, family: FactorFamilyKey, missing_metrics: list[str]) -> FactorContribution:
        return FactorContribution(
            family=family,
            label=FAMILY_LABELS[family],
            score=None,
            weight=COMPOSITE_WEIGHTS[family],
            missing_metrics=missing_metrics,
        )

    def _composite_score(self, contributions: list[FactorContribution]) -> float | None:
        available = [item for item in contributions if item.score is not None and item.weight > 0]
        if not available:
            return None
        weight_sum = sum(item.weight for item in available)
        if weight_sum <= 0:
            return None
        return _clamp_score(sum((item.score or 0.0) * item.weight for item in available) / weight_sum)

    def _bucket(self, score: float | None) -> str:
        if score is None:
            return "insufficient"
        if score >= 75:
            return "leader"
        if score >= 55:
            return "candidate"
        return "watch"

    def _notes(self, workspace: Any, missing_data: list[str]) -> list[str]:
        notes = list(_coerce_attr(_coerce_attr(workspace, "capabilities"), "notes", []))
        if _coerce_attr(workspace, "stale", False):
            notes.append("Some factor inputs are served from the local cache.")
        if missing_data:
            notes.append(f"Missing factor inputs: {', '.join(missing_data)}.")
        return notes

    def _score_history(self, workspace: Any) -> list[PortfolioValuePoint]:
        points = _history_points(workspace)[-64:]
        if not points:
            return []
        first = points[0][1]
        if first == 0:
            return []
        return [
            PortfolioValuePoint(date=date, value=round((close / first) * 100, 2))
            for date, close in points
        ]
