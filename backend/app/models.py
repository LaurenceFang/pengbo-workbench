from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


ViewKey = Literal[
    "dashboard",
    "commandCenter",
    "asset",
    "watchlist",
    "research",
    "factorLab",
    "strategyLab",
    "workflowStudio",
    "dataSources",
    "screeners",
    "manual",
    "portfolio",
    "connections",
    "settings",
]
LanguagePreference = Literal["zh-CN", "en-US"]
DensityPreference = Literal["standard", "compact"]
OnboardingStepKey = Literal[
    "demo_mode",
    "provider_setup",
    "local_unlock",
    "privacy_boundary",
    "execution_boundary",
]
ConnectionHealth = Literal["ok", "error", "missing_credentials", "cached", "planned", "unsupported", "unavailable"]
FreshnessState = Literal[
    "fresh",
    "cached",
    "stale",
    "refresh_failed",
    "offline",
    "credential_required",
    "unavailable",
    "unsupported",
    "unknown",
]
DataQualityLevel = Literal["complete", "partial", "limited", "blocked", "unknown"]
DataQualityConfidence = Literal["official", "public", "provider", "local_cache", "simulated", "unsupported", "unknown"]
CredentialState = Literal[
    "missing",
    "configured",
    "invalid",
    "expired",
    "disabled",
    "read_only",
    "trading_gated",
    "blocked",
]
CredentialActionKind = Literal[
    "none",
    "save_credentials",
    "test_connection",
    "check_permissions",
    "refresh_credentials",
    "enable_provider",
    "unlock_local",
    "confirm_trading_gate",
]
ProviderCapabilityStatusHint = Literal["available", "credential_required", "unsupported"]
AssetCapabilityStatus = Literal["available", "credential_required", "unsupported", "temporarily_unavailable"]
ScreenerUniverseSource = Literal["catalog", "expanded"]
ScreenerScoreLabel = Literal["high", "medium", "watch"]
ScreenerTuningLevel = Literal["low", "medium", "high"]
PriceHistoryInterval = Literal["15m", "30m", "1h", "2h", "4h", "8h", "1d", "1wk", "1mo", "1y"]
PortfolioDataStatus = Literal["live", "cached", "unavailable"]
PortfolioAnalyticsWindowKey = Literal["today", "mtd", "ytd", "one_year", "max"]
FactorFamilyKey = Literal[
    "momentum_12_1",
    "value",
    "quality_profitability",
    "conservative_growth",
    "low_volatility_risk",
    "crypto_momentum_strength",
    "crypto_volume_confirmation",
    "crypto_overheat_guardrail",
    "index_trend_breadth",
    "index_defensive_quality",
    "short_term_reversal",
    "composite",
]
FactorScoreBucket = Literal["leader", "candidate", "watch", "insufficient"]
StrategyTemplateKey = Literal["top_n_factor_rotation"]
StrategyRebalanceInterval = Literal["monthly", "quarterly"]
StrategyExecutionMode = Literal["backtest", "paper"]
ExecutionOrderSide = Literal["buy", "sell"]
ExecutionOrderType = Literal["market", "limit"]
ExecutionIntentStatus = Literal["draft", "blocked", "submitted", "filled", "rejected"]
ExecutionRiskDecisionStatus = Literal["pass", "block"]
WorkflowTemplateKey = Literal[
    "screener_to_research",
    "data_sources_to_research",
    "research_to_factor",
    "factor_to_backtest",
    "backtest_to_paper",
    "paper_to_binance_intent",
    "evidence_report_export",
]
WorkflowActionPolicy = Literal[
    "read_only",
    "local_analysis",
    "local_simulation",
    "binance_intent",
    "user_confirmed_binance_submit",
]
WorkflowRunStatus = Literal["pending", "running", "completed", "blocked", "failed"]
WorkflowStepStatus = Literal["pending", "running", "completed", "blocked", "failed", "manual_required"]
SessionPermission = Literal[
    "session:read",
    "security:audit:read",
    "credentials:manage",
    "execution:manage",
    "account:read",
    "reports:export",
    "ai:context",
    "ai:generate",
]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    message: str
    app_version: str
    sidecar_version: str


class TranslationStatusResponse(BaseModel):
    enabled: bool
    provider: str
    configured: bool
    message: str


class TranslationSuggestRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2_000)
    source_language: LanguagePreference = Field(default="en-US", alias="sourceLanguage")
    target_language: LanguagePreference = Field(default="zh-CN", alias="targetLanguage")


class TranslationSuggestResponse(BaseModel):
    translated_text: str
    provider: str
    configured: bool
    used_fallback: bool


AIProviderMode = Literal["disabled", "local", "cloud"]
AIRuntimeHealth = Literal["disabled", "available", "unavailable", "timeout", "error"]


class AILocalModelInfo(BaseModel):
    name: str
    size_bytes: int | None = None
    modified_at: str | None = None


class AIRuntimeStatusResponse(BaseModel):
    enabled: bool
    mode: AIProviderMode = "disabled"
    local_provider: str
    local_base_url: str
    selected_model: str | None = None
    health: AIRuntimeHealth
    model_count: int = 0
    models: list[AILocalModelInfo] = Field(default_factory=list)
    latency_ms: int | None = None
    checked_at: str
    message: str
    evidence_path: str | None = None


class AIPermissionBoundaryResponse(BaseModel):
    allowed_context: list[str]
    forbidden_context: list[str]
    requires_unlock_surfaces: list[str]
    requires_confirmation: list[str]
    audit_events: list[str]
    default_mode: AIProviderMode = "disabled"


class AIContextCitation(BaseModel):
    source_type: str
    source_id: str
    label: str
    status: str
    summary: str


