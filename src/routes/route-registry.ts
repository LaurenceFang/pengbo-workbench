import type { ViewKey } from "../store/app-store";
import type { UiState } from "../ui-state-registry";

export type RouteTopLevelView = ViewKey | "aiAssistant";
export type RoutePageKind = "index" | "detail" | "config" | "result" | "review" | "assistant";
export type RouteAccessPolicy = "public" | "local_unlock";
export type RouteActionPolicy = "read_only" | "local_write" | "explicit_confirmation";
export type PlannedTask = `T${number}`;
export type RouteAvailability =
  | { kind: "available" }
  | { kind: "planned"; plannedTask: PlannedTask; missingCondition: string };
export type RouteAiPolicy =
  | { mode: "none" }
  | { mode: "contextual" | "standalone"; availability: RouteAvailability };

export type RouteVisualContract = {
  svgFrame: string;
  desktop: { width: 1440; height: 900; tolerancePx: 2; maxUnmaskedDiffPercent: 1.5 };
  wide: { minWidth: 1600; layout: "three-region" };
  compact: { maxWidth: 1180; contextRail: "accessible-drawer" };
  narrow: { maxWidth: 960; layout: "single-column"; navigation: "drawer"; inspector: "drawer" };
};

export type FrameRouteRecord = {
  frameNo: number;
  frameId: string;
  svgRoute: string;
  svgBounds: { x: number; y: number; width: number; height: number };
  topLevelView: RouteTopLevelView;
  surface: { view: RouteTopLevelView; section: string };
  pageKind: RoutePageKind;
  componentKey: string;
  loaderKey?: string;
  fixtureKey: string;
  supportedStates: UiState[];
  availability: RouteAvailability;
  aiPolicy: RouteAiPolicy;
  accessPolicy: RouteAccessPolicy;
  actionPolicy: RouteActionPolicy;
  visualContract: RouteVisualContract;
  label: string;
};

const stateOrder: UiState[] = [
  "loading",
  "empty",
  "blocked",
  "error",
  "locked",
  "ready",
  "ai-insufficient-evidence",
  "cloud-opt-in",
  "recovery",
];
const aiStates = stateOrder;
const contextualAiAvailable: RouteAiPolicy = { mode: "contextual", availability: { kind: "available" } };
const contextualAiPlanned: RouteAiPolicy = {
  mode: "contextual",
  availability: { kind: "planned", plannedTask: "T116", missingCondition: "等待可审计的上下文 AI Router 与证据合同" },
};
const standaloneAiAvailable: RouteAiPolicy = {
  mode: "standalone",
  availability: { kind: "available" },
};

function bounds(frameNo: number) {
  const column = (frameNo - 1) % 2;
  const row = Math.floor((frameNo - 1) / 2);
  return { x: column * 1580 + 80, y: row * 1020 + 150, width: 1440, height: 900 };
}

