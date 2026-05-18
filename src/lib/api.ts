import { invoke } from "@tauri-apps/api/core";
import {
  getRuntimeConfig,
  invalidateRuntimeConfig,
  isTauriRuntime,
  refreshRuntimeConfig,
  type RuntimeConfig,
} from "./runtime";

export type BackendHealth = {
  status: "ok";
  message: string;
};

export type DashboardMarketPulse = {
  label: string;
  symbol: string;
  value: number;
  change_pct: number;
  currency: string;
  tone: "up" | "down" | "neutral";
};

export type WatchlistAssetSnapshot = {
  symbol: string;
  name: string;
  market: string;
  asset_class: string;
  currency: string;
  provider: string;
  price: number;
  change: number;
  change_pct: number;
  trend: number[];
  summary: string;
};

export type DashboardOverviewResponse = {
  updated_at: string;
  stale: boolean;
  market_pulse: DashboardMarketPulse[];
  watchlist: WatchlistAssetSnapshot[];
  focus_asset: WatchlistAssetSnapshot | null;
  connection_summary: {
    binance_configured: boolean;
    binance_account_healthy: boolean | null;
    watchlist_count: number;
    data_mode: "live" | "cached";
  };
};

export type AssetSearchResult = {
  symbol: string;
  name: string;
  market: string;
  asset_class: string;
  currency: string;
  provider: string;
};

export type RatioItem = {
  label: string;
  value: string;
  note: string;
};

export type FilingItem = {
  type: string;
  filed_at: string;
  headline: string;
  status: string;
};

export type PricePoint = {
  timestamp: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close: number;
  volume: number;
};

export type PriceHistoryInterval = "15m" | "30m" | "1h" | "2h" | "4h" | "8h" | "1d" | "1wk" | "1mo" | "1y";

export type AssetWorkspaceResponse = {
  updated_at: string;
  stale: boolean;
  asset: {
    symbol: string;
    name: string;
    market: string;
    asset_class: string;
    currency: string;
    provider: string;
  };
  quote: {
    symbol: string;
    price: number;
    change: number;
    change_pct: number;
    currency: string;
    provider: string;
    as_of: string;
  };
  history: PricePoint[];
  overview: {
    symbol: string;
    company: string;
    sector?: string | null;
    market_cap?: string | null;
    summary: string;
  } | null;
  ratios: RatioItem[];
  filings: FilingItem[];
  capabilities: {
    has_fundamentals: boolean;
    has_filings: boolean;
    fundamentals_status: "available" | "credential_required" | "unsupported" | "temporarily_unavailable";
    filings_status: "available" | "credential_required" | "unsupported" | "temporarily_unavailable";
    fundamentals_message: string | null;
    filings_message: string | null;
    notes: string[];
  };
};

export type RuntimeCommandResponse = {
  ok: boolean;
};

export type ConnectionHealth = "ok" | "error" | "missing_credentials" | "cached" | "planned" | "unsupported" | "unavailable";

export type ConnectionTestResponse = {
  provider: string;
  status: ConnectionHealth;
  message: string;
  stale: boolean;
  requires_credentials: boolean;
  credential_summary: string | null;
  last_tested_at: string | null;
  last_success_at: string | null;
  cache_updated_at: string | null;
  cache_age_seconds: number | null;
  profile_id: string;
  profile_label: string;
};

export type ConnectionStatusItem = {
  provider: string;
  label: string;
  configured: boolean;
  health: ConnectionHealth;
  last_message: string | null;
  stale: boolean;
  requires_credentials: boolean;
  credential_summary: string | null;
  last_tested_at: string | null;
  last_success_at: string | null;
  cache_updated_at: string | null;
  cache_age_seconds: number | null;
  profile_id: string;
  profile_label: string;
};