class AIContextPreviewResponse(BaseModel):
    brief_id: str
    symbol: str
    title: str
    allowed_sections: list[str]
    redacted_sections: list[str]
    blocked_sections: list[str]
    citations: list[AIContextCitation] = Field(default_factory=list)
    data_quality: DataQualityLevel | None = None
    stale: bool
    prompt_context_preview: str
    estimated_input_chars: int
    cloud_transmission_allowed: bool = False
    audited_event_id: str | None = None


class WorkflowTemplateStepDefinition(BaseModel):
    step_key: str
    title: str
    policy: WorkflowActionPolicy
    description: str


class WorkflowTemplateDefinition(BaseModel):
    template_key: WorkflowTemplateKey
    title: str
    description: str
    steps: list[WorkflowTemplateStepDefinition] = Field(default_factory=list)


class WorkflowArtifactRef(BaseModel):
    artifact_id: str
    artifact_type: str
    label: str
    source_step_key: str | None = None


class WorkflowAuditEvent(BaseModel):
    event_id: str
    created_at: str
    event_type: str
    summary: str
    details: dict[str, Any] = Field(default_factory=dict)


class WorkflowStepState(BaseModel):
    step_key: str
    title: str
    policy: WorkflowActionPolicy
    status: WorkflowStepStatus = "pending"
    started_at: str | None = None
    completed_at: str | None = None
    input: dict[str, Any] = Field(default_factory=dict)
    output: dict[str, Any] = Field(default_factory=dict)
    artifact_refs: list[WorkflowArtifactRef] = Field(default_factory=list)
    blocked_reasons: list[str] = Field(default_factory=list)
    error: str | None = None
    provenance: dict[str, Any] = Field(default_factory=dict)


class WorkflowRunRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    template_key: WorkflowTemplateKey = Field(alias="templateKey")
    input: dict[str, Any] = Field(default_factory=dict)


class WorkflowRunResponse(BaseModel):
    run_id: str
    template_key: WorkflowTemplateKey
    status: WorkflowRunStatus
    created_at: str
    updated_at: str
    input: dict[str, Any] = Field(default_factory=dict)
    steps: list[WorkflowStepState] = Field(default_factory=list)
    output: dict[str, Any] = Field(default_factory=dict)
    artifact_refs: list[WorkflowArtifactRef] = Field(default_factory=list)
    blocked_reasons: list[str] = Field(default_factory=list)
    audit_events: list[WorkflowAuditEvent] = Field(default_factory=list)
    manual_confirmation_required: bool = False
    manual_confirmation_policy: WorkflowActionPolicy | None = None


class AssetSearchResult(BaseModel):
    symbol: str
    name: str
    market: str
    asset_class: str
    currency: str
    provider: str


class QuoteResponse(BaseModel):
    symbol: str
    price: float
    change: float
    change_pct: float
    currency: str
    provider: str
    as_of: str


class PricePoint(BaseModel):
    timestamp: str
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float
    volume: float


class FundamentalOverview(BaseModel):
    symbol: str
    company: str
    sector: str | None = None
    market_cap: str | None = None
    summary: str


class RatioItem(BaseModel):
    label: str
    value: str
    note: str


class FilingItem(BaseModel):
    type: str
    filed_at: str
    headline: str
    status: str


class ConnectionCheckRequest(BaseModel):
    provider: str
    mode: str = "read-only"


class ConnectionCheckResponse(BaseModel):
    provider: str
    status: ConnectionHealth
    message: str
    stale: bool = False
    requires_credentials: bool = False
    credential_state: CredentialState = "read_only"
    credential_state_label: str = "Read-only"
    credential_next_action: str = "No credential action is required."
    credential_action_kind: CredentialActionKind = "none"
    credential_state_reason: str | None = None
    credential_summary: str | None = None
    last_tested_at: str | None = None
    last_success_at: str | None = None
    cache_updated_at: str | None = None
    cache_age_seconds: int | None = None
    profile_id: str = "local_default"
    profile_label: str = "Local default"


class SourceFreshnessMetadata(BaseModel):
    label: str
    expected_lag: str | None = None
    as_of_field: str | None = None
    cache_ttl_seconds: int | None = None
    stale_after_seconds: int | None = None
    refresh_behavior: str | None = None
    offline_behavior: str | None = None


class SourceProvenanceMetadata(BaseModel):
    provider: str
    upstream: str | None = None
    license_note: str | None = None
    source_url: str | None = None


class DataQualityDimension(BaseModel):
    level: DataQualityLevel = "unknown"
    label: str
    detail: str
    signals: list[str] = Field(default_factory=list)


class DataQualityStatus(BaseModel):
    overall: DataQualityLevel = "unknown"
    completeness: DataQualityDimension
    timeliness: DataQualityDimension
    source_confidence: DataQualityDimension
    limitations: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    machine_tags: list[str] = Field(default_factory=list)


class ConnectionStatusItem(BaseModel):
    provider: str
    label: str
    configured: bool
    health: ConnectionHealth
    last_message: str | None = None
    stale: bool = False
    requires_credentials: bool = False
    credential_state: CredentialState = "read_only"
    credential_state_label: str = "Read-only"
    credential_next_action: str = "No credential action is required."
    credential_action_kind: CredentialActionKind = "none"
    credential_state_reason: str | None = None
    credential_summary: str | None = None
    last_tested_at: str | None = None
    last_success_at: str | None = None
    cache_updated_at: str | None = None
    cache_age_seconds: int | None = None
    profile_id: str = "local_default"
    profile_label: str = "Local default"


class CredentialProfile(BaseModel):
    profile_id: str
    label: str
    is_active: bool = False
    created_at: str
    updated_at: str


class ConnectionsStatusResponse(BaseModel):
    providers: list[ConnectionStatusItem]
    profiles: list[CredentialProfile] = Field(default_factory=list)
    active_profile: CredentialProfile | None = None


class CreateCredentialProfileRequest(BaseModel):
    label: str = Field(min_length=1, max_length=80)


class SetActiveCredentialProfileRequest(BaseModel):
    profile_id: str = Field(min_length=1, max_length=80)


