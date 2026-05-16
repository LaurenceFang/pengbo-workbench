from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from ..models import (
    BinanceExecutionIntentRequest,
    CreateResearchBriefRequest,
    FactorRunRequest,
    ScreenerRunRequest,
    StrategyBacktestRequest,
    StrategyPaperSessionRequest,
    WorkflowActionPolicy,
    WorkflowArtifactRef,
    WorkflowAuditEvent,
    WorkflowRunRequest,
    WorkflowRunResponse,
    WorkflowRunStatus,
    WorkflowStepState,
    WorkflowStepStatus,
    WorkflowTemplateDefinition,
    WorkflowTemplateKey,
    WorkflowTemplateStepDefinition,
)
from ..storage.sqlite_store import SqliteStore
from .execution_service import ExecutionService
from .factor_service import FactorService
from .research_service import ResearchService
from .screener_service import ScreenerService
from .strategy_service import StrategyService
from .data_source_service import DataSourceService


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _input_value(payload: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in payload and payload[key] is not None:
            return payload[key]
    return default


def _model_payload(value: Any) -> dict[str, Any]:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return value
    return {}


class WorkflowService:
    def __init__(
        self,
        sqlite_store: SqliteStore,
        screener_service: ScreenerService,
        research_service: ResearchService,
        factor_service: FactorService,
        strategy_service: StrategyService,
        execution_service: ExecutionService,
        data_source_service: DataSourceService | None = None,
    ) -> None:
        self.sqlite_store = sqlite_store
        self.screener_service = screener_service
        self.research_service = research_service
        self.factor_service = factor_service
        self.strategy_service = strategy_service
        self.execution_service = execution_service
        self.data_source_service = data_source_service

    def list_templates(self) -> list[WorkflowTemplateDefinition]:
        return [
            WorkflowTemplateDefinition(
                template_key="screener_to_research",
                title="Screener to Research Brief",
                description="Run a controlled screener and create a research brief for a selected result.",
                steps=[
                    self._template_step("run_screener", "Run screener", "read_only"),
                    self._template_step("create_research_brief", "Create research brief", "local_analysis"),
                ],
            ),
            WorkflowTemplateDefinition(
                template_key="data_sources_to_research",
                title="Data Sources to Research Brief",
                description="Sample a read-only macro, event, or crypto source and create a research brief with provenance.",
                steps=[
                    self._template_step("collect_data_source_sample", "Collect data source sample", "read_only"),
                    self._template_step("create_research_brief", "Create research brief", "local_analysis"),
                ],
            ),
            WorkflowTemplateDefinition(
                template_key="research_to_factor",
                title="Research Brief to Factor Run",
                description="Use a research target to create a local factor snapshot.",
                steps=[
                    self._template_step("create_or_load_research", "Create or load research brief", "local_analysis"),
                    self._template_step("run_factor", "Run factor snapshot", "local_analysis"),
                ],
            ),
            WorkflowTemplateDefinition(
                template_key="factor_to_backtest",
                title="Factor Run to Backtest",
                description="Create a strategy backtest from a factor run.",
                steps=[
                    self._template_step("create_or_load_factor", "Create or load factor run", "local_analysis"),
                    self._template_step("run_backtest", "Run strategy backtest", "local_simulation"),
                ],
            ),
            WorkflowTemplateDefinition(
                template_key="backtest_to_paper",
                title="Backtest to Paper Session",
                description="Create a local paper-trading session from a strategy backtest.",
                steps=[
                    self._template_step("create_or_load_backtest", "Create or load backtest", "local_simulation"),
                    self._template_step("create_paper_session", "Create paper session", "local_simulation"),
                ],
            ),
            WorkflowTemplateDefinition(
                template_key="paper_to_binance_intent",
                title="Paper Session to Binance Intent",
                description="Create a Binance execution intent, then stop for visible user confirmation.",
                steps=[
                    self._template_step("create_or_load_paper_session", "Create or load paper session", "local_simulation"),
                    self._template_step("create_binance_intent", "Create Binance intent", "binance_intent"),
                    self._template_step(
                        "await_user_confirmation",
                        "Await user confirmation",
                        "user_confirmed_binance_submit",
                    ),
                ],
            ),
            WorkflowTemplateDefinition(
                template_key="evidence_report_export",
                title="Evidence Report Export",
                description="Export an existing research, backtest, or paper-session evidence artifact.",
                steps=[
                    self._template_step("resolve_evidence_artifact", "Resolve evidence artifact", "read_only"),
                    self._template_step("export_evidence_report", "Export evidence report", "local_analysis"),
                ],
            ),
        ]

    def list_recent_runs(self, limit: int = 20) -> list[WorkflowRunResponse]:
        return [
            WorkflowRunResponse.model_validate(item)
            for item in self.sqlite_store.list_recent_workflow_runs(limit)
        ]

    def get_run(self, run_id: str) -> WorkflowRunResponse:
        row = self.sqlite_store.get_workflow_run(run_id)
        if row is None:
            raise ValueError(f"Workflow run not found: {run_id}")
        return WorkflowRunResponse.model_validate(row)

    def run(self, payload: WorkflowRunRequest) -> WorkflowRunResponse:
        template = self._template(payload.template_key)
        now = _utc_now_iso()
        run = WorkflowRunResponse(
            run_id=f"workflow-{uuid4().hex[:12]}",
            template_key=payload.template_key,
            status="running",
            created_at=now,
            updated_at=now,
            input=payload.input,
        )
        context: dict[str, Any] = {}
        try:
            self._run_template(template.template_key, payload.input, run, context)
            if run.manual_confirmation_required:
                run.status = "blocked"
                if not run.blocked_reasons:
                    run.blocked_reasons.append("Workflow requires explicit user confirmation before Binance submit.")
            elif run.status == "running":
                run.status = "completed"
        except ValueError as error:
            run.status = "blocked"
            run.blocked_reasons.append(str(error))
            self._audit(run, "workflow_blocked", str(error), {"template_key": payload.template_key})
        except Exception as error:  # pragma: no cover - defensive guard for persisted failure visibility
            run.status = "failed"
            self._audit(run, "workflow_failed", str(error), {"template_key": payload.template_key})
        run.updated_at = _utc_now_iso()
        row = self.sqlite_store.put_workflow_run(run.model_dump(mode="json"))
        return WorkflowRunResponse.model_validate(row)

    def _run_template(
        self,
        template_key: WorkflowTemplateKey,
        payload: dict[str, Any],
        run: WorkflowRunResponse,
        context: dict[str, Any],
    ) -> None:
        if template_key == "screener_to_research":
            self._step(run, "run_screener", "Run screener", "read_only", payload, lambda: self._run_screener(payload, context))
            self._step(
                run,
                "create_research_brief",
                "Create research brief",
                "local_analysis",
                payload,
                lambda: self._create_research(payload, context),
            )
            return
        if template_key == "data_sources_to_research":
            self._step(
                run,
                "collect_data_source_sample",
                "Collect data source sample",
                "read_only",
                payload,
                lambda: self._collect_data_source_sample(payload, context),
            )
            self._step(
                run,
                "create_research_brief",
                "Create research brief",
                "local_analysis",
                payload,
                lambda: self._create_research(payload, context),
            )
            return
        if template_key == "research_to_factor":
            self._step(
                run,
                "create_or_load_research",
                "Create or load research brief",
                "local_analysis",
                payload,
                lambda: self._create_research(payload, context),
            )
            self._step(run, "run_factor", "Run factor snapshot", "local_analysis", payload, lambda: self._run_factor(payload, context))
            return
        if template_key == "factor_to_backtest":
            self._step(
                run,
                "create_or_load_factor",
                "Create or load factor run",
                "local_analysis",
                payload,
                lambda: self._run_factor(payload, context),
            )
            self._step(run, "run_backtest", "Run strategy backtest", "local_simulation", payload, lambda: self._run_backtest(payload, context))
            return
        if template_key == "backtest_to_paper":
            self._step(
                run,
                "create_or_load_backtest",
                "Create or load backtest",
                "local_simulation",
                payload,
                lambda: self._run_backtest(payload, context),
            )
            self._step(
                run,
                "create_paper_session",
                "Create paper session",
                "local_simulation",
                payload,
                lambda: self._create_paper_session(payload, context),
            )
            return
        if template_key == "paper_to_binance_intent":
            self._step(
                run,
                "create_or_load_paper_session",
                "Create or load paper session",
                "local_simulation",
                payload,
                lambda: self._create_paper_session(payload, context),
            )
            self._step(
                run,
                "create_binance_intent",
                "Create Binance intent",
                "binance_intent",
                payload,
                lambda: self._create_binance_intent(payload, context),
            )
            self._manual_confirmation_step(run, payload, context)
            return
        if template_key == "evidence_report_export":
            self._step(
                run,
                "resolve_evidence_artifact",
                "Resolve evidence artifact",
                "read_only",
                payload,
                lambda: self._resolve_evidence_artifact(payload, context),
            )
            self._step(
                run,
                "export_evidence_report",
                "Export evidence report",
                "local_analysis",
                payload,
                lambda: self._export_evidence_report(payload, context),
            )
            return
        raise ValueError(f"Unsupported workflow template: {template_key}")

    def _run_screener(self, payload: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        request = ScreenerRunRequest(
            preset=_input_value(payload, "preset", default="quality-equities"),
            asset_type=_input_value(payload, "assetType", "asset_type", default="equity"),
            universeSource=_input_value(payload, "universeSource", "universe_source", default="expanded"),
            variantKey=_input_value(payload, "variantKey", "variant_key"),
        )
        response = self.screener_service.run(request)
        result = next((item for item in response.results if getattr(item, "symbol", None)), None)
        if result is None:
            raise ValueError("Screener produced no selectable results")
        context["screener"] = response
        context["symbol"] = _input_value(payload, "symbol", default=result.symbol)
        context["source_preset_key"] = response.preset
        context["source_variant_key"] = response.variant_key
        context["source_universe_source"] = response.universe_source
        return {
            "preset": response.preset,
            "variant_key": response.variant_key,
            "universe_source": response.universe_source,
            "hit_count": response.hit_count,
            "selected_symbol": context["symbol"],
        }

    def _create_research(self, payload: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        symbol = _input_value(payload, "symbol", default=context.get("symbol") or "AAPL")
        request = CreateResearchBriefRequest(
            symbol=symbol,
            sourcePresetKey=_input_value(payload, "sourcePresetKey", "source_preset_key", default=context.get("source_preset_key")),
            sourceVariantKey=_input_value(payload, "sourceVariantKey", "source_variant_key", default=context.get("source_variant_key")),
            sourceUniverseSource=_input_value(
                payload,
                "sourceUniverseSource",
                "source_universe_source",
                default=context.get("source_universe_source"),
            ),
            dataSourceProvider=_input_value(payload, "dataSourceProvider", "data_source_provider", default=context.get("data_source_provider")),
            dataSourceKind=_input_value(payload, "dataSourceKind", "data_source_kind", default=context.get("data_source_kind")),
            dataSourceQuery=_input_value(payload, "dataSourceQuery", "data_source_query", default=context.get("data_source_query")),
            factorRunId=_input_value(payload, "factorRunId", "factor_run_id", default=context.get("factor_run_id")),
            backtestRunId=_input_value(payload, "backtestRunId", "backtest_run_id", default=context.get("backtest_run_id")),
            paperSessionId=_input_value(payload, "paperSessionId", "paper_session_id", default=context.get("paper_session_id")),
            intentId=_input_value(payload, "intentId", "intent_id", default=context.get("intent_id")),
        )
        response = self.research_service.create_brief(request)
        context["research_brief"] = response
        context["brief_id"] = response.brief_id
        context["symbol"] = response.symbol
        return {
            "brief_id": response.brief_id,
            "symbol": response.symbol,
            "title": response.title,
        }

    def _collect_data_source_sample(self, payload: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        if self.data_source_service is None:
            raise ValueError("Data source service is not configured for workflow automation")
        kind = str(_input_value(payload, "dataSourceKind", "data_source_kind", default="macro")).lower()
        provider = str(_input_value(payload, "dataSourceProvider", "data_source_provider", default="worldbank")).lower()
        symbol = str(_input_value(payload, "symbol", default="AAPL")).upper()
        context["symbol"] = symbol
        context["data_source_provider"] = provider
        context["data_source_kind"] = kind

        if kind == "macro":
            series_id = str(_input_value(payload, "seriesId", "series_id", default="NY.GDP.MKTP.CD"))
            country = str(_input_value(payload, "country", default="CN"))
            response = self.data_source_service.get_macro_series(
                provider=provider,
                series_id=series_id,
                country=country,
                limit=int(_input_value(payload, "limit", default=5)),
            )
            context["data_source_query"] = f"{series_id}/{country}"
            return {
                "data_source_provider": response.provider,
                "data_source_kind": "macro",
                "data_source_query": context["data_source_query"],
                "sample_count": len(response.observations),
                "stale": response.provenance.stale,
                "fetched_at": response.provenance.fetched_at,
            }
        if kind == "news":
            query = str(_input_value(payload, "query", default=symbol))
            response = self.data_source_service.get_news_events(
                query=query,
                limit=int(_input_value(payload, "limit", default=5)),
            )
            context["data_source_provider"] = response.provider
            context["data_source_query"] = query
            return {
                "data_source_provider": response.provider,
                "data_source_kind": "news",
                "data_source_query": query,
                "sample_count": len(response.events),
                "stale": response.provenance.stale,
                "fetched_at": response.provenance.fetched_at,
            }
        if kind == "crypto":
            ids = str(_input_value(payload, "cryptoIds", "crypto_ids", default="bitcoin,ethereum"))
            response = self.data_source_service.get_crypto_markets(
                ids=ids,
                limit=int(_input_value(payload, "limit", default=5)),
            )
            context["data_source_provider"] = response.provider
            context["data_source_query"] = ids
            return {
                "data_source_provider": response.provider,
                "data_source_kind": "crypto",
                "data_source_query": ids,
                "sample_count": len(response.assets),
                "stale": response.provenance.stale,
                "fetched_at": response.provenance.fetched_at,
            }
        raise ValueError(f"Unsupported data source workflow kind: {kind}")

    def _run_factor(self, payload: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        existing = _input_value(payload, "factorRunId", "factor_run_id")
        if existing:
            response = self.factor_service.get_run(existing)
        else:
            request = FactorRunRequest(
                universeSource=_input_value(payload, "universeSource", "universe_source", default="expanded"),
                assetType=_input_value(payload, "assetType", "asset_type", default="equity"),
                family=_input_value(payload, "family", default="composite"),
            )
            response = self.factor_service.run(request)
        context["factor_run"] = response
        context["factor_run_id"] = response.run_id
        return {
            "run_id": response.run_id,
            "family": response.family,
            "result_count": len(response.results),
        }

    def _run_backtest(self, payload: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        existing = _input_value(payload, "backtestRunId", "backtest_run_id")
        if existing:
            response = self.strategy_service.get_backtest(existing)
        else:
            if "factor_run_id" not in context:
                self._run_factor(payload, context)
            request = StrategyBacktestRequest(
                templateKey=_input_value(payload, "templateKey", "strategyTemplateKey", default="top_n_factor_rotation"),
                factorRunId=context["factor_run_id"],
                topN=_input_value(payload, "topN", "top_n", default=5),
                rebalanceInterval=_input_value(payload, "rebalanceInterval", "rebalance_interval", default="monthly"),
                initialCapital=_input_value(payload, "initialCapital", "initial_capital", default=100000),
                maxPositionWeight=_input_value(payload, "maxPositionWeight", "max_position_weight", default=0.25),
                cashReservePct=_input_value(payload, "cashReservePct", "cash_reserve_pct", default=0.05),
                benchmarkSymbol=_input_value(payload, "benchmarkSymbol", "benchmark_symbol", default="SPY"),
                transactionCostBps=_input_value(payload, "transactionCostBps", "transaction_cost_bps", default=5),
                slippageBps=_input_value(payload, "slippageBps", "slippage_bps", default=10),
            )
            response = self.strategy_service.run_backtest(request)
        context["backtest"] = response
        context["backtest_run_id"] = response.run_id
        return {
            "run_id": response.run_id,
            "factor_run_id": response.factor_run_id,
            "trade_count": len(response.trades),
            "position_count": len(response.positions),
        }

    def _create_paper_session(self, payload: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        existing = _input_value(payload, "paperSessionId", "paper_session_id")
        if existing:
            response = self.strategy_service.get_paper_session(existing)
        else:
            if "backtest_run_id" not in context:
                self._run_backtest(payload, context)
            request = StrategyPaperSessionRequest(
                backtestRunId=context["backtest_run_id"],
                label=_input_value(payload, "paperLabel", "paper_label"),
            )
            response = self.strategy_service.create_paper_session(request)
        context["paper_session"] = response
        context["paper_session_id"] = response.session_id
        return {
            "session_id": response.session_id,
            "backtest_run_id": response.backtest_run_id,
            "order_count": len(response.orders),
            "no_live_orders": response.no_live_orders,
        }

    def _create_binance_intent(self, payload: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        missing = [
            key
            for key in ("symbol", "side", "quantity")
            if _input_value(payload, key) in (None, "")
        ]
        if missing:
            raise ValueError(f"Binance intent workflow requires explicit {', '.join(missing)}")
        request = BinanceExecutionIntentRequest(
            symbol=str(_input_value(payload, "symbol")).upper(),
            side=_input_value(payload, "side"),
            quantity=float(_input_value(payload, "quantity")),
            orderType=_input_value(payload, "orderType", "order_type", default="market"),
            limitPrice=_input_value(payload, "limitPrice", "limit_price"),
            strategyRunId=_input_value(payload, "backtestRunId", "backtest_run_id", default=context.get("backtest_run_id")),
            paperSessionId=_input_value(payload, "paperSessionId", "paper_session_id", default=context.get("paper_session_id")),
            clientOrderId=_input_value(payload, "clientOrderId", "client_order_id"),
            notes=_input_value(payload, "notes", default="Created by workflow automation; submit requires explicit user confirmation."),
        )
        response = self.execution_service.create_intent(request)
        context["intent"] = response
        context["intent_id"] = response.intent_id
        return {
            "intent_id": response.intent_id,
            "status": response.status,
            "symbol": response.request.symbol,
            "no_live_order_until_submit": response.no_live_order_until_submit,
        }

    def _resolve_evidence_artifact(self, payload: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        artifact_id = _input_value(payload, "artifactId", "artifact_id")
        artifact_type = _input_value(payload, "artifactType", "artifact_type")
        if artifact_id is None:
            self._run_backtest(payload, context)
            self._create_paper_session(payload, context)
            artifact_id = context["paper_session_id"]
            artifact_type = "paper_session"
        if artifact_type is None:
            if str(artifact_id).startswith("brief-"):
                artifact_type = "research_brief"
            elif str(artifact_id).startswith("paper-"):
                artifact_type = "paper_session"
            else:
                artifact_type = "backtest"
        context["artifact_id"] = artifact_id
        context["artifact_type"] = artifact_type
        return {
            "artifact_id": artifact_id,
            "artifact_type": artifact_type,
            "factor_run_id": context.get("factor_run_id"),
            "backtest_run_id": context.get("backtest_run_id"),
            "paper_session_id": context.get("paper_session_id"),
            "intent_id": context.get("intent_id"),
        }

    def _export_evidence_report(self, payload: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        artifact_id = context["artifact_id"]
        artifact_type = context["artifact_type"]
        if artifact_type == "research_brief":
            response = self.research_service.export_brief(artifact_id)
        elif artifact_type in {"backtest", "paper_session"}:
            response = self.strategy_service.export_report(artifact_id)
        else:
            raise ValueError(f"Unsupported evidence artifact type: {artifact_type}")
        return _model_payload(response)

    def _manual_confirmation_step(
        self,
        run: WorkflowRunResponse,
        payload: dict[str, Any],
        context: dict[str, Any],
    ) -> None:
        now = _utc_now_iso()
        intent_id = context.get("intent_id")
        step = WorkflowStepState(
            step_key="await_user_confirmation",
            title="Await user confirmation",
            policy="user_confirmed_binance_submit",
            status="manual_required",
            started_at=now,
            completed_at=now,
            input=payload,
            output={
                "intent_id": intent_id,
                "required_action": "show_visible_confirmation_modal",
                "submit_endpoint": f"/api/v1/execution/binance/intents/{intent_id}/submit" if intent_id else None,
            },
            artifact_refs=[
                self._artifact(intent_id, "binance_intent", "Binance execution intent", "await_user_confirmation")
            ]
            if intent_id
            else [],
            blocked_reasons=["User confirmation is required before any Binance submit request."],
            provenance={
                "policy": "user_confirmed_binance_submit",
                "submit_performed": False,
                "live_mode_changed": False,
                "risk_acknowledgement_changed": False,
                "kill_switch_changed": False,
            },
        )
        run.steps.append(step)
        run.manual_confirmation_required = True
        run.manual_confirmation_policy = "user_confirmed_binance_submit"
        run.blocked_reasons.extend(step.blocked_reasons)
        self._audit(run, "manual_confirmation_required", step.blocked_reasons[0], {"intent_id": intent_id})

    def _step(
        self,
        run: WorkflowRunResponse,
        step_key: str,
        title: str,
        policy: WorkflowActionPolicy,
        payload: dict[str, Any],
        action,
    ) -> None:
        step = WorkflowStepState(
            step_key=step_key,
            title=title,
            policy=policy,
            status="running",
            started_at=_utc_now_iso(),
            input=payload,
        )
        run.steps.append(step)
        try:
            result = action()
            step.output = result
            step.artifact_refs = self._artifact_refs_for_step(step_key, result)
            step.provenance = {
                "policy": policy,
                "service_composed": True,
                "duplicated_domain_logic": False,
            }
            step.status = "completed"
            step.completed_at = _utc_now_iso()
            run.artifact_refs.extend(step.artifact_refs)
            run.output.update(result)
            self._audit(run, "step_completed", f"{title} completed.", {"step_key": step_key, "policy": policy})
        except ValueError as error:
            step.status = "blocked"
            step.error = str(error)
            step.blocked_reasons.append(str(error))
            step.completed_at = _utc_now_iso()
            run.blocked_reasons.append(str(error))
            self._audit(run, "step_blocked", str(error), {"step_key": step_key, "policy": policy})
            raise
        except Exception as error:
            step.status = "failed"
            step.error = str(error)
            step.completed_at = _utc_now_iso()
            self._audit(run, "step_failed", str(error), {"step_key": step_key, "policy": policy})
            raise

    def _artifact_refs_for_step(self, step_key: str, result: dict[str, Any]) -> list[WorkflowArtifactRef]:
        refs: list[WorkflowArtifactRef] = []
        if "brief_id" in result:
            refs.append(self._artifact(result["brief_id"], "research_brief", "Research brief", step_key))
        if "factor_run_id" in result and result["factor_run_id"]:
            refs.append(self._artifact(result["factor_run_id"], "factor_run", "Factor run", step_key))
        if "backtest_run_id" in result and result["backtest_run_id"]:
            refs.append(self._artifact(result["backtest_run_id"], "strategy_backtest", "Strategy backtest", step_key))
        if "paper_session_id" in result and result["paper_session_id"]:
            refs.append(self._artifact(result["paper_session_id"], "paper_session", "Paper session", step_key))
        if "run_id" in result:
            artifact_type = "factor_run" if step_key in {"run_factor", "create_or_load_factor"} else "strategy_backtest"
            refs.append(self._artifact(result["run_id"], artifact_type, artifact_type.replace("_", " ").title(), step_key))
        if "session_id" in result:
            refs.append(self._artifact(result["session_id"], "paper_session", "Paper session", step_key))
        if "intent_id" in result:
            refs.append(self._artifact(result["intent_id"], "binance_intent", "Binance execution intent", step_key))
        if "export_path" in result:
            refs.append(self._artifact(result.get("artifact_id", result["export_path"]), "evidence_report", "Evidence report", step_key))
        return refs

    def _artifact(
        self,
        artifact_id: Any,
        artifact_type: str,
        label: str,
        source_step_key: str | None,
    ) -> WorkflowArtifactRef:
        return WorkflowArtifactRef(
            artifact_id=str(artifact_id),
            artifact_type=artifact_type,
            label=label,
            source_step_key=source_step_key,
        )

    def _audit(self, run: WorkflowRunResponse, event_type: str, summary: str, details: dict[str, Any]) -> None:
        run.audit_events.append(
            WorkflowAuditEvent(
                event_id=f"workflow-event-{uuid4().hex[:10]}",
                created_at=_utc_now_iso(),
                event_type=event_type,
                summary=summary,
                details=details,
            )
        )

    def _template(self, template_key: WorkflowTemplateKey) -> WorkflowTemplateDefinition:
        for template in self.list_templates():
            if template.template_key == template_key:
                return template
        raise ValueError(f"Workflow template not found: {template_key}")

    def _template_step(
        self,
        step_key: str,
        title: str,
        policy: WorkflowActionPolicy,
        description: str | None = None,
    ) -> WorkflowTemplateStepDefinition:
        return WorkflowTemplateStepDefinition(
            step_key=step_key,
            title=title,
            policy=policy,
            description=description or title,
        )
