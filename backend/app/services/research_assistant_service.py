from __future__ import annotations

import re
from datetime import UTC, datetime

from ..models import (
    AIContextCitation,
    AIContextPreviewResponse,
    AIAssistantGenerateRequest,
    AIAssistantGenerateResponse,
    AIPermissionBoundaryResponse,
    AIPromptTemplateDefinition,
    AIPromptTemplateKey,
    ResearchBrief,
)
from ..runtime import RuntimeSettings
from .research_service import ResearchService
from .security_audit_service import SecurityAuditService


ALLOWED_CONTEXT = [
    "research brief title, symbol, generated timestamp, and stale flag",
    "asset snapshot summary, provider name, quote currency, and capability status",
    "structured data-quality status, limitations, and machine tags",
    "decision review thesis, assumptions, evidence, risks, watch items, and provenance",
    "analysis module summaries and local evidence-chain identifiers",
    "user-selected research notes after redaction",
]

FORBIDDEN_CONTEXT = [
    "raw provider credentials, Stronghold vault content, API keys, secrets, passwords, and session tokens",
    "private Binance account payloads unless a future explicit account-scoped summary is added",
    "execution submit requests, kill-switch mutation payloads, and live order responses",
    "runtime databases, local filesystem paths outside exported evidence references, and sidecar logs",
    "free-form web claims not backed by a Data Sources connector or local evidence object",
]

REQUIRES_UNLOCK = ["ai_assistant", "security_audit"]
REQUIRES_CONFIRMATION = [
    "cloud model submission",
    "saving generated text into notes",
    "exporting generated assistant output",
]
AUDIT_EVENTS = [
    "ai_context_preview_created",
    "ai_generation_requested",
    "ai_generation_completed",
    "ai_generation_blocked",
]

LANGUAGE_RULES = [
    "Use only observed, cached, simulated, blocked, audited, unsupported, or degraded evidence labels already present in context.",
    "Do not add web facts, price targets, earnings dates, recommendations, or provider claims absent from local evidence.",
    "Preserve credential_required, unsupported, stale, and simulated boundaries in plain language.",
    "Do not recommend live execution, order submission, kill-switch changes, or credential disclosure.",
]

PROMPT_TEMPLATES: dict[AIPromptTemplateKey, AIPromptTemplateDefinition] = {
    "research_summary": AIPromptTemplateDefinition(
        template_key="research_summary",
        title="Research summary",
        purpose="Summarize the current brief with evidence boundaries intact.",
        required_evidence=["decision_review", "data_quality", "citations"],
        language_rules=LANGUAGE_RULES,
    ),
    "thesis": AIPromptTemplateDefinition(
        template_key="thesis",
        title="Thesis",
        purpose="Draft a cautious thesis from supporting evidence only.",
        required_evidence=["supporting_evidence", "assumptions", "provenance"],
        language_rules=LANGUAGE_RULES,
    ),
    "counter_thesis": AIPromptTemplateDefinition(
        template_key="counter_thesis",
        title="Counter-thesis",
        purpose="Surface reasons the current thesis could be wrong.",
        required_evidence=["counter_evidence", "risks", "limitations"],
        language_rules=LANGUAGE_RULES,
    ),
    "earnings_review": AIPromptTemplateDefinition(
        template_key="earnings_review",
        title="Earnings review",
        purpose="Review earnings or filings only when local filing/fundamental evidence exists.",
        required_evidence=["fundamentals_status", "filings_status", "data_quality"],
        language_rules=LANGUAGE_RULES,
    ),
    "portfolio_risk": AIPromptTemplateDefinition(
        template_key="portfolio_risk",
        title="Portfolio risk",
        purpose="Connect the brief to local position and portfolio-risk context.",
        required_evidence=["portfolio_context", "valuation_status", "provenance"],
        language_rules=LANGUAGE_RULES,
    ),
    "provider_limitation": AIPromptTemplateDefinition(
        template_key="provider_limitation",
        title="Provider limitation",
        purpose="Explain stale, blocked, credential-gated, or unsupported provider states.",
        required_evidence=["data_quality", "capabilities", "provenance"],
        language_rules=LANGUAGE_RULES,
    ),
    "report_rewrite": AIPromptTemplateDefinition(
        template_key="report_rewrite",
        title="Report rewrite",
        purpose="Rewrite a brief section while preserving evidence and private-state boundaries.",
        required_evidence=["decision_review", "citations", "private_state_boundary"],
        language_rules=LANGUAGE_RULES,
    ),
}