class ProviderCapability(BaseModel):
    key: str
    label: str
    supported: bool
    requires_credentials: bool
    status_hint: ProviderCapabilityStatusHint
    notes: list[str] = Field(default_factory=list)
    endpoint_coverage: list[str] = Field(default_factory=list)
    data_domains: list[str] = Field(default_factory=list)
    asset_coverage: list[str] = Field(default_factory=list)
    regions: list[str] = Field(default_factory=list)
    locales: list[str] = Field(default_factory=list)
    rate_limit_note: str | None = None
    cache_policy: str | None = None
    freshness: SourceFreshnessMetadata | None = None
    provenance: SourceProvenanceMetadata | None = None
    testable: bool = False
    test_mode: str | None = None
    read_only: bool = True
    credential_note: str | None = None
    unsupported_reason: str | None = None
    decision_note: str | None = None


class ProviderCapabilityProviderItem(BaseModel):
    provider: str
    label: str
    description: str | None = None
    endpoint_coverage: list[str] = Field(default_factory=list)
    data_domains: list[str] = Field(default_factory=list)
    asset_coverage: list[str] = Field(default_factory=list)
    regions: list[str] = Field(default_factory=list)
    locales: list[str] = Field(default_factory=list)
    credential_note: str | None = None
    rate_limit_note: str | None = None
    cache_policy: str | None = None
    freshness: SourceFreshnessMetadata | None = None
    provenance: SourceProvenanceMetadata | None = None
    testable: bool = False
    test_mode: str | None = None
    read_only: bool = True
    live_trading: bool = False
    write_status: str = "read_only"
    execution_boundary: str | None = None
    matrix_summary: str | None = None
    capabilities: list[ProviderCapability] = Field(default_factory=list)


class ConnectionsCatalogResponse(BaseModel):
    providers: list[ProviderCapabilityProviderItem]


class DataSourceRuntimeStatus(BaseModel):
    provider: str
    label: str
    configured: bool
    health: ConnectionHealth
    message: str
    stale: bool = False
    requires_credentials: bool = False
    cache_updated_at: str | None = None
    cache_age_seconds: int | None = None
    freshness_state: FreshnessState = "unknown"
    freshness: SourceFreshnessMetadata | None = None
    last_success_at: str | None = None
    data_quality: DataQualityStatus | None = None
    registration_url: str | None = None
    paid_setup_url: str | None = None


class DataSourceStatusResponse(BaseModel):
    providers: list[DataSourceRuntimeStatus]


class DataSourceProvenance(BaseModel):
    provider: str
    label: str
    source_url: str
    fetched_at: str | None = None
    freshness: SourceFreshnessMetadata | None = None
    freshness_state: FreshnessState = "unknown"
    cache_age_seconds: int | None = None
    stale: bool = False
    unavailable_reason: str | None = None
    data_quality: DataQualityStatus | None = None


class MacroSeriesPoint(BaseModel):
    date: str
    value: float | None = None


class MacroSeriesResponse(BaseModel):
    provider: str
    series_id: str
    title: str
    geography: str | None = None
    frequency: str | None = None
    unit: str | None = None
    observations: list[MacroSeriesPoint] = Field(default_factory=list)
    provenance: DataSourceProvenance


class CryptoMarketItem(BaseModel):
    id: str
    symbol: str
    name: str
    price_usd: float | None = None
    market_cap_usd: float | None = None
    volume_24h_usd: float | None = None
    price_change_24h_pct: float | None = None
    as_of: str | None = None


class CryptoMarketsResponse(BaseModel):
    provider: str
    assets: list[CryptoMarketItem] = Field(default_factory=list)
    provenance: DataSourceProvenance


class NewsEventItem(BaseModel):
    title: str
    source: str
    url: str
    published_at: str | None = None
    summary: str | None = None
    symbols: list[str] = Field(default_factory=list)


class NewsEventsResponse(BaseModel):
    provider: str
    query: str | None = None
    events: list[NewsEventItem] = Field(default_factory=list)
    provenance: DataSourceProvenance


class DataSourceReportExportRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    macro_provider: str = Field(default="worldbank", alias="macroProvider")
    macro_series_id: str = Field(default="NY.GDP.MKTP.CD", alias="macroSeriesId")
    macro_country: str = Field(default="CN", alias="macroCountry")
    news_query: str = Field(default="market OR earnings", alias="newsQuery")
    crypto_ids: str = Field(default="bitcoin,ethereum,solana", alias="cryptoIds")


class DataSourceReportSourceSummary(BaseModel):
    provider: str
    label: str
    health: ConnectionHealth
    configured: bool
    stale: bool = False
    fetched_at: str | None = None
    freshness_state: FreshnessState = "unknown"
    cache_age_seconds: int | None = None
    cache_ttl_seconds: int | None = None
    refresh_behavior: str | None = None
    offline_behavior: str | None = None
    data_quality: DataQualityStatus | None = None
    source_url: str | None = None
    unavailable_reason: str | None = None
    read_only: bool = True
    live_trading: bool = False


class DataSourceReportExportResponse(BaseModel):
    export_path: str
    generated_at: str
    included_sources: list[DataSourceReportSourceSummary] = Field(default_factory=list)
    provenance_summary: list[str] = Field(default_factory=list)


class WatchlistUpdateRequest(BaseModel):
    symbols: list[str]


class DashboardMarketPulse(BaseModel):
    label: str
    symbol: str
    value: float
    change_pct: float
    currency: str
    tone: Literal["up", "down", "neutral"]


class WatchlistAssetSnapshot(BaseModel):
    symbol: str
    name: str
    market: str
    asset_class: str
    currency: str
    provider: str
    price: float
    change: float
    change_pct: float
    trend: list[float]
    summary: str


class DashboardConnectionSummary(BaseModel):
    binance_configured: bool
    binance_account_healthy: bool | None = None
    watchlist_count: int
    data_mode: Literal["live", "cached"]