export type CredentialProfile = {
  profile_id: string;
  label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ConnectionsStatusResponse = {
  providers: ConnectionStatusItem[];
  profiles: CredentialProfile[];
  active_profile: CredentialProfile | null;
};

export type SourceFreshnessMetadata = {
  label: string;
  expected_lag: string | null;
  as_of_field: string | null;
};

export type SourceProvenanceMetadata = {
  provider: string;
  upstream: string | null;
  license_note: string | null;
  source_url: string | null;
};

export type ProviderCapability = {
  key: string;
  label: string;
  supported: boolean;
  requires_credentials: boolean;
  status_hint: "available" | "credential_required" | "unsupported";
  notes: string[];
  data_domains: string[];
  asset_coverage: string[];
  regions: string[];
  locales: string[];
  rate_limit_note: string | null;
  cache_policy: string | null;
  freshness: SourceFreshnessMetadata | null;
  provenance: SourceProvenanceMetadata | null;
  testable: boolean;
  test_mode: string | null;
  read_only: boolean;
  credential_note: string | null;
};

export type ProviderCapabilityProviderItem = {
  provider: string;
  label: string;
  description: string | null;
  data_domains: string[];
  asset_coverage: string[];
  regions: string[];
  locales: string[];
  credential_note: string | null;
  rate_limit_note: string | null;
  cache_policy: string | null;
  freshness: SourceFreshnessMetadata | null;
  provenance: SourceProvenanceMetadata | null;
  testable: boolean;
  test_mode: string | null;
  read_only: boolean;
  live_trading: boolean;
  capabilities: ProviderCapability[];
};

export type ConnectionsCatalogResponse = {
  providers: ProviderCapabilityProviderItem[];
};

export type DataSourceRuntimeStatus = {
  provider: string;
  label: string;
  configured: boolean;
  health: ConnectionHealth;
  message: string;
  stale: boolean;
  requires_credentials: boolean;
  cache_updated_at: string | null;
  cache_age_seconds: number | null;
  registration_url: string | null;
  paid_setup_url: string | null;
};

export type DataSourceStatusResponse = {
  providers: DataSourceRuntimeStatus[];
};

export type DataSourceProvenance = {
  provider: string;
  label: string;
  source_url: string;
  fetched_at: string | null;
  freshness: SourceFreshnessMetadata | null;
  stale: boolean;
  unavailable_reason: string | null;
};

export type MacroSeriesResponse = {
  provider: string;
  series_id: string;
  title: string;
  geography: string | null;
  frequency: string | null;
  unit: string | null;
  observations: Array<{ date: string; value: number | null }>;
  provenance: DataSourceProvenance;
};

export type CryptoMarketsResponse = {
  provider: string;
  assets: Array<{
    id: string;
    symbol: string;
    name: string;
    price_usd: number | null;
    market_cap_usd: number | null;
    volume_24h_usd: number | null;
    price_change_24h_pct: number | null;
    as_of: string | null;
  }>;
  provenance: DataSourceProvenance;
};

export type NewsEventsResponse = {
  provider: string;
  query: string | null;
  events: Array<{
    title: string;
    source: string;
    url: string;
    published_at: string | null;
    summary: string | null;
    symbols: string[];
  }>;
  provenance: DataSourceProvenance;
};

export type DataSourceReportSourceSummary = {
  provider: string;
  label: string;
  health: ConnectionHealth;
  configured: boolean;
  stale: boolean;
  fetched_at: string | null;
  source_url: string | null;
  unavailable_reason: string | null;
  read_only: boolean;
  live_trading: boolean;
};

export type DataSourceReportExportResponse = {
  export_path: string;
  generated_at: string;
  included_sources: DataSourceReportSourceSummary[];
  provenance_summary: string[];
};

export type ConnectionSecretPayload = {
  apiKey?: string;
  secret?: string;
  password?: string;
  identity?: string;
};

export type SettingsRuntimeResponse = {
  base_url: string;
  runtime_mode: string;
  data_dir: string;
  log_dir: string;
  diagnostics_dir: string;
  sqlite_path: string;
  duckdb_path: string;
  sidecar_stdout_path: string;
  sidecar_stderr_path: string;
  sidecar_last_error_path: string;
  sidecar_bootstrap_path: string;
  build_summary_path: string | null;
};

export type ViewKey =
  | "dashboard"
  | "asset"
  | "watchlist"
  | "research"
  | "factorLab"
  | "strategyLab"
  | "workflowStudio"
  | "dataSources"
  | "screeners"
  | "manual"
  | "portfolio"
  | "connections"
  | "settings";

export type AppPreferences = {
  default_view: ViewKey;
  quote_ttl_minutes: number;
  log_collection_enabled: boolean;
  diagnostics_export_enabled: boolean;
  language: "zh-CN" | "en-US";
  density: "standard" | "compact";
};

export type OnboardingState = {
  onboarding_seen_at: string | null;
};

export type LocalSecurityStatus = {
  initialized: boolean;
  locked: boolean;
  unlocked_until: string | null;
  idle_timeout_seconds: number;
  failed_attempts: number;
  max_failed_attempts: number;
  lockout_until: string | null;
  sensitive_surfaces: string[];
};

export type SecurityAuditEvent = {
  event_id: string;
  created_at: string;
  category: string;
  event_type: string;
  actor: string;
  surface: string;
  subject: string | null;
  summary: string;
  payload: Record<string, unknown>;
};

export type SetupStatus = {
  firstRun: boolean;
  needsSetup: boolean;
  sidecarOffline: boolean;
  missingProviders: string[];
};

export type DiagnosticsFileEntry = {
  key: string;
  label: string;
  path: string | null;
};

export type DiagnosticsExportResult = {
  exportPath: string;
  manifestPath: string;
  generatedAt: string;
  includedFiles: DiagnosticsFileEntry[];
  missingFiles: DiagnosticsFileEntry[];
};

export type BinanceAccountSnapshot = {
  updated_at: string;
  stale: boolean;
  exchange: string;
  total_assets: number;
  balances: Array<{
    asset: string;
    free: number;
    used: number;
    total: number;
  }>;
};

export type PortfolioTransaction = {
  id: number;
  symbol: string;
  name: string;
  market: string;
  asset_class: string;
  currency: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  traded_at: string;
  notes: string | null;
};

export type PortfolioTransactionInput = Omit<PortfolioTransaction, "id" | "name" | "market" | "asset_class" | "currency">;

export type PortfolioDataStatus = "live" | "cached" | "unavailable";

export type PortfolioHolding = {
  symbol: string;
  name: string;
  market: string;
  asset_class: string;
  currency: string;
  quantity: number;
  average_cost: number;
  current_price: number | null;
  valuation_status: PortfolioDataStatus;
  market_value: number | null;
  cost_basis: number;
  pnl: number | null;
  pnl_pct: number | null;
  allocation: number | null;
  day_change_pct: number | null;
  stale: boolean;
  notes: string[];
};

export type PortfolioValuePoint = {
  date: string;
  value: number;
};

export type PortfolioAnalyticsWindow = {
  key: "today" | "mtd" | "ytd" | "one_year" | "max";
  label: string;
  status: PortfolioDataStatus;
  start_date: string | null;
  end_date: string | null;
  start_value: number | null;
  end_value: number | null;
  total_return_pct: number | null;
  max_drawdown_pct: number | null;
  volatility_pct: number | null;
  sharpe_style: number | null;
  benchmark_symbol: string | null;
  benchmark_return_pct: number | null;
  benchmark_relative_return_pct: number | null;
  notes: string[];
};

export type PortfolioAllocationBucket = {
  key: string;
  label: string;
  value: number;
  allocation: number;
  status: PortfolioDataStatus;
};

export type PortfolioAnalytics = {
  windows: PortfolioAnalyticsWindow[];
  pnl: {
    realized_pnl: number;
    unrealized_pnl: number;
    total_pnl: number;
    method: "average_cost";
    notes: string[];
  };
  allocation: Record<string, PortfolioAllocationBucket[]>;
  concentration_pct: number | null;
  notes: string[];
};

export type PortfolioSummaryResponse = {
  currency: string;
  total_value: number;
  total_cost: number;
  total_pnl: number;
  total_pnl_pct: number;
  daily_pnl: number;
  positions: number;
  stale: boolean;
  degraded: boolean;
  notes: string[];
  missing_symbols: string[];
  benchmark_status: Record<string, PortfolioDataStatus>;
  performance: PortfolioValuePoint[];
  benchmarks: Record<string, PortfolioValuePoint[]>;
  analytics: PortfolioAnalytics;
};

export type ScreenerPreset = {
  key: string;
  title: string;
  badge: string;
  description: string;
  filters: string[];
  asset_type: string;
  hit_count: number;
  updated_at: string;
  active_variant_key: string | null;
  active_variant_name: string | null;
};

export type ScreenerUniverseSource = "catalog" | "expanded";

export type ScreenerScoreLabel = "high" | "medium" | "watch";

export type ScreenerTuningLevel = "low" | "medium" | "high";

export type ScreenerPresetVariant = {
  variant_key: string;
  preset_key: string;
  name: string;
  description: string;
  tuning: Record<string, ScreenerTuningLevel>;
  filters: string[];
  is_system_default: boolean;
  is_active: boolean;
  last_hit_count: number;
  updated_at: string;
};

export type ScreenerRunResult = {
  symbol: string;
  name: string;
  market: string;
  asset_class: string;
  price: number;
  change_pct: number;
  score: number;
  score_label: ScreenerScoreLabel;
  stale: boolean;
  data_source: string;
  matched_rules: string[];
  explanations: string[];
  missing_metrics: string[];
  notes: string[];
  metrics: Record<string, string | number>;
  factor_context: ResearchBrief["factor_context"] | null;
};

export type ScreenerRunResponse = {
  preset: string;
  asset_type: string;
  universe_source: ScreenerUniverseSource;
  variant_key: string;
  variant_name: string;
  evaluated_count: number;
  hit_count: number;
  universe_label: string;
  results: ScreenerRunResult[];
  data_source_note: string;
};

export type FactorFamilyKey =
  | "momentum_12_1"
  | "value"
  | "quality_profitability"
  | "conservative_growth"
  | "low_volatility_risk"
  | "crypto_momentum_strength"
  | "crypto_volume_confirmation"
  | "crypto_overheat_guardrail"
  | "index_trend_breadth"
  | "index_defensive_quality"
  | "short_term_reversal"
  | "composite";

export type FactorScoreBucket = "leader" | "candidate" | "watch" | "insufficient";

export type FactorFamilyDefinition = {
  key: FactorFamilyKey;
  label: string;
  description: string;
  simple_description: string;
  required_metrics: string[];
  research_only_note: string;
};

export type FactorContribution = {
  family: FactorFamilyKey;
  label: string;
  score: number | null;
  weight: number;
  evidence: string[];
  missing_metrics: string[];
};

export type FactorResult = {
  symbol: string;
  name: string;
  market: string;
  asset_class: string;
  rank: number | null;
  percentile: number | null;
  composite_score: number | null;
  bucket: FactorScoreBucket;
  stale: boolean;
  data_source: string;
  price: number | null;
  change_pct: number | null;
  metrics: Record<string, string | number | boolean | null>;
  contributions: FactorContribution[];
  missing_data: string[];
  notes: string[];
  score_history: PortfolioValuePoint[];
};

export type FactorRunResponse = {
  run_id: string;
  universe_source: ScreenerUniverseSource;
  asset_type: string;
  family: FactorFamilyKey;
  as_of: string;
  evaluated_count: number;
  result_count: number;
  source_timestamps: Record<string, string | null>;
  diagnostics: Record<string, string | number | boolean | null>;
  results: FactorResult[];
};

export type FactorRunListItem = {
  run_id: string;
  universe_source: ScreenerUniverseSource;
  asset_type: string;
  family: FactorFamilyKey;
  as_of: string;
  evaluated_count: number;
  result_count: number;
  diagnostics: Record<string, string | number | boolean | null>;
};

export type StrategyTemplateDefinition = {
  key: "top_n_factor_rotation";
  title: string;
  description: string;
  execution_mode: "local_simulation";
  parameters: Array<{
    key: string;
    label: string;
    default: string | number;
    min_value: number | null;
    max_value: number | null;
    options: string[];
  }>;
  warnings: string[];
};

export type StrategyMetric = {
  label: string;
  value: number | string;
  unit: string | null;
  tone: "neutral" | "positive" | "caution";
};

export type StrategyTrade = {
  trade_id: string;
  timestamp: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  notional: number;
  transaction_cost: number;
  slippage_cost: number;
  execution_mode: "backtest" | "paper";
  notes: string[];
};

export type StrategyPosition = {
  symbol: string;
  name: string;
  quantity: number;
  average_price: number;
  market_price: number;
  market_value: number;
  target_weight: number;
  actual_weight: number;
  unrealized_pnl: number;
};

export type StrategyRuleDecision = {
  timestamp: string;
  symbol: string;
  action: "select" | "skip" | "hold";
  reason: string;
  score: number | null;
  rank: number | null;
  target_weight: number | null;
};

export type StrategyDiagnostics = {
  warnings: string[];
  degraded_symbols: string[];
  assumptions: string[];
  no_live_orders: boolean;
};

export type StrategyBacktestResponse = {
  run_id: string;
  template_key: "top_n_factor_rotation";
  factor_run_id: string;
  created_at: string;
  data_window: Record<string, string | null>;
  request: Record<string, string | number>;
  factor_context: Record<string, string | number | boolean | null>;
  equity_curve: PortfolioValuePoint[];
  benchmark_curve: PortfolioValuePoint[];
  trades: StrategyTrade[];
  positions: StrategyPosition[];
  rule_decisions: StrategyRuleDecision[];
  metrics: StrategyMetric[];
  diagnostics: StrategyDiagnostics;
};

export type StrategyBacktestListItem = {
  run_id: string;
  template_key: "top_n_factor_rotation";
  factor_run_id: string;
  created_at: string;
  top_n: number;
  initial_capital: number;
  total_return_pct: number | null;
  max_drawdown_pct: number | null;
  warning_count: number;
};

export type StrategyPaperSessionResponse = {
  session_id: string;
  backtest_run_id: string;
  created_at: string;
  label: string;
  execution_mode: "paper";
  status: "simulated";
  no_live_orders: boolean;
  orders: Array<{
    order_id: string;
    session_id: string;
    created_at: string;
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    limit_price: number | null;
    status: "filled" | "rejected" | "simulated";
    execution_mode: "paper";
    reason: string;
  }>;
  fills: Array<{
    fill_id: string;
    order_id: string;
    session_id: string;
    filled_at: string;
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    notional: number;
    transaction_cost: number;
    slippage_cost: number;
  }>;
  positions: StrategyPosition[];
  cash_ledger: Array<{
    entry_id: string;
    session_id: string;
    timestamp: string;
    event: string;
    amount: number;
    cash_balance: number;
  }>;
  pnl: Record<string, number>;
  drawdown: Record<string, number>;
  rule_decisions: StrategyRuleDecision[];
  diagnostics: StrategyDiagnostics;
};

export type StrategyPaperSessionListItem = {
  session_id: string;
  backtest_run_id: string;
  created_at: string;
  label: string;
  order_count: number;
  fill_count: number;
  cash_balance: number;
  total_pnl: number;
  no_live_orders: boolean;
};

export type StrategyReportExportResponse = {
  artifact_id: string;
  artifact_type: "backtest" | "paper_session";
  export_path: string;
};

export type WorkflowTemplateKey =
  | "screener_to_research"
  | "data_sources_to_research"
  | "research_to_factor"
  | "factor_to_backtest"
  | "backtest_to_paper"
  | "paper_to_binance_intent"
  | "evidence_report_export";

export type WorkflowActionPolicy =
  | "read_only"
  | "local_analysis"
  | "local_simulation"
  | "binance_intent"
  | "user_confirmed_binance_submit";

export type WorkflowRunStatus = "pending" | "running" | "completed" | "blocked" | "failed";
export type WorkflowStepStatus = "pending" | "running" | "completed" | "blocked" | "failed" | "manual_required";

export type WorkflowTemplateStepDefinition = {
  step_key: string;
  title: string;
  policy: WorkflowActionPolicy;
  description: string;
};

export type WorkflowTemplateDefinition = {
  template_key: WorkflowTemplateKey;
  title: string;
  description: string;
  steps: WorkflowTemplateStepDefinition[];
};

export type WorkflowArtifactRef = {
  artifact_id: string;
  artifact_type: "research_brief" | "factor_run" | "strategy_backtest" | "paper_session" | "binance_intent" | "evidence_report" | string;
  label: string;
  source_step_key: string | null;
};

export type WorkflowAuditEvent = {
  event_id: string;
  created_at: string;
  event_type: string;
  summary: string;
  details: Record<string, unknown>;
};

export type WorkflowStepState = {
  step_key: string;
  title: string;
  policy: WorkflowActionPolicy;
  status: WorkflowStepStatus;
  started_at: string | null;
  completed_at: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  artifact_refs: WorkflowArtifactRef[];
  blocked_reasons: string[];
  error: string | null;
  provenance: Record<string, unknown>;
};

export type WorkflowRunResponse = {
  run_id: string;
  template_key: WorkflowTemplateKey;
  status: WorkflowRunStatus;
  created_at: string;
  updated_at: string;
  input: Record<string, unknown>;
  steps: WorkflowStepState[];
  output: Record<string, unknown>;
  artifact_refs: WorkflowArtifactRef[];
  blocked_reasons: string[];
  audit_events: WorkflowAuditEvent[];
  manual_confirmation_required: boolean;
  manual_confirmation_policy: WorkflowActionPolicy | null;
};

export type WorkflowRunRequest = {
  templateKey: WorkflowTemplateKey;
  input: Record<string, string | number | boolean | null>;
};

export type BinanceExecutionConfig = {
  live_enabled: boolean;
  risk_acknowledged: boolean;
  allowlist: string[];
  max_order_notional: number;
  max_daily_turnover: number;
  max_position_weight: number;
  stale_quote_seconds: number;
  require_paper_session: boolean;
  updated_at: string;
  credentials_configured: boolean;
  kill_switch_enabled: boolean;
  notes: string[];
};

export type BinanceExecutionIntentRequest = {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  orderType: "market" | "limit";
  limitPrice?: number | null;
  strategyRunId?: string | null;
  paperSessionId?: string | null;
  clientOrderId?: string | null;
  notes?: string | null;
};

export type BinanceRiskDecision = {
  check: string;
  status: "pass" | "block";
  message: string;
  details: Record<string, string | number | boolean | null>;
};

export type BinanceExecutionIntentResponse = {
  intent_id: string;
  created_at: string;
  updated_at: string;
  status: "draft" | "blocked" | "submitted" | "filled" | "rejected";
  request: {
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    order_type: "market" | "limit";
    limit_price: number | null;
    strategy_run_id: string | null;
    paper_session_id: string | null;
    client_order_id: string | null;
    notes: string | null;
  };
  estimated_price: number | null;
  estimated_notional: number | null;
  risk_decisions: BinanceRiskDecision[];
  order: {
    order_id: string;
    status: string;
    broker_order_id: string | null;
    no_secret_payload: boolean;
  } | null;
  fills: Array<{
    fill_id: string;
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    notional: number;
  }>;
  ledger: Array<{
    entry_id: string;
    event: string;
    asset: string;
    amount: number;
  }>;
  audit_event_count: number;
  no_live_order_until_submit: boolean;
};

export type BinanceExecutionAuditEvent = {
  event_id: string;
  created_at: string;
  event_type: string;
  intent_id: string | null;
  strategy_run_id: string | null;
  summary: string;
  payload: Record<string, string | number | boolean | string[] | null>;
};

export type ResearchBriefSourceContext = {
  source_preset_key: string | null;
  source_variant_key: string | null;
  source_universe_source: ScreenerUniverseSource | null;
  data_source_provider: string | null;
  data_source_kind: string | null;
  data_source_query: string | null;
  factor_run_id: string | null;
  backtest_run_id: string | null;
  paper_session_id: string | null;
  intent_id: string | null;
  source_label: string | null;
};

export type ResearchScreenerSummary = {
  preset_key: string;
  preset_title: string;
  variant_key: string | null;
  variant_name: string | null;
  universe_source: ScreenerUniverseSource;
  matched: boolean;
  score: number | null;
  score_label: ScreenerScoreLabel | null;
  explanations: string[];
  matched_rules: string[];
  notes: string[];
  stale: boolean;
};

export type AnalysisHighlight = {
  label: string;
  value: string;
  tone: "neutral" | "positive" | "caution";
};

export type AnalysisSection = {
  title: string;
  body: string;
  kind: "paragraph" | "bullets";
  items: string[];
};

export type AnalysisSource = {
  label: string;
  detail: string | null;
};

export type AnalysisModuleResult = {
  key: string;
  title: string;
  summary: string;
  highlights: AnalysisHighlight[];
  sections: AnalysisSection[];
  sources: AnalysisSource[];
  generated_at: string;
  stale: boolean;
};

export type ResearchBrief = {
  brief_id: string;
  symbol: string;
  title: string;
  generated_at: string;
  updated_at: string;
  stale: boolean;
  asset_snapshot: AssetWorkspaceResponse;
  screener_context: {
    source: ResearchBriefSourceContext | null;
    summaries: ResearchScreenerSummary[];
  };
  factor_context: {
    run_id: string;
    family: FactorFamilyKey;
    universe_source: ScreenerUniverseSource;
    asset_type: string;
    as_of: string;
    symbol: string;
    rank: number | null;
    percentile: number | null;
    composite_score: number | null;
    bucket: FactorScoreBucket;
    missing_data: string[];
    contributions: FactorContribution[];
  } | null;
  evidence_context: ResearchEvidenceContext | null;
  portfolio_context: {
    in_portfolio: boolean;
    quantity: number | null;
    average_cost: number | null;
    valuation_status: PortfolioDataStatus | null;
    market_value: number | null;
    cost_basis: number | null;
    transaction_count: number;
    notes: string[];
    handoff_draft: {
      symbol: string;
      side: "buy" | "sell";
      quantity: number;
      price: number;
      fees: number;
      traded_at: string;
      notes: string | null;
    };
  };
  analysis_modules: AnalysisModuleResult[];
  notes: {
    markdown: string;
    updated_at: string;
  };
  export_info: {
    last_export_path: string | null;
  };
};

export type ResearchEvidenceContext = {
  factor: ResearchBrief["factor_context"];
  screener: {
    source: ResearchBriefSourceContext | null;
    summaries: ResearchScreenerSummary[];
  } | null;
  backtest: {
    run_id: string;
    template_key: "top_n_factor_rotation";
    factor_run_id: string;
    created_at: string;
    total_return_pct: number | null;
    max_drawdown_pct: number | null;
    trade_count: number;
    position_count: number;
    assumptions: string[];
    warnings: string[];
    no_live_orders: boolean;
  } | null;
  paper_session: {
    session_id: string;
    backtest_run_id: string;
    created_at: string;
    status: string;
    order_count: number;
    fill_count: number;
    ledger_count: number;
    cash_balance: number | null;
    total_pnl: number | null;
    no_live_orders: boolean;
    warnings: string[];
  } | null;
  execution: {
    intent_id: string | null;
    status: "draft" | "blocked" | "submitted" | "filled" | "rejected" | null;
    symbol: string | null;
    side: "buy" | "sell" | null;
    estimated_notional: number | null;
    live_order_recorded: boolean;
    no_live_order_until_submit: boolean;
    blocked_checks: string[];
    risk_decision_count: number;
    audit_event_count: number;
  } | null;
  audit: {
    event_count: number;
    latest_event_at: string | null;
    event_ids: string[];
    event_types: string[];
  } | null;
  data_quality_notes: string[];
};

export type ResearchBriefListItem = {
  brief_id: string;
  symbol: string;
  title: string;
  generated_at: string;
  updated_at: string;
  stale: boolean;
  source: ResearchBriefSourceContext | null;
};

export type ResearchBriefExportResponse = {
  brief_id: string;
  export_path: string;
};

export type TranslationStatusResponse = {
  enabled: boolean;
  provider: string;
  configured: boolean;
  message: string;
};

export type TranslationSuggestResponse = {
  translated_text: string;
  provider: string;
  configured: boolean;
  used_fallback: boolean;
};

async function getApiBaseUrl(): Promise<string> {
  const runtime = await getRuntimeConfig();
  return runtime.baseUrl;
}

function isNetworkRequestError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error.name === "TypeError" ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed")
  );
}