function route(
  frameNo: number,
  svgRoute: string,
  topLevelView: RouteTopLevelView,
  pageKind: RoutePageKind,
  componentKey: string,
  fixtureKey: string,
  label: string,
  options: Partial<Pick<FrameRouteRecord, "loaderKey" | "supportedStates" | "aiPolicy" | "availability" | "accessPolicy" | "actionPolicy">> = {},
): FrameRouteRecord {
  const accessPolicy = options.accessPolicy ?? (
    (["research", "factorLab", "strategyLab", "workflowStudio", "dataSources", "screeners", "portfolio", "connections", "settings", "aiAssistant"] as RouteTopLevelView[]).includes(topLevelView)
      ? "local_unlock"
      : "public"
  );
  const availability = options.availability ?? { kind: "available" };
  const aiPolicy = options.aiPolicy ?? { mode: "none" };
  const supportedStateSet = new Set<UiState>();
  if (availability.kind === "planned") {
    supportedStateSet.add("blocked");
    supportedStateSet.add("recovery");
  } else {
    supportedStateSet.add("loading");
    supportedStateSet.add("empty");
    supportedStateSet.add("error");
    supportedStateSet.add("ready");
    supportedStateSet.add("recovery");
    if (accessPolicy === "local_unlock") {
      supportedStateSet.add("blocked");
      supportedStateSet.add("locked");
    }
    if (aiPolicy.mode !== "none") {
      if (aiPolicy.availability.kind === "available") {
        supportedStateSet.add("ai-insufficient-evidence");
        supportedStateSet.add("cloud-opt-in");
      }
    }
  }
  return {
    frameNo,
    frameId: `frame-${String(frameNo).padStart(2, "0")}`,
    svgRoute,
    svgBounds: bounds(frameNo),
    topLevelView,
    surface: { view: topLevelView, section: componentKey },
    pageKind,
    componentKey,
    fixtureKey,
    label,
    supportedStates: stateOrder.filter((state) => supportedStateSet.has(state)),
    availability,
    aiPolicy,
    accessPolicy,
    actionPolicy: options.actionPolicy ?? (pageKind === "config" ? "local_write" : "read_only"),
    visualContract: {
      svgFrame: `frame-${String(frameNo).padStart(2, "0")}`,
      desktop: { width: 1440, height: 900, tolerancePx: 2, maxUnmaskedDiffPercent: 1.5 },
      wide: { minWidth: 1600, layout: "three-region" },
      compact: { maxWidth: 1180, contextRail: "accessible-drawer" },
      narrow: { maxWidth: 960, layout: "single-column", navigation: "drawer", inspector: "drawer" },
    },
    loaderKey: options.loaderKey,
  };
}

