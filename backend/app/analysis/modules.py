from __future__ import annotations

from .registry import AnalysisModuleContext, bullets, highlight, paragraph, source
from ..models import AnalysisModuleResult


def _format_number(value: float | None) -> str:
    if value is None:
        return "n/a"
    if abs(value) >= 100:
        return f"{value:,.2f}"
    return f"{value:.2f}"


def _status_label(value: str) -> str:
    return value.replace("_", " ").title()


class AssetQualitySnapshotModule:
    key = "asset_quality_snapshot"
    title = "Asset Quality Snapshot"

    def build(self, context: AnalysisModuleContext) -> AnalysisModuleResult:
        asset = context.asset_snapshot
        highlights = [
            highlight("Price", f"{asset.quote.price:.2f} {asset.quote.currency}"),
            highlight(
                "Change",
                f"{asset.quote.change_pct:.2f}%",
                "positive" if asset.quote.change_pct >= 0 else "caution",
            ),
            highlight("Ratios", str(len(asset.ratios))),
            highlight("Filings", str(len(asset.filings))),
            highlight("Fundamentals", _status_label(asset.capabilities.fundamentals_status)),
        ]

        sections = []
        if asset.overview:
            sections.append(paragraph("Overview", asset.overview.summary))
        if asset.ratios:
            sections.append(
                bullets(
                    "Key Ratios",
                    [f"{ratio.label}: {ratio.value} ({ratio.note})" for ratio in asset.ratios[:4]],
                )
            )
        if not asset.overview and asset.capabilities.fundamentals_message:
            sections.append(paragraph("Coverage", asset.capabilities.fundamentals_message))
        if asset.capabilities.notes:
            sections.append(bullets("Provider Notes", list(asset.capabilities.notes)))
        if not sections:
            sections.append(paragraph("Coverage", "Fundamental snapshot is limited for this symbol right now."))

        return AnalysisModuleResult(
            key=self.key,
            title=self.title,
            summary=(
                f"{asset.asset.symbol} is trading at {asset.quote.price:.2f} {asset.quote.currency} with "
                f"{len(asset.ratios)} tracked ratio(s) and {len(asset.filings)} filing item(s) in the current workspace."
            ),
            highlights=highlights,
            sections=sections,
            sources=[
                source("Quote", asset.quote.provider),
                source("Overview", asset.asset.provider if asset.overview else "Not available"),
            ],
            generated_at=context.generated_at,
            stale=context.stale or asset.stale,
        )


class FilingsBriefModule:
    key = "filings_brief"
    title = "Filings Brief"

    def build(self, context: AnalysisModuleContext) -> AnalysisModuleResult:
        filings = context.asset_snapshot.filings
        if filings:
            latest = filings[0]
            summary = f"Latest filing is {latest.type} dated {latest.filed_at} with status {latest.status}."
            sections = [
                bullets(
                    "Recent Filings",
                    [f"{item.filed_at} - {item.type}: {item.headline} ({item.status})" for item in filings[:3]],
                )
            ]
        else:
            summary = context.asset_snapshot.capabilities.filings_message or "No filing records are currently available in the research snapshot."
            sections = [
                paragraph(
                    "Coverage",
                    context.asset_snapshot.capabilities.filings_message
                    or "This brief does not currently have a filing feed for the selected symbol.",
                )
            ]

        return AnalysisModuleResult(
            key=self.key,
            title=self.title,
            summary=summary,
            highlights=[
                highlight("Available", "Yes" if bool(filings) else "No", "positive" if filings else "caution"),
                highlight("Count", str(len(filings))),
                highlight("Coverage", _status_label(context.asset_snapshot.capabilities.filings_status)),
            ],
            sections=sections,
            sources=[
                source(
                    "Filings",
                    "Workspace filings snapshot" if filings else "No filing records in current workspace payload",
                )
            ],
            generated_at=context.generated_at,
            stale=context.stale or context.asset_snapshot.stale,
        )