function formatDesktopNetworkError(runtime: RuntimeConfig, recovered: boolean): Error {
  if (runtime.sidecarStatus === "starting") {
    return new Error("???????????????????");
  }

  if (runtime.sidecarStatus === "offline") {
    return new Error(
      runtime.lastError ??
        (recovered ? "??????????????????" : "?????????"),
    );
  }

  return new Error(recovered ? "????????????????" : "??????????????");
}

async function performApiRequest(path: string, init?: RequestInit, runtime?: RuntimeConfig): Promise<Response> {
  const baseUrl = runtime?.baseUrl ?? (await getApiBaseUrl());
  return fetch(`${baseUrl}${path}`, init);
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let runtime = await getRuntimeConfig();
  let response: Response;

  try {
    response = await performApiRequest(path, init, runtime);
  } catch (error) {
    if (!isTauriRuntime() || !isNetworkRequestError(error)) {
      throw error;
    }

    runtime = await refreshRuntimeConfig();
    if (runtime.sidecarStatus !== "online") {
      throw formatDesktopNetworkError(runtime, false);
    }

    try {
      response = await performApiRequest(path, init, runtime);
    } catch (retryError) {
      if (!isNetworkRequestError(retryError)) {
        throw retryError;
      }

      const refreshedRuntime = await refreshRuntimeConfig().catch(() => runtime);
      throw formatDesktopNetworkError(refreshedRuntime, true);
    }
  }

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const text = await response.text();
      if (text) {
        try {
          const payload = JSON.parse(text) as { detail?: string };
          message = payload.detail ?? text;
        } catch {
          message = text;
        }
      }
    } catch {
      // Keep the status fallback if the response body cannot be read.
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

async function jsonRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const api = {
  getHealth: () => apiFetch<BackendHealth>("/health"),
  searchAssets: (query: string) => apiFetch<AssetSearchResult[]>(`/search/assets?q=${encodeURIComponent(query)}`),
  getDashboardOverview: () => apiFetch<DashboardOverviewResponse>("/dashboard/overview"),
  getAssetWorkspace: (symbol: string) =>
    apiFetch<AssetWorkspaceResponse>(`/assets/${encodeURIComponent(symbol)}/workspace`),
  getPriceHistory: (symbol: string, interval: PriceHistoryInterval = "30m", range = "1y") =>
    apiFetch<PricePoint[]>(
      `/prices/history?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`,
    ),
  getTranslationStatus: () => apiFetch<TranslationStatusResponse>("/translation/status"),
  suggestTranslation: (payload: { text: string; sourceLanguage?: "zh-CN" | "en-US"; targetLanguage?: "zh-CN" | "en-US" }) =>
    jsonRequest<TranslationSuggestResponse>("/translation/suggest", "POST", payload),
  getDefaultWatchlist: () => apiFetch<{ symbols: string[] }>("/watchlist/default"),
  updateDefaultWatchlist: (symbols: string[]) =>
    jsonRequest<{ symbols: string[] }>("/watchlist/default", "PUT", { symbols }),
  getRecentResearchBriefs: (limit = 20) =>
    apiFetch<ResearchBriefListItem[]>(`/research/briefs/recent?limit=${encodeURIComponent(String(limit))}`),
  createResearchBrief: (payload: {
    symbol: string;
    sourcePresetKey?: string;
    sourceVariantKey?: string;
    sourceUniverseSource?: ScreenerUniverseSource;
    dataSourceProvider?: string;
    dataSourceKind?: string;
    dataSourceQuery?: string;
    factorRunId?: string;
    backtestRunId?: string;
    paperSessionId?: string;
    intentId?: string;
  }) => jsonRequest<ResearchBrief>("/research/briefs", "POST", payload),
  getResearchBrief: (briefId: string) =>
    apiFetch<ResearchBrief>(`/research/briefs/${encodeURIComponent(briefId)}`),
  refreshResearchBrief: (briefId: string) =>
    jsonRequest<ResearchBrief>(`/research/briefs/${encodeURIComponent(briefId)}/refresh`, "POST"),
  getResearchEvidence: (
    symbol: string,
    params?: {
      factorRunId?: string;
      backtestRunId?: string;
      paperSessionId?: string;
      intentId?: string;
    },
  ) => {
    const query = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value) {
        query.set(key, value);
      }
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiFetch<ResearchEvidenceContext>(`/research/evidence/${encodeURIComponent(symbol)}${suffix}`);
  },
  updateResearchBriefNotes: (briefId: string, markdown: string) =>
    jsonRequest<ResearchBrief>(`/research/briefs/${encodeURIComponent(briefId)}/notes`, "PUT", { markdown }),
  exportResearchBrief: (briefId: string) =>
    jsonRequest<ResearchBriefExportResponse>(`/research/briefs/${encodeURIComponent(briefId)}/export`, "POST"),
  getFactorFamilies: () => apiFetch<FactorFamilyDefinition[]>("/factors/families"),
  getRecentFactorRuns: (limit = 20) =>
    apiFetch<FactorRunListItem[]>(`/factors/runs/recent?limit=${encodeURIComponent(String(limit))}`),
  runFactorLab: (payload: {
    universeSource: ScreenerUniverseSource;
    assetType: string;
    family: FactorFamilyKey;
  }) => jsonRequest<FactorRunResponse>("/factors/runs", "POST", payload),
  getFactorRun: (runId: string) => apiFetch<FactorRunResponse>(`/factors/runs/${encodeURIComponent(runId)}`),
  getStrategyTemplates: () => apiFetch<StrategyTemplateDefinition[]>("/strategies/templates"),
  getRecentStrategyBacktests: (limit = 20) =>
    apiFetch<StrategyBacktestListItem[]>(`/strategies/backtests/recent?limit=${encodeURIComponent(String(limit))}`),
  runStrategyBacktest: (payload: {
    templateKey: "top_n_factor_rotation";
    factorRunId: string;
    topN: number;
    rebalanceInterval: "monthly" | "quarterly";
    initialCapital: number;
    maxPositionWeight: number;
    cashReservePct: number;
    benchmarkSymbol: string;
    transactionCostBps: number;
    slippageBps: number;
  }) => jsonRequest<StrategyBacktestResponse>("/strategies/backtests", "POST", payload),
  getStrategyBacktest: (runId: string) =>
    apiFetch<StrategyBacktestResponse>(`/strategies/backtests/${encodeURIComponent(runId)}`),
  getRecentStrategyPaperSessions: (limit = 20) =>
    apiFetch<StrategyPaperSessionListItem[]>(
      `/strategies/paper/sessions/recent?limit=${encodeURIComponent(String(limit))}`,
    ),
  createStrategyPaperSession: (payload: { backtestRunId: string; label?: string | null }) =>
    jsonRequest<StrategyPaperSessionResponse>("/strategies/paper/sessions", "POST", payload),
  getStrategyPaperSession: (sessionId: string) =>
    apiFetch<StrategyPaperSessionResponse>(`/strategies/paper/sessions/${encodeURIComponent(sessionId)}`),
  exportStrategyReport: (artifactId: string) =>
    jsonRequest<StrategyReportExportResponse>(`/strategies/reports/${encodeURIComponent(artifactId)}/export`, "POST"),
  getWorkflowTemplates: () => apiFetch<WorkflowTemplateDefinition[]>("/workflows/templates"),
  getRecentWorkflowRuns: (limit = 20) =>
    apiFetch<WorkflowRunResponse[]>(`/workflows/runs/recent?limit=${encodeURIComponent(String(limit))}`),
  createWorkflowRun: (payload: WorkflowRunRequest) =>
    jsonRequest<WorkflowRunResponse>("/workflows/runs", "POST", payload),
  getWorkflowRun: (runId: string) => apiFetch<WorkflowRunResponse>(`/workflows/runs/${encodeURIComponent(runId)}`),
  getBinanceExecutionConfig: () => apiFetch<BinanceExecutionConfig>("/execution/binance/config"),
  updateBinanceExecutionConfig: (payload: Partial<Omit<BinanceExecutionConfig, "updated_at" | "credentials_configured" | "kill_switch_enabled" | "notes">>) =>
    jsonRequest<BinanceExecutionConfig>("/execution/binance/config", "PUT", payload),
  getRecentBinanceExecutionIntents: (limit = 20) =>
    apiFetch<BinanceExecutionIntentResponse[]>(
      `/execution/binance/intents/recent?limit=${encodeURIComponent(String(limit))}`,
    ),
  createBinanceExecutionIntent: (payload: BinanceExecutionIntentRequest) =>
    jsonRequest<BinanceExecutionIntentResponse>("/execution/binance/intents", "POST", payload),
  submitBinanceExecutionIntent: (intentId: string) =>
    jsonRequest<BinanceExecutionIntentResponse>(
      `/execution/binance/intents/${encodeURIComponent(intentId)}/submit`,
      "POST",
    ),
  setBinanceExecutionKillSwitch: (payload: { enabled: boolean; reason?: string | null; strategyRunId?: string | null }) =>
    jsonRequest<BinanceExecutionConfig>("/execution/binance/kill-switch", "POST", payload),
  getBinanceExecutionAudit: (limit = 50) =>
    apiFetch<BinanceExecutionAuditEvent[]>(`/execution/binance/audit?limit=${encodeURIComponent(String(limit))}`),
  getSettingsRuntime: () => apiFetch<SettingsRuntimeResponse>("/settings/runtime"),
  getSettingsPreferences: () => apiFetch<AppPreferences>("/settings/preferences"),
  updateSettingsPreferences: (payload: AppPreferences) =>
    jsonRequest<AppPreferences>("/settings/preferences", "PUT", payload),
  getOnboardingState: () => apiFetch<OnboardingState>("/settings/onboarding"),
  updateOnboardingState: (payload: OnboardingState) =>
    jsonRequest<OnboardingState>("/settings/onboarding", "PUT", payload),
  getLocalSecurityStatus: () => apiFetch<LocalSecurityStatus>("/security/local/status"),
  initializeLocalSecurity: (unlockSecret: string) =>
    jsonRequest<LocalSecurityStatus>("/security/local/initialize", "POST", { unlock_secret: unlockSecret }),
  unlockLocalSecurity: (unlockSecret: string) =>
    jsonRequest<LocalSecurityStatus>("/security/local/unlock", "POST", { unlock_secret: unlockSecret }),
  lockLocalSecurity: () => jsonRequest<LocalSecurityStatus>("/security/local/lock", "POST"),
  idleTimeoutLocalSecurity: () => jsonRequest<LocalSecurityStatus>("/security/local/idle-timeout", "POST"),
  touchLocalSecurity: (surface?: string | null) =>
    jsonRequest<LocalSecurityStatus>("/security/local/touch", "POST", { surface: surface ?? null }),
  getSecurityAudit: (limit = 50, category?: string | null) => {
    const query = new URLSearchParams({ limit: String(limit) });
    if (category) {
      query.set("category", category);
    }
    return apiFetch<SecurityAuditEvent[]>(`/security/audit?${query.toString()}`);
  },
  getConnectionsStatus: () => apiFetch<ConnectionsStatusResponse>("/connections/status"),
  getConnectionsCatalog: () => apiFetch<ConnectionsCatalogResponse>("/connections/catalog"),
  getConnectionProfiles: () => apiFetch<CredentialProfile[]>("/connections/profiles"),
  createConnectionProfile: (label: string) =>
    jsonRequest<CredentialProfile>("/connections/profiles", "POST", { label }),
  setActiveConnectionProfile: async (profileId: string) => {
    const profile = await jsonRequest<CredentialProfile>("/connections/profiles/active", "PUT", { profile_id: profileId });
    if (isTauriRuntime()) {
      await invoke<RuntimeCommandResponse>("set_active_connection_profile", {
        payload: { profileId },
      });
      invalidateRuntimeConfig();
    }
    return profile;
  },
  getDataSourceStatus: () => apiFetch<DataSourceStatusResponse>("/data-sources/status"),
  getDataSourceProviderStatus: (provider: string) =>
    apiFetch<DataSourceRuntimeStatus>(`/data-sources/sources/${encodeURIComponent(provider)}/status`),
  getMacroSeries: (params: { provider?: string; seriesId?: string; country?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.provider) query.set("provider", params.provider);
    if (params.seriesId) query.set("seriesId", params.seriesId);
    if (params.country) query.set("country", params.country);
    if (params.limit) query.set("limit", String(params.limit));
    return apiFetch<MacroSeriesResponse>(`/data-sources/macro/series?${query.toString()}`);
  },
  getCryptoMarkets: (params: { ids?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.ids) query.set("ids", params.ids);
    if (params.limit) query.set("limit", String(params.limit));
    return apiFetch<CryptoMarketsResponse>(`/data-sources/crypto/markets?${query.toString()}`);
  },
  getNewsEvents: (params: { query?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.query) query.set("query", params.query);
    if (params.limit) query.set("limit", String(params.limit));
    return apiFetch<NewsEventsResponse>(`/data-sources/news/events?${query.toString()}`);
  },
  exportDataSourceReport: (payload: {
    macroProvider: string;
    macroSeriesId: string;
    macroCountry: string;
    newsQuery: string;
    cryptoIds: string;
  }) => jsonRequest<DataSourceReportExportResponse>("/data-sources/reports/export", "POST", payload),
  getBinanceAccount: () => apiFetch<BinanceAccountSnapshot>("/connections/binance/account"),
  getPortfolioSummary: () => apiFetch<PortfolioSummaryResponse>("/portfolio/summary"),
  getPortfolioHoldings: () => apiFetch<PortfolioHolding[]>("/portfolio/holdings"),
  getPortfolioTransactions: () => apiFetch<PortfolioTransaction[]>("/portfolio/transactions"),
  createPortfolioTransaction: (payload: PortfolioTransactionInput) =>
    jsonRequest<PortfolioTransaction>("/portfolio/transactions", "POST", payload),
  updatePortfolioTransaction: (transactionId: number, payload: PortfolioTransactionInput) =>
    jsonRequest<PortfolioTransaction>(`/portfolio/transactions/${transactionId}`, "PUT", payload),
  deletePortfolioTransaction: (transactionId: number) =>
    jsonRequest<{ ok: boolean }>(`/portfolio/transactions/${transactionId}`, "DELETE"),
  getScreenerPresets: () => apiFetch<ScreenerPreset[]>("/screeners/presets"),
  getScreenerPresetVariants: (presetKey: string) =>
    apiFetch<ScreenerPresetVariant[]>(`/screeners/presets/${encodeURIComponent(presetKey)}/variants`),
  updateScreenerPreset: (
    presetKey: string,
    payload: Partial<Pick<ScreenerPreset, "title" | "badge" | "description" | "filters" | "asset_type">>,
  ) =>
    jsonRequest<ScreenerPreset>(`/screeners/presets/${encodeURIComponent(presetKey)}`, "PUT", payload),
  createScreenerPresetVariant: (presetKey: string, payload: { name: string; description?: string | null }) =>
    jsonRequest<ScreenerPresetVariant>(
      `/screeners/presets/${encodeURIComponent(presetKey)}/variants`,
      "POST",
      payload,
    ),
  updateScreenerPresetVariant: (
    presetKey: string,
    variantKey: string,
    payload: {
      name?: string;
      description?: string | null;
      tuning?: Record<string, ScreenerTuningLevel>;
    },
  ) =>
    jsonRequest<ScreenerPresetVariant>(
      `/screeners/presets/${encodeURIComponent(presetKey)}/variants/${encodeURIComponent(variantKey)}`,
      "PUT",
      payload,
    ),
  activateScreenerPresetVariant: (presetKey: string, variantKey: string) =>
    jsonRequest<ScreenerPresetVariant>(
      `/screeners/presets/${encodeURIComponent(presetKey)}/variants/${encodeURIComponent(variantKey)}/activate`,
      "POST",
    ),
  deleteScreenerPresetVariant: (presetKey: string, variantKey: string) =>
    jsonRequest<{ ok: boolean }>(
      `/screeners/presets/${encodeURIComponent(presetKey)}/variants/${encodeURIComponent(variantKey)}`,
      "DELETE",
    ),
  runScreener: (payload: {
    preset: string;
    asset_type?: string;
    universeSource: ScreenerUniverseSource;
    variantKey?: string;
  }) =>
    jsonRequest<ScreenerRunResponse>("/screeners/run", "POST", payload),
  restartSidecar: async () => {
    if (!isTauriRuntime()) {
      return { ok: false } satisfies RuntimeCommandResponse;
    }
    const result = await invoke<RuntimeCommandResponse>("restart_sidecar");
    invalidateRuntimeConfig();
    return result;
  },
  exportDiagnosticsBundle: async () => {
    if (!isTauriRuntime()) {
      throw new Error("诊断导出仅在桌面版中可用。");
    }
    return invoke<DiagnosticsExportResult>("export_diagnostics_bundle");
  },
  saveConnectionSecret: async (provider: string, payload: ConnectionSecretPayload, profileId?: string) => {
    if (!isTauriRuntime()) {
      throw new Error("凭证编辑仅在桌面版中可用。");
    }
    await ensureLocalSecurityUnlocked("provider_credentials");
    return invoke<RuntimeCommandResponse>("save_connection_secret", { provider, payload, profileId });
  },
  clearConnectionSecret: async (provider: string, profileId?: string) => {
    if (!isTauriRuntime()) {
      throw new Error("凭证编辑仅在桌面版中可用。");
    }
    await ensureLocalSecurityUnlocked("provider_credentials");
    return invoke<RuntimeCommandResponse>("clear_connection_secret", { provider, profileId });
  },
  clearConnectionProfile: (provider: string) =>
    apiFetch<{ ok: boolean }>(`/connections/${encodeURIComponent(provider)}/profile`, {
      method: "DELETE",
    }),
  testConnection: async (provider: string) => {
    if (["binance", "edgar", "fred", "coingecko"].includes(provider.toLowerCase())) {
      await ensureLocalSecurityUnlocked("provider_credentials");
    }
    if (isTauriRuntime()) {
      return invoke<ConnectionTestResponse>("test_connection", { provider });
    }
    return jsonRequest<ConnectionTestResponse>("/connections/test", "POST", { provider });
  },
};

async function ensureLocalSecurityUnlocked(surface: string) {
  const status = await apiFetch<LocalSecurityStatus>("/security/local/status");
  if (!status.initialized || status.locked) {
    throw new Error(`Local unlock is required before accessing ${surface}.`);
  }
  await jsonRequest<LocalSecurityStatus>("/security/local/touch", "POST", { surface });
}