export const frameRouteRegistry: readonly FrameRouteRecord[] = [
  route(1, "/dashboard/overview", "dashboard", "index", "dashboardOverview", "dashboard-ready", "首页总览", { loaderKey: "dashboardOverview" }),
  route(2, "/dashboard/runtime", "dashboard", "detail", "dashboardRuntime", "dashboard-runtime-ready", "本地运行状态", { loaderKey: "dashboardRuntime" }),
  route(3, "/command-center/actions", "commandCenter", "index", "commandActions", "command-actions-ready", "命令目录", { loaderKey: "commandActions" }),
  route(4, "/command-center/recent", "commandCenter", "detail", "commandRecent", "command-recent-ready", "最近命令", { loaderKey: "commandRecent", availability: { kind: "planned", plannedTask: "T109", missingCondition: "缺少可持久化的命令历史" } }),
  route(5, "/command-center/results/:resultId", "commandCenter", "result", "commandResult", "command-result-ready", "执行结果", { loaderKey: "commandResult", availability: { kind: "planned", plannedTask: "T109", missingCondition: "缺少可按 resultId 恢复的命令结果" } }),

  route(6, "/markets/assets", "asset", "index", "assetSearch", "asset-search-ready", "资产搜索", { loaderKey: "assetSearch", aiPolicy: contextualAiPlanned, supportedStates: aiStates }),
  route(7, "/markets/assets/:symbol/overview", "asset", "detail", "assetOverview", "asset-overview-ready", "资产概览", { loaderKey: "assetOverview", aiPolicy: contextualAiPlanned, supportedStates: aiStates }),
  route(8, "/markets/assets/:symbol/price", "asset", "detail", "assetPrice", "asset-price-ready", "行情与图表", { loaderKey: "assetPrice", aiPolicy: contextualAiPlanned, supportedStates: aiStates }),
  route(9, "/markets/assets/:symbol/fundamentals", "asset", "detail", "assetFundamentals", "asset-fundamentals-ready", "基本面与比率", { loaderKey: "assetFundamentals", aiPolicy: contextualAiPlanned, supportedStates: aiStates }),
  route(10, "/markets/assets/:symbol/filings", "asset", "detail", "assetFilings", "asset-filings-ready", "文件与公告", { loaderKey: "assetFilings", aiPolicy: contextualAiPlanned, supportedStates: aiStates }),
  route(11, "/markets/assets/:symbol/data", "asset", "detail", "assetData", "asset-data-ready", "数据覆盖与来源", { loaderKey: "assetData", aiPolicy: contextualAiPlanned, supportedStates: aiStates }),
  route(12, "/markets/assets/:symbol/research", "asset", "review", "assetResearch", "asset-research-ready", "研究交接", { loaderKey: "assetResearch", aiPolicy: contextualAiPlanned, supportedStates: aiStates }),

  route(13, "/markets/watchlist", "watchlist", "index", "watchlistIndex", "watchlist-ready", "自选目录", { loaderKey: "watchlistIndex" }),
  route(14, "/markets/watchlist/:listId", "watchlist", "detail", "watchlistDetail", "watchlist-detail-ready", "自选列表", { loaderKey: "watchlistDetail", availability: { kind: "planned", plannedTask: "T110", missingCondition: "当前仅支持默认自选列表，缺少多列表模型" } }),
  route(15, "/markets/watchlist/:listId/manage", "watchlist", "config", "watchlistManage", "watchlist-manage-ready", "自选管理", { loaderKey: "watchlistManage", availability: { kind: "planned", plannedTask: "T110", missingCondition: "缺少自选列表新增、重命名和删除能力" } }),

  route(16, "/markets/data-sources/catalog", "dataSources", "index", "dataSourcesCatalog", "data-sources-catalog-ready", "数据源目录", { loaderKey: "dataSourcesCatalog" }),
  route(17, "/markets/data-sources/:provider", "dataSources", "detail", "dataSourceDetail", "data-source-detail-ready", "来源详情与能力", { loaderKey: "dataSourceDetail" }),
  route(18, "/markets/data-sources/:provider/preview", "dataSources", "detail", "dataSourcePreview", "data-source-preview-ready", "数据预览", { loaderKey: "dataSourcePreview" }),
  route(19, "/markets/data-sources/:provider/quality", "dataSources", "review", "dataSourceQuality", "data-source-quality-ready", "来源质量", { loaderKey: "dataSourceQuality" }),
  route(20, "/markets/data-sources/report", "dataSources", "review", "dataSourcesReport", "data-sources-report-ready", "覆盖与新鲜度报告", { loaderKey: "dataSourcesReport" }),

  route(21, "/research/inbox", "research", "index", "researchInbox", "research-inbox-ready", "研究目录", { loaderKey: "researchInbox", aiPolicy: contextualAiAvailable, supportedStates: aiStates }),
  route(22, "/research/briefs/:briefId/decision", "research", "detail", "researchDecision", "research-decision-ready", "结论与论点", { loaderKey: "researchDecision", aiPolicy: contextualAiAvailable, supportedStates: aiStates }),
  route(23, "/research/briefs/:briefId/asset-data", "research", "detail", "researchAssetData", "research-asset-data-ready", "基本面与文件", { loaderKey: "researchAssetData", aiPolicy: contextualAiAvailable, supportedStates: aiStates }),
  route(24, "/research/briefs/:briefId/analysis", "research", "detail", "researchAnalysis", "research-analysis-ready", "结构化分析", { loaderKey: "researchAnalysis", aiPolicy: contextualAiAvailable, supportedStates: aiStates }),
  route(25, "/research/briefs/:briefId/evidence", "research", "detail", "researchEvidence", "research-evidence-ready", "证据链", { loaderKey: "researchEvidence", aiPolicy: contextualAiAvailable, supportedStates: aiStates }),
  route(26, "/research/briefs/:briefId/assistant", "research", "assistant", "researchAssistant", "research-assistant-ready", "AI 助手与生成预览", { loaderKey: "researchAssistant", aiPolicy: contextualAiAvailable, supportedStates: aiStates }),
  route(27, "/research/briefs/:briefId/notes", "research", "detail", "researchNotes", "research-notes-ready", "笔记与交接", { loaderKey: "researchNotes", aiPolicy: contextualAiAvailable, supportedStates: aiStates }),
  route(28, "/research/briefs/:briefId/export", "research", "review", "researchExport", "research-export-ready", "导出报告", { loaderKey: "researchExport", aiPolicy: contextualAiAvailable, supportedStates: aiStates }),

  route(29, "/factor-lab/runs/new", "factorLab", "config", "factorRunNew", "factor-run-new-ready", "新建因子实验", { loaderKey: "factorRunNew", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(30, "/factor-lab/runs", "factorLab", "index", "factorRuns", "factor-runs-ready", "因子运行记录", { loaderKey: "factorRuns", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(31, "/factor-lab/runs/:runId/results", "factorLab", "result", "factorResults", "factor-results-ready", "因子实验结果", { loaderKey: "factorResults", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(32, "/factor-lab/runs/:runId/assets/:symbol", "factorLab", "detail", "factorAssetExplanation", "factor-asset-ready", "标的因子解释", { loaderKey: "factorAssetExplanation", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(33, "/factor-lab/runs/:runId/quality", "factorLab", "review", "factorQuality", "factor-quality-ready", "数据质量", { loaderKey: "factorQuality", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(34, "/factor-lab/runs/:runId/handoff", "factorLab", "review", "factorHandoff", "factor-handoff-ready", "研究/策略交接", { loaderKey: "factorHandoff", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),

  route(35, "/strategies", "strategyLab", "index", "strategies", "strategies-ready", "策略实验室", { loaderKey: "strategies", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(36, "/strategies/new", "strategyLab", "config", "strategyNew", "strategy-new-ready", "新建策略", { loaderKey: "strategyNew", availability: { kind: "planned", plannedTask: "T155", missingCondition: "缺少独立策略项目的持久化模型" }, aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(37, "/strategies/backtests/new", "strategyLab", "config", "backtestNew", "backtest-new-ready", "新建回测", { loaderKey: "backtestNew", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(38, "/strategies/backtests/:backtestId", "strategyLab", "result", "backtestResult", "backtest-result-ready", "回测结果", { loaderKey: "backtestResult", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(39, "/strategies/paper/:sessionId", "strategyLab", "detail", "paperSession", "paper-session-ready", "Paper Trading 会话", { loaderKey: "paperSession", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(40, "/strategies/risk-review/:id", "strategyLab", "review", "strategyRiskReview", "strategy-risk-ready", "风险复核", { loaderKey: "strategyRiskReview", availability: { kind: "planned", plannedTask: "T159", missingCondition: "已有风险数据但尚无独立 risk-review 实体" }, aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(41, "/strategies/execution/:id", "strategyLab", "review", "strategyExecution", "strategy-execution-ready", "执行意图与审计", { loaderKey: "strategyExecution", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock", actionPolicy: "explicit_confirmation" }),

  route(42, "/automation/workflows", "workflowStudio", "index", "workflowCatalog", "workflow-catalog-ready", "工作流目录", { loaderKey: "workflowCatalog", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(43, "/automation/workflows/:templateId", "workflowStudio", "detail", "workflowDetail", "workflow-detail-ready", "工作流模板详情", { loaderKey: "workflowDetail", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(44, "/automation/workflows/:templateId/configure", "workflowStudio", "config", "workflowConfigure", "workflow-configure-ready", "工作流配置", { loaderKey: "workflowConfigure", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(45, "/automation/workflows/runs", "workflowStudio", "index", "workflowRuns", "workflow-runs-ready", "工作流运行记录", { loaderKey: "workflowRuns", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(46, "/automation/workflows/runs/:runId", "workflowStudio", "detail", "workflowRun", "workflow-run-ready", "运行时间线", { loaderKey: "workflowRun", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(47, "/automation/workflows/runs/:runId/artifacts", "workflowStudio", "detail", "workflowArtifacts", "workflow-artifacts-ready", "证据与产物", { loaderKey: "workflowArtifacts", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(48, "/automation/workflows/runs/:runId/confirm", "workflowStudio", "review", "workflowConfirm", "workflow-confirm-ready", "人工确认", { loaderKey: "workflowConfirm", availability: { kind: "planned", plannedTask: "T136", missingCondition: "当前只能阻断 manual-required 步骤，缺少确认 API" }, aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock", actionPolicy: "explicit_confirmation" }),

  route(49, "/automation/screeners", "screeners", "index", "screenerCatalog", "screener-catalog-ready", "筛选器目录", { loaderKey: "screenerCatalog", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(50, "/automation/screeners/:presetKey/variants/:variantKey", "screeners", "detail", "screenerVariant", "screener-variant-ready", "筛选器变体", { loaderKey: "screenerVariant", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(51, "/automation/screeners/:presetKey/variants/:variantKey/tuning", "screeners", "config", "screenerTuning", "screener-tuning-ready", "参数调优", { loaderKey: "screenerTuning", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(52, "/automation/screeners/:presetKey/universe", "screeners", "detail", "screenerUniverse", "screener-universe-ready", "Universe 与覆盖", { loaderKey: "screenerUniverse", aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(53, "/automation/screeners/runs/:runId", "screeners", "result", "screenerRun", "screener-run-ready", "筛选结果", { loaderKey: "screenerRun", availability: { kind: "planned", plannedTask: "T137", missingCondition: "运行结果尚不能按 runId 从本地持久层恢复" }, aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),
  route(54, "/automation/screeners/runs/:runId/explanations", "screeners", "review", "screenerExplanations", "screener-explanations-ready", "命中解释", { loaderKey: "screenerExplanations", availability: { kind: "planned", plannedTask: "T137", missingCondition: "命中解释当前仅存在于内存运行结果" }, aiPolicy: contextualAiPlanned, supportedStates: aiStates, accessPolicy: "local_unlock" }),

  route(55, "/portfolio/overview", "portfolio", "index", "portfolioOverview", "portfolio-overview-ready", "组合总览", { loaderKey: "portfolioOverview", accessPolicy: "local_unlock" }),
  route(56, "/portfolio/holdings", "portfolio", "detail", "portfolioHoldings", "portfolio-holdings-ready", "持仓", { loaderKey: "portfolioHoldings", accessPolicy: "local_unlock" }),
  route(57, "/portfolio/allocation", "portfolio", "detail", "portfolioAllocation", "portfolio-allocation-ready", "配置与集中度", { loaderKey: "portfolioAllocation", accessPolicy: "local_unlock" }),
  route(58, "/portfolio/analytics", "portfolio", "detail", "portfolioAnalytics", "portfolio-analytics-ready", "收益与分析", { loaderKey: "portfolioAnalytics", accessPolicy: "local_unlock" }),
  route(59, "/portfolio/risk", "portfolio", "review", "portfolioRisk", "portfolio-risk-ready", "风险", { loaderKey: "portfolioRisk", accessPolicy: "local_unlock" }),
  route(60, "/portfolio/transactions", "portfolio", "detail", "portfolioTransactions", "portfolio-transactions-ready", "交易记录", { loaderKey: "portfolioTransactions", accessPolicy: "local_unlock" }),
  route(61, "/portfolio/transactions/new", "portfolio", "config", "portfolioTransactionNew", "portfolio-transaction-new-ready", "新增交易", { loaderKey: "portfolioTransactionNew", accessPolicy: "local_unlock" }),
  route(62, "/portfolio/handoff/:symbol", "portfolio", "review", "portfolioHandoff", "portfolio-handoff-ready", "持仓研究交接", { loaderKey: "portfolioHandoff", accessPolicy: "local_unlock" }),

  route(63, "/settings/connections/providers", "connections", "index", "connectionsCatalog", "connections-catalog-ready", "连接目录", { loaderKey: "connectionsCatalog", accessPolicy: "local_unlock" }),
  route(64, "/settings/connections/:provider", "connections", "detail", "connectionDetail", "connection-detail-ready", "连接详情", { loaderKey: "connectionDetail", accessPolicy: "local_unlock" }),
  route(65, "/settings/connections/credentials", "connections", "config", "connectionCredentials", "connection-credentials-ready", "凭证管理", { loaderKey: "connectionCredentials", accessPolicy: "local_unlock" }),
  route(66, "/settings/connections/health", "connections", "review", "connectionHealth", "connection-health-ready", "连接探测与诊断", { loaderKey: "connectionHealth", accessPolicy: "local_unlock" }),
  route(67, "/settings/preferences", "settings", "index", "settingsPreferences", "settings-preferences-ready", "常规偏好", { loaderKey: "settingsPreferences", accessPolicy: "local_unlock" }),
  route(68, "/settings/appearance", "settings", "detail", "settingsAppearance", "settings-appearance-ready", "外观与可读性", { loaderKey: "settingsAppearance", accessPolicy: "local_unlock" }),
  route(69, "/settings/data", "settings", "detail", "settingsData", "settings-data-ready", "数据与缓存", { loaderKey: "settingsData", availability: { kind: "planned", plannedTask: "T170", missingCondition: "缺少独立缓存与数据维护设置合同" }, accessPolicy: "local_unlock" }),
  route(70, "/settings/security", "settings", "review", "settingsSecurity", "settings-security-ready", "安全与本地解锁", { loaderKey: "settingsSecurity", accessPolicy: "local_unlock" }),
  route(71, "/settings/ai", "settings", "detail", "settingsAi", "settings-ai-ready", "AI 边界", { loaderKey: "settingsAi", availability: { kind: "planned", plannedTask: "T117", missingCondition: "AI Control 尚未迁移到独立设置页面" }, accessPolicy: "local_unlock" }),
  route(72, "/settings/execution", "settings", "review", "settingsExecution", "settings-execution-ready", "执行边界与 Kill Switch", { loaderKey: "settingsExecution", accessPolicy: "local_unlock", actionPolicy: "explicit_confirmation" }),
  route(73, "/settings/runtime", "settings", "review", "settingsRuntime", "settings-runtime-ready", "诊断与运行时", { loaderKey: "settingsRuntime", accessPolicy: "local_unlock" }),

  route(74, "/help/manual/getting-started", "manual", "detail", "manualGettingStarted", "manual-getting-started-ready", "研究流程", { loaderKey: "manualGettingStarted" }),
  route(75, "/help/manual/research-data", "manual", "detail", "manualResearchData", "manual-research-data-ready", "筛选与因子", { loaderKey: "manualResearchData" }),
  route(76, "/help/manual/strategy-workflows", "manual", "detail", "manualStrategyWorkflows", "manual-strategy-workflows-ready", "回测与模拟", { loaderKey: "manualStrategyWorkflows" }),
  route(77, "/help/manual/security-execution", "manual", "detail", "manualSecurityExecution", "manual-security-execution-ready", "凭证与安全", { loaderKey: "manualSecurityExecution" }),
  route(78, "/help/manual/troubleshooting", "manual", "detail", "manualTroubleshooting", "manual-troubleshooting-ready", "状态说明", { loaderKey: "manualTroubleshooting" }),
  route(79, "/ai-assistant", "aiAssistant", "assistant", "aiAssistant", "ai-assistant-ready", "通用 AI 工作区", { loaderKey: "aiAssistant", aiPolicy: standaloneAiAvailable, supportedStates: aiStates, accessPolicy: "local_unlock", actionPolicy: "local_write" }),
];

export const defaultRouteByView: Partial<Record<RouteTopLevelView, string>> = {
  dashboard: "/dashboard/overview",
  commandCenter: "/command-center/actions",
  asset: "/markets/assets/:symbol/overview",
  watchlist: "/markets/watchlist",
  dataSources: "/markets/data-sources/catalog",
  research: "/research/inbox",
  factorLab: "/factor-lab/runs",
  strategyLab: "/strategies",
  workflowStudio: "/automation/workflows",
  screeners: "/automation/screeners",
  portfolio: "/portfolio/overview",
  connections: "/settings/connections/providers",
  settings: "/settings/preferences",
  manual: "/help/manual/getting-started",
  aiAssistant: "/ai-assistant",
};

export function getFrameRoute(routePath: string): FrameRouteRecord | undefined {
  return frameRouteRegistry.find((record) => record.svgRoute === routePath);
}

export function getFrameRouteByComponent(componentKey: string): FrameRouteRecord | undefined {
  return frameRouteRegistry.find((record) => record.componentKey === componentKey);
}

export function getFrameRoutesForView(view: RouteTopLevelView): readonly FrameRouteRecord[] {
  return frameRouteRegistry.filter((record) => record.topLevelView === view);
}

export function materializeRoutePath(
  routePath: string,
  params: Readonly<Record<string, string | null | undefined>>,
): string {
  return routePath.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
    const value = params[key];
    return encodeURIComponent(value && value.trim() ? value : `current-${key}`);
  });
}

export function routeMatchesPath(record: FrameRouteRecord, pathname: string): boolean {
  const routeParts = record.svgRoute.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (routeParts.length !== pathParts.length) return false;
  return routeParts.every((part, index) => part.startsWith(":") || part === pathParts[index]);
}

export function getRouteParams(record: FrameRouteRecord, pathname: string): Readonly<Record<string, string>> {
  const routeParts = record.svgRoute.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  return Object.fromEntries(routeParts.flatMap((part, index) => part.startsWith(":")
    ? [[part.slice(1), decodeURIComponent(pathParts[index] ?? "")]]
    : []));
}

export function getRouteObjectType(route: FrameRouteRecord): string {
  if (route.svgRoute.includes("assets")) return "asset";
  if (route.svgRoute.includes("brief")) return "research_brief";
  if (route.svgRoute.includes("factor")) return "factor_run";
  if (route.svgRoute.includes("strateg")) return "strategy_run";
  if (route.svgRoute.includes("workflow")) return "workflow_run";
  if (route.svgRoute.includes("screener")) return "screener_run";
  if (route.svgRoute.includes("portfolio")) return "portfolio";
  if (route.svgRoute.includes("settings/connections")) return "provider";
  return route.topLevelView;
}

export function getFrameRouteForPath(pathname: string): FrameRouteRecord | undefined {
  return frameRouteRegistry
    .filter((record) => routeMatchesPath(record, pathname))
    .sort((left, right) => {
      const leftStatic = left.svgRoute.split("/").filter(Boolean).filter((part) => !part.startsWith(":")).length;
      const rightStatic = right.svgRoute.split("/").filter(Boolean).filter((part) => !part.startsWith(":")).length;
      return rightStatic - leftStatic;
    })[0];
}

export function validateFrameRouteRegistry() {
  const failures: string[] = [];
  const frameNos = frameRouteRegistry.map((record) => record.frameNo);
  const routes = frameRouteRegistry.map((record) => record.svgRoute);
  if (frameRouteRegistry.length !== 79) failures.push(`expected 79 routes, found ${frameRouteRegistry.length}`);
  if (new Set(frameNos).size !== frameNos.length || frameNos.some((number, index) => number !== index + 1)) failures.push("frame numbers are not unique and contiguous");
  if (new Set(routes).size !== routes.length) failures.push("route paths are not unique");
  for (const record of frameRouteRegistry) {
    if (!record.frameId || !record.componentKey || !record.surface.section || !record.fixtureKey || record.supportedStates.length === 0) failures.push(`frame ${record.frameNo} is incomplete`);
    if (record.actionPolicy === "explicit_confirmation" && record.accessPolicy !== "local_unlock") failures.push(`frame ${record.frameNo} confirmation route must also require local unlock`);
    if (record.availability.kind === "planned" && !/^T\d+$/.test(record.availability.plannedTask)) failures.push(`frame ${record.frameNo} has an invalid planned task`);
  }
  return failures;
}
