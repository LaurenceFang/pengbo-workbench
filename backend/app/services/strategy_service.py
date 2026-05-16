from __future__ import annotations

from datetime import UTC, datetime
from math import sqrt
from statistics import mean, pstdev
from typing import Any
from uuid import uuid4

from ..models import (
    PortfolioValuePoint,
    StrategyBacktestListItem,
    StrategyBacktestRequest,
    StrategyBacktestResponse,
    StrategyCashLedgerEntry,
    StrategyDiagnostics,
    StrategyMetric,
    StrategyPaperFill,
    StrategyPaperOrder,
    StrategyPaperSessionListItem,
    StrategyPaperSessionRequest,
    StrategyPaperSessionResponse,
    StrategyPosition,
    StrategyReportExportResponse,
    StrategyRuleDecision,
    StrategyTemplateDefinition,
    StrategyTemplateParameter,
    StrategyTrade,
)
from ..runtime import RuntimeSettings
from ..storage.duckdb_store import DuckDbStore
from ..storage.sqlite_store import SqliteStore
from .asset_service import AssetService
from .factor_service import FAMILY_DEFINITIONS


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _round_money(value: float) -> float:
    return round(value, 2)


def _round_pct(value: float) -> float:
    return round(value, 2)


def _max_drawdown_pct(values: list[float]) -> float:
    if not values:
        return 0.0
    peak = values[0]
    drawdown = 0.0
    for value in values:
        peak = max(peak, value)
        if peak:
            drawdown = max(drawdown, ((peak - value) / peak) * 100)
    return _round_pct(drawdown)


def _annualized_volatility_pct(values: list[float]) -> float:
    returns = [(current / previous) - 1 for previous, current in zip(values[:-1], values[1:]) if previous]
    if len(returns) < 2:
        return 0.0
    return _round_pct(pstdev(returns) * sqrt(252) * 100)


def _coerce_float(value: Any, default: float = 0.0) -> float:
    return float(value) if isinstance(value, (int, float)) else default


def _metric_value(metrics: list[StrategyMetric], label: str) -> float | None:
    for item in metrics:
        if item.label == label and isinstance(item.value, (int, float)):
            return float(item.value)
    return None