class DashboardOverviewResponse(BaseModel):
    updated_at: str
    stale: bool
    market_pulse: list[DashboardMarketPulse]
    watchlist: list[WatchlistAssetSnapshot]
    focus_asset: WatchlistAssetSnapshot | None = None
    connection_summary: DashboardConnectionSummary


class AssetCapabilities(BaseModel):
    has_fundamentals: bool
    has_filings: bool
    fundamentals_status: AssetCapabilityStatus = "unsupported"
    filings_status: AssetCapabilityStatus = "unsupported"
    fundamentals_message: str | None = None
    filings_message: str | None = None
    notes: list[str] = Field(default_factory=list)


class AssetWorkspaceResponse(BaseModel):
    updated_at: str
    stale: bool
    asset: AssetSearchResult
    quote: QuoteResponse
    history: list[PricePoint]
    overview: FundamentalOverview | None = None
    ratios: list[RatioItem] = Field(default_factory=list)
    filings: list[FilingItem] = Field(default_factory=list)
    capabilities: AssetCapabilities


class ResearchBriefSourceContext(BaseModel):
    source_preset_key: str | None = None
    source_variant_key: str | None = None
    source_universe_source: ScreenerUniverseSource | None = None
    data_source_provider: str | None = None
    data_source_kind: str | None = None
    data_source_query: str | None = None
    factor_run_id: str | None = None
    backtest_run_id: str | None = None
    paper_session_id: str | None = None
    intent_id: str | None = None
    source_label: str | None = None


class ResearchFactorContribution(BaseModel):
    family: FactorFamilyKey
    label: str
    score: float | None = None
    weight: float
    evidence: list[str] = Field(default_factory=list)
    missing_metrics: list[str] = Field(default_factory=list)


class ResearchFactorContext(BaseModel):
    run_id: str
    family: FactorFamilyKey
    universe_source: ScreenerUniverseSource
    asset_type: str
    as_of: str
    symbol: str
    rank: int | None = None
    percentile: float | None = None
    composite_score: float | None = None
    bucket: FactorScoreBucket = "insufficient"
    missing_data: list[str] = Field(default_factory=list)
    contributions: list[ResearchFactorContribution] = Field(default_factory=list)


class ResearchScreenerSummary(BaseModel):
    preset_key: str
    preset_title: str
    variant_key: str | None = None
    variant_name: str | None = None
    universe_source: ScreenerUniverseSource
    matched: bool
    score: float | None = None
    score_label: ScreenerScoreLabel | None = None
    explanations: list[str] = Field(default_factory=list)
    matched_rules: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    stale: bool = False


class ResearchScreenerContext(BaseModel):
    source: ResearchBriefSourceContext | None = None
    summaries: list[ResearchScreenerSummary] = Field(default_factory=list)


class AnalysisHighlight(BaseModel):
    label: str
    value: str
    tone: Literal["neutral", "positive", "caution"] = "neutral"


class AnalysisSection(BaseModel):
    title: str
    body: str
    kind: Literal["paragraph", "bullets"] = "paragraph"
    items: list[str] = Field(default_factory=list)


class AnalysisSource(BaseModel):
    label: str
    detail: str | None = None


class AnalysisModuleResult(BaseModel):
    key: str
    title: str
    summary: str
    highlights: list[AnalysisHighlight] = Field(default_factory=list)
    sections: list[AnalysisSection] = Field(default_factory=list)
    sources: list[AnalysisSource] = Field(default_factory=list)
    generated_at: str
    stale: bool = False


class ResearchPortfolioHandoffDraft(BaseModel):
    symbol: str
    side: Literal["buy", "sell"]
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)
    fees: float = Field(ge=0, default=0)
    traded_at: str
    notes: str | None = None


class ResearchPortfolioContext(BaseModel):
    in_portfolio: bool
    quantity: float | None = None
    average_cost: float | None = None
    valuation_status: PortfolioDataStatus | None = None
    market_value: float | None = None
    cost_basis: float | None = None
    transaction_count: int = 0
    notes: list[str] = Field(default_factory=list)
    provenance: list["PortfolioProvenanceItem"] = Field(default_factory=list)
    handoff_draft: ResearchPortfolioHandoffDraft


class ResearchNoteState(BaseModel):
    markdown: str
    updated_at: str


class ResearchExportInfo(BaseModel):
    last_export_path: str | None = None


class ResearchEvidenceBacktestSummary(BaseModel):
    run_id: str
    template_key: StrategyTemplateKey
    factor_run_id: str
    created_at: str
    total_return_pct: float | None = None
    max_drawdown_pct: float | None = None
    trade_count: int = 0
    position_count: int = 0
    assumptions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    no_live_orders: bool = True


class ResearchEvidencePaperSessionSummary(BaseModel):
    session_id: str
    backtest_run_id: str
    created_at: str
    status: str
    order_count: int = 0
    fill_count: int = 0
    ledger_count: int = 0
    cash_balance: float | None = None
    total_pnl: float | None = None
    no_live_orders: bool = True
    warnings: list[str] = Field(default_factory=list)


class ResearchEvidenceExecutionSummary(BaseModel):
    intent_id: str | None = None
    status: ExecutionIntentStatus | None = None
    symbol: str | None = None
    side: ExecutionOrderSide | None = None
    estimated_notional: float | None = None
    live_order_recorded: bool = False
    no_live_order_until_submit: bool = True
    blocked_checks: list[str] = Field(default_factory=list)
    risk_decision_count: int = 0
    audit_event_count: int = 0


class ResearchEvidenceAuditSummary(BaseModel):
    event_count: int = 0
    latest_event_at: str | None = None
    event_ids: list[str] = Field(default_factory=list)
    event_types: list[str] = Field(default_factory=list)


