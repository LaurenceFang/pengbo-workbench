import { FileText, FlaskConical, Play, Power, RefreshCcw, ShieldAlert, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  InlineState,
  MetricCard,
  PanelState,
  ProfessionalChartPanel,
  formatPercent,
  formatPrice,
  type BackendStatus,
} from "../components/shared";
import { useAsyncResource } from "../hooks/use-async-resource";
import { usePengboNavigation } from "../hooks/use-pengbo-navigation";
import {
  api,
  type BinanceExecutionIntentResponse,
  type StrategyBacktestResponse,
  type StrategyPaperSessionResponse,
} from "../lib/api";
import { useAppStore } from "../store/app-store";
import { useRouteContext } from "../routes/route-context";

export type StrategyRouteSection =
  | "strategies"
  | "backtestNew"
  | "backtestResult"
  | "paperSession"
  | "strategyExecution";

type StrategyLabViewProps = {
  backendStatus: BackendStatus;
  routeSection?: StrategyRouteSection;
};

function metricDisplay(value: number | string, unit: string | null): string {
  if (typeof value === "number") {
    return unit === "pct" ? `${value.toFixed(2)}%` : Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return unit ? `${value} ${unit}` : value;
}

function metricLookup(backtest: StrategyBacktestResponse | null, label: string, notAvailable: string): string {
  const metric = backtest?.metrics.find((item) => item.label === label);
  return metric ? metricDisplay(metric.value, metric.unit) : notAvailable;
}

type StrategyCopy = {
  eyebrow: string;
  title: string;
  reload: string;
  template: string;
  topNFactorRotation: string;
  paperOnly: string;
  factorRun: string;
  topN: string;
  rebalance: string;
  monthly: string;
  quarterly: string;
  capital: string;
  maxWeight: string;
  cashReserve: string;
  benchmark: string;
  costBps: string;
  slippageBps: string;
  runBacktest: string;
  running: string;
  openFactor: string;
  recentFactorRuns: string;
  openSavedSnapshot: string;
  emptyFactor: string;
  totalReturn: string;
  maxDrawdown: string;
  trades: string;
  window: string;
  backtests: string;
  persistedStrategyRuns: string;
  backtestResult: string;
  simulated: string;
  paperTrading: string;
  noLiveOrderPath: string;
  orders: string;
  noPaperSession: string;
  noPaperSessionCopy: string;
  startPaper: string;
  noBacktest: string;
  noBacktestCopy: string;
  liveExecution: string;
  executionTitle: string;
  explicitLive: string;
  defaultOff: string;
  credentials: string;
  configured: string;
  missing: string;
  riskAck: string;
  recorded: string;
  required: string;
  killSwitch: string;
  enabled: string;
  clear: string;
  maxOrder: string;
  intentDraft: string;
  paperEvidenceLinked: string;
  paperEvidenceMissing: string;
  noBacktestShort: string;
  symbol: string;
  quantity: string;
  clientOrderId: string;
  optionalUniqueId: string;
  createIntent: string;
  runRiskSubmit: string;
  enableKillSwitch: string;
  clearKillSwitch: string;
  cash: string;
  pnl: string;
  fills: string;
  mode: string;
  riskEvidence: string;
  noActiveIntent: string;
  blocks: string;
  intent: string;
  notional: string;
  audit: string;
  noRiskRun: string;
  noRiskRunCopy: string;
  noIntentCopy: string;
  recentIntents: string;
  executionLedger: string;
  auditTrail: string;
  latestEvents: string;
  exportReport: string;
  exportPaperReport: string;
  runFailed: string;
  loadFactorFailed: string;
  openBacktestFailed: string;
  startPaperFailed: string;
  openPaperFailed: string;
  exportFailed: string;
  createIntentFailed: string;
  submitFailed: string;
  killSwitchFailed: string;
  runCompleted: string;
  loaded: string;
  sessionStarted: string;
  reportExported: string;
  intentCreated: string;
  intentBlocked: string;
  intentSubmitted: string;
  killSwitchEnabled: string;
  killSwitchCleared: string;
  notAvailable: string;
};

const STRATEGY_COPY: Record<"zh-CN" | "en-US", StrategyCopy> = {
  "zh-CN": {
    eyebrow: "策略实验室",
    title: "回测、纸面交易、诊断与模拟报告",
    reload: "刷新",
    template: "模板",
    topNFactorRotation: "Top-N 因子轮动",
    paperOnly: "仅纸面",
    factorRun: "因子运行",
    topN: "Top N",
    rebalance: "再平衡",
    monthly: "每月",
    quarterly: "每季度",
    capital: "初始资金",
    maxWeight: "最大权重",
    cashReserve: "现金储备",
    benchmark: "基准",
    costBps: "成本 bps",
    slippageBps: "滑点 bps",
    runBacktest: "运行回测",
    running: "运行中...",
    openFactor: "打开因子实验室",
    recentFactorRuns: "最近因子运行",
    openSavedSnapshot: "打开已保存快照",
    emptyFactor: "还没有保存的因子实验室快照。请先打开因子实验室并运行一次本地排名。",
    totalReturn: "总收益",
    maxDrawdown: "最大回撤",
    trades: "交易次数",
    window: "时间窗口",
    backtests: "回测",
    persistedStrategyRuns: "已保存的策略运行",
    backtestResult: "回测结果",
    simulated: "模拟",
    paperTrading: "纸面交易",
    noLiveOrderPath: "没有实时下单路径",
    orders: "订单",
    noPaperSession: "还没有纸面会话",
    noPaperSessionCopy: "从当前回测启动纸面会话，以创建模拟订单、成交、现金账本和盈亏。",
    startPaper: "启动纸面会话",
    noBacktest: "还没有策略回测",
    noBacktestCopy: "加载已保存的因子实验室快照，调整 Top-N 策略参数，然后运行本地模拟。",
    liveExecution: "实时执行",
    executionTitle: "Binance 执行意图与风险控制",
    explicitLive: "显式实时模式",
    defaultOff: "默认关闭",
    credentials: "凭证",
    configured: "已配置",
    missing: "缺少",
    riskAck: "风险确认",
    recorded: "已记录",
    required: "需要确认",
    killSwitch: "熔断开关",
    enabled: "已启用",
    clear: "已清除",
    maxOrder: "最大订单",
    intentDraft: "意图草稿",
    paperEvidenceLinked: "已关联纸面证据",
    paperEvidenceMissing: "缺少纸面证据",
    noBacktestShort: "没有回测",
    symbol: "交易标的",
    quantity: "数量",
    clientOrderId: "客户端订单 ID",
    optionalUniqueId: "可选的唯一 ID",
    createIntent: "创建意图",
    runRiskSubmit: "运行风险提交",
    enableKillSwitch: "启用熔断开关",
    clearKillSwitch: "清除熔断开关",
    cash: "现金",
    pnl: "盈亏",
    fills: "成交",
    mode: "模式",
    riskEvidence: "风险证据",
    noActiveIntent: "没有活动意图",
    blocks: "项阻塞",
    intent: "意图",
    notional: "名义金额",
    audit: "审计",
    noRiskRun: "尚未运行风险检查",
    noRiskRunCopy: "创建意图，然后运行风险提交以记录决策。",
    noIntentCopy: "从有纸面证据的策略结果创建执行意图，以便在任何经纪商请求前检查风险闸门。",
    recentIntents: "最近意图",
    executionLedger: "本地执行账本",
    auditTrail: "审计轨迹",
    latestEvents: "最近事件",
    exportReport: "导出报告",
    exportPaperReport: "导出纸面报告",
    runFailed: "运行策略回测失败。",
    loadFactorFailed: "加载因子运行失败。",
    openBacktestFailed: "打开策略回测失败。",
    startPaperFailed: "启动纸面会话失败。",
    openPaperFailed: "打开纸面会话失败。",
    exportFailed: "导出策略报告失败。",
    createIntentFailed: "创建执行意图失败。",
    submitFailed: "提交执行意图失败。",
    killSwitchFailed: "更新熔断开关失败。",
    runCompleted: "回测已完成",
    loaded: "已加载因子运行",
    sessionStarted: "纸面会话已启动",
    reportExported: "策略报告已导出",
    intentCreated: "执行意图已创建",
    intentBlocked: "执行意图已被阻塞",
    intentSubmitted: "执行意图已提交",
    killSwitchEnabled: "全局 Binance 熔断开关已启用",
    killSwitchCleared: "全局 Binance 熔断开关已清除",
    notAvailable: "暂无",
  },
  "en-US": {
    eyebrow: "Strategy Lab",
    title: "Backtesting, paper trading, diagnostics, and simulated reports",
    reload: "Reload",
    template: "Template",
    topNFactorRotation: "Top-N Factor Rotation",
    paperOnly: "paper-only",
    factorRun: "Factor run",
    topN: "Top N",
    rebalance: "Rebalance",
    monthly: "Monthly",
    quarterly: "Quarterly",
    capital: "Capital",
    maxWeight: "Max weight",
    cashReserve: "Cash reserve",
    benchmark: "Benchmark",
    costBps: "Cost bps",
    slippageBps: "Slippage bps",
    runBacktest: "Run Backtest",
    running: "Running...",
    openFactor: "Open Factor Lab",
    recentFactorRuns: "Recent Factor Runs",
    openSavedSnapshot: "Open a saved snapshot",
    emptyFactor: "No saved Factor Lab snapshot yet. Open Factor Lab and run a local ranking first.",
    totalReturn: "Total return",
    maxDrawdown: "Max drawdown",
    trades: "Trades",
    window: "Window",
    backtests: "Backtests",
    persistedStrategyRuns: "Persisted strategy runs",
    backtestResult: "Backtest Result",
    simulated: "simulated",
    paperTrading: "Paper Trading",
    noLiveOrderPath: "No live order path",
    orders: "orders",
    noPaperSession: "No paper session yet",
    noPaperSessionCopy: "Start a paper session from the current backtest to create simulated orders, fills, cash ledger, and PnL.",
    startPaper: "Start Paper Session",
    noBacktest: "No strategy backtest yet",
    noBacktestCopy: "Load a saved Factor Lab snapshot, tune the top-N strategy parameters, and run a local simulation.",
    liveExecution: "Live Execution",
    executionTitle: "Binance execution intents and risk controls",
    explicitLive: "explicit live mode",
    defaultOff: "default off",
    credentials: "Credentials",
    configured: "configured",
    missing: "missing",
    riskAck: "Risk ack",
    recorded: "recorded",
    required: "required",
    killSwitch: "Kill switch",
    enabled: "enabled",
    clear: "clear",
    maxOrder: "Max order",
    intentDraft: "Intent Draft",
    paperEvidenceLinked: "Paper evidence linked",
    paperEvidenceMissing: "Paper evidence missing",
    noBacktestShort: "no backtest",
    symbol: "Symbol",
    quantity: "Quantity",
    clientOrderId: "Client order id",
    optionalUniqueId: "optional unique id",
    createIntent: "Create Intent",
    runRiskSubmit: "Run Risk Submit",
    enableKillSwitch: "Enable Kill Switch",
    clearKillSwitch: "Clear Kill Switch",
    cash: "Cash",
    pnl: "PnL",
    fills: "Fills",
    mode: "Mode",
    riskEvidence: "Risk Evidence",
    noActiveIntent: "No active intent",
    blocks: "blocks",
    intent: "Intent",
    notional: "Notional",
    audit: "Audit",
    noRiskRun: "No risk run yet",
    noRiskRunCopy: "Create an intent, then run risk submit to record decisions.",
    noIntentCopy: "Create an execution intent from a paper-backed strategy result to inspect risk gates before any broker request is possible.",
    recentIntents: "Recent Intents",
    executionLedger: "Local execution ledger",
    auditTrail: "Audit Trail",
    latestEvents: "Latest events",
    exportReport: "Export Report",
    exportPaperReport: "Export Paper Report",
    runFailed: "Failed to run strategy backtest.",
    loadFactorFailed: "Failed to load factor run.",
    openBacktestFailed: "Failed to open strategy backtest.",
    startPaperFailed: "Failed to start paper session.",
    openPaperFailed: "Failed to open paper session.",
    exportFailed: "Failed to export strategy report.",
    createIntentFailed: "Failed to create execution intent.",
    submitFailed: "Failed to submit execution intent.",
    killSwitchFailed: "Failed to update kill switch.",
    runCompleted: "Backtest completed",
    loaded: "Factor run loaded for Strategy Lab",
    sessionStarted: "Paper session started",
    reportExported: "Strategy report exported",
    intentCreated: "Execution intent created",
    intentBlocked: "Execution intent blocked",
    intentSubmitted: "Execution intent submitted",
    killSwitchEnabled: "Global Binance execution kill switch enabled",
    killSwitchCleared: "Global Binance execution kill switch cleared",
    notAvailable: "n/a",
  },
};

function strategyStatusLabel(status: string, copy: StrategyCopy): string {
  const labels: Record<string, string> = {
    draft: copy.noActiveIntent,
    blocked: copy.intentBlocked,
    submitted: copy.intentSubmitted,
    filled: copy.intentSubmitted,
    enabled: copy.enabled,
    clear: copy.clear,
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function StrategyLabView({ backendStatus, routeSection }: StrategyLabViewProps) {
  const sidecarReady = backendStatus === "online";
  const { params } = useRouteContext();
  const language = useAppStore((state) => state.language);
  const copy = STRATEGY_COPY[language];
  const selectedFactorRunId = useAppStore((state) => state.selectedFactorRunId);
  const lastFactorRunResult = useAppStore((state) => state.lastFactorRunResult);
  const selectedStrategyBacktestId = useAppStore((state) => state.selectedStrategyBacktestId);
  const lastStrategyBacktestResult = useAppStore((state) => state.lastStrategyBacktestResult);
  const lastStrategyPaperSession = useAppStore((state) => state.lastStrategyPaperSession);
  const selectedStrategyPaperSessionId = useAppStore((state) => state.selectedStrategyPaperSessionId);
  const { openRoute, openView: setActiveView } = usePengboNavigation();
  const setSelectedFactorRunId = useAppStore((state) => state.setSelectedFactorRunId);
  const setLastFactorRunResult = useAppStore((state) => state.setLastFactorRunResult);
  const setSelectedStrategyBacktestId = useAppStore((state) => state.setSelectedStrategyBacktestId);
  const setLastStrategyBacktestResult = useAppStore((state) => state.setLastStrategyBacktestResult);
  const setSelectedStrategyPaperSessionId = useAppStore((state) => state.setSelectedStrategyPaperSessionId);
  const setLastStrategyPaperSession = useAppStore((state) => state.setLastStrategyPaperSession);
  const setLatestCommandFeedback = useAppStore((state) => state.setLatestCommandFeedback);

  const needsStrategyTemplates = routeSection === undefined || routeSection === "strategies" || routeSection === "backtestNew";
  const needsFactorRuns = routeSection === undefined || routeSection === "backtestNew";
  const needsBacktests = routeSection === undefined || routeSection === "strategies";
  const needsPaperSessions = routeSection === undefined || routeSection === "strategies" || routeSection === "paperSession";
  const needsExecution = routeSection === undefined || routeSection === "strategyExecution";
  const templates = useAsyncResource(async () => api.getStrategyTemplates(), [], { enabled: sidecarReady && needsStrategyTemplates });
  const recentFactorRuns = useAsyncResource(async () => api.getRecentFactorRuns(12), [], { enabled: sidecarReady && needsFactorRuns });
  const recentBacktests = useAsyncResource(async () => api.getRecentStrategyBacktests(12), [], { enabled: sidecarReady && needsBacktests });
  const recentPaper = useAsyncResource(async () => api.getRecentStrategyPaperSessions(12), [], { enabled: sidecarReady && needsPaperSessions });
  const executionConfig = useAsyncResource(async () => api.getBinanceExecutionConfig(), [], { enabled: sidecarReady && needsExecution });
  const executionAudit = useAsyncResource(async () => api.getBinanceExecutionAudit(10), [], { enabled: sidecarReady && needsExecution });
  const recentExecutionIntents = useAsyncResource(async () => api.getRecentBinanceExecutionIntents(8), [], {
    enabled: sidecarReady && needsExecution,
  });
  const [factorRunId, setFactorRunId] = useState(selectedFactorRunId ?? lastFactorRunResult?.run_id ?? "");
  const [topN, setTopN] = useState(5);
  const [rebalanceInterval, setRebalanceInterval] = useState<"monthly" | "quarterly">("monthly");
  const [initialCapital, setInitialCapital] = useState(100000);
  const [maxPositionWeight, setMaxPositionWeight] = useState(0.25);
  const [cashReservePct, setCashReservePct] = useState(0.05);
  const [benchmarkSymbol, setBenchmarkSymbol] = useState("SPY");
  const [transactionCostBps, setTransactionCostBps] = useState(5);
  const [slippageBps, setSlippageBps] = useState(10);
  const [executionSymbol, setExecutionSymbol] = useState("BTC/USDT");
  const [executionQuantity, setExecutionQuantity] = useState(0.01);
  const [executionClientOrderId, setExecutionClientOrderId] = useState("");
  const [activeExecutionIntent, setActiveExecutionIntent] = useState<BinanceExecutionIntentResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const activeBacktest = lastStrategyBacktestResult;
  const activePaper = lastStrategyPaperSession;
  const template = templates.data?.[0] ?? null;
  const warnings = useMemo(
    () => [...(template?.warnings ?? []), ...(activeBacktest?.diagnostics.warnings ?? [])],
    [activeBacktest, template],
  );

  useEffect(() => {
    const backtestId = params.backtestId;
    if (
      routeSection !== "backtestResult"
      || !sidecarReady
      || !backtestId
      || backtestId.startsWith("current-")
      || activeBacktest?.run_id === backtestId
    ) {
      return;
    }
    let cancelled = false;
    void api.getStrategyBacktest(backtestId).then((result) => {
      if (cancelled) return;
      setSelectedStrategyBacktestId(result.run_id);
      setLastStrategyBacktestResult(result);
      setFactorRunId(result.factor_run_id);
    }).catch((error: unknown) => {
      if (!cancelled) setActionError(error instanceof Error ? error.message : copy.openBacktestFailed);
    });
    return () => { cancelled = true; };
  }, [activeBacktest?.run_id, copy.openBacktestFailed, params.backtestId, routeSection, setLastStrategyBacktestResult, setSelectedStrategyBacktestId, sidecarReady]);

  useEffect(() => {
    const sessionId = params.sessionId;
    if (
      routeSection !== "paperSession"
      || !sidecarReady
      || !sessionId
      || sessionId.startsWith("current-")
      || activePaper?.session_id === sessionId
    ) {
      return;
    }
    let cancelled = false;
    void api.getStrategyPaperSession(sessionId).then((result) => {
      if (cancelled) return;
      setSelectedStrategyPaperSessionId(result.session_id);
      setLastStrategyPaperSession(result);
    }).catch((error: unknown) => {
      if (!cancelled) setActionError(error instanceof Error ? error.message : copy.openPaperFailed);
    });
    return () => { cancelled = true; };
  }, [activePaper?.session_id, copy.openPaperFailed, params.sessionId, routeSection, setLastStrategyPaperSession, setSelectedStrategyPaperSessionId, sidecarReady]);

  useEffect(() => {
    if (routeSection !== "strategyExecution" || !params.id || params.id.startsWith("current-")) return;
    const intent = recentExecutionIntents.data?.find((item) => item.intent_id === params.id);
    if (intent) setActiveExecutionIntent(intent);
  }, [params.id, recentExecutionIntents.data, routeSection]);

  async function openFactorRun(runId: string) {
    setBusy(true);
    setActionError(null);
    try {
      const run = await api.getFactorRun(runId);
      setSelectedFactorRunId(run.run_id);
      setLastFactorRunResult(run);
      setFactorRunId(run.run_id);
      setActionMessage(`${copy.loaded}: ${run.run_id}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.loadFactorFailed);
    } finally {
      setBusy(false);
    }
  }

  async function runBacktest() {
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await api.runStrategyBacktest({
        templateKey: "top_n_factor_rotation",
        factorRunId: factorRunId.trim(),
        topN,
        rebalanceInterval,
        initialCapital,
        maxPositionWeight,
        cashReservePct,
        benchmarkSymbol: benchmarkSymbol.trim().toUpperCase(),
        transactionCostBps,
        slippageBps,
      });
      setSelectedStrategyBacktestId(result.run_id);
      setLastStrategyBacktestResult(result);
      setActionMessage(`${copy.runCompleted}: ${result.run_id}`);
      recentBacktests.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.runFailed);
    } finally {
      setBusy(false);
    }
  }

  async function openBacktest(runId: string) {
    setBusy(true);
    setActionError(null);
    try {
      const result = await api.getStrategyBacktest(runId);
      setSelectedStrategyBacktestId(result.run_id);
      setLastStrategyBacktestResult(result);
      setFactorRunId(result.factor_run_id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.openBacktestFailed);
    } finally {
      setBusy(false);
    }
  }

  async function startPaperSession() {
    if (!activeBacktest) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const result = await api.createStrategyPaperSession({
        backtestRunId: activeBacktest.run_id,
        label: `Paper ${activeBacktest.run_id}`,
      });
      setSelectedStrategyPaperSessionId(result.session_id);
      setLastStrategyPaperSession(result);
      setActionMessage(`${copy.sessionStarted}: ${result.session_id}`);
      recentPaper.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.startPaperFailed);
    } finally {
      setBusy(false);
    }
  }

  async function openPaperSession(sessionId: string) {
    setBusy(true);
    setActionError(null);
    try {
      const result = await api.getStrategyPaperSession(sessionId);
      setSelectedStrategyPaperSessionId(result.session_id);
      setLastStrategyPaperSession(result);
      if (!activeBacktest || activeBacktest.run_id !== result.backtest_run_id) {
        const backtest = await api.getStrategyBacktest(result.backtest_run_id);
        setSelectedStrategyBacktestId(backtest.run_id);
        setLastStrategyBacktestResult(backtest);
        setFactorRunId(backtest.factor_run_id);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.openPaperFailed);
    } finally {
      setBusy(false);
    }
  }

  async function exportReport(artifactId: string) {
    setBusy(true);
    setActionError(null);
    try {
      const result = await api.exportStrategyReport(artifactId);
      setLatestCommandFeedback({
        tone: "success",
        title: copy.reportExported,
        detail: result.export_path,
      });
      setActionMessage(`${copy.reportExported}: ${result.artifact_type}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.exportFailed);
    } finally {
      setBusy(false);
    }
  }

  async function createExecutionIntent() {
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await api.createBinanceExecutionIntent({
        symbol: executionSymbol.trim().toUpperCase(),
        side: "buy",
        quantity: executionQuantity,
        orderType: "market",
        strategyRunId: activeBacktest?.run_id ?? null,
        paperSessionId: activePaper?.session_id ?? null,
        clientOrderId: executionClientOrderId.trim() || `pengbo-${Date.now()}`,
         notes: `${copy.intentDraft}: ${copy.liveExecution}`,
      });
      setActiveExecutionIntent(result);
      setActionMessage(`${copy.intentCreated}: ${result.intent_id}`);
      recentExecutionIntents.reload();
      executionAudit.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.createIntentFailed);
    } finally {
      setBusy(false);
    }
  }

  async function submitExecutionIntent(intentId: string) {
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await api.submitBinanceExecutionIntent(intentId);
      setActiveExecutionIntent(result);
      const blocked = result.risk_decisions.filter((item) => item.status === "block");
      setActionMessage(
        blocked.length
          ? `${copy.intentBlocked}: ${result.intent_id} (${blocked.map((item) => item.check).join(", ")})`
          : `${copy.intentSubmitted}: ${result.intent_id} (${result.fills.length} ${copy.fills}).`,
      );
      recentExecutionIntents.reload();
      executionAudit.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.submitFailed);
    } finally {
      setBusy(false);
    }
  }

  async function setGlobalKillSwitch(enabled: boolean) {
    setBusy(true);
    setActionError(null);
    try {
      await api.setBinanceExecutionKillSwitch({
        enabled,
         reason: enabled ? copy.killSwitchEnabled : copy.killSwitchCleared,
      });
      executionConfig.reload();
      executionAudit.reload();
       setActionMessage(enabled ? copy.killSwitchEnabled : copy.killSwitchCleared);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.killSwitchFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!sidecarReady) {
    return (
      <PanelState
        title={language === "en-US" ? "Strategy Lab is waiting for the local sidecar" : "策略实验室正在等待本地服务"}
        copy={language === "en-US" ? "Backtests, saved snapshots, paper sessions, and reports will be available once runtime health recovers." : "运行时恢复健康后，回测、已保存快照、纸面会话和报告会重新可用。"}
      />
    );
  }

  if (routeSection === "strategies") {
    return (
      <div className="stack-layout p3-page p3-strategy-page" data-strategy-section={routeSection}>
        <section className="card p3-panel" data-primary-task="strategies">
          <div className="card-header p1-page-header">
            <div><p className="eyebrow">{copy.eyebrow}</p><h3>{copy.title}</h3></div>
            <button className="ghost-button" onClick={() => { templates.reload(); recentBacktests.reload(); recentPaper.reload(); }} type="button"><RefreshCcw size={16} />{copy.reload}</button>
          </div>
          <div className="factor-lab-control-grid">
            <section className="research-panel">
              <div className="screeners-column-head"><div><p className="eyebrow">{copy.template}</p><strong>{copy.persistedStrategyRuns}</strong></div><span className="mini-pill">{templates.data?.length ?? 0}</span></div>
              <div className="research-list">{(templates.data ?? []).map((item) => <article className="variant-card" key={item.key}><div className="variant-card-head"><strong>{item.title}</strong><span className="mini-pill">{copy.paperOnly}</span></div><p>{item.description}</p></article>)}</div>
            </section>
            <section className="research-panel">
              <div className="screeners-column-head"><div><p className="eyebrow">{copy.backtests}</p><strong>{copy.openSavedSnapshot}</strong></div><span className="mini-pill">{recentBacktests.data?.length ?? 0}</span></div>
              <div className="research-list">{(recentBacktests.data ?? []).map((item) => <button className="variant-card" key={item.run_id} onClick={() => void openBacktest(item.run_id).then(() => openRoute("/strategies/backtests/:backtestId", { params: { backtestId: item.run_id } }))} type="button"><div className="variant-card-head"><strong>{item.run_id}</strong><span className="mini-pill">{formatPercent(item.total_return_pct ?? 0)}</span></div><p>{item.factor_run_id}</p></button>)}</div>
            </section>
            <section className="research-panel">
              <div className="screeners-column-head"><div><p className="eyebrow">{copy.paperTrading}</p><strong>{copy.noLiveOrderPath}</strong></div><span className="mini-pill">{recentPaper.data?.length ?? 0}</span></div>
              <div className="research-list">{(recentPaper.data ?? []).map((item) => <button className="variant-card" key={item.session_id} onClick={() => void openPaperSession(item.session_id).then(() => openRoute("/strategies/paper/:sessionId", { params: { sessionId: item.session_id } }))} type="button"><div className="variant-card-head"><strong>{item.session_id}</strong><span className="mini-pill">paper</span></div><p>{item.backtest_run_id}</p></button>)}</div>
            </section>
          </div>
        </section>
      </div>
    );
  }

  if (routeSection === "backtestNew") {
    return (
      <div className="stack-layout p3-page p3-strategy-page" data-strategy-section={routeSection}>
        <section className="card p3-panel" data-primary-task="backtestNew">
          <div className="card-header p1-page-header"><div><p className="eyebrow">{copy.template}</p><h3>{template?.title ?? copy.topNFactorRotation}</h3></div><span className="mini-pill">{copy.paperOnly}</span></div>
          <div className="factor-lab-control-grid">
            <div className="research-panel">
              <label className="field"><span>{copy.factorRun}</span><input aria-label={`strategy-factor-run-input value=${factorRunId || "none"}`} placeholder="factor-..." value={factorRunId} onChange={(event) => setFactorRunId(event.target.value)} /></label>
              <div className="form-grid two-up">
                <label className="field"><span>{copy.topN}</span><input min={1} max={50} type="number" value={topN} onChange={(event) => setTopN(Number(event.target.value || 5))} /></label>
                <label className="field"><span>{copy.rebalance}</span><select value={rebalanceInterval} onChange={(event) => setRebalanceInterval(event.target.value as "monthly" | "quarterly")}><option value="monthly">{copy.monthly}</option><option value="quarterly">{copy.quarterly}</option></select></label>
                <label className="field"><span>{copy.capital}</span><input type="number" value={initialCapital} onChange={(event) => setInitialCapital(Number(event.target.value || 100000))} /></label>
                <label className="field"><span>{copy.maxWeight}</span><input max={1} min={0.01} step={0.01} type="number" value={maxPositionWeight} onChange={(event) => setMaxPositionWeight(Number(event.target.value || 0.25))} /></label>
                <label className="field"><span>{copy.cashReserve}</span><input max={0.95} min={0} step={0.01} type="number" value={cashReservePct} onChange={(event) => setCashReservePct(Number(event.target.value || 0.05))} /></label>
                <label className="field"><span>{copy.benchmark}</span><input value={benchmarkSymbol} onChange={(event) => setBenchmarkSymbol(event.target.value)} /></label>
                <label className="field"><span>{copy.costBps}</span><input min={0} type="number" value={transactionCostBps} onChange={(event) => setTransactionCostBps(Number(event.target.value || 0))} /></label>
                <label className="field"><span>{copy.slippageBps}</span><input min={0} type="number" value={slippageBps} onChange={(event) => setSlippageBps(Number(event.target.value || 0))} /></label>
              </div>
              <button aria-label={`strategy-backtest-submit factorRun=${factorRunId || "none"} topN=${topN}`} className="primary-button" disabled={busy || factorRunId.trim().length === 0} onClick={() => void runBacktest()} type="button"><Play size={16} />{busy ? copy.running : copy.runBacktest}</button>
              {actionMessage ? <InlineState label={actionMessage} /> : null}{actionError ? <InlineState label={actionError} /> : null}
            </div>
            <div className="research-panel">
              <div className="screeners-column-head"><div><p className="eyebrow">{copy.recentFactorRuns}</p><strong>{copy.openSavedSnapshot}</strong></div><span className="mini-pill">{recentFactorRuns.data?.length ?? 0}</span></div>
              <div className="research-list">{(recentFactorRuns.data ?? []).map((item) => <button className={`variant-card ${item.run_id === factorRunId ? "selected" : ""}`} key={item.run_id} onClick={() => void openFactorRun(item.run_id)} type="button"><div className="variant-card-head"><strong>{item.family}</strong><span className="mini-pill">{item.result_count}</span></div><p>{item.run_id}</p></button>)}</div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (routeSection === "backtestResult") {
    return (
      <div className="stack-layout p3-page p3-strategy-page" data-strategy-section={routeSection}>
        <section className="card p3-panel" data-primary-task="backtestResult">
          <div className="card-header p1-page-header"><div><p className="eyebrow">{copy.backtestResult}</p><h3>{activeBacktest?.run_id ?? copy.noBacktest}</h3></div><span className="mini-pill accent">{copy.simulated}</span></div>
          {activeBacktest ? <>
            <div className="metric-grid"><MetricCard label={copy.totalReturn} value={metricLookup(activeBacktest, "Total return", copy.notAvailable)} /><MetricCard label={copy.maxDrawdown} value={metricLookup(activeBacktest, "Max drawdown", copy.notAvailable)} /><MetricCard label={copy.trades} value={String(activeBacktest.trades.length)} /><MetricCard label={copy.window} value={`${activeBacktest.data_window.start ?? copy.notAvailable} / ${activeBacktest.data_window.end ?? copy.notAvailable}`} /></div>
            <ProfessionalChartPanel primary={activeBacktest.equity_curve} comparisons={[{ label: benchmarkSymbol, points: activeBacktest.benchmark_curve }]} />
            <div className="analysis-card-list">{activeBacktest.positions.map((position) => <article className="analysis-card" key={position.symbol}><div className="analysis-card-head"><div><strong>{position.symbol}</strong><p>{position.name}</p></div><span className="mini-pill">{position.actual_weight.toFixed(2)}%</span></div><p>{formatPrice(position.market_value, "USD", "equity")} / {formatPrice(position.unrealized_pnl, "USD", "equity")}</p></article>)}</div>
            <div className="form-actions"><button className="primary-button" disabled={busy} onClick={() => void startPaperSession()} type="button"><WalletCards size={16} />{copy.startPaper}</button><button className="ghost-button" disabled={busy} onClick={() => void exportReport(activeBacktest.run_id)} type="button"><FileText size={16} />{copy.exportReport}</button></div>
          </> : <PanelState state="empty" title={copy.noBacktest} copy={copy.noBacktestCopy} />}
          {actionMessage ? <InlineState label={actionMessage} /> : null}{actionError ? <InlineState label={actionError} /> : null}
        </section>
      </div>
    );
  }

  if (routeSection === "paperSession") {
    return (
      <div className="stack-layout p3-page p3-strategy-page" data-strategy-section={routeSection}>
        <section className="card p3-panel" data-primary-task="paperSession">
          <div className="card-header p1-page-header"><div><p className="eyebrow">{copy.paperTrading}</p><h3>{activePaper?.session_id ?? copy.noPaperSession}</h3></div><span className="mini-pill">{copy.noLiveOrderPath}</span></div>
          {activePaper ? <PaperSessionPanel copy={copy} session={activePaper} onExport={exportReport} busy={busy} /> : <PanelState state="empty" title={copy.noPaperSession} copy={copy.noPaperSessionCopy} />}
          <div className="research-list">{(recentPaper.data ?? []).map((item) => <button className={`variant-card ${item.session_id === selectedStrategyPaperSessionId ? "selected" : ""}`} key={item.session_id} onClick={() => void openPaperSession(item.session_id).then(() => openRoute("/strategies/paper/:sessionId", { params: { sessionId: item.session_id } }))} type="button"><div className="variant-card-head"><strong>{item.session_id}</strong><span className="mini-pill">paper</span></div><p>{item.backtest_run_id}</p></button>)}</div>
          {actionError ? <InlineState label={actionError} /> : null}
        </section>
      </div>
    );
  }

  if (routeSection === "strategyExecution") {
    return (
      <div className="stack-layout p3-page p3-strategy-page" data-strategy-section={routeSection}>
        <section aria-label={`strategy-live-execution status=${executionConfig.data?.live_enabled ? "live-enabled" : "default-off"} killSwitch=${executionConfig.data?.kill_switch_enabled ? "enabled" : "clear"} intent=${activeExecutionIntent?.intent_id ?? "none"}`} className="card p3-panel" data-primary-task="strategyExecution">
          <div className="card-header p1-page-header"><div><p className="eyebrow">{copy.liveExecution}</p><h3>{copy.executionTitle}</h3></div><span className={`mini-pill ${executionConfig.data?.live_enabled ? "accent" : ""}`}>{executionConfig.data?.live_enabled ? copy.explicitLive : copy.defaultOff}</span></div>
          <div className="metric-grid"><MetricCard label={copy.credentials} value={executionConfig.data?.credentials_configured ? copy.configured : copy.missing} /><MetricCard label={copy.riskAck} value={executionConfig.data?.risk_acknowledged ? copy.recorded : copy.required} /><MetricCard label={copy.killSwitch} value={executionConfig.data?.kill_switch_enabled ? copy.enabled : copy.clear} /><MetricCard label={copy.maxOrder} value={formatPrice(executionConfig.data?.max_order_notional ?? 0, "USDT", "crypto")} /></div>
          <div className="factor-lab-control-grid">
            <div className="research-panel">
              <div className="screeners-column-head"><div><p className="eyebrow">{copy.intentDraft}</p><strong>{activePaper ? copy.paperEvidenceLinked : copy.paperEvidenceMissing}</strong></div><span className="mini-pill">{activeBacktest?.run_id ?? copy.noBacktestShort}</span></div>
              <div className="form-grid two-up"><label className="field"><span>{copy.symbol}</span><input value={executionSymbol} onChange={(event) => setExecutionSymbol(event.target.value)} /></label><label className="field"><span>{copy.quantity}</span><input min={0.000001} step={0.000001} type="number" value={executionQuantity} onChange={(event) => setExecutionQuantity(Number(event.target.value || 0.01))} /></label><label className="field wide-field"><span>{copy.clientOrderId}</span><input placeholder={copy.optionalUniqueId} value={executionClientOrderId} onChange={(event) => setExecutionClientOrderId(event.target.value)} /></label></div>
              <div className="form-actions"><button className="ghost-button" disabled={busy || executionQuantity <= 0} onClick={() => void createExecutionIntent()} type="button"><ShieldAlert size={16} />{copy.createIntent}</button><button className="ghost-button" disabled={busy || !activeExecutionIntent} onClick={() => activeExecutionIntent && void submitExecutionIntent(activeExecutionIntent.intent_id)} type="button"><Power size={16} />{copy.runRiskSubmit}</button></div>
              <div className="form-actions"><button className="ghost-button" disabled={busy} onClick={() => void setGlobalKillSwitch(true)} type="button">{copy.enableKillSwitch}</button><button className="ghost-button" disabled={busy} onClick={() => void setGlobalKillSwitch(false)} type="button">{copy.clearKillSwitch}</button></div>
            </div>
            <LiveExecutionEvidencePanel activeIntent={activeExecutionIntent} recentIntents={recentExecutionIntents.data ?? []} auditEvents={executionAudit.data ?? []} notes={executionConfig.data?.notes ?? []} copy={copy} onOpenIntent={setActiveExecutionIntent} />
          </div>
          {actionMessage ? <InlineState label={actionMessage} /> : null}{actionError ? <InlineState label={actionError} /> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="stack-layout p3-page p3-strategy-page" data-strategy-section="legacy">
      <section
        aria-label={`strategy-lab-view state=${activeBacktest ? "ready" : "empty"} backtest=${selectedStrategyBacktestId ?? "none"} paper=${selectedStrategyPaperSessionId ?? "none"}`}
        className="card p3-panel p3-strategy-shell"
      >
        <div className="card-header p1-page-header">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h3>{copy.title}</h3>
          </div>
          <button className="ghost-button" onClick={() => recentBacktests.reload()} type="button">
            <RefreshCcw size={16} />
            {copy.reload}
          </button>
        </div>

        <div className="factor-lab-control-grid">
          <div className="research-panel">
            <div className="screeners-column-head">
              <div>
                <p className="eyebrow">{copy.template}</p>
                <strong>{template?.title ?? copy.topNFactorRotation}</strong>
              </div>
              <span className="mini-pill">{copy.paperOnly}</span>
            </div>
            <label className="field">
              <span>{copy.factorRun}</span>
              <input
                aria-label={`strategy-factor-run-input value=${factorRunId || "none"}`}
                placeholder="factor-..."
                value={factorRunId}
                onChange={(event) => setFactorRunId(event.target.value)}
              />
            </label>
            <div className="form-grid two-up">
              <label className="field">
                <span>{copy.topN}</span>
                <input min={1} max={50} type="number" value={topN} onChange={(event) => setTopN(Number(event.target.value || 5))} />
              </label>
              <label className="field">
                <span>{copy.rebalance}</span>
                <select value={rebalanceInterval} onChange={(event) => setRebalanceInterval(event.target.value as "monthly" | "quarterly")}>
                  <option value="monthly">{copy.monthly}</option>
                  <option value="quarterly">{copy.quarterly}</option>
                </select>
              </label>
              <label className="field">
                <span>{copy.capital}</span>
                <input type="number" value={initialCapital} onChange={(event) => setInitialCapital(Number(event.target.value || 100000))} />
              </label>
              <label className="field">
                <span>{copy.maxWeight}</span>
                <input
                  max={1}
                  min={0.01}
                  step={0.01}
                  type="number"
                  value={maxPositionWeight}
                  onChange={(event) => setMaxPositionWeight(Number(event.target.value || 0.25))}
                />
              </label>
              <label className="field">
                <span>{copy.cashReserve}</span>
                <input
                  max={0.95}
                  min={0}
                  step={0.01}
                  type="number"
                  value={cashReservePct}
                  onChange={(event) => setCashReservePct(Number(event.target.value || 0.05))}
                />
              </label>
              <label className="field">
                <span>{copy.benchmark}</span>
                <input value={benchmarkSymbol} onChange={(event) => setBenchmarkSymbol(event.target.value)} />
              </label>
              <label className="field">
                <span>{copy.costBps}</span>
                <input min={0} type="number" value={transactionCostBps} onChange={(event) => setTransactionCostBps(Number(event.target.value || 0))} />
              </label>
              <label className="field">
                <span>{copy.slippageBps}</span>
                <input min={0} type="number" value={slippageBps} onChange={(event) => setSlippageBps(Number(event.target.value || 0))} />
              </label>
            </div>
            <button
              aria-label={`strategy-backtest-submit factorRun=${factorRunId || "none"} topN=${topN}`}
              className="primary-button"
              disabled={busy || factorRunId.trim().length === 0}
              onClick={() => void runBacktest()}
              type="button"
            >
              <Play size={16} />
              {busy ? copy.running : copy.runBacktest}
            </button>
            <button className="ghost-button" onClick={() => setActiveView("factorLab")} type="button">
              <FlaskConical size={16} />
              {copy.openFactor}
            </button>
          </div>

          <div className="research-panel">
            <div className="screeners-column-head">
              <div>
                <p className="eyebrow">{copy.recentFactorRuns}</p>
                <strong>{copy.openSavedSnapshot}</strong>
              </div>
              <span className="mini-pill">{recentFactorRuns.data?.length ?? 0}</span>
            </div>
            <div className="research-list">
              {(recentFactorRuns.data ?? []).length > 0 ? (recentFactorRuns.data ?? []).map((item) => (
                <button
                  aria-label={`strategy-factor-run-recent run=${item.run_id}`}
                  className={`variant-card ${item.run_id === factorRunId ? "selected" : ""}`}
                  disabled={busy}
                  key={item.run_id}
                  onClick={() => void openFactorRun(item.run_id)}
                  type="button"
                >
                  <div className="variant-card-head">
                    <strong>{item.family}</strong>
                    <span className="mini-pill">{item.result_count}</span>
                  </div>
                  <p>{item.run_id}</p>
                  <small>{new Date(item.as_of).toLocaleString()}</small>
                </button>
              )) : <InlineState label={copy.emptyFactor} actionLabel={copy.openFactor} onAction={() => setActiveView("factorLab")} />}
            </div>
          </div>
        </div>

        {activeBacktest ? (
          <>
            <div
              aria-label={`strategy-backtest-attribution run=${activeBacktest.run_id} factorRun=${activeBacktest.factor_run_id} trades=${activeBacktest.trades.length} noLiveOrders=${activeBacktest.diagnostics.no_live_orders}`}
              className="metric-grid"
            >
              <MetricCard label={copy.totalReturn} value={metricLookup(activeBacktest, "Total return", copy.notAvailable)} />
              <MetricCard label={copy.maxDrawdown} value={metricLookup(activeBacktest, "Max drawdown", copy.notAvailable)} />
              <MetricCard label={copy.trades} value={String(activeBacktest.trades.length)} />
              <MetricCard label={copy.window} value={`${activeBacktest.data_window.start ?? copy.notAvailable} / ${activeBacktest.data_window.end ?? copy.notAvailable}`} />
            </div>

            <div className="factor-lab-workspace">
              <section className="research-panel">
                <div className="screeners-column-head">
                  <div>
                    <p className="eyebrow">{copy.backtests}</p>
                    <strong>{copy.persistedStrategyRuns}</strong>
                  </div>
                  <span className="mini-pill">{recentBacktests.data?.length ?? 0}</span>
                </div>
                <div className="research-list">
                  {(recentBacktests.data ?? []).map((item) => (
                    <button
                      aria-label={`strategy-backtest-recent run=${item.run_id} factorRun=${item.factor_run_id}`}
                      className={`variant-card ${item.run_id === selectedStrategyBacktestId ? "selected" : ""}`}
                      disabled={busy}
                      key={item.run_id}
                      onClick={() => void openBacktest(item.run_id)}
                      type="button"
                    >
                      <div className="variant-card-head">
                        <strong>{item.run_id}</strong>
                        <span className="mini-pill">{formatPercent(item.total_return_pct ?? 0)}</span>
                      </div>
                      <p>{item.factor_run_id}</p>
                      <small>{new Date(item.created_at).toLocaleString()}</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className="research-panel">
                <div className="card-header">
                  <div>
                    <p className="eyebrow">{copy.backtestResult}</p>
                    <h3>{activeBacktest.run_id}</h3>
                  </div>
                  <span className="mini-pill accent">{copy.simulated}</span>
                </div>
                <ProfessionalChartPanel primary={activeBacktest.equity_curve} comparisons={[{ label: benchmarkSymbol, points: activeBacktest.benchmark_curve }]} />
                <div className="analysis-card-list">
                  {activeBacktest.positions.map((position) => (
                    <article className="analysis-card" key={position.symbol}>
                      <div className="analysis-card-head">
                        <div>
                          <strong>{position.symbol}</strong>
                          <p>{position.name}</p>
                        </div>
                        <span className="mini-pill">{position.actual_weight.toFixed(2)}%</span>
                      </div>
                      <p>
                        Market value {formatPrice(position.market_value, "USD", "equity")} / PnL{" "}
                        {formatPrice(position.unrealized_pnl, "USD", "equity")}
                      </p>
                    </article>
                  ))}
                </div>
                <div className="form-actions">
                  <button
                    aria-label={`strategy-paper-start backtest=${activeBacktest.run_id}`}
                    className="primary-button"
                    disabled={busy}
                    onClick={() => void startPaperSession()}
                    type="button"
                  >
                    <WalletCards size={16} />
                    {copy.startPaper}
                  </button>
                  <button
                    aria-label={`strategy-export-report artifact=${activeBacktest.run_id}`}
                    className="ghost-button"
                    disabled={busy}
                    onClick={() => void exportReport(activeBacktest.run_id)}
                    type="button"
                  >
                    <FileText size={16} />
                    {copy.exportReport}
                  </button>
                </div>
              </section>

              <section className="research-panel">
                <div className="screeners-column-head">
                  <div>
                    <p className="eyebrow">{copy.paperTrading}</p>
                    <strong>{copy.noLiveOrderPath}</strong>
                  </div>
                  <span className="mini-pill">{activePaper?.orders.length ?? 0} {copy.orders}</span>
                </div>
                {activePaper ? <PaperSessionPanel copy={copy} session={activePaper} onExport={exportReport} busy={busy} /> : <PanelState state="empty" title={copy.noPaperSession} copy={copy.noPaperSessionCopy} />}
                <div className="research-list">
                  {(recentPaper.data ?? []).map((item) => (
                    <button
                      aria-label={`strategy-paper-recent session=${item.session_id} backtest=${item.backtest_run_id}`}
                      className={`variant-card ${item.session_id === selectedStrategyPaperSessionId ? "selected" : ""}`}
                      disabled={busy}
                      key={item.session_id}
                      onClick={() => void openPaperSession(item.session_id)}
                      type="button"
                    >
                      <div className="variant-card-head">
                        <strong>{item.session_id}</strong>
                        <span className="mini-pill">paper</span>
                      </div>
                      <p>{item.backtest_run_id}</p>
                      <small>{new Date(item.created_at).toLocaleString()}</small>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : (
          <PanelState state="empty" title={copy.noBacktest} copy={copy.noBacktestCopy} />
        )}

        <section
          aria-label={`strategy-live-execution status=${executionConfig.data?.live_enabled ? "live-enabled" : "default-off"} killSwitch=${executionConfig.data?.kill_switch_enabled ? "enabled" : "clear"} intent=${activeExecutionIntent?.intent_id ?? "none"}`}
          className="research-panel"
        >
          <div className="card-header">
            <div>
              <p className="eyebrow">{copy.liveExecution}</p>
              <h3>{copy.executionTitle}</h3>
            </div>
            <span className={`mini-pill ${executionConfig.data?.live_enabled ? "accent" : ""}`}>
              {executionConfig.data?.live_enabled ? copy.explicitLive : copy.defaultOff}
            </span>
          </div>

          <div className="metric-grid">
            <MetricCard label={copy.credentials} value={executionConfig.data?.credentials_configured ? copy.configured : copy.missing} />
            <MetricCard label={copy.riskAck} value={executionConfig.data?.risk_acknowledged ? copy.recorded : copy.required} />
            <MetricCard label={copy.killSwitch} value={executionConfig.data?.kill_switch_enabled ? copy.enabled : copy.clear} />
            <MetricCard label={copy.maxOrder} value={formatPrice(executionConfig.data?.max_order_notional ?? 0, "USDT", "crypto")} />
          </div>

          <div className="factor-lab-control-grid">
            <div className="research-panel">
              <div className="screeners-column-head">
                <div>
                  <p className="eyebrow">{copy.intentDraft}</p>
                  <strong>{activePaper ? copy.paperEvidenceLinked : copy.paperEvidenceMissing}</strong>
                </div>
                <span className="mini-pill">{activeBacktest?.run_id ?? copy.noBacktestShort}</span>
              </div>
              <div className="form-grid two-up">
                <label className="field">
                  <span>{copy.symbol}</span>
                  <input value={executionSymbol} onChange={(event) => setExecutionSymbol(event.target.value)} />
                </label>
                <label className="field">
                  <span>{copy.quantity}</span>
                  <input
                    min={0.000001}
                    step={0.000001}
                    type="number"
                    value={executionQuantity}
                    onChange={(event) => setExecutionQuantity(Number(event.target.value || 0.01))}
                  />
                </label>
                <label className="field wide-field">
                  <span>{copy.clientOrderId}</span>
                  <input
                    placeholder={copy.optionalUniqueId}
                    value={executionClientOrderId}
                    onChange={(event) => setExecutionClientOrderId(event.target.value)}
                  />
                </label>
              </div>
              <div className="form-actions">
                  <button
                  aria-label={`strategy-live-intent-create symbol=${executionSymbol || "none"} paper=${activePaper?.session_id ?? "none"}`}
                  className="ghost-button"
                  disabled={busy || executionQuantity <= 0}
                  onClick={() => void createExecutionIntent()}
                  type="button"
                >
                   <ShieldAlert size={16} />
                   {copy.createIntent}
                </button>
                <button
                  aria-label={`strategy-live-intent-submit intent=${activeExecutionIntent?.intent_id ?? "none"}`}
                  className="ghost-button"
                  disabled={busy || !activeExecutionIntent}
                  onClick={() => activeExecutionIntent && void submitExecutionIntent(activeExecutionIntent.intent_id)}
                  type="button"
                >
                   <Power size={16} />
                   {copy.runRiskSubmit}
                </button>
              </div>
              <div className="form-actions">
                <button
                  className="ghost-button"
                  disabled={busy}
                  onClick={() => void setGlobalKillSwitch(true)}
                  type="button"
                >
                   {copy.enableKillSwitch}
                </button>
                <button
                  className="ghost-button"
                  disabled={busy}
                  onClick={() => void setGlobalKillSwitch(false)}
                  type="button"
                >
                   {copy.clearKillSwitch}
                </button>
              </div>
            </div>

            <LiveExecutionEvidencePanel
              activeIntent={activeExecutionIntent}
              recentIntents={recentExecutionIntents.data ?? []}
              auditEvents={executionAudit.data ?? []}
              notes={executionConfig.data?.notes ?? []}
              copy={copy}
              onOpenIntent={setActiveExecutionIntent}
            />
          </div>
        </section>

        {warnings.length ? (
          <div className="task-list">
            {warnings.slice(0, 5).map((warning) => (
              <InlineState label={warning} key={warning} />
            ))}
          </div>
        ) : null}
        {actionMessage ? <InlineState label={actionMessage} /> : null}
        {actionError ? <InlineState label={actionError} /> : null}
      </section>
    </div>
  );
}

function PaperSessionPanel({
  copy,
  session,
  onExport,
  busy,
}: {
  copy: StrategyCopy;
  session: StrategyPaperSessionResponse;
  onExport: (artifactId: string) => Promise<void>;
  busy: boolean;
}) {
  return (
    <>
      <div
        aria-label={`strategy-paper-session session=${session.session_id} backtest=${session.backtest_run_id} noLiveOrders=${session.no_live_orders}`}
        className="metric-grid"
      >
        <MetricCard label={copy.cash} value={formatPrice(session.pnl.cash_balance ?? 0, "USD", "equity")} />
        <MetricCard label={copy.pnl} value={formatPrice(session.pnl.total_pnl ?? 0, "USD", "equity")} />
        <MetricCard label={copy.fills} value={String(session.fills.length)} />
        <MetricCard label={copy.mode} value={session.execution_mode} />
      </div>
      <div className="table-list">
        {session.orders.slice(0, 6).map((order) => (
          <div className="table-row" key={order.order_id}>
            <div className="table-main">
              <strong>{order.symbol}</strong>
              <span>{order.reason}</span>
            </div>
            <div className="table-meta">
              <span>{order.status}</span>
              <small>{order.quantity.toFixed(4)}</small>
            </div>
          </div>
        ))}
      </div>
      <button
        aria-label={`strategy-export-report artifact=${session.session_id}`}
        className="ghost-button"
        disabled={busy}
        onClick={() => void onExport(session.session_id)}
        type="button"
      >
        <FileText size={16} />
        {copy.exportPaperReport}
      </button>
    </>
  );
}

function LiveExecutionEvidencePanel({
  copy,
  activeIntent,
  recentIntents,
  auditEvents,
  notes,
  onOpenIntent,
}: {
  copy: StrategyCopy;
  activeIntent: BinanceExecutionIntentResponse | null;
  recentIntents: BinanceExecutionIntentResponse[];
  auditEvents: Array<{
    event_id: string;
    created_at: string;
    event_type: string;
    summary: string;
  }>;
  notes: string[];
  onOpenIntent: (intent: BinanceExecutionIntentResponse) => void;
}) {
  const blocked = activeIntent?.risk_decisions.filter((item) => item.status === "block") ?? [];
  return (
    <div className="research-panel">
      <div className="screeners-column-head">
        <div>
          <p className="eyebrow">{copy.riskEvidence}</p>
          <strong>{activeIntent ? strategyStatusLabel(activeIntent.status, copy) : copy.noActiveIntent}</strong>
        </div>
        <span className="mini-pill">{blocked.length} {copy.blocks}</span>
      </div>

      {activeIntent ? (
        <>
          <div
            aria-label={`strategy-live-intent intent=${activeIntent.intent_id} status=${activeIntent.status} blocks=${blocked.length} noLiveBeforeSubmit=${activeIntent.no_live_order_until_submit}`}
            className="metric-grid"
          >
            <MetricCard label={copy.intent} value={activeIntent.intent_id.slice(-8)} />
            <MetricCard label={copy.notional} value={formatPrice(activeIntent.estimated_notional ?? 0, "USDT", "crypto")} />
            <MetricCard label={copy.fills} value={String(activeIntent.fills.length)} />
            <MetricCard label={copy.audit} value={String(activeIntent.audit_event_count)} />
          </div>
          <div className="table-list">
            {activeIntent.risk_decisions.length === 0 ? (
              <div className="table-row">
                <div className="table-main">
                  <strong>{copy.noRiskRun}</strong>
                  <span>{copy.noRiskRunCopy}</span>
                </div>
              </div>
            ) : null}
            {activeIntent.risk_decisions.map((decision) => (
              <div className="table-row" key={`${activeIntent.intent_id}-${decision.check}`}>
                <div className="table-main">
                  <strong>{decision.check}</strong>
                  <span>{decision.message}</span>
                </div>
                <div className="table-meta">
                  <span>{strategyStatusLabel(decision.status, copy)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <InlineState label={copy.noIntentCopy} />
      )}

      {notes.length ? (
        <div className="task-list">
          {notes.map((note) => (
            <InlineState label={note} key={note} />
          ))}
        </div>
      ) : null}

      <div className="screeners-column-head">
        <div>
          <p className="eyebrow">{copy.recentIntents}</p>
          <strong>{copy.executionLedger}</strong>
        </div>
        <span className="mini-pill">{recentIntents.length}</span>
      </div>
      <div className="research-list">
        {recentIntents.slice(0, 4).map((intent) => (
          <button
            aria-label={`strategy-live-intent-recent intent=${intent.intent_id} status=${intent.status}`}
            className={`variant-card ${intent.intent_id === activeIntent?.intent_id ? "selected" : ""}`}
            key={intent.intent_id}
            onClick={() => onOpenIntent(intent)}
            type="button"
          >
            <div className="variant-card-head">
              <strong>{intent.request.symbol}</strong>
              <span className="mini-pill">{strategyStatusLabel(intent.status, copy)}</span>
            </div>
            <p>{intent.intent_id}</p>
            <small>{new Date(intent.updated_at).toLocaleString()}</small>
          </button>
        ))}
      </div>

      <div className="screeners-column-head">
        <div>
          <p className="eyebrow">{copy.auditTrail}</p>
          <strong>{copy.latestEvents}</strong>
        </div>
        <span className="mini-pill">{auditEvents.length}</span>
      </div>
      <div className="table-list">
        {auditEvents.slice(0, 5).map((event) => (
          <div
            aria-label={`strategy-live-audit event=${event.event_type} id=${event.event_id}`}
            className="table-row"
            key={event.event_id}
          >
            <div className="table-main">
              <strong>{event.event_type}</strong>
              <span>{event.summary}</span>
            </div>
            <div className="table-meta">
              <small>{new Date(event.created_at).toLocaleString()}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