class StrategyService:
    def __init__(
        self,
        settings: RuntimeSettings,
        duck_store: DuckDbStore,
        sqlite_store: SqliteStore,
        asset_service: AssetService,
    ) -> None:
        self.settings = settings
        self.duck_store = duck_store
        self.sqlite_store = sqlite_store
        self.asset_service = asset_service

    def list_templates(self) -> list[StrategyTemplateDefinition]:
        return [
            StrategyTemplateDefinition(
                key="top_n_factor_rotation",
                title="Top-N Factor Rotation",
                description=(
                    "Builds an equal-weighted simulated basket from a saved Factor Lab snapshot, "
                    "then replays locally cached history as a snapshot-ranked historical simulation."
                ),
                execution_mode="local_simulation",
                parameters=[
                    StrategyTemplateParameter(key="factorRunId", label="Factor run", default=""),
                    StrategyTemplateParameter(key="topN", label="Top N", default=5, min_value=1, max_value=50),
                    StrategyTemplateParameter(
                        key="rebalanceInterval",
                        label="Rebalance interval",
                        default="monthly",
                        options=["monthly", "quarterly"],
                    ),
                    StrategyTemplateParameter(key="initialCapital", label="Initial capital", default=100000, min_value=1),
                    StrategyTemplateParameter(
                        key="maxPositionWeight",
                        label="Max position weight",
                        default=0.25,
                        min_value=0.01,
                        max_value=1,
                    ),
                    StrategyTemplateParameter(
                        key="cashReservePct",
                        label="Cash reserve",
                        default=0.05,
                        min_value=0,
                        max_value=0.95,
                    ),
                    StrategyTemplateParameter(key="benchmarkSymbol", label="Benchmark", default="SPY"),
                    StrategyTemplateParameter(key="transactionCostBps", label="Transaction cost bps", default=5, min_value=0),
                    StrategyTemplateParameter(key="slippageBps", label="Slippage bps", default=10, min_value=0),
                ],
                warnings=[
                    "Backtest v1 uses the selected factor snapshot as ranking evidence for the full historical replay.",
                    "This can include survivorship bias, snapshot bias, and stale cached history.",
                    "No live orders, broker calls, or Binance order paths are used.",
                ],
            )
        ]

    def list_recent_backtests(self, limit: int = 20) -> list[StrategyBacktestListItem]:
        return [
            StrategyBacktestListItem.model_validate(item)
            for item in self.duck_store.list_recent_strategy_backtest_snapshots(limit)
        ]

    def get_backtest(self, run_id: str) -> StrategyBacktestResponse:
        snapshot = self.duck_store.get_strategy_backtest_snapshot(run_id)
        if snapshot is None:
            raise ValueError(f"Strategy backtest not found: {run_id}")
        return StrategyBacktestResponse.model_validate(snapshot)

    def run_backtest(self, payload: StrategyBacktestRequest) -> StrategyBacktestResponse:
        if payload.template_key != "top_n_factor_rotation":
            raise ValueError(f"Unsupported strategy template: {payload.template_key}")
        if payload.cash_reserve_pct + payload.max_position_weight <= 0:
            raise ValueError("Strategy sizing leaves no investable capital")

        factor_snapshot = self.duck_store.get_factor_snapshot(payload.factor_run_id)
        if factor_snapshot is None:
            raise ValueError(f"Factor run not found: {payload.factor_run_id}")

        ranked = [
            item
            for item in factor_snapshot.get("results", [])
            if item.get("rank") is not None and item.get("composite_score") is not None
        ]
        ranked.sort(key=lambda item: (int(item.get("rank") or 9999), item.get("symbol", "")))
        selected = ranked[: payload.top_n]
        if not selected:
            raise ValueError("Factor run has no ranked rows available for strategy simulation")

        created_at = _utc_now_iso()
        run_id = f"strategy-{uuid4().hex[:12]}"
        total_cost_rate = (payload.transaction_cost_bps + payload.slippage_bps) / 10000
        gross_weight = min((1 - payload.cash_reserve_pct) / len(selected), payload.max_position_weight)
        investable_weight = max(0.0, gross_weight)
        gross_allocations = {item["symbol"]: payload.initial_capital * investable_weight for item in selected}
        cash = payload.initial_capital - sum(gross_allocations.values())

        curves_by_symbol = {item["symbol"]: self._curve_for_result(item) for item in selected}
        dates = self._shared_dates(curves_by_symbol)
        if not dates:
            raise ValueError("Selected factor rows do not include enough local history for simulation")

        trades: list[StrategyTrade] = []
        positions: list[StrategyPosition] = []
        decisions: list[StrategyRuleDecision] = []
        warnings = [
            "Snapshot-ranked historical simulation: one current factor snapshot is used across the replay window.",
            "Results can include survivorship bias, snapshot bias, and stale-history effects.",
            "Simulation is local only and did not place live orders or call a broker adapter.",
        ]
        degraded_symbols: list[str] = []
        first_date = dates[0]
        latest_date = dates[-1]

        for item in selected:
            symbol = item["symbol"]
            price = max(_coerce_float(item.get("price"), 1.0), 0.01)
            allocation = gross_allocations[symbol]
            transaction_cost = allocation * (payload.transaction_cost_bps / 10000)
            slippage_cost = allocation * (payload.slippage_bps / 10000)
            net_notional = max(0.0, allocation - transaction_cost - slippage_cost)
            quantity = net_notional / price
            cash -= transaction_cost + slippage_cost
            if item.get("stale") or item.get("missing_data"):
                degraded_symbols.append(symbol)
            trades.append(
                StrategyTrade(
                    trade_id=f"trade-{uuid4().hex[:10]}",
                    timestamp=first_date,
                    symbol=symbol,
                    side="buy",
                    quantity=round(quantity, 6),
                    price=_round_money(price),
                    notional=_round_money(net_notional),
                    transaction_cost=_round_money(transaction_cost),
                    slippage_cost=_round_money(slippage_cost),
                    execution_mode="backtest",
                    notes=["Simulated fill from strategy backtest; no live order was created."],
                )
            )
            decisions.append(
                StrategyRuleDecision(
                    timestamp=created_at,
                    symbol=symbol,
                    action="select",
                    reason=f"Rank {item.get('rank')} selected from factor run {payload.factor_run_id}.",
                    score=item.get("composite_score"),
                    rank=item.get("rank"),
                    target_weight=_round_pct(investable_weight * 100),
                )
            )

        skipped = ranked[payload.top_n : payload.top_n + 10]
        for item in skipped:
            decisions.append(
                StrategyRuleDecision(
                    timestamp=created_at,
                    symbol=item["symbol"],
                    action="skip",
                    reason=f"Outside top {payload.top_n} selection.",
                    score=item.get("composite_score"),
                    rank=item.get("rank"),
                    target_weight=0,
                )
            )

        equity_curve = self._portfolio_equity_curve(
            dates=dates,
            cash=cash,
            allocations=gross_allocations,
            curves_by_symbol=curves_by_symbol,
            total_cost_rate=total_cost_rate,
        )
        benchmark_curve = self._benchmark_curve(payload.benchmark_symbol, dates, payload.initial_capital)
        final_value = equity_curve[-1].value if equity_curve else payload.initial_capital
        total_return = ((final_value / payload.initial_capital) - 1) * 100
        max_drawdown = _max_drawdown_pct([point.value for point in equity_curve])
        volatility = _annualized_volatility_pct([point.value for point in equity_curve])
        sharpe_style = 0.0
        if volatility:
            sharpe_style = _round_pct((total_return / volatility))
        benchmark_return = 0.0
        if benchmark_curve and benchmark_curve[0].value:
            benchmark_return = ((benchmark_curve[-1].value / benchmark_curve[0].value) - 1) * 100

        final_total = max(final_value, 0.01)
        for item in selected:
            symbol = item["symbol"]
            price = max(_coerce_float(item.get("price"), 1.0), 0.01)
            allocation = gross_allocations[symbol]
            latest_multiplier = curves_by_symbol[symbol].get(latest_date, 100.0) / 100
            market_value = allocation * latest_multiplier
            quantity = max((allocation * (1 - total_cost_rate)) / price, 0.0)
            positions.append(
                StrategyPosition(
                    symbol=symbol,
                    name=item.get("name", symbol),
                    quantity=round(quantity, 6),
                    average_price=_round_money(price),
                    market_price=_round_money(price * latest_multiplier),
                    market_value=_round_money(market_value),
                    target_weight=_round_pct(investable_weight * 100),
                    actual_weight=_round_pct((market_value / final_total) * 100),
                    unrealized_pnl=_round_money(market_value - allocation),
                )
            )

        metrics = [
            StrategyMetric(label="Total return", value=_round_pct(total_return), unit="pct", tone="positive" if total_return >= 0 else "caution"),
            StrategyMetric(label="Max drawdown", value=max_drawdown, unit="pct", tone="caution" if max_drawdown > 15 else "neutral"),
            StrategyMetric(label="Volatility", value=volatility, unit="pct"),
            StrategyMetric(label="Sharpe style", value=sharpe_style),
            StrategyMetric(label="Benchmark return", value=_round_pct(benchmark_return), unit="pct"),
            StrategyMetric(label="Turnover", value=_round_pct(sum(gross_allocations.values()) / payload.initial_capital * 100), unit="pct"),
            StrategyMetric(label="Trade count", value=len(trades)),
        ]
        diagnostics = StrategyDiagnostics(
            warnings=warnings,
            degraded_symbols=sorted(set(degraded_symbols)),
            assumptions=[
                f"Rebalance interval parameter recorded as {payload.rebalance_interval}; v1 applies the initial top-N basket only.",
                f"Cash reserve target is {payload.cash_reserve_pct:.2%}.",
                f"Costs include {payload.transaction_cost_bps:g} bps transaction cost and {payload.slippage_bps:g} bps slippage.",
            ],
            no_live_orders=True,
        )
        response = StrategyBacktestResponse(
            run_id=run_id,
            template_key=payload.template_key,
            factor_run_id=payload.factor_run_id,
            created_at=created_at,
            data_window={"start": first_date, "end": latest_date},
            request=payload.model_dump(mode="json", by_alias=True),
            factor_context={
                "run_id": factor_snapshot["run_id"],
                "family": factor_snapshot["family"],
                "as_of": factor_snapshot["as_of"],
                "universe_source": factor_snapshot["universe_source"],
                "asset_type": factor_snapshot["asset_type"],
                "selected_count": len(selected),
            },
            equity_curve=equity_curve,
            benchmark_curve=benchmark_curve,
            trades=trades,
            positions=positions,
            rule_decisions=decisions,
            metrics=metrics,
            diagnostics=diagnostics,
        )
        self.duck_store.put_strategy_backtest_snapshot(response.model_dump(mode="json"))
        return response

    def list_recent_paper_sessions(self, limit: int = 20) -> list[StrategyPaperSessionListItem]:
        return [
            StrategyPaperSessionListItem.model_validate(item)
            for item in self.sqlite_store.list_recent_strategy_paper_sessions(limit)
        ]

    def get_paper_session(self, session_id: str) -> StrategyPaperSessionResponse:
        session = self.sqlite_store.get_strategy_paper_session(session_id)
        if session is None:
            raise ValueError(f"Paper session not found: {session_id}")
        return StrategyPaperSessionResponse.model_validate(session)

    def create_paper_session(self, payload: StrategyPaperSessionRequest) -> StrategyPaperSessionResponse:
        backtest = self.get_backtest(payload.backtest_run_id)
        created_at = _utc_now_iso()
        session_id = f"paper-{uuid4().hex[:12]}"
        cash = float(backtest.request.get("initialCapital", 0.0))
        orders: list[StrategyPaperOrder] = []
        fills: list[StrategyPaperFill] = []
        ledger: list[StrategyCashLedgerEntry] = [
            StrategyCashLedgerEntry(
                entry_id=f"ledger-{uuid4().hex[:10]}",
                session_id=session_id,
                timestamp=created_at,
                event="initial_cash",
                amount=cash,
                cash_balance=cash,
            )
        ]

        for trade in backtest.trades:
            order_id = f"order-{uuid4().hex[:10]}"
            fill_id = f"fill-{uuid4().hex[:10]}"
            debit = trade.notional + trade.transaction_cost + trade.slippage_cost
            cash -= debit
            orders.append(
                StrategyPaperOrder(
                    order_id=order_id,
                    session_id=session_id,
                    created_at=created_at,
                    symbol=trade.symbol,
                    side=trade.side,
                    quantity=trade.quantity,
                    limit_price=trade.price,
                    status="filled",
                    reason="Paper order generated from top-N strategy rule.",
                )
            )
            fills.append(
                StrategyPaperFill(
                    fill_id=fill_id,
                    order_id=order_id,
                    session_id=session_id,
                    filled_at=created_at,
                    symbol=trade.symbol,
                    side=trade.side,
                    quantity=trade.quantity,
                    price=trade.price,
                    notional=trade.notional,
                    transaction_cost=trade.transaction_cost,
                    slippage_cost=trade.slippage_cost,
                )
            )
            ledger.append(
                StrategyCashLedgerEntry(
                    entry_id=f"ledger-{uuid4().hex[:10]}",
                    session_id=session_id,
                    timestamp=created_at,
                    event=f"{trade.side}_{trade.symbol}",
                    amount=-_round_money(debit),
                    cash_balance=_round_money(cash),
                )
            )

        total_pnl = sum(item.unrealized_pnl for item in backtest.positions)
        max_drawdown = _metric_value(backtest.metrics, "Max drawdown") or 0.0
        session = StrategyPaperSessionResponse(
            session_id=session_id,
            backtest_run_id=backtest.run_id,
            created_at=created_at,
            label=payload.label or f"Paper session for {backtest.run_id}",
            status="simulated",
            no_live_orders=True,
            orders=orders,
            fills=fills,
            positions=backtest.positions,
            cash_ledger=ledger,
            pnl={
                "cash_balance": _round_money(cash),
                "unrealized_pnl": _round_money(total_pnl),
                "total_pnl": _round_money(total_pnl),
            },
            drawdown={"max_drawdown_pct": max_drawdown},
            rule_decisions=backtest.rule_decisions,
            diagnostics=StrategyDiagnostics(
                warnings=[
                    "Paper trading session is simulated and local only.",
                    "No live broker, Binance order, or external execution request was made.",
                ],
                degraded_symbols=backtest.diagnostics.degraded_symbols,
                assumptions=backtest.diagnostics.assumptions,
                no_live_orders=True,
            ),
        )
        row = self.sqlite_store.create_strategy_paper_session(session.model_dump(mode="json"))
        return StrategyPaperSessionResponse.model_validate(row)

    def export_report(self, artifact_id: str) -> StrategyReportExportResponse:
        backtest = self.duck_store.get_strategy_backtest_snapshot(artifact_id)
        if backtest is not None:
            markdown = self._render_backtest_markdown(StrategyBacktestResponse.model_validate(backtest))
            artifact_type = "backtest"
            filename = f"strategy-backtest-{artifact_id[-6:]}.md"
        else:
            session = self.sqlite_store.get_strategy_paper_session(artifact_id)
            if session is None:
                raise ValueError(f"Strategy artifact not found: {artifact_id}")
            markdown = self._render_paper_markdown(StrategyPaperSessionResponse.model_validate(session))
            artifact_type = "paper_session"
            filename = f"strategy-paper-{artifact_id[-6:]}.md"

        reports_dir = self.settings.diagnostics_dir / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        export_path = reports_dir / filename
        export_path.write_text(markdown, encoding="utf-8")
        return StrategyReportExportResponse(
            artifact_id=artifact_id,
            artifact_type=artifact_type,
            export_path=str(export_path),
        )

    def _curve_for_result(self, result: dict[str, Any]) -> dict[str, float]:
        points = result.get("score_history") or []
        curve: dict[str, float] = {}
        for point in points:
            date = str(point.get("date") or "")[:10]
            value = _coerce_float(point.get("value"), 0.0)
            if date and value > 0:
                curve[date] = value
        return curve

    def _shared_dates(self, curves_by_symbol: dict[str, dict[str, float]]) -> list[str]:
        counts: dict[str, int] = {}
        for curve in curves_by_symbol.values():
            for date in curve:
                counts[date] = counts.get(date, 0) + 1
        threshold = max(1, len(curves_by_symbol) // 2)
        return sorted(date for date, count in counts.items() if count >= threshold)

    def _portfolio_equity_curve(
        self,
        *,
        dates: list[str],
        cash: float,
        allocations: dict[str, float],
        curves_by_symbol: dict[str, dict[str, float]],
        total_cost_rate: float,
    ) -> list[PortfolioValuePoint]:
        points: list[PortfolioValuePoint] = []
        for date in dates:
            value = cash
            for symbol, allocation in allocations.items():
                multiplier = curves_by_symbol[symbol].get(date)
                if multiplier is None:
                    previous = [d for d in curves_by_symbol[symbol] if d <= date]
                    multiplier = curves_by_symbol[symbol][previous[-1]] if previous else 100.0
                value += allocation * (1 - total_cost_rate) * (multiplier / 100)
            points.append(PortfolioValuePoint(date=date, value=_round_money(value)))
        return points

    def _benchmark_curve(self, symbol: str, dates: list[str], initial_capital: float) -> list[PortfolioValuePoint]:
        try:
            workspace = self.asset_service.get_asset_workspace(symbol.strip().upper())
            history = {
                str(point.timestamp)[:10]: float(point.close)
                for point in workspace.history
                if getattr(point, "close", None) is not None
            }
        except Exception:
            history = {}
        if not history:
            return []
        aligned = [(date, history[date]) for date in dates if date in history]
        if len(aligned) < 2 or aligned[0][1] == 0:
            return []
        first = aligned[0][1]
        return [PortfolioValuePoint(date=date, value=_round_money((close / first) * initial_capital)) for date, close in aligned]

    def _render_backtest_markdown(self, backtest: StrategyBacktestResponse) -> str:
        factor_snapshot = self.duck_store.get_factor_snapshot(backtest.factor_run_id) or {}
        execution_refs = self._execution_refs_for_backtest(backtest.run_id)
        lines = [
            f"# Strategy Backtest {backtest.run_id}",
            "",
            f"- Template: `{backtest.template_key}`",
            f"- Factor run: `{backtest.factor_run_id}`",
            f"- Created: `{backtest.created_at}`",
            f"- Data window: `{backtest.data_window.get('start')}` to `{backtest.data_window.get('end')}`",
            "- Execution mode: `backtest / simulated`",
            "- Live orders: `none`",
            "",
            "## Factor Evidence",
            "",
            f"- Factor family: `{factor_snapshot.get('family', backtest.factor_context.get('family', 'n/a'))}`",
            f"- Factor as-of: `{factor_snapshot.get('as_of', backtest.factor_context.get('as_of', 'n/a'))}`",
            "- Factor definitions:",
        ]
        for definition in FAMILY_DEFINITIONS:
            lines.append(f"  - `{definition.key}`: {definition.description}")
        source_timestamps = factor_snapshot.get("source_timestamps", {})
        if source_timestamps:
            lines.append("- Source timestamps:")
            for symbol, timestamp in list(source_timestamps.items())[:10]:
                lines.append(f"  - `{symbol}`: `{timestamp or 'n/a'}`")
        lines.extend(
            [
                "",
                "## Strategy Rules",
                "",
                f"- Top N: `{backtest.request.get('topN')}`",
                f"- Rebalance interval: `{backtest.request.get('rebalanceInterval')}`",
                f"- Cash reserve: `{backtest.request.get('cashReservePct')}`",
                f"- Max position weight: `{backtest.request.get('maxPositionWeight')}`",
                f"- Costs: `{backtest.request.get('transactionCostBps')}` bps transaction cost, `{backtest.request.get('slippageBps')}` bps slippage",
                "",
                "## Metrics",
                "",
            ]
        )
        for metric in backtest.metrics:
            unit = f" {metric.unit}" if metric.unit else ""
            lines.append(f"- {metric.label}: `{metric.value}{unit}`")
        lines.extend(["", "## Diagnostics", ""])
        for warning in backtest.diagnostics.warnings:
            lines.append(f"- Warning: {warning}")
        for assumption in backtest.diagnostics.assumptions:
            lines.append(f"- Assumption: {assumption}")
        lines.extend(["", "## Trades", ""])
        for trade in backtest.trades:
            lines.append(
                f"- `{trade.timestamp}` {trade.side.upper()} `{trade.symbol}` qty `{trade.quantity}` "
                f"notional `{trade.notional}` mode `{trade.execution_mode}`"
            )
        lines.extend(["", "## Positions", ""])
        for position in backtest.positions:
            lines.append(
                f"- `{position.symbol}` target `{position.target_weight}%`, actual `{position.actual_weight}%`, "
                f"market value `{position.market_value}`, unrealized PnL `{position.unrealized_pnl}`"
            )
        lines.extend(["", "## Execution Evidence", ""])
        if execution_refs:
            for ref in execution_refs:
                lines.append(
                    f"- Intent `{ref['intent_id']}` status `{ref['status']}` blocked `{', '.join(ref['blocked_checks']) or 'none'}` "
                    f"audit `{', '.join(ref['audit_event_ids']) or 'none'}`."
                )
        else:
            lines.append("- No Binance execution intent is linked to this backtest.")
        lines.append("")
        return "\n".join(lines)

    def _render_paper_markdown(self, session: StrategyPaperSessionResponse) -> str:
        execution_refs = self._execution_refs_for_backtest(session.backtest_run_id, paper_session_id=session.session_id)
        lines = [
            f"# Strategy Paper Session {session.session_id}",
            "",
            f"- Backtest run: `{session.backtest_run_id}`",
            f"- Created: `{session.created_at}`",
            f"- Status: `{session.status}`",
            "- Execution mode: `paper / simulated`",
            "- Live orders: `none`",
            "",
            "## Ledger",
            "",
        ]
        for entry in session.cash_ledger:
            lines.append(f"- `{entry.timestamp}` {entry.event}: `{entry.amount}` cash `{entry.cash_balance}`")
        lines.extend(["", "## Orders And Fills", ""])
        for order in session.orders:
            lines.append(f"- Order `{order.order_id}` {order.side.upper()} `{order.symbol}` qty `{order.quantity}` status `{order.status}`")
        for fill in session.fills:
            lines.append(f"- Fill `{fill.fill_id}` `{fill.symbol}` notional `{fill.notional}` costs `{fill.transaction_cost + fill.slippage_cost}`")
        lines.extend(["", "## Diagnostics", ""])
        for warning in session.diagnostics.warnings:
            lines.append(f"- Warning: {warning}")
        lines.extend(["", "## Execution Evidence", ""])
        if execution_refs:
            for ref in execution_refs:
                lines.append(
                    f"- Intent `{ref['intent_id']}` status `{ref['status']}` blocked `{', '.join(ref['blocked_checks']) or 'none'}` "
                    f"live order recorded `{ref['live_order_recorded']}`."
                )
                for entry in ref["live_ledger"]:
                    lines.append(f"  - Live ledger `{entry.get('entry_id')}` {entry.get('event')}: `{entry.get('amount')}` `{entry.get('asset')}`")
        else:
            lines.append("- No Binance execution intent is linked to this paper session.")
        lines.append("")
        return "\n".join(lines)

    def _execution_refs_for_backtest(self, backtest_run_id: str, paper_session_id: str | None = None) -> list[dict[str, Any]]:
        refs: list[dict[str, Any]] = []
        for intent in self.sqlite_store.list_recent_binance_execution_intents(100):
            request = intent.get("request", {})
            if request.get("strategy_run_id") != backtest_run_id and request.get("paper_session_id") != paper_session_id:
                continue
            audit_events = [
                event
                for event in self.sqlite_store.list_binance_execution_audit_events(100)
                if event.get("intent_id") == intent.get("intent_id")
            ]
            refs.append(
                {
                    "intent_id": intent.get("intent_id"),
                    "status": intent.get("status"),
                    "blocked_checks": [
                        decision.get("check")
                        for decision in intent.get("risk_decisions", [])
                        if decision.get("status") == "block"
                    ],
                    "live_order_recorded": intent.get("order") is not None,
                    "live_ledger": intent.get("ledger", []),
                    "audit_event_ids": [event.get("event_id") for event in audit_events[:8]],
                }
            )
        return refs
