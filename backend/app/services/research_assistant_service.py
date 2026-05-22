from __future__ import annotations

import re

from ..models import (
    AIContextCitation,
    AIContextPreviewResponse,
    AIPermissionBoundaryResponse,
    ResearchBrief,
)
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


SECRET_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9_-]{16,}"),
    re.compile(r"(?i)(api[_ -]?key|secret|password|token)\s*[:=]\s*[\w.\-_/+]{6,}"),
]


class ResearchAssistantService:
    def __init__(self, research_service: ResearchService, security_audit_service: SecurityAuditService) -> None:
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