SECRET_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9_-]{16,}"),
    re.compile(r"(?i)(api[_ -]?key|secret|password|token)\s*[:=]\s*[\w.\-_/+]{6,}"),
]


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


class ResearchAssistantService:
    def __init__(
        self,
        settings: RuntimeSettings,
        research_service: ResearchService,
        security_audit_service: SecurityAuditService,
    ) -> None:
        self.settings = settings
        self.research_service = research_service
        self.security_audit_service = security_audit_service

    def permission_boundary(self) -> AIPermissionBoundaryResponse:
        return AIPermissionBoundaryResponse(
            allowed_context=list(ALLOWED_CONTEXT),
            forbidden_context=list(FORBIDDEN_CONTEXT),
            requires_unlock_surfaces=list(REQUIRES_UNLOCK),
            requires_confirmation=list(REQUIRES_CONFIRMATION),
            audit_events=list(AUDIT_EVENTS),
        )

    def list_templates(self) -> list[AIPromptTemplateDefinition]:
        return list(PROMPT_TEMPLATES.values())

    def context_preview(self, brief_id: str) -> AIContextPreviewResponse:
        brief = self.research_service.get_brief(brief_id)
        prompt_context = self._build_prompt_context(brief)
        event = self.security_audit_service.record(
            category="ai_assistant",
            event_type="ai_context_preview_created",
            subject=brief.brief_id,
            summary="Created a redacted AI research context preview.",
            payload={
                "brief_id": brief.brief_id,
                "symbol": brief.symbol,
                "allowed_sections": ["asset", "data_quality", "decision_review", "analysis_modules", "notes"],
                "redacted_sections": ["notes"],
                "blocked_sections": ["credentials", "sessions", "execution_submit", "raw_runtime_logs"],
                "cloud_transmission_allowed": False,
            },
            surface="ai_assistant",
        )
        return AIContextPreviewResponse(
            brief_id=brief.brief_id,
            symbol=brief.symbol,
            title=brief.title,
            allowed_sections=["asset", "data_quality", "decision_review", "analysis_modules", "notes"],
            redacted_sections=["notes"],
            blocked_sections=["credentials", "sessions", "execution_submit", "raw_runtime_logs"],
            citations=self._citations(brief),
            data_quality=brief.data_quality.overall if brief.data_quality else None,
            stale=brief.stale,
            prompt_context_preview=prompt_context,
            estimated_input_chars=len(prompt_context),
            cloud_transmission_allowed=False,
            audited_event_id=event.event_id,
        )

    def generate(self, brief_id: str, payload: AIAssistantGenerateRequest) -> AIAssistantGenerateResponse:
        preview = self.context_preview(brief_id)
        requested = self.security_audit_service.record(
            category="ai_assistant",
            event_type="ai_generation_requested",
            subject=brief_id,
            summary="AI research assistant generation requested.",
            payload={
                "brief_id": brief_id,
                "template_key": payload.template_key,
                "provider": "local" if self.settings.ai_assistant_enabled else "disabled",
                "include_notes": payload.include_notes,
            },
            surface="ai_assistant",
        )
        if not self.settings.ai_assistant_enabled:
            blocked = self.security_audit_service.record(
                category="ai_assistant",
                event_type="ai_generation_blocked",
                subject=brief_id,
                summary="AI generation blocked because assistant features are disabled.",
                payload={"brief_id": brief_id, "reason": "ai_disabled"},
                surface="ai_assistant",
            )
            return AIAssistantGenerateResponse(
                status="blocked",
                template_key=payload.template_key,
                provider="disabled",
                model=self.settings.ai_local_model,
                generated_at=_utc_now_iso(),
                summary="AI assistant generation is disabled until the user explicitly enables local AI.",
                limitations=["AI assistant features are default-off."],
                citations=preview.citations,
                blocked_reasons=["ai_disabled"],
                audit_event_ids=[preview.audited_event_id or "", requested.event_id, blocked.event_id],
                output_markdown="AI assistant generation is disabled until local AI is explicitly enabled.",
            )

        brief = self.research_service.get_brief(brief_id)
        summary = self._grounded_summary(brief, payload.template_key)
        questions = self._grounded_questions(brief, payload.template_key)
        risks = self._grounded_risks(brief, payload.template_key)
        limitations = self._grounded_limitations(brief)
        markdown = self._render_markdown(
            brief=brief,
            summary=summary,
            questions=questions,
            risks=risks,
            limitations=limitations,
            citations=preview.citations,
            include_notes=payload.include_notes,
        )
        completed = self.security_audit_service.record(
            category="ai_assistant",
            event_type="ai_generation_completed",
            subject=brief_id,
            summary="AI research assistant generated a grounded local draft.",
            payload={
                "brief_id": brief_id,
                "template_key": payload.template_key,
                "citation_count": len(preview.citations),
                "output_chars": len(markdown),
                "provider": "local",
            },
            surface="ai_assistant",
        )
        return AIAssistantGenerateResponse(
            status="completed",
            template_key=payload.template_key,
            provider="local",
            model=self.settings.ai_local_model,
            generated_at=_utc_now_iso(),
            summary=summary,
            questions=questions,
            risks=risks,
            limitations=limitations,
            citations=preview.citations,
            audit_event_ids=[preview.audited_event_id or "", requested.event_id, completed.event_id],
            output_markdown=markdown,
        )

    def _citations(self, brief: ResearchBrief) -> list[AIContextCitation]:
        citations = [
            AIContextCitation(
                source_type="research_brief",
                source_id=brief.brief_id,
                label="Research brief",
                status="cached" if brief.stale else "observed",
                summary=f"{brief.symbol} brief generated at {brief.generated_at}.",
            ),
            AIContextCitation(
                source_type="asset_snapshot",
                source_id=brief.symbol,
                label="Asset snapshot",
                status="cached" if brief.asset_snapshot.stale else "observed",
                summary=f"{brief.asset_snapshot.asset.provider}; quote currency {brief.asset_snapshot.quote.currency}.",
            ),
        ]
        if brief.evidence_context and brief.evidence_context.audit:
            citations.append(
                AIContextCitation(
                    source_type="audit",
                    source_id=",".join(brief.evidence_context.audit.event_ids[:4]) or "audit-summary",
                    label="Evidence audit",
                    status="audited",
                    summary=f"{brief.evidence_context.audit.event_count} audit event(s) attached.",
                )
            )
        for item in brief.decision_review.provenance[:4]:
            citations.append(
                AIContextCitation(
                    source_type="decision_provenance",
                    source_id=item.label,
                    label=item.label,
                    status=item.status,
                    summary=item.detail,
                )
            )
        return citations

    def _build_prompt_context(self, brief: ResearchBrief) -> str:
        review = brief.decision_review
        notes = self._redact_text(brief.notes.markdown.strip()) if brief.notes.markdown else ""
        evidence = "; ".join(f"{item.status} {item.label}: {item.summary}" for item in review.supporting_evidence[:4])
        risks = "; ".join(review.risks[:4]) or "No explicit risks recorded."
        limitations = (
            "; ".join(brief.data_quality.limitations if brief.data_quality else [])
            or "No structured data-quality limitations recorded."
        )
        return "\n".join(
            [
                f"Symbol: {brief.symbol}",
                f"Title: {brief.title}",
                f"Stale: {brief.stale}",
                f"Data quality: {brief.data_quality.overall if brief.data_quality else 'unknown'}",
                f"Limitations: {limitations}",
                f"Thesis: {review.thesis}",
                f"Supporting evidence: {evidence}",
                f"Risks: {risks}",
                f"Notes: {notes or 'No user notes selected.'}",
                "Boundary: do not infer facts outside the cited local evidence.",
            ]
        )

    def _redact_text(self, value: str) -> str:
        redacted = value
        for pattern in SECRET_PATTERNS:
            redacted = pattern.sub("[redacted]", redacted)
        return redacted

    def _grounded_summary(self, brief: ResearchBrief, template_key: AIPromptTemplateKey) -> str:
        review = brief.decision_review
        matched = len([item for item in brief.screener_context.summaries if item.matched])
        quality = brief.data_quality.overall if brief.data_quality else "unknown"
        stale = "cached/stale" if brief.stale else "observed"
        if template_key == "counter_thesis":
            counter = "; ".join(item.summary for item in review.counter_evidence[:3]) or "No counter-evidence recorded."
            return f"Counter-thesis for {brief.symbol}: {counter} The data-quality state is {quality}, so the conclusion must stay conditional."
        if template_key == "earnings_review":
            return (
                f"Earnings review for {brief.symbol} is limited to local fundamentals status "
                f"{brief.asset_snapshot.capabilities.fundamentals_status} and filings status "
                f"{brief.asset_snapshot.capabilities.filings_status}; no uncited earnings date or estimate was added."
            )
        if template_key == "portfolio_risk":
            held = "held locally" if brief.portfolio_context.in_portfolio else "not held locally"
            return f"Portfolio risk view: {brief.symbol} is {held}; any position decision must preserve the {quality} data-quality boundary."
        if template_key == "provider_limitation":
            limits = "; ".join(brief.data_quality.limitations if brief.data_quality else []) or "No explicit limitation recorded."
            return f"Provider limitation view for {brief.symbol}: {limits} Capability states must remain visible before export."
        if template_key == "report_rewrite":
            return f"Report rewrite boundary for {brief.symbol}: rewrite only the local evidence story and keep private-state exclusions explicit."
        if template_key == "thesis":
            return f"Thesis draft for {brief.symbol}: {review.thesis} This remains bounded by {quality} data quality and {stale} evidence."
        return (
            f"{brief.symbol} has a {stale} research brief using template {review.template_key}. "
            f"Current data quality is {quality}; {matched} screener profile(s) matched. "
            f"The assistant draft should preserve the thesis boundary: {review.conclusion}"
        )

    def _grounded_questions(self, brief: ResearchBrief, template_key: AIPromptTemplateKey) -> list[str]:
        questions = list(brief.decision_review.watch_items[:3])
        if template_key == "provider_limitation":
            questions.insert(0, "Which provider state is observed, cached, blocked, credential_required, or unsupported?")
        if template_key == "portfolio_risk":
            questions.insert(0, "Does the local portfolio context show an actual holding or only a research handoff draft?")
        if brief.asset_snapshot.capabilities.fundamentals_status != "available":
            questions.append("What changes if fundamentals remain unavailable for this symbol?")
        if brief.asset_snapshot.capabilities.filings_status != "available":
            questions.append("What filing or disclosure gap should be resolved before relying on this brief?")
        if not questions:
            questions.append("What evidence would most improve confidence before this brief is exported?")
        return questions[:5]

    def _grounded_risks(self, brief: ResearchBrief, template_key: AIPromptTemplateKey) -> list[str]:
        risks = list(brief.decision_review.risks[:4])
        if template_key == "earnings_review" and brief.asset_snapshot.capabilities.filings_status != "available":
            risks.append("Filing evidence is not available, so earnings commentary must remain limited.")
        if template_key == "provider_limitation":
            risks.append("Provider limitation language must not be softened into an availability claim.")
        if brief.stale:
            risks.append("The active asset snapshot is cached or stale.")
        if brief.data_quality and brief.data_quality.limitations:
            risks.extend(brief.data_quality.limitations[:3])
        return risks or ["No additional risk beyond the recorded evidence boundary was inferred."]

    def _grounded_limitations(self, brief: ResearchBrief) -> list[str]:
        limitations = [
            "Only local Research evidence, data-quality labels, and provenance were used.",
            "No external web claim or uncited market fact was added.",
        ]
        if brief.data_quality and brief.data_quality.limitations:
            limitations.extend(brief.data_quality.limitations[:4])
        return limitations

    def _render_markdown(
        self,
        *,
        brief: ResearchBrief,
        summary: str,
        questions: list[str],
        risks: list[str],
        limitations: list[str],
        citations: list[AIContextCitation],
        include_notes: bool,
    ) -> str:
        lines = [
            f"## AI Research Assistant Draft: {brief.symbol}",
            "",
            "### Grounded Summary",
            "",
            summary,
            "",
            "### Questions",
            "",
        ]
        lines.extend(f"- {item}" for item in questions)
        lines.extend(["", "### Risks", ""])
        lines.extend(f"- {item}" for item in risks)
        lines.extend(["", "### Limitations", ""])
        lines.extend(f"- {item}" for item in limitations)
        if include_notes and brief.notes.markdown:
            lines.extend(["", "### Redacted Notes Context", "", self._redact_text(brief.notes.markdown)])
        lines.extend(["", "### Citations", ""])
        lines.extend(f"- `{item.status}` {item.label}: {item.summary}" for item in citations)
        lines.extend(["", "Boundary: this draft is local, evidence-grounded, and does not authorize execution."])
        return "\n".join(lines)