class ResearchEvidenceContext(BaseModel):
    factor: ResearchFactorContext | None = None
    screener: ResearchScreenerContext | None = None
    backtest: ResearchEvidenceBacktestSummary | None = None
    paper_session: ResearchEvidencePaperSessionSummary | None = None
    execution: ResearchEvidenceExecutionSummary | None = None
    audit: ResearchEvidenceAuditSummary | None = None
    data_quality_notes: list[str] = Field(default_factory=list)
    data_quality: DataQualityStatus | None = None


class ResearchBriefEvidenceItem(BaseModel):
    label: str
    summary: str
    status: Literal["observed", "cached", "simulated", "degraded", "blocked", "audited", "unsupported"]


class ResearchBriefProvenanceItem(BaseModel):
    label: str
    detail: str
    status: Literal["observed", "cached", "simulated", "degraded", "blocked", "audited", "unsupported"]


class ResearchBriefDecisionReview(BaseModel):
    template_key: Literal["equity", "crypto", "portfolio", "macro"]
    thesis: str
    assumptions: list[str] = Field(default_factory=list)
    supporting_evidence: list[ResearchBriefEvidenceItem] = Field(default_factory=list)
    counter_evidence: list[ResearchBriefEvidenceItem] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    watch_items: list[str] = Field(default_factory=list)
    provenance: list[ResearchBriefProvenanceItem] = Field(default_factory=list)
    conclusion: str


class ResearchBrief(BaseModel):
    brief_id: str
    symbol: str
    title: str
    generated_at: str
    updated_at: str
    stale: bool
    asset_snapshot: AssetWorkspaceResponse
    screener_context: ResearchScreenerContext
    factor_context: ResearchFactorContext | None = None
    evidence_context: ResearchEvidenceContext | None = None
    portfolio_context: ResearchPortfolioContext
    analysis_modules: list[AnalysisModuleResult] = Field(default_factory=list)
    decision_review: ResearchBriefDecisionReview
    data_quality: DataQualityStatus | None = None
    notes: ResearchNoteState
    export_info: ResearchExportInfo


class ResearchBriefListItem(BaseModel):
    brief_id: str
    symbol: str
    title: str
    generated_at: str
    updated_at: str
    stale: bool
    source: ResearchBriefSourceContext | None = None


class CreateResearchBriefRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(min_length=1)
    source_preset_key: str | None = Field(default=None, alias="sourcePresetKey")
    source_variant_key: str | None = Field(default=None, alias="sourceVariantKey")
    source_universe_source: ScreenerUniverseSource | None = Field(default=None, alias="sourceUniverseSource")
    data_source_provider: str | None = Field(default=None, alias="dataSourceProvider")
    data_source_kind: str | None = Field(default=None, alias="dataSourceKind")
    data_source_query: str | None = Field(default=None, alias="dataSourceQuery")
    factor_run_id: str | None = Field(default=None, alias="factorRunId")
    backtest_run_id: str | None = Field(default=None, alias="backtestRunId")
    paper_session_id: str | None = Field(default=None, alias="paperSessionId")
    intent_id: str | None = Field(default=None, alias="intentId")


class UpdateResearchBriefNotesRequest(BaseModel):
    markdown: str = ""


class ResearchBriefExportResponse(BaseModel):
    brief_id: str
    export_path: str


class BinanceBalanceItem(BaseModel):
    asset: str
    free: float
    used: float
    total: float


class BinanceAccountSnapshot(BaseModel):
    updated_at: str
    stale: bool
    exchange: str
    balances: list[BinanceBalanceItem]
    total_assets: int


class SettingsRuntimeResponse(BaseModel):
    app_version: str
    sidecar_version: str
    base_url: str
    runtime_mode: str
    data_dir: str
    log_dir: str
    diagnostics_dir: str
    sqlite_path: str
    duckdb_path: str
    sidecar_stdout_path: str
    sidecar_stderr_path: str
    sidecar_last_error_path: str
    sidecar_bootstrap_path: str
    build_summary_path: str | None = None


class AppPreferences(BaseModel):
    default_view: ViewKey
    quote_ttl_minutes: int = Field(ge=1, le=1_440)
    log_collection_enabled: bool
    diagnostics_export_enabled: bool
    language: LanguagePreference = "zh-CN"
    density: DensityPreference = "standard"


class UpdateAppPreferencesRequest(AppPreferences):
    pass


class OnboardingChecklistItem(BaseModel):
    key: OnboardingStepKey
    completed_at: str | None = None


class OnboardingState(BaseModel):
    onboarding_seen_at: str | None = None
    checklist: list[OnboardingChecklistItem] = Field(default_factory=list)


class UpdateOnboardingStateRequest(OnboardingState):
    pass


class DemoModeStatus(BaseModel):
    enabled: bool
    no_key_evaluation_ready: bool
    mode: str
    sample_surfaces: list[str]
    credential_gated_surfaces: list[str]
    missing_credentials: list[str]
    safety_boundaries: list[str]
    notes: list[str]


class PortfolioTransactionBase(BaseModel):
    symbol: str
    side: Literal["buy", "sell"]
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)
    fees: float = Field(ge=0, default=0)
    traded_at: str
    notes: str | None = None


class PortfolioTransactionCreate(PortfolioTransactionBase):
    pass


class PortfolioTransactionUpdate(PortfolioTransactionBase):
    pass


class PortfolioTransaction(PortfolioTransactionBase):
    id: int
    name: str
    market: str
    asset_class: str
    currency: str


class PortfolioProvenanceItem(BaseModel):
    label: str
    detail: str
    status: Literal["live", "cached", "unavailable", "audited"]
    provider: str | None = None
    source_id: str | None = None


class PortfolioHolding(BaseModel):
    symbol: str
    name: str
    market: str
    asset_class: str
    currency: str
    quantity: float
    average_cost: float
    current_price: float | None
    valuation_status: PortfolioDataStatus
    market_value: float | None
    cost_basis: float
    pnl: float | None
    pnl_pct: float | None
    allocation: float | None
    day_change_pct: float | None
    stale: bool
    notes: list[str] = Field(default_factory=list)
    data_quality: DataQualityStatus | None = None
    provenance: list[PortfolioProvenanceItem] = Field(default_factory=list)


