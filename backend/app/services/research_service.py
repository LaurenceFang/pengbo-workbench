from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import TYPE_CHECKING
from uuid import uuid4

from ..analysis import AnalysisModuleContext, build_default_analysis_registry
from ..models import (
    AssetWorkspaceResponse,
    CreateResearchBriefRequest,
    ResearchBrief,
    ResearchBriefDecisionReview,
    ResearchBriefEvidenceItem,
    ResearchBriefExportResponse,
    ResearchBriefListItem,
    ResearchFactorContext,
    ResearchEvidenceContext,
    ResearchBriefProvenanceItem,
    ResearchBriefSourceContext,
    ResearchPortfolioContext,
    ResearchPortfolioHandoffDraft,
    ResearchScreenerContext,
    ResearchScreenerSummary,
    UpdateResearchBriefNotesRequest,
)
from ..providers.catalog import get_asset
from ..runtime import RuntimeSettings
from ..storage.sqlite_store import SqliteStore
from .asset_service import AssetService
from .data_quality_service import quality_from_missing_and_stale
from .portfolio_service import PortfolioService
from .screener_service import ScreenerService
from .watchlist_service import WatchlistService

if TYPE_CHECKING:
    from .evidence_service import EvidenceService
    from .factor_service import FactorService


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


class ResearchService:
    def __init__(
        self,
        settings: RuntimeSettings,
        sqlite_store: SqliteStore,
        asset_service: AssetService,
        screener_service: ScreenerService,
        portfolio_service: PortfolioService,
        watchlist_service: WatchlistService,
        factor_service: FactorService | None = None,
        evidence_service: EvidenceService | None = None,
    ) -> None:
        self.settings = settings
        self.sqlite_store = sqlite_store
        self.asset_service = asset_service
        self.screener_service = screener_service
        self.portfolio_service = portfolio_service
        self.watchlist_service = watchlist_service
        self.factor_service = factor_service
        self.evidence_service = evidence_service
        self.analysis_registry = build_default_analysis_registry()

    def _asset_type_for_symbol(self, symbol: str) -> str:
        entry = get_asset(symbol)
        if entry is None:
            raise ValueError(f"Asset not found: {symbol}")
        if entry.asset_class in {"equity", "etf"}:
            return "equity"
        return entry.asset_class

    def _build_source_context(self, payload: CreateResearchBriefRequest) -> ResearchBriefSourceContext | None:
        if (
            payload.source_preset_key is None
            and payload.source_variant_key is None
            and payload.source_universe_source is None
            and getattr(payload, "data_source_provider", None) is None
            and getattr(payload, "data_source_kind", None) is None
            and getattr(payload, "data_source_query", None) is None
            and getattr(payload, "factor_run_id", None) is None
            and getattr(payload, "backtest_run_id", None) is None
            and getattr(payload, "paper_session_id", None) is None
            and getattr(payload, "intent_id", None) is None
        ):
            return None

        label_parts = [
            part
            for part in [
                payload.source_preset_key,
                payload.source_variant_key,
                payload.source_universe_source,
                getattr(payload, "data_source_provider", None),
                getattr(payload, "data_source_kind", None),
                getattr(payload, "data_source_query", None),
                getattr(payload, "factor_run_id", None),
                getattr(payload, "backtest_run_id", None),
                getattr(payload, "paper_session_id", None),
                getattr(payload, "intent_id", None),
            ]
            if part
        ]
        return ResearchBriefSourceContext(
            source_preset_key=payload.source_preset_key,
            source_variant_key=payload.source_variant_key,
            source_universe_source=payload.source_universe_source,
            data_source_provider=getattr(payload, "data_source_provider", None),
            data_source_kind=getattr(payload, "data_source_kind", None),
            data_source_query=getattr(payload, "data_source_query", None),
            factor_run_id=getattr(payload, "factor_run_id", None),
            backtest_run_id=getattr(payload, "backtest_run_id", None),
            paper_session_id=getattr(payload, "paper_session_id", None),
            intent_id=getattr(payload, "intent_id", None),
            source_label=" / ".join(label_parts) if label_parts else None,
        )

    def _build_factor_context(
        self,
        symbol: str,
        source_context: ResearchBriefSourceContext | None,
    ) -> ResearchFactorContext | None:
        if source_context is None or source_context.factor_run_id is None or self.factor_service is None:
            return None
        return self.factor_service.get_research_context(source_context.factor_run_id, symbol)

    def _build_screener_context(
        self,
        symbol: str,
        source_context: ResearchBriefSourceContext | None,
    ) -> ResearchScreenerContext:
        asset_type = self._asset_type_for_symbol(symbol)
        preset_runs: list[tuple[str, str | None, str]] = []
        preset_titles = {preset.key: preset.title for preset in self.screener_service.get_presets() if preset.asset_type == asset_type}

        if source_context and source_context.source_preset_key:
            preset_key = source_context.source_preset_key
            if preset_key in preset_titles:
                preset_runs.append(
                    (
                        preset_key,
                        source_context.source_variant_key,
                        source_context.source_universe_source or "expanded",
                    )
                )
        else:
            for preset in self.screener_service.get_presets():
                if preset.asset_type == asset_type:
                    preset_runs.append((preset.key, preset.active_variant_key, "expanded"))

        summaries: list[ResearchScreenerSummary] = []
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
                    summaries.append(
                        ResearchScreenerSummary(
                            preset_key=preset_key,
                            preset_title=preset_titles.get(preset_key, preset_key),
                            variant_key=run.variant_key,
                            variant_name=run.variant_name,
                            universe_source=run.universe_source,
                            matched=False,
                            explanations=["This symbol is outside the current controlled screener universe."],
                        )
                    )
                    continue

                summaries.append(
                    ResearchScreenerSummary(
                        preset_key=preset_key,
                        preset_title=preset_titles.get(preset_key, preset_key),
                        variant_key=run.variant_key,
                        variant_name=run.variant_name,
                        universe_source=run.universe_source,
                        matched=result.score_label != "watch",
                        score=result.score,
                        score_label=result.score_label,
                        explanations=list(result.explanations),
                        matched_rules=list(result.matched_rules),
                        notes=list(result.notes),
                        stale=result.stale,
                    )
                )
            except Exception as error:
                summaries.append(
                    ResearchScreenerSummary(
                        preset_key=preset_key,
                        preset_title=preset_titles.get(preset_key, preset_key),
                        variant_key=variant_key,
                        variant_name=None,
                        universe_source=universe_source,
                        matched=False,
                        explanations=[f"Screener context unavailable: {error}"],
                    )
                )

        return ResearchScreenerContext(source=source_context, summaries=summaries)

    def _build_portfolio_context(self, symbol: str, asset_snapshot: AssetWorkspaceResponse) -> ResearchPortfolioContext:
        holdings = self.portfolio_service.get_holdings()
        transactions = self.portfolio_service.get_transactions()
        holding = next((item for item in holdings if item.symbol == symbol), None)
        transaction_count = sum(1 for item in transactions if item.symbol == symbol)
        notes = list(holding.notes) if holding else []
        handoff_price = holding.current_price if holding and holding.current_price is not None else asset_snapshot.quote.price
        provenance = list(getattr(holding, "provenance", [])) if holding else []

        if holding is None and transaction_count == 0:
            notes.append("This symbol is not currently held in the portfolio.")
        if transaction_count:
            provenance.append(
                {
                    "label": "Research portfolio handoff",
                    "detail": f"{transaction_count} local transaction(s) are linked to this research symbol.",
                    "status": "audited",
                    "provider": "local_sqlite",
                    "source_id": f"research:{symbol}:portfolio-transactions",
                }
            )

        return ResearchPortfolioContext(
            in_portfolio=holding is not None,
            quantity=holding.quantity if holding else None,
            average_cost=holding.average_cost if holding else None,
            valuation_status=holding.valuation_status if holding else None,
            market_value=holding.market_value if holding else None,
            cost_basis=holding.cost_basis if holding else None,
            transaction_count=transaction_count,
            notes=notes,
            provenance=provenance,
            handoff_draft=ResearchPortfolioHandoffDraft(
                symbol=symbol,
                side="buy",
                quantity=1,
                price=round(handoff_price, 2),
                fees=0,
                traded_at=datetime.now(UTC).date().isoformat(),
                notes=f"Created from research brief {symbol}",
            ),
        )

    def _brief_template_key(
        self,
        asset_snapshot: AssetWorkspaceResponse,
        portfolio_context: ResearchPortfolioContext,
        source_context: ResearchBriefSourceContext | None,
    ) -> str:
        if (
            asset_snapshot.asset.provider == "tushare"
            or asset_snapshot.asset.symbol.endswith((".SH", ".SZ"))
            or (
                source_context is not None
                and (
                    source_context.data_source_provider in {"tushare", "hkma"}
                    or source_context.data_source_kind in {"equity", "a_share", "china_market"}
                )
            )
        ):
            return "china_market"
        if portfolio_context.in_portfolio:
            return "portfolio"
        if source_context and source_context.data_source_kind in {"macro", "macro_series"}:
            return "macro"
        if asset_snapshot.asset.asset_class == "crypto":
            return "crypto"
        return "equity"

    def _status_for_capability(self, status: str, stale: bool) -> str:
        if stale:
            return "cached"
        if status == "temporarily_unavailable":
            return "degraded"
        if status == "credential_required":
            return "blocked"
        if status == "unsupported":
            return "unsupported"
        return "observed"

    def _build_decision_review(
        self,
        *,
        symbol: str,
        source_context: ResearchBriefSourceContext | None,
        asset_snapshot: AssetWorkspaceResponse,
        screener_context: ResearchScreenerContext,
        factor_context: ResearchFactorContext | None,
        evidence_context: ResearchEvidenceContext | None,
        portfolio_context: ResearchPortfolioContext,
    ) -> ResearchBriefDecisionReview:
        template_key = self._brief_template_key(asset_snapshot, portfolio_context, source_context)
        stale_label = "cached" if asset_snapshot.stale else "observed"
        matched = [item for item in screener_context.summaries if item.matched]
        fundamentals_status = asset_snapshot.capabilities.fundamentals_status
        filings_status = asset_snapshot.capabilities.filings_status
        unsupported_or_blocked = [
            label
            for label, status in [
                ("fundamentals", fundamentals_status),
                ("filings", filings_status),
            ]
            if status in {"credential_required", "unsupported", "temporarily_unavailable"}
        ]

        if template_key == "crypto":
            thesis = (
                f"{symbol} should be reviewed as a volatile crypto asset using observed quote context, "
                "local evidence, and explicit unsupported-provider boundaries."
            )
            watch_items = [
                "Recheck quote freshness before using this brief in a report.",
                "Keep any execution intent behind the Binance confirmation gate.",
            ]
        elif template_key == "portfolio":
            thesis = (
                f"{symbol} is already held locally, so the review should weigh observed position exposure "
                "against current evidence quality before any portfolio handoff."
            )
            watch_items = [
                "Compare market value, cost basis, and transaction history before changing exposure.",
                "Refresh the brief after material portfolio edits.",
            ]
        elif template_key == "macro":
            thesis = (
                f"{symbol} should be treated as a macro research input; conclusions depend on provider freshness "
                "and source provenance rather than single-asset fundamentals."
            )
            watch_items = [
                "Confirm source provider freshness before citing this brief externally.",
                "Pair the macro signal with asset-level evidence before forming a conclusion.",
            ]
        elif template_key == "china_market":
            thesis = (
                f"{symbol} should be reviewed as a China-market research target with listing venue, currency, "
                "policy/liquidity context, source-quality limits, and unsupported trading boundaries kept visible."
            )
            watch_items = [
                "Confirm A-share/HK macro connector freshness, token state, and license notes before export.",
                "Separate research evidence from any execution workflow; no A-share or HK order route is available.",
            ]
        else:
            thesis = (
                f"{symbol} has an observed asset snapshot that can support a cautious equity brief, "
                "provided stale, credential-gated, and unsupported evidence remains visible."
            )
            watch_items = [
                "Refresh fundamentals and filings before a final report if credentials become available.",
                "Compare screener and factor evidence against counter-evidence before acting.",
            ]

        supporting_evidence = [
            ResearchBriefEvidenceItem(
                label="Asset snapshot",
                summary=(
                    f"{asset_snapshot.asset.name} is available from {asset_snapshot.asset.provider} with "
                    f"{stale_label} quote context at {asset_snapshot.quote.price:.2f} {asset_snapshot.quote.currency}."
                ),
                status="cached" if asset_snapshot.stale else "observed",
            ),
            ResearchBriefEvidenceItem(
                label="Screener coverage",
                summary=f"{len(matched)} matched profile(s) out of {len(screener_context.summaries)} checked.",
                status="audited" if screener_context.summaries else "blocked",
            ),
        ]
        if factor_context is not None:
            supporting_evidence.append(
                ResearchBriefEvidenceItem(
                    label="Factor context",
                    summary=(
                        f"Factor run {factor_context.run_id} reports bucket {factor_context.bucket} "
                        f"with rank {factor_context.rank if factor_context.rank is not None else 'n/a'}."
                    ),
                    status="audited",
                )
            )
        if evidence_context is not None and evidence_context.backtest is not None:
            supporting_evidence.append(
                ResearchBriefEvidenceItem(
                    label="Backtest evidence",
                    summary=(
                        f"Backtest {evidence_context.backtest.run_id} is simulated evidence with "
                        f"{evidence_context.backtest.trade_count} trade(s) and no live orders."
                    ),
                    status="simulated",
                )
            )
        if source_context and (source_context.data_source_provider or source_context.data_source_kind):
            supporting_evidence.append(
                ResearchBriefEvidenceItem(
                    label="China-market source handoff" if template_key == "china_market" else "Data-source handoff",
                    summary=(
                        f"Provider={source_context.data_source_provider or 'n/a'}, "
                        f"kind={source_context.data_source_kind or 'n/a'}, query={source_context.data_source_query or 'n/a'}."
                    ),
                    status="audited",
                )
            )

        counter_evidence = [
            ResearchBriefEvidenceItem(
                label="Fundamentals boundary",
                summary=f"Fundamentals status is {fundamentals_status}.",
                status=self._status_for_capability(fundamentals_status, asset_snapshot.stale),
            ),
            ResearchBriefEvidenceItem(
                label="Filings boundary",
                summary=f"Filings status is {filings_status}.",
                status=self._status_for_capability(filings_status, asset_snapshot.stale),
            ),
        ]
        if template_key == "china_market":
            counter_evidence.extend(
                [
                    ResearchBriefEvidenceItem(
                        label="Policy and liquidity boundary",
                        summary="Policy, liquidity, venue, currency, and sector interpretation requires connector-backed evidence before firm claims.",
                        status="blocked" if source_context is None else "audited",
                    ),
                    ResearchBriefEvidenceItem(
                        label="Unsupported trading boundary",
                        summary="A-share/HK connectors are read-only; live trading and order submission are unsupported.",
                        status="unsupported",
                    ),
                ]
            )
        for summary in screener_context.summaries:
            if not summary.matched:
                counter_evidence.append(
                    ResearchBriefEvidenceItem(
                        label=f"Screener: {summary.preset_title}",
                        summary="; ".join(summary.explanations[:2]) or "This preset did not support the thesis.",
                        status="cached" if summary.stale else "observed",
                    )
                )

        risks = [
            "This brief is a local research artifact, not investment advice or an execution instruction.",
            "Live Binance submission remains blocked until the explicit user-confirmed submit path is used.",
        ]
        if asset_snapshot.stale:
            risks.append("Some source context is cached; refresh before relying on the latest price or provider state.")
        if unsupported_or_blocked:
            risks.append(f"Evidence coverage is incomplete for: {', '.join(unsupported_or_blocked)}.")
        if factor_context and factor_context.missing_data:
            risks.append(f"Factor evidence has missing input(s): {', '.join(factor_context.missing_data)}.")
        if template_key == "china_market":
            risks.extend(
                [
                    "China-market outputs must not soften credential_required, license_blocked, stale, or simulated source states.",
                    "A-share/HK data may carry redistribution restrictions; exports must include provenance and license notes.",
                ]
            )

        assumptions = [
            f"Template: {template_key}.",
            f"Provider state is treated as {stale_label} unless a refresh changes the snapshot.",
            "Unsupported, stale, simulated, blocked, and audited evidence must remain labeled in exports.",
        ]
        if source_context and source_context.source_label:
            assumptions.append(f"Source handoff: {source_context.source_label}.")
        if template_key == "china_market":
            assumptions.append(
                "China-market template sections cover policy, liquidity, listing venue, currency, sector, source quality, credential/license boundary, and unsupported trading boundary."
            )

        provenance = [
            ResearchBriefProvenanceItem(
                label="Asset provider",
                detail=f"{asset_snapshot.asset.provider}; quote currency {asset_snapshot.quote.currency}.",
                status="cached" if asset_snapshot.stale else "observed",
            ),
            ResearchBriefProvenanceItem(
                label="Research storage",
                detail="Stored in the local SQLite-backed research workspace.",
                status="audited",
            ),
        ]
        if evidence_context is not None:
            provenance.append(
                ResearchBriefProvenanceItem(
                    label="Evidence chain",
                    detail=f"{len(evidence_context.data_quality_notes)} data-quality note(s) attached.",
                    status="audited",
                )
            )
            if evidence_context.audit is not None and evidence_context.audit.event_ids:
                provenance.append(
                    ResearchBriefProvenanceItem(
                        label="Audit IDs",
                        detail=", ".join(evidence_context.audit.event_ids[:4]),
                        status="audited",
                    )
                )
        if source_context and source_context.data_source_provider:
            provenance.append(
                ResearchBriefProvenanceItem(
                    label="Data-source provider",
                    detail=(
                        f"{source_context.data_source_provider}; kind={source_context.data_source_kind or 'unknown'}; "
                        f"query={source_context.data_source_query or 'not recorded'}."
                    ),
                    status="audited",
                )
            )
        if portfolio_context.provenance:
            provenance.append(
                ResearchBriefProvenanceItem(
                    label="Portfolio provenance",
                    detail=f"{len(portfolio_context.provenance)} portfolio source reference(s) linked.",
                    status="audited",
                )
            )

        conclusion = (
            f"Conclusion boundary: {symbol} can be reviewed with the current {template_key} template, "
            "but any report should preserve the visible evidence labels and avoid certainty beyond observed data."
        )

        return ResearchBriefDecisionReview(
            template_key=template_key,  # type: ignore[arg-type]
            thesis=thesis,
            assumptions=assumptions,
            supporting_evidence=supporting_evidence,
            counter_evidence=counter_evidence,
            risks=risks,
            watch_items=watch_items,
            provenance=provenance,
            conclusion=conclusion,
        )

    def _build_snapshot(
        self,
        *,
        brief_id: str,
        symbol: str,
        source_context: ResearchBriefSourceContext | None,
    ) -> dict:
        asset_snapshot = self.asset_service.get_asset_workspace(symbol)
        title = f"{symbol} China Market Research Brief" if asset_snapshot.asset.provider == "tushare" else f"{symbol} Research Brief"
        generated_at = _utc_now_iso()
        screener_context = self._build_screener_context(symbol, source_context)
        factor_context = self._build_factor_context(symbol, source_context)
        evidence_context = (
            self.evidence_service.build_snapshot(
                symbol,
                source_context=source_context,
                screener_context=screener_context,
                factor_context=factor_context,
            )
            if self.evidence_service
            else None
        )
        portfolio_context = self._build_portfolio_context(symbol, asset_snapshot)
        analysis_context = AnalysisModuleContext(
            brief_id=brief_id,
            symbol=symbol,
            generated_at=generated_at,
            stale=asset_snapshot.stale or any(item.stale for item in screener_context.summaries),
            asset_snapshot=asset_snapshot,
            screener_context=screener_context,
            portfolio_context=portfolio_context,
        )
        analysis_modules = self.analysis_registry.render_all(analysis_context)
        decision_review = self._build_decision_review(
            symbol=symbol,
            source_context=source_context,
            asset_snapshot=asset_snapshot,
            screener_context=screener_context,
            factor_context=factor_context,
            evidence_context=evidence_context,
            portfolio_context=portfolio_context,
        )
        missing_items: list[str] = []
        if factor_context and factor_context.missing_data:
            missing_items.extend(factor_context.missing_data)
        if not screener_context.summaries:
            missing_items.append("screener_context")
        if evidence_context and evidence_context.data_quality:
            missing_items.extend(evidence_context.data_quality.completeness.signals)
        data_quality = quality_from_missing_and_stale(
            provider=asset_snapshot.asset.provider,
            stale=analysis_context.stale,
            missing_items=missing_items,
            limitations=(evidence_context.data_quality_notes if evidence_context else []) + asset_snapshot.capabilities.notes,
            simulated=evidence_context is not None
            and (evidence_context.backtest is not None or evidence_context.paper_session is not None),
        )
        return {
            "brief_id": brief_id,
            "symbol": symbol,
            "title": title,
            "generated_at": generated_at,
            "stale": analysis_context.stale,
            "asset_snapshot": asset_snapshot.model_dump(mode="json"),
            "screener_context": screener_context.model_dump(mode="json"),
            "factor_context": factor_context.model_dump(mode="json") if factor_context else None,
            "evidence_context": evidence_context.model_dump(mode="json") if evidence_context else None,
            "portfolio_context": portfolio_context.model_dump(mode="json"),
            "analysis_modules": [item.model_dump(mode="json") for item in analysis_modules],
            "decision_review": decision_review.model_dump(mode="json"),
            "data_quality": data_quality.model_dump(mode="json"),
        }

    def _to_brief(self, row: dict) -> ResearchBrief:
        snapshot = row["snapshot"]
        if "decision_review" not in snapshot:
            source_context = (
                ResearchBriefSourceContext.model_validate(row["source_context"])
                if row.get("source_context")
                else None
            )
            asset_snapshot = AssetWorkspaceResponse.model_validate(snapshot["asset_snapshot"])
            screener_context = ResearchScreenerContext.model_validate(snapshot["screener_context"])
            factor_context = (
                ResearchFactorContext.model_validate(snapshot.get("factor_context"))
                if snapshot.get("factor_context")
                else None
            )
            evidence_context = (
                ResearchEvidenceContext.model_validate(snapshot.get("evidence_context"))
                if snapshot.get("evidence_context")
                else None
            )
            portfolio_context = ResearchPortfolioContext.model_validate(snapshot["portfolio_context"])
            snapshot["decision_review"] = self._build_decision_review(
                symbol=row["symbol"],
                source_context=source_context,
                asset_snapshot=asset_snapshot,
                screener_context=screener_context,
                factor_context=factor_context,
                evidence_context=evidence_context,
                portfolio_context=portfolio_context,
            ).model_dump(mode="json")
        return ResearchBrief.model_validate(
            {
                "brief_id": row["brief_id"],
                "symbol": row["symbol"],
                "title": row["title"],
                "generated_at": snapshot["generated_at"],
                "updated_at": row["updated_at"],
                "stale": snapshot["stale"],
                "asset_snapshot": snapshot["asset_snapshot"],
                "screener_context": snapshot["screener_context"],
                "factor_context": snapshot.get("factor_context"),
                "evidence_context": snapshot.get("evidence_context"),
                "portfolio_context": snapshot["portfolio_context"],
                "analysis_modules": snapshot.get("analysis_modules", []),
                "decision_review": snapshot["decision_review"],
                "data_quality": snapshot.get("data_quality"),
                "notes": {
                    "markdown": row["notes_markdown"],
                    "updated_at": row["updated_at"],
                },
                "export_info": {
                    "last_export_path": row["last_export_path"],
                },
            }
        )

    def list_recent_briefs(self, limit: int = 20) -> list[ResearchBriefListItem]:
        rows = self.sqlite_store.list_recent_research_briefs(limit)
        items: list[ResearchBriefListItem] = []
        for row in rows:
            snapshot = row["snapshot"]
            items.append(
                ResearchBriefListItem.model_validate(
                    {
                        "brief_id": row["brief_id"],
                        "symbol": row["symbol"],
                        "title": row["title"],
                        "generated_at": snapshot["generated_at"],
                        "updated_at": row["updated_at"],
                        "stale": snapshot["stale"],
                        "source": row["source_context"],
                    }
                )
            )
        return items

    def create_brief(self, payload: CreateResearchBriefRequest) -> ResearchBrief:
        symbol = payload.symbol.strip().upper()
        if not symbol:
            raise ValueError("Research symbol is required")
        if get_asset(symbol) is None:
            raise ValueError(f"Asset not found: {symbol}")

        brief_id = f"brief-{uuid4().hex[:12]}"
        source_context = self._build_source_context(payload)
        snapshot = self._build_snapshot(brief_id=brief_id, symbol=symbol, source_context=source_context)
        row = self.sqlite_store.create_research_brief(
            brief_id=brief_id,
            symbol=symbol,
            title=snapshot["title"],
            snapshot=snapshot,
            notes_markdown="",
            source_context=(source_context.model_dump(mode="json") if source_context else {}),
        )
        return self._to_brief(row)

    def get_brief(self, brief_id: str) -> ResearchBrief:
        row = self.sqlite_store.get_research_brief(brief_id)
        if row is None:
            raise ValueError(f"Research brief not found: {brief_id}")
        if self._needs_provider_refresh(row):
            row = self._refresh_row(row)
        return self._to_brief(row)

    def refresh_brief(self, brief_id: str) -> ResearchBrief:
        row = self.sqlite_store.get_research_brief(brief_id)
        if row is None:
            raise ValueError(f"Research brief not found: {brief_id}")
        return self._to_brief(self._refresh_row(row))

    def _needs_provider_refresh(self, row: dict) -> bool:
        capabilities = (
            row.get("snapshot", {})
            .get("asset_snapshot", {})
            .get("capabilities", {})
        )
        return (
            capabilities.get("filings_status") == "credential_required"
            and self.asset_service.filings_provider.is_configured
        )

    def _refresh_row(self, row: dict) -> dict:
        source_context = (
            ResearchBriefSourceContext.model_validate(row["source_context"])
            if row.get("source_context")
            else None
        )
        snapshot = self._build_snapshot(
            brief_id=row["brief_id"],
            symbol=row["symbol"],
            source_context=source_context,
        )
        refreshed = self.sqlite_store.update_research_brief_snapshot(
            row["brief_id"],
            title=snapshot["title"],
            snapshot=snapshot,
            source_context=source_context.model_dump(mode="json") if source_context else {},
        )
        if refreshed is None:
            raise ValueError(f"Research brief not found: {row['brief_id']}")
        return refreshed

    def update_notes(self, brief_id: str, payload: UpdateResearchBriefNotesRequest) -> ResearchBrief:
        row = self.sqlite_store.update_research_brief_notes(brief_id, payload.markdown)
        if row is None:
            raise ValueError(f"Research brief not found: {brief_id}")
        return self._to_brief(row)

    def get_evidence(
        self,
        symbol: str,
        *,
        factor_run_id: str | None = None,
        backtest_run_id: str | None = None,
        paper_session_id: str | None = None,
        intent_id: str | None = None,
    ):
        if self.evidence_service is None:
            raise ValueError("Evidence service is not configured")
        source_context = ResearchBriefSourceContext(
            factor_run_id=factor_run_id,
            backtest_run_id=backtest_run_id,
            paper_session_id=paper_session_id,
            intent_id=intent_id,
            source_label=" / ".join(
                item
                for item in [factor_run_id, backtest_run_id, paper_session_id, intent_id]
                if item
            )
            or None,
        )
        return self.evidence_service.build_snapshot(symbol.strip().upper(), source_context=source_context)

    def _render_markdown(self, brief: ResearchBrief) -> str:
        lines: list[str] = [
            f"# {brief.title}",
            "",
            f"- Symbol: `{brief.symbol}`",
            f"- Generated: `{brief.generated_at}`",
            f"- Updated: `{brief.updated_at}`",
            f"- Stale: `{'yes' if brief.stale else 'no'}`",
            "- Evidence pack: `research_brief`",
            f"- Data quality: `{brief.data_quality.overall if brief.data_quality else 'unknown'}`",
            "- Private-state boundary: `no credentials, Stronghold vaults, unlock secrets, session tokens, or runtime databases are included`",
            "",
            "## Evidence Pack Summary",
            "",
            f"- Provider: `{brief.asset_snapshot.asset.provider}`",
            f"- Data freshness: `{'cached' if brief.stale else 'observed'}`",
            f"- Fundamentals status: `{brief.asset_snapshot.capabilities.fundamentals_status}`",
            f"- Filings status: `{brief.asset_snapshot.capabilities.filings_status}`",
            f"- Evidence status: `{'audited' if brief.evidence_context else 'blocked'}`",
            f"- Audit references: `{brief.evidence_context.audit.event_count if brief.evidence_context and brief.evidence_context.audit else 0}` event(s)",
            "",
            "## Data Quality",
            "",
            "| Dimension | Level | Detail |",
            "| --- | --- | --- |",
            f"| Completeness | {brief.data_quality.completeness.level if brief.data_quality else 'unknown'} | {brief.data_quality.completeness.detail if brief.data_quality else 'No structured quality contract attached.'} |",
            f"| Timeliness | {brief.data_quality.timeliness.level if brief.data_quality else 'unknown'} | {brief.data_quality.timeliness.detail if brief.data_quality else 'No structured quality contract attached.'} |",
            f"| Source confidence | {brief.data_quality.source_confidence.level if brief.data_quality else 'unknown'} | {brief.data_quality.source_confidence.detail if brief.data_quality else 'No structured quality contract attached.'} |",
            "",
            "## Asset Snapshot",
            "",
            f"- Name: {brief.asset_snapshot.asset.name}",
            f"- Market: {brief.asset_snapshot.asset.market}",
            f"- Provider: {brief.asset_snapshot.asset.provider}",
            f"- Price: {brief.asset_snapshot.quote.price:.2f} {brief.asset_snapshot.quote.currency}",
            f"- Change: {brief.asset_snapshot.quote.change_pct:.2f}%",
            "",
        ]

        review = brief.decision_review
        lines.extend(
            [
                "## Decision Review",
                "",
                f"- Template: `{review.template_key}`",
                "",
                "### Thesis",
                "",
                review.thesis,
                "",
                "### Assumptions",
                "",
            ]
        )
        for item in review.assumptions:
            lines.append(f"- {item}")
        lines.extend(["", "### Supporting Evidence", ""])
        for item in review.supporting_evidence:
            lines.append(f"- `{item.status}` {item.label}: {item.summary}")
        lines.extend(["", "### Counter-Evidence", ""])
        for item in review.counter_evidence:
            lines.append(f"- `{item.status}` {item.label}: {item.summary}")
        lines.extend(["", "### Risks", ""])
        for item in review.risks:
            lines.append(f"- {item}")
        lines.extend(["", "### Watch Items", ""])
        for item in review.watch_items:
            lines.append(f"- {item}")
        lines.extend(["", "### Provenance", ""])
        for item in review.provenance:
            lines.append(f"- `{item.status}` {item.label}: {item.detail}")
        lines.extend(["", "### Conclusion Boundary", "", review.conclusion, ""])

        lines.extend(["## Portfolio Context", ""])
        portfolio = brief.portfolio_context
        lines.extend(
            [
                f"- In portfolio: `{'yes' if portfolio.in_portfolio else 'no'}`",
                f"- Transaction count: `{portfolio.transaction_count}`",
                f"- Valuation status: `{portfolio.valuation_status or 'not held'}`",
                f"- Market value: `{portfolio.market_value if portfolio.market_value is not None else 'n/a'}`",
                "",
                "### Portfolio Provenance",
                "",
            ]
        )
        if portfolio.provenance:
            for item in portfolio.provenance:
                source_id = f" source `{item.source_id}`" if item.source_id else ""
                provider = f" provider `{item.provider}`" if item.provider else ""
                lines.append(f"- `{item.status}` {item.label}:{provider}{source_id}; {item.detail}")
        else:
            lines.append("- No portfolio provenance references are linked to this brief.")
        lines.append("")

        lines.extend(["## Analysis Modules", ""])
        for module in brief.analysis_modules:
            lines.append(f"### {module.title}")
            lines.append("")
            lines.append(module.summary)
            lines.append("")
            for item in module.highlights:
                lines.append(f"- {item.label}: {item.value}")
            if module.highlights:
                lines.append("")
            for section in module.sections:
                lines.append(f"#### {section.title}")
                lines.append("")
                if section.kind == "bullets":
                    for bullet in section.items:
                        lines.append(f"- {bullet}")
                else:
                    lines.append(section.body)
                lines.append("")

        if brief.factor_context is not None:
            lines.extend(
                [
                    "## Factor Context",
                    "",
                    f"- Factor run: `{brief.factor_context.run_id}`",
                    f"- Family: `{brief.factor_context.family}`",
                    f"- Universe: `{brief.factor_context.universe_source}` / `{brief.factor_context.asset_type}`",
                    f"- Rank: `{brief.factor_context.rank if brief.factor_context.rank is not None else 'n/a'}`",
                    f"- Percentile: `{brief.factor_context.percentile if brief.factor_context.percentile is not None else 'n/a'}`",
                    f"- Composite score: `{brief.factor_context.composite_score if brief.factor_context.composite_score is not None else 'n/a'}`",
                    f"- Bucket: `{brief.factor_context.bucket}`",
                    "- Scope: `research-only; no orders, broker calls, or strategy deployment`",
                    "",
                ]
            )
            if brief.factor_context.missing_data:
                lines.append(f"- Missing inputs: {', '.join(brief.factor_context.missing_data)}")
                lines.append("")
            for contribution in brief.factor_context.contributions:
                lines.append(f"### {contribution.label}")
                lines.append("")
                lines.append(f"- Score: `{contribution.score if contribution.score is not None else 'n/a'}`")
                lines.append(f"- Weight: `{contribution.weight}`")
                for item in contribution.evidence:
                    lines.append(f"- Evidence: {item}")
                for item in contribution.missing_metrics:
                    lines.append(f"- Missing: `{item}`")
                lines.append("")

        if brief.evidence_context is not None:
            lines.extend(["## Evidence Chain", ""])
            evidence = brief.evidence_context
            if evidence.factor is not None:
                lines.append(
                    f"- Factor: `{evidence.factor.run_id}` rank `{evidence.factor.rank if evidence.factor.rank is not None else 'n/a'}` "
                    f"score `{evidence.factor.composite_score if evidence.factor.composite_score is not None else 'n/a'}`."
                )
            if evidence.screener is not None:
                matched = [item for item in evidence.screener.summaries if item.matched]
                lines.append(f"- Screener: `{len(matched)}` matched profile(s), `{len(evidence.screener.summaries)}` checked.")
            if evidence.backtest is not None:
                lines.append(
                    f"- Backtest: `{evidence.backtest.run_id}` return `{evidence.backtest.total_return_pct if evidence.backtest.total_return_pct is not None else 'n/a'}` "
                    f"max drawdown `{evidence.backtest.max_drawdown_pct if evidence.backtest.max_drawdown_pct is not None else 'n/a'}`; live orders `{not evidence.backtest.no_live_orders}`."
                )
            if evidence.paper_session is not None:
                lines.append(
                    f"- Paper session: `{evidence.paper_session.session_id}` orders `{evidence.paper_session.order_count}`, "
                    f"fills `{evidence.paper_session.fill_count}`, ledger entries `{evidence.paper_session.ledger_count}`."
                )
            if evidence.execution is not None:
                lines.append(
                    f"- Binance intent: `{evidence.execution.intent_id}` status `{evidence.execution.status}` "
                    f"blocked `{', '.join(evidence.execution.blocked_checks) or 'none'}` live order recorded `{evidence.execution.live_order_recorded}`."
                )
            if evidence.audit is not None:
                lines.append(f"- Audit: `{evidence.audit.event_count}` event(s), latest `{evidence.audit.latest_event_at}`.")
                if evidence.audit.event_ids:
                    lines.append(f"- Audit IDs: `{', '.join(evidence.audit.event_ids)}`.")
            for note in evidence.data_quality_notes:
                lines.append(f"- Data quality: {note}")
            lines.append("")

        lines.extend(["## Notes", ""])
        if brief.notes.markdown.strip():
            lines.append(brief.notes.markdown.rstrip())
        else:
            lines.append("_No notes yet._")
        lines.append("")
        return "\n".join(lines)

    def export_brief(self, brief_id: str) -> ResearchBriefExportResponse:
        brief = self.get_brief(brief_id)
        reports_dir = self.settings.diagnostics_dir / "reports"
        reports_dir.mkdir(parents=True, exist_ok=True)
        export_path = reports_dir / f"research-{brief.symbol.lower()}-{brief.brief_id[-6:]}.md"
        export_path.write_text(self._render_markdown(brief), encoding="utf-8")
        row = self.sqlite_store.update_research_brief_export_path(brief_id, str(export_path))
        if row is None:
            raise ValueError(f"Research brief not found: {brief_id}")
        return ResearchBriefExportResponse(brief_id=brief_id, export_path=str(export_path))