class ScreenerMatchExplainerModule:
    key = "screener_match_explainer"
    title = "Screener Match Explainer"

    def build(self, context: AnalysisModuleContext) -> AnalysisModuleResult:
        matched = [item for item in context.screener_context.summaries if item.matched]
        stale = context.stale or any(item.stale for item in context.screener_context.summaries)

        if matched:
            strongest = max(matched, key=lambda item: item.score or 0)
            summary = (
                f"{context.symbol} currently matches {len(matched)} screener preset(s); "
                f"the strongest signal is {strongest.preset_title} at {strongest.score or 0:.1f}."
            )
        else:
            summary = (
                f"{context.symbol} is not currently landing in a matched screener bucket, "
                "or the symbol sits outside the active controlled universe."
            )

        sections = []
        for item in context.screener_context.summaries[:4]:
            details: list[str] = []
            if item.score is not None:
                details.append(f"Score {item.score:.1f} ({item.score_label})")
            details.extend(item.explanations[:2])
            if item.matched_rules:
                details.append(f"Matched rules: {', '.join(item.matched_rules[:3])}")
            if item.notes:
                details.append(f"Notes: {'; '.join(item.notes[:2])}")
            if not details:
                details.append("No supporting explanation is available for this preset.")
            sections.append(bullets(item.preset_title, details))

        return AnalysisModuleResult(
            key=self.key,
            title=self.title,
            summary=summary,
            highlights=[
                highlight("Matched", str(len(matched)), "positive" if matched else "caution"),
                highlight("Presets", str(len(context.screener_context.summaries))),
                highlight(
                    "Source",
                    context.screener_context.source.source_label
                    if context.screener_context.source and context.screener_context.source.source_label
                    else "research defaults",
                ),
            ],
            sections=sections
            or [paragraph("Screener Coverage", "No screener summary is currently attached to this brief.")],
            sources=[source("Screener presets", "Current /api/v1/screeners/* results")],
            generated_at=context.generated_at,
            stale=stale,
        )


class PortfolioRiskSnapshotModule:
    key = "portfolio_risk_snapshot"
    title = "Portfolio Risk Snapshot"

    def build(self, context: AnalysisModuleContext) -> AnalysisModuleResult:
        portfolio = context.portfolio_context
        valuation_status = portfolio.valuation_status or "unavailable"
        summary = (
            f"{context.symbol} is already held in the portfolio with {portfolio.transaction_count} recorded trade(s)."
            if portfolio.in_portfolio
            else f"{context.symbol} is not currently held; the handoff draft is ready for a new trade idea."
        )
        items = list(portfolio.notes)
        if portfolio.in_portfolio:
            items.insert(
                0,
                f"Current quantity { _format_number(portfolio.quantity) } at average cost { _format_number(portfolio.average_cost) }.",
            )
            if portfolio.market_value is not None and portfolio.cost_basis is not None:
                items.append(
                    f"Marked market value {_format_number(portfolio.market_value)} against cost basis {_format_number(portfolio.cost_basis)}."
                )
        else:
            items.append("This name can be handed off into the portfolio form without leaving research.")

        return AnalysisModuleResult(
            key=self.key,
            title=self.title,
            summary=summary,
            highlights=[
                highlight("Held", "Yes" if portfolio.in_portfolio else "No", "positive" if portfolio.in_portfolio else "neutral"),
                highlight("Transactions", str(portfolio.transaction_count)),
                highlight(
                    "Valuation",
                    valuation_status,
                    "positive" if valuation_status == "live" else "caution",
                ),
            ],
            sections=[bullets("Position Notes", items)],
            sources=[
                source("Portfolio holdings", "Current local portfolio snapshot"),
                source("Handoff draft", portfolio.handoff_draft.traded_at),
            ],
            generated_at=context.generated_at,
            stale=context.stale or valuation_status != "live",
        )