class PortfolioValuePoint(BaseModel):
    date: str
    value: float


class PortfolioAnalyticsWindow(BaseModel):
    key: PortfolioAnalyticsWindowKey
    label: str
    status: PortfolioDataStatus
    start_date: str | None = None
    end_date: str | None = None
    start_value: float | None = None
    end_value: float | None = None
    total_return_pct: float | None = None
    max_drawdown_pct: float | None = None
    volatility_pct: float | None = None
    sharpe_style: float | None = None
    benchmark_symbol: str | None = None
    benchmark_return_pct: float | None = None
    benchmark_relative_return_pct: float | None = None
    notes: list[str] = Field(default_factory=list)


class PortfolioAllocationBucket(BaseModel):
    key: str
    label: str
    value: float
    allocation: float
    status: PortfolioDataStatus


class PortfolioPnlBreakdown(BaseModel):
    realized_pnl: float
    unrealized_pnl: float
    total_pnl: float
    method: Literal["average_cost"]
    notes: list[str] = Field(default_factory=list)


class PortfolioAnalytics(BaseModel):
    windows: list[PortfolioAnalyticsWindow] = Field(default_factory=list)
    pnl: PortfolioPnlBreakdown
    allocation: dict[str, list[PortfolioAllocationBucket]] = Field(default_factory=dict)
    concentration_pct: float | None = None
    notes: list[str] = Field(default_factory=list)


class PortfolioSummaryResponse(BaseModel):
    currency: str
    total_value: float
    total_cost: float
    total_pnl: float
    total_pnl_pct: float
    daily_pnl: float
    positions: int
    stale: bool
    degraded: bool
    notes: list[str] = Field(default_factory=list)
    missing_symbols: list[str] = Field(default_factory=list)
    benchmark_status: dict[str, PortfolioDataStatus] = Field(default_factory=dict)
    performance: list[PortfolioValuePoint]
    benchmarks: dict[str, list[PortfolioValuePoint]]
    analytics: PortfolioAnalytics
    data_quality: DataQualityStatus | None = None
    provenance: list[PortfolioProvenanceItem] = Field(default_factory=list)


class ScreenerPreset(BaseModel):
    key: str
    title: str
    badge: str
    description: str
    filters: list[str]
    asset_type: str
    hit_count: int
    updated_at: str
    active_variant_key: str | None = None
    active_variant_name: str | None = None


class ScreenerPresetVariant(BaseModel):
    variant_key: str
    preset_key: str
    name: str
    description: str
    tuning: dict[str, ScreenerTuningLevel]
    filters: list[str]
    is_system_default: bool
    is_active: bool
    last_hit_count: int
    updated_at: str


class CreateScreenerPresetVariantRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=240)


class UpdateScreenerPresetVariantRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=240)
    tuning: dict[str, ScreenerTuningLevel] | None = None


class UpdateScreenerPresetRequest(BaseModel):
    title: str | None = None
    badge: str | None = None
    description: str | None = None
    filters: list[str] | None = None
    asset_type: str | None = None


class ScreenerRunRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    preset: str
    asset_type: str | None = None
    universe_source: ScreenerUniverseSource = Field(default="catalog", alias="universeSource")
    variant_key: str | None = Field(default=None, alias="variantKey")


class ScreenerResult(BaseModel):
    symbol: str
    name: str
    market: str
    asset_class: str
    price: float
    change_pct: float
    score: float
    score_label: ScreenerScoreLabel
    stale: bool
    data_source: str
    matched_rules: list[str] = Field(default_factory=list)
    explanations: list[str] = Field(default_factory=list)
    missing_metrics: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    factor_context: ResearchFactorContext | None = None
    data_quality: DataQualityStatus | None = None


class ScreenerRunResponse(BaseModel):
    preset: str
    asset_type: str
    universe_source: ScreenerUniverseSource
    variant_key: str
    variant_name: str
    evaluated_count: int
    hit_count: int
    universe_label: str
    results: list[ScreenerResult]
    data_source_note: str


class FactorFamilyDefinition(BaseModel):
    key: FactorFamilyKey
    label: str
    description: str
    simple_description: str
    required_metrics: list[str] = Field(default_factory=list)
    research_only_note: str


class FactorRunRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    universe_source: ScreenerUniverseSource = Field(default="expanded", alias="universeSource")
    asset_type: Literal["equity", "etf", "index", "crypto"] = Field(default="equity", alias="assetType")
    family: FactorFamilyKey = "composite"


class FactorContribution(BaseModel):
    family: FactorFamilyKey
    label: str
    score: float | None = None
    weight: float
    evidence: list[str] = Field(default_factory=list)
    missing_metrics: list[str] = Field(default_factory=list)


class FactorResult(BaseModel):
    symbol: str
    name: str
    market: str
    asset_class: str
    rank: int | None = None
    percentile: float | None = None
    composite_score: float | None = None
    bucket: FactorScoreBucket
    stale: bool
    data_source: str
    price: float | None = None
    change_pct: float | None = None
    metrics: dict[str, Any] = Field(default_factory=dict)
    contributions: list[FactorContribution] = Field(default_factory=list)
    missing_data: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    score_history: list[PortfolioValuePoint] = Field(default_factory=list)
    data_quality: DataQualityStatus | None = None


class FactorRunResponse(BaseModel):
    run_id: str
    universe_source: ScreenerUniverseSource
    asset_type: str
    family: FactorFamilyKey
    as_of: str
    evaluated_count: int
    result_count: int
    source_timestamps: dict[str, str | None] = Field(default_factory=dict)
    diagnostics: dict[str, Any] = Field(default_factory=dict)
    results: list[FactorResult] = Field(default_factory=list)


