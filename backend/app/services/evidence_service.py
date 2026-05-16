from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from ..models import (
    ResearchBriefSourceContext,
    ResearchEvidenceAuditSummary,
    ResearchEvidenceBacktestSummary,
    ResearchEvidenceContext,
    ResearchEvidenceExecutionSummary,
    ResearchEvidencePaperSessionSummary,
    ResearchFactorContext,
    ResearchScreenerContext,
)
from ..providers.catalog import get_asset
from .execution_service import ExecutionService
from .factor_service import FactorService
from .screener_service import ScreenerService
from .strategy_service import StrategyService


def _metric_lookup(metrics: list[Any], label: str) -> float | None:
    for item in metrics:
        if isinstance(item, dict):
            if item.get("label") == label and isinstance(item.get("value"), (int, float)):
                return float(item["value"])
            continue
        if getattr(item, "label", None) == label and isinstance(getattr(item, "value", None), (int, float)):
            return float(getattr(item, "value"))
    return None


class EvidenceService:
    def __init__(
        self,
        factor_service: FactorService,
        strategy_service: StrategyService,
        execution_service: ExecutionService,
        screener_service: ScreenerService,
    ) -> None:
        self.factor_service = factor_service
        self.strategy_service = strategy_service
        self.execution_service = execution_service
        self.screener_service = screener_service

    def build_snapshot(
        self,
        symbol: str,
        *,
        source_context: ResearchBriefSourceContext | None = None,
        screener_context: ResearchScreenerContext | None = None,
        factor_context: ResearchFactorContext | None = None,
    ) -> ResearchEvidenceContext:
        normalized = symbol.strip().upper()
        notes: list[str] = []
        if get_asset(normalized) is None:
            raise ValueError(f"Asset not found: {normalized}")

        factor = factor_context or self._factor_context(normalized, source_context, notes)
        backtest = self._backtest_summary(normalized, source_context, factor, notes)
        paper_session = self._paper_session_summary(normalized, source_context, backtest, notes)
        execution = self._execution_summary(normalized, source_context, backtest, paper_session, notes)
        audit = self._audit_summary(source_context, execution, backtest, notes)

        if screener_context is None:
            screener_context = self._screener_context(normalized, source_context, notes)
        if not screener_context.summaries:
            notes.append("No screener evidence is currently available for this symbol.")

        return ResearchEvidenceContext(
            factor=factor,
            screener=screener_context,
            backtest=backtest,
            paper_session=paper_session,
            execution=execution,
            audit=audit,
            data_quality_notes=notes,
        )

    def _factor_context(
        self,
        symbol: str,
        source_context: ResearchBriefSourceContext | None,
        notes: list[str],
    ) -> ResearchFactorContext | None:
        explicit_run_id = source_context.factor_run_id if source_context else None
        if explicit_run_id:
            context = self.factor_service.get_research_context(explicit_run_id, symbol)
            if context is None:
                notes.append(f"Factor run {explicit_run_id} did not include {symbol}.")
            return context

        for item in self.factor_service.list_recent_runs(20):
            context = self.factor_service.get_research_context(item.run_id, symbol)
            if context is not None:
                return context
        notes.append("No recent factor snapshot includes this symbol.")
        return None

    def _screener_context(
        self,
        symbol: str,
        source_context: ResearchBriefSourceContext | None,
        notes: list[str],
    ) -> ResearchScreenerContext:
        asset = get_asset(symbol)
        asset_type = "equity" if asset and asset.asset_class in {"equity", "etf"} else (asset.asset_class if asset else "equity")
        preset_runs: list[tuple[str, str | None, str]] = []
        if source_context and source_context.source_preset_key:
            preset_runs.append(
                (
                    source_context.source_preset_key,
                    source_context.source_variant_key,
                    source_context.source_universe_source or "expanded",
                )
            )
        else:
            for preset in self.screener_service.get_presets():
                if preset.asset_type == asset_type:
                    preset_runs.append((preset.key, preset.active_variant_key, "expanded"))

        summaries = []
        for preset_key, variant_key, universe_source in preset_runs:
            try:
                run = self.screener_service.run(
                    SimpleNamespace(
                        preset=preset_key,
                        asset_type=asset_type,
                        universe_source=universe_source,
                        variant_key=variant_key,
                    )
                )
                result = next((item for item in run.results if item.symbol == symbol), None)
                if result is None:
                    continue
                summaries.append(
                    {
                        "preset_key": preset_key,
                        "preset_title": preset_key,
                        "variant_key": run.variant_key,
                        "variant_name": run.variant_name,
                        "universe_source": run.universe_source,
                        "matched": result.score_label != "watch",
                        "score": result.score,
                        "score_label": result.score_label,
                        "explanations": result.explanations,
                        "matched_rules": result.matched_rules,
                        "notes": result.notes,
                        "stale": result.stale,
                    }
                )
            except Exception as error:
                notes.append(f"Screener evidence unavailable for {preset_key}: {error}")
        return ResearchScreenerContext.model_validate({"source": source_context, "summaries": summaries})

    def _backtest_summary(
        self,
        symbol: str,
        source_context: ResearchBriefSourceContext | None,
        factor_context: ResearchFactorContext | None,
        notes: list[str],
    ) -> ResearchEvidenceBacktestSummary | None:
        explicit_run_id = source_context.backtest_run_id if source_context else None
        candidates = [explicit_run_id] if explicit_run_id else [item.run_id for item in self.strategy_service.list_recent_backtests(25)]
        for run_id in [item for item in candidates if item]:
            try:
                backtest = self.strategy_service.get_backtest(run_id)
            except ValueError:
                if explicit_run_id:
                    notes.append(f"Backtest {run_id} was not found.")
                continue
            if explicit_run_id or self._backtest_matches(backtest.model_dump(mode="json"), symbol, factor_context):
                return ResearchEvidenceBacktestSummary(
                    run_id=backtest.run_id,
                    template_key=backtest.template_key,
                    factor_run_id=backtest.factor_run_id,
                    created_at=backtest.created_at,
                    total_return_pct=_metric_lookup(backtest.metrics, "Total return"),
                    max_drawdown_pct=_metric_lookup(backtest.metrics, "Max drawdown"),
                    trade_count=len(backtest.trades),
                    position_count=len(backtest.positions),
                    assumptions=list(backtest.diagnostics.assumptions),
                    warnings=list(backtest.diagnostics.warnings),
                    no_live_orders=backtest.diagnostics.no_live_orders,
                )
        notes.append("No matching strategy backtest evidence is currently linked.")
        return None

    def _paper_session_summary(
        self,
        symbol: str,
        source_context: ResearchBriefSourceContext | None,
        backtest: ResearchEvidenceBacktestSummary | None,
        notes: list[str],
    ) -> ResearchEvidencePaperSessionSummary | None:
        explicit_session_id = source_context.paper_session_id if source_context else None
        candidates = [explicit_session_id] if explicit_session_id else [item.session_id for item in self.strategy_service.list_recent_paper_sessions(25)]
        for session_id in [item for item in candidates if item]:
            try:
                session = self.strategy_service.get_paper_session(session_id)
            except ValueError:
                if explicit_session_id:
                    notes.append(f"Paper session {session_id} was not found.")
                continue
            session_symbols = {item.symbol for item in session.positions} | {item.symbol for item in session.orders}
            if explicit_session_id or (symbol in session_symbols and (backtest is None or session.backtest_run_id == backtest.run_id)):
                ledger = list(session.cash_ledger)
                return ResearchEvidencePaperSessionSummary(
                    session_id=session.session_id,
                    backtest_run_id=session.backtest_run_id,
                    created_at=session.created_at,
                    status=session.status,
                    order_count=len(session.orders),
                    fill_count=len(session.fills),
                    ledger_count=len(session.cash_ledger),
                    cash_balance=ledger[-1].cash_balance if ledger else None,
                    total_pnl=session.pnl.get("total_pnl"),
                    no_live_orders=session.no_live_orders,
                    warnings=list(session.diagnostics.warnings),
                )
        notes.append("No matching paper-session ledger is currently linked.")
        return None

    def _execution_summary(
        self,
        symbol: str,
        source_context: ResearchBriefSourceContext | None,
        backtest: ResearchEvidenceBacktestSummary | None,
        paper_session: ResearchEvidencePaperSessionSummary | None,
        notes: list[str],
    ) -> ResearchEvidenceExecutionSummary | None:
        explicit_intent_id = source_context.intent_id if source_context else None
        candidates = [explicit_intent_id] if explicit_intent_id else [item.intent_id for item in self.execution_service.list_recent_intents(25)]
        for intent_id in [item for item in candidates if item]:
            intent = next((item for item in self.execution_service.list_recent_intents(100) if item.intent_id == intent_id), None)
            if intent is None:
                if explicit_intent_id:
                    notes.append(f"Execution intent {intent_id} was not found.")
                continue
            linked = (
                intent.request.symbol == symbol
                or (backtest is not None and intent.request.strategy_run_id == backtest.run_id)
                or (paper_session is not None and intent.request.paper_session_id == paper_session.session_id)
            )
            if explicit_intent_id or linked:
                blocked = [item.check for item in intent.risk_decisions if item.status == "block"]
                if blocked:
                    notes.append(f"Execution is currently blocked by: {', '.join(blocked)}.")
                elif intent.status in {"submitted", "filled"}:
                    notes.append("Execution intent has recorded live-order evidence; audit trail should be reviewed.")
                return ResearchEvidenceExecutionSummary(
                    intent_id=intent.intent_id,
                    status=intent.status,
                    symbol=intent.request.symbol,
                    side=intent.request.side,
                    estimated_notional=intent.estimated_notional,
                    live_order_recorded=intent.order is not None,
                    no_live_order_until_submit=intent.no_live_order_until_submit,
                    blocked_checks=blocked,
                    risk_decision_count=len(intent.risk_decisions),
                    audit_event_count=intent.audit_event_count,
                )
        notes.append("No Binance execution intent is currently linked.")
        return None

    def _audit_summary(
        self,
        source_context: ResearchBriefSourceContext | None,
        execution: ResearchEvidenceExecutionSummary | None,
        backtest: ResearchEvidenceBacktestSummary | None,
        notes: list[str],
    ) -> ResearchEvidenceAuditSummary | None:
        intent_id = execution.intent_id if execution else (source_context.intent_id if source_context else None)
        strategy_run_id = backtest.run_id if backtest else (source_context.backtest_run_id if source_context else None)
        events = [
            item
            for item in self.execution_service.list_audit_events(100)
            if (intent_id and item.intent_id == intent_id) or (strategy_run_id and item.strategy_run_id == strategy_run_id)
        ]
        if not events:
            notes.append("No execution audit events are currently linked.")
            return None
        return ResearchEvidenceAuditSummary(
            event_count=len(events),
            latest_event_at=events[0].created_at,
            event_ids=[item.event_id for item in events[:8]],
            event_types=[item.event_type for item in events[:8]],
        )

    def _backtest_matches(
        self,
        backtest: dict[str, Any],
        symbol: str,
        factor_context: ResearchFactorContext | None,
    ) -> bool:
        if factor_context and backtest.get("factor_run_id") == factor_context.run_id:
            return True
        symbols = {item.get("symbol") for item in backtest.get("positions", [])}
        symbols.update(item.get("symbol") for item in backtest.get("trades", []))
        return symbol in symbols