class FactorRunListItem(BaseModel):
    run_id: str
    universe_source: ScreenerUniverseSource
    asset_type: str
    family: FactorFamilyKey
    as_of: str
    evaluated_count: int
    result_count: int
    diagnostics: dict[str, Any] = Field(default_factory=dict)


class StrategyTemplateParameter(BaseModel):
    key: str
    label: str
    default: str | int | float
    min_value: float | None = None
    max_value: float | None = None
    options: list[str] = Field(default_factory=list)


class StrategyTemplateDefinition(BaseModel):
    key: StrategyTemplateKey
    title: str
    description: str
    execution_mode: Literal["local_simulation"]
    parameters: list[StrategyTemplateParameter] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class StrategyBacktestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    template_key: StrategyTemplateKey = Field(default="top_n_factor_rotation", alias="templateKey")
    factor_run_id: str = Field(alias="factorRunId")
    top_n: int = Field(default=5, ge=1, le=50, alias="topN")
    rebalance_interval: StrategyRebalanceInterval = Field(default="monthly", alias="rebalanceInterval")
    initial_capital: float = Field(default=100000, gt=0, alias="initialCapital")
    max_position_weight: float = Field(default=0.25, gt=0, le=1, alias="maxPositionWeight")
    cash_reserve_pct: float = Field(default=0.05, ge=0, lt=1, alias="cashReservePct")
    benchmark_symbol: str = Field(default="SPY", min_length=1, alias="benchmarkSymbol")
    transaction_cost_bps: float = Field(default=5, ge=0, alias="transactionCostBps")
    slippage_bps: float = Field(default=10, ge=0, alias="slippageBps")


class StrategyRuleDecision(BaseModel):
    timestamp: str
    symbol: str
    action: Literal["select", "skip", "hold"]
    reason: str
    score: float | None = None
    rank: int | None = None
    target_weight: float | None = None


class StrategyTrade(BaseModel):
    trade_id: str
    timestamp: str
    symbol: str
    side: Literal["buy", "sell"]
    quantity: float
    price: float
    notional: float
    transaction_cost: float
    slippage_cost: float
    execution_mode: StrategyExecutionMode
    notes: list[str] = Field(default_factory=list)


class StrategyPosition(BaseModel):
    symbol: str
    name: str
    quantity: float
    average_price: float
    market_price: float
    market_value: float
    target_weight: float
    actual_weight: float
    unrealized_pnl: float


class StrategyMetric(BaseModel):
    label: str
    value: float | str
    unit: str | None = None
    tone: Literal["neutral", "positive", "caution"] = "neutral"


class StrategyDiagnostics(BaseModel):
    warnings: list[str] = Field(default_factory=list)
    degraded_symbols: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    no_live_orders: bool = True


class StrategyBacktestResponse(BaseModel):
    run_id: str
    template_key: StrategyTemplateKey
    factor_run_id: str
    created_at: str
    data_window: dict[str, str | None] = Field(default_factory=dict)
    request: dict[str, Any] = Field(default_factory=dict)
    factor_context: dict[str, Any] = Field(default_factory=dict)
    equity_curve: list[PortfolioValuePoint] = Field(default_factory=list)
    benchmark_curve: list[PortfolioValuePoint] = Field(default_factory=list)
    trades: list[StrategyTrade] = Field(default_factory=list)
    positions: list[StrategyPosition] = Field(default_factory=list)
    rule_decisions: list[StrategyRuleDecision] = Field(default_factory=list)
    metrics: list[StrategyMetric] = Field(default_factory=list)
    diagnostics: StrategyDiagnostics


class StrategyBacktestListItem(BaseModel):
    run_id: str
    template_key: StrategyTemplateKey
    factor_run_id: str
    created_at: str
    top_n: int
    initial_capital: float
    total_return_pct: float | None = None
    max_drawdown_pct: float | None = None
    warning_count: int = 0


class StrategyPaperSessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    backtest_run_id: str = Field(alias="backtestRunId")
    label: str | None = None


class StrategyPaperOrder(BaseModel):
    order_id: str
    session_id: str
    created_at: str
    symbol: str
    side: Literal["buy", "sell"]
    quantity: float
    limit_price: float | None = None
    status: Literal["filled", "rejected", "simulated"]
    execution_mode: Literal["paper"] = "paper"
    reason: str


class StrategyPaperFill(BaseModel):
    fill_id: str
    order_id: str
    session_id: str
    filled_at: str
    symbol: str
    side: Literal["buy", "sell"]
    quantity: float
    price: float
    notional: float
    transaction_cost: float
    slippage_cost: float


class StrategyCashLedgerEntry(BaseModel):
    entry_id: str
    session_id: str
    timestamp: str
    event: str
    amount: float
    cash_balance: float


class StrategyPaperSessionResponse(BaseModel):
    session_id: str
    backtest_run_id: str
    created_at: str
    label: str
    execution_mode: Literal["paper"] = "paper"
    status: Literal["simulated"]
    no_live_orders: bool = True
    orders: list[StrategyPaperOrder] = Field(default_factory=list)
    fills: list[StrategyPaperFill] = Field(default_factory=list)
    positions: list[StrategyPosition] = Field(default_factory=list)
    cash_ledger: list[StrategyCashLedgerEntry] = Field(default_factory=list)
    pnl: dict[str, float] = Field(default_factory=dict)
    drawdown: dict[str, float] = Field(default_factory=dict)
    rule_decisions: list[StrategyRuleDecision] = Field(default_factory=list)
    diagnostics: StrategyDiagnostics


class StrategyPaperSessionListItem(BaseModel):
    session_id: str
    backtest_run_id: str
    created_at: str
    label: str
    order_count: int
    fill_count: int
    cash_balance: float
    total_pnl: float
    no_live_orders: bool = True


class StrategyReportExportResponse(BaseModel):
    artifact_id: str
    artifact_type: Literal["backtest", "paper_session"]
    export_path: str


class BinanceExecutionConfig(BaseModel):
    live_enabled: bool = False
    risk_acknowledged: bool = False
    allowlist: list[str] = Field(default_factory=lambda: ["BTC/USDT", "ETH/USDT"])
    max_order_notional: float = Field(default=500, gt=0)
    max_daily_turnover: float = Field(default=2_000, gt=0)
    max_position_weight: float = Field(default=0.25, gt=0, le=1)
    stale_quote_seconds: int = Field(default=300, ge=30, le=86_400)
    require_paper_session: bool = True
    updated_at: str
    credentials_configured: bool = False
    kill_switch_enabled: bool = False
    notes: list[str] = Field(default_factory=list)


class UpdateBinanceExecutionConfigRequest(BaseModel):
    live_enabled: bool | None = None
    risk_acknowledged: bool | None = None
    allowlist: list[str] | None = None
    max_order_notional: float | None = Field(default=None, gt=0)
    max_daily_turnover: float | None = Field(default=None, gt=0)
    max_position_weight: float | None = Field(default=None, gt=0, le=1)
    stale_quote_seconds: int | None = Field(default=None, ge=30, le=86_400)
    require_paper_session: bool | None = None


class BinanceExecutionIntentRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(min_length=1)
    side: ExecutionOrderSide
    quantity: float = Field(gt=0)
    order_type: ExecutionOrderType = Field(default="market", alias="orderType")
    limit_price: float | None = Field(default=None, gt=0, alias="limitPrice")
    strategy_run_id: str | None = Field(default=None, alias="strategyRunId")
    paper_session_id: str | None = Field(default=None, alias="paperSessionId")
    client_order_id: str | None = Field(default=None, max_length=80, alias="clientOrderId")
    notes: str | None = Field(default=None, max_length=500)


class BinanceRiskDecision(BaseModel):
    check: str
    status: ExecutionRiskDecisionStatus
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class BinanceLiveOrder(BaseModel):
    order_id: str
    intent_id: str
    created_at: str
    symbol: str
    side: ExecutionOrderSide
    quantity: float
    order_type: ExecutionOrderType
    limit_price: float | None = None
    status: str
    broker_order_id: str | None = None
    broker_response: dict[str, Any] = Field(default_factory=dict)
    no_secret_payload: bool = True


class BinanceLiveFill(BaseModel):
    fill_id: str
    order_id: str
    intent_id: str
    filled_at: str
    symbol: str
    side: ExecutionOrderSide
    quantity: float
    price: float
    notional: float
    fee: float = 0
    fee_asset: str | None = None


class BinanceLiveLedgerEntry(BaseModel):
    entry_id: str
    intent_id: str
    timestamp: str
    event: str
    asset: str
    amount: float
    balance_after: float | None = None


class BinanceExecutionIntentResponse(BaseModel):
    intent_id: str
    created_at: str
    updated_at: str
    status: ExecutionIntentStatus
    request: BinanceExecutionIntentRequest
    estimated_price: float | None = None
    estimated_notional: float | None = None
    risk_decisions: list[BinanceRiskDecision] = Field(default_factory=list)
    order: BinanceLiveOrder | None = None
    fills: list[BinanceLiveFill] = Field(default_factory=list)
    ledger: list[BinanceLiveLedgerEntry] = Field(default_factory=list)
    audit_event_count: int = 0
    no_live_order_until_submit: bool = True


class BinanceKillSwitchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    enabled: bool
    reason: str | None = Field(default=None, max_length=500)
    strategy_run_id: str | None = Field(default=None, alias="strategyRunId")


class BinanceExecutionAuditEvent(BaseModel):
    event_id: str
    created_at: str
    event_type: str
    intent_id: str | None = None
    strategy_run_id: str | None = None
    summary: str
    payload: dict[str, Any] = Field(default_factory=dict)


class SecurityAuditEvent(BaseModel):
    event_id: str
    created_at: str
    category: str
    event_type: str
    actor: str = "local_user"
    surface: str = "sidecar"
    subject: str | None = None
    summary: str
    payload: dict[str, Any] = Field(default_factory=dict)


class LocalSecurityStatus(BaseModel):
    initialized: bool
    locked: bool
    unlocked_until: str | None = None
    idle_timeout_seconds: int = 600
    failed_attempts: int = 0
    max_failed_attempts: int = 5
    lockout_until: str | None = None
    sensitive_surfaces: list[str] = Field(default_factory=list)


class LocalSecurityInitializeRequest(BaseModel):
    unlock_secret: str = Field(min_length=4, max_length=128)


class LocalSecurityUnlockRequest(BaseModel):
    unlock_secret: str = Field(min_length=1, max_length=128)


class LocalSecurityChangeSecretRequest(BaseModel):
    current_unlock_secret: str = Field(min_length=1, max_length=128)
    new_unlock_secret: str = Field(min_length=4, max_length=128)


class LocalSecurityResetRequest(BaseModel):
    confirmation: str = Field(min_length=1, max_length=64)


class LocalSecurityTouchRequest(BaseModel):
    surface: str | None = None


class LocalAuthSessionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    account_id: str | None = Field(default=None, alias="accountId")
    account_label: str | None = Field(default=None, alias="accountLabel")
    ttl_minutes: int | None = Field(default=None, ge=5, le=1440, alias="ttlMinutes")


class LocalAuthSessionResponse(BaseModel):
    session_id: str
    account_id: str
    account_label: str
    created_at: str
    expires_at: str
    revoked_at: str | None = None
    permissions: list[SessionPermission]
    status: Literal["active", "expired", "revoked"]


class RoutePermissionClassification(BaseModel):
    method: str
    path: str
    surface: str
    exposure: Literal["desktop_local", "account_sensitive", "future_public_candidate", "never_public"]
    permission: SessionPermission | None = None
    notes: str
