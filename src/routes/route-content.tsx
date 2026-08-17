import { Activity, ArrowUpRight, CheckCircle2, CircleAlert, Database, FileText, FlaskConical, GitBranch, LockKeyhole, Play, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Wallet, Workflow } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../components/button";
import { Badge, DataTable } from "../components/ui-kit";
import type { FrameRouteRecord } from "./route-registry";

type ContentRow = Record<string, string>;

type RouteContent = {
  eyebrow: string;
  taskTitle: string;
  taskDescription: string;
  panelTitle: string;
  panelDescription: string;
  sourceLabel: string;
  stats: Array<{ label: string; value: string; detail: string; tone?: "neutral" | "info" | "success" | "warning" | "danger" }>;
  rows: ContentRow[];
  columns: Array<{ key: keyof ContentRow & string; label: string; width?: string; align?: "left" | "right" }>;
  kind: "chart" | "table" | "form" | "timeline" | "checklist";
  chart?: Array<{ label: string; value: string; tone: "up" | "down" | "neutral" }>;
  formFields?: Array<{ label: string; value: string; hint: string }>;
  timeline?: Array<{ title: string; description: string; status: "done" | "current" | "pending" }>;
};

const assetRows: ContentRow[] = [
  { id: "AAPL", name: "AAPL · Apple Inc.", status: "READY", value: "$211.18", source: "EDGAR / Yahoo", detail: "+1.24% · 02m" },
  { id: "MSFT", name: "MSFT · Microsoft Corp.", status: "READY", value: "$503.32", source: "EDGAR / Yahoo", detail: "+0.86% · 02m" },
  { id: "NVDA", name: "NVDA · NVIDIA Corp.", status: "CACHED", value: "$171.52", source: "local cache", detail: "-0.42% · 18m" },
  { id: "BTC", name: "BTC/USDT · Bitcoin", status: "READ ONLY", value: "$117,840", source: "CoinGecko", detail: "+2.11% · 06m" },
];

const researchRows: ContentRow[] = [
  { id: "brief-20260715-aapl", name: "AAPL 资本回报与服务收入", status: "READY", value: "结论待复核", source: "本地研究记录", detail: "7 条证据 · 12m" },
  { id: "brief-20260714-msft", name: "MSFT 云业务增长质量", status: "IN REVIEW", value: "证据补充", source: "EDGAR + 本地缓存", detail: "4 条证据 · 1d" },
  { id: "brief-20260712-macro", name: "宏观数据与风险偏好", status: "CACHED", value: "待更新", source: "World Bank", detail: "3 条证据 · 3d" },
];

const providerRows: ContentRow[] = [
  { id: "edgar", name: "SEC EDGAR", status: "AVAILABLE", value: "公司申报", source: "本地 API", detail: "fresh · read-only" },
  { id: "yahoo", name: "Market Quotes", status: "CACHED", value: "行情与历史", source: "本地缓存", detail: "18m · fallback" },
  { id: "fred", name: "FRED", status: "CREDENTIAL REQUIRED", value: "宏观时间序列", source: "可选凭证", detail: "未连接" },
  { id: "coingecko", name: "CoinGecko", status: "AVAILABLE", value: "加密资产行情", source: "本地 API", detail: "06m · read-only" },
];

const portfolioRows: ContentRow[] = [
  { id: "AAPL", name: "AAPL", status: "HELD", value: "32.0%", source: "本地组合", detail: "+8.42% PnL" },
  { id: "MSFT", name: "MSFT", status: "HELD", value: "24.5%", source: "本地组合", detail: "+5.16% PnL" },
  { id: "NVDA", name: "NVDA", status: "HELD", value: "18.7%", source: "本地组合", detail: "-1.08% PnL" },
  { id: "CASH", name: "现金与短债", status: "AVAILABLE", value: "24.8%", source: "本地账本", detail: "低波动" },
];

function rowsFor(componentKey: string): ContentRow[] {
  if (componentKey.toLowerCase().includes("research")) return researchRows;
  if (componentKey.toLowerCase().includes("datasource")) return providerRows;
  if (componentKey.toLowerCase().includes("portfolio")) return portfolioRows;
  return assetRows;
}

function categoryFor(componentKey: string): "dashboard" | "asset" | "research" | "data" | "factor" | "strategy" | "workflow" | "screener" | "portfolio" | "connection" | "settings" | "manual" | "command" | "ai" {
  const key = componentKey.toLowerCase();
  if (key.includes("dashboard")) return "dashboard";
  if (key.includes("asset") || key.includes("watchlist")) return "asset";
  if (key.includes("research")) return "research";
  if (key.includes("datasource")) return "data";
  if (key.includes("factor")) return "factor";
  if (key.includes("strategy") || key.includes("backtest") || key.includes("paper")) return "strategy";
  if (key.includes("workflow")) return "workflow";
  if (key.includes("screener")) return "screener";
  if (key.includes("portfolio")) return "portfolio";
  if (key.includes("connection")) return "connection";
  if (key.includes("settings")) return "settings";
  if (key.includes("manual")) return "manual";
  if (key.includes("command")) return "command";
  return "ai";
}

export function getRouteContent(route: FrameRouteRecord, params: Readonly<Record<string, string | undefined>>): RouteContent {
  const category = categoryFor(route.componentKey);
  const symbol = params.symbol ?? "AAPL";
  const briefId = params.briefId ?? "brief-20260715-aapl";
  const runId = params.runId ?? "run-20260715-001";
  const common = {
    sourceLabel: "local API / deterministic fixture",
    chart: [
      { label: "09:30", value: "98", tone: "neutral" as const },
      { label: "11:00", value: "104", tone: "up" as const },
      { label: "13:00", value: "101", tone: "down" as const },
      { label: "15:00", value: "109", tone: "up" as const },
      { label: "16:00", value: "112", tone: "up" as const },
    ],
  };

  if (category === "dashboard") return {
    ...common,
    eyebrow: "MARKET PULSE / LOCAL RUNTIME",
    taskTitle: route.componentKey === "dashboardRuntime" ? "本地运行状态" : "系统就绪与市场脉搏",
    taskDescription: "把系统健康、市场信号和下一步研究动作放在同一工作区中。数据来源、更新时间和降级状态均可追溯。",
    panelTitle: route.componentKey === "dashboardRuntime" ? "服务与运行检查" : "市场脉搏与研究入口",
    panelDescription: "当前本地服务在线，数据优先来自 API；无凭证或离线时使用确定性快照。",
    stats: [
      { label: "本地服务", value: "ONLINE", detail: "8765 / health", tone: "success" },
      { label: "市场信号", value: "06", detail: "2m 内更新", tone: "info" },
      { label: "研究简报", value: "03", detail: "1 条待复核", tone: "warning" },
      { label: "缓存新鲜度", value: "02m", detail: "本地快照", tone: "success" },
    ],
    rows: [
      { id: "runtime", name: "API sidecar", status: "READY", value: "127.0.0.1:8765", source: "health", detail: "22ms" },
      { id: "research", name: "研究工作区", status: "READY", value: "3 个简报", source: "SQLite", detail: "本地" },
      { id: "cache", name: "市场缓存", status: "CACHED", value: "12 个标的", source: "DuckDB", detail: "02m" },
    ],
    columns: [{ key: "name", label: "检查项" }, { key: "status", label: "状态" }, { key: "value", label: "值" }, { key: "source", label: "来源" }, { key: "detail", label: "详情" }],
    kind: route.componentKey === "dashboardRuntime" ? "checklist" : "chart",
  };

  if (category === "command") return {
    ...common,
    eyebrow: "COMMAND CENTER / LOCAL ACTIONS",
    taskTitle: route.pageKind === "result" ? "执行结果与审计" : "从动作到可复核结果",
    taskDescription: "命令中心只展示本地可执行动作；涉及外部账户、凭证或交易的动作始终停在确认与审计边界。",
    panelTitle: route.pageKind === "result" ? "动作结果" : "可用命令",
    panelDescription: "选择一个动作查看输入、权限、来源和结果，不自动触发外部执行。",
    stats: [{ label: "可用动作", value: "12", detail: "本地安全动作", tone: "success" }, { label: "待确认", value: "02", detail: "需要人工确认", tone: "warning" }, { label: "最近结果", value: "18", detail: "可追溯记录", tone: "info" }],
    rows: [
      { id: "research", name: "打开研究简报", status: "AVAILABLE", value: "研究工作区", source: "route", detail: "只读" },
      { id: "refresh", name: "刷新本地数据", status: "AVAILABLE", value: "市场 / 来源", source: "local API", detail: "可重试" },
      { id: "export", name: "导出证据报告", status: "AVAILABLE", value: "Markdown / JSON", source: "local files", detail: "可审计" },
      { id: "execute", name: "提交执行意图", status: "CONFIRMATION REQUIRED", value: "Binance 默认关闭", source: "risk gate", detail: "人工确认" },
    ],
    columns: [{ key: "name", label: "动作" }, { key: "status", label: "状态" }, { key: "value", label: "目标" }, { key: "source", label: "权限" }, { key: "detail", label: "下一步" }],
    kind: route.pageKind === "result" ? "timeline" : "table",
    timeline: [{ title: "输入已校验", description: "参数、来源和权限状态已记录。", status: "done" }, { title: "结果已生成", description: "结果可以返回当前路由或导出为本地证据包。", status: "current" }, { title: "人工复核", description: "外部执行仍需要明确确认。", status: "pending" }],
  };

  if (category === "asset") return {
    ...common,
    eyebrow: "MARKETS / ASSET RESEARCH",
    taskTitle: route.componentKey === "assetSearch" ? "搜索并选择研究对象" : `${symbol} 的可复核资产视图`,
    taskDescription: "行情、基本面、申报文件、数据覆盖和研究交接共享同一资产上下文，避免在页面之间丢失来源和时间戳。",
    panelTitle: route.componentKey === "assetSearch" ? "资产目录" : `${symbol} / ${route.label}`,
    panelDescription: "所有价格和指标均标记来源与新鲜度；加密资产路径保持只读。",
    stats: [{ label: "当前标的", value: symbol, detail: "Apple Inc. / US", tone: "info" }, { label: "最新价", value: "$211.18", detail: "+1.24%", tone: "success" }, { label: "市值", value: "$3.16T", detail: "估值快照", tone: "neutral" }, { label: "来源状态", value: "READY", detail: "EDGAR + quote", tone: "success" }],
    rows: route.componentKey === "assetSearch" ? assetRows : [
      { id: "price", name: "最新价格", status: "READY", value: "$211.18", source: "Market Quotes", detail: "02m" },
      { id: "return", name: "日内变化", status: "OBSERVED", value: "+1.24%", source: "local snapshot", detail: "收盘前" },
      { id: "filing", name: "最近申报", status: "READY", value: "10-Q · 2026-05-02", source: "SEC EDGAR", detail: "可查看" },
      { id: "research", name: "研究交接", status: "READY", value: "1 个简报", source: "Research", detail: "打开" },
    ],
    columns: [{ key: "name", label: "指标 / 标的" }, { key: "status", label: "状态" }, { key: "value", label: "值" }, { key: "source", label: "来源" }, { key: "detail", label: "更新时间" }],
    kind: route.componentKey === "assetSearch" || route.componentKey === "assetData" ? "table" : "chart",
  };

  if (category === "data") return {
    ...common,
    eyebrow: "DATA SOURCES / PROVENANCE",
    taskTitle: route.componentKey === "dataSourcesReport" ? "覆盖与新鲜度报告" : "选择可用的数据来源",
    taskDescription: "数据源页面展示能力、凭证、缓存、质量和只读边界；研究页面只消费已标注来源的数据。",
    panelTitle: route.componentKey === "dataSourcePreview" ? "来源数据预览" : "来源目录与健康状态",
    panelDescription: "每一行都包含可用能力、来源标签和新鲜度，不把样例数据伪装成实时数据。",
    stats: [{ label: "来源总数", value: "08", detail: "4 个可用", tone: "info" }, { label: "可用", value: "04", detail: "本地 API", tone: "success" }, { label: "需凭证", value: "02", detail: "用户可选", tone: "warning" }, { label: "缓存", value: "02", detail: "离线可读", tone: "neutral" }],
    rows: providerRows,
    columns: [{ key: "name", label: "数据来源" }, { key: "status", label: "状态" }, { key: "value", label: "覆盖" }, { key: "source", label: "通道" }, { key: "detail", label: "新鲜度" }],
    kind: route.pageKind === "review" ? "checklist" : "table",
  };

  if (category === "research") return {
    ...common,
    eyebrow: "RESEARCH / EVIDENCE WORKSPACE",
    taskTitle: route.componentKey === "researchInbox" ? "从简报目录进入下一次判断" : `简报 ${briefId} · ${route.label}`,
    taskDescription: "研究页面围绕结论、资产数据、结构化分析、证据、AI 辅助、笔记和导出组织；每一步都保留证据范围。",
    panelTitle: route.componentKey === "researchEvidence" ? "证据链" : route.componentKey === "researchAssistant" ? "证据约束下的 AI 助手" : "研究简报内容",
    panelDescription: "当前上下文：AAPL / Apple Inc.；来源包含 SEC EDGAR、Market Quotes 和本地研究记录。",
    stats: [{ label: "当前简报", value: briefId, detail: "AAPL", tone: "info" }, { label: "证据条目", value: "07", detail: "5 个来源", tone: "success" }, { label: "结论置信度", value: "MEDIUM", detail: "需要复核", tone: "warning" }, { label: "最后更新", value: "12m", detail: "本地记录", tone: "neutral" }],
    rows: researchRows,
    columns: [{ key: "name", label: "研究对象" }, { key: "status", label: "状态" }, { key: "value", label: "当前阶段" }, { key: "source", label: "证据来源" }, { key: "detail", label: "更新时间" }],
    kind: route.componentKey === "researchAssistant" || route.componentKey === "researchNotes" ? "form" : route.componentKey === "researchEvidence" ? "checklist" : "table",
    formFields: [{ label: "研究问题", value: "AAPL 服务收入增长是否改善盈利质量？", hint: "明确问题后再生成结论" }, { label: "当前结论", value: "服务业务增长支持利润率，但仍需核对分部披露。", hint: "结论必须关联证据" }, { label: "下一步", value: "补充最近 10-Q 分部数据", hint: "建议动作" }],
  };

  if (category === "factor") return {
    ...common,
    eyebrow: "FACTOR LAB / RESEARCH ONLY",
    taskTitle: route.componentKey === "factorRunNew" ? "配置一次可复现的因子实验" : `因子运行 ${runId} · ${route.label}`,
    taskDescription: "因子实验只在本地研究边界内运行，展示样本、覆盖、质量、解释和交接，不直接产生交易指令。",
    panelTitle: route.componentKey === "factorQuality" ? "质量与覆盖检查" : route.componentKey === "factorHandoff" ? "研究交接" : "因子实验结果",
    panelDescription: "实验参数、数据版本、样本窗口和结果 ID 会进入 URL 与证据上下文。",
    stats: [{ label: "运行 ID", value: runId, detail: "本地 DuckDB", tone: "info" }, { label: "因子数量", value: "06", detail: "价值 / 动量 / 质量", tone: "neutral" }, { label: "覆盖标的", value: "482", detail: "96.4%", tone: "success" }, { label: "质量门", value: "PASS", detail: "1 项待关注", tone: "warning" }],
    rows: [{ id: "value", name: "Value composite", status: "READY", value: "+0.42", source: "factor snapshot", detail: "482 assets" }, { id: "momentum", name: "Momentum 12-1", status: "READY", value: "+0.31", source: "price history", detail: "01d" }, { id: "quality", name: "Quality / ROIC", status: "DEGRADED", value: "+0.18", source: "fundamentals", detail: "missing 7.2%" }, { id: "handoff", name: "Research handoff", status: "AVAILABLE", value: "AAPL", source: "Inspector", detail: "下一步" }],
    columns: [{ key: "name", label: "因子 / 结果" }, { key: "status", label: "状态" }, { key: "value", label: "得分" }, { key: "source", label: "来源" }, { key: "detail", label: "覆盖" }],
    kind: route.componentKey === "factorRunNew" ? "form" : route.componentKey === "factorQuality" ? "checklist" : "chart",
    formFields: [{ label: "样本宇宙", value: "US large cap · 482 assets", hint: "固定数据版本" }, { label: "观察窗口", value: "2016-01-01 → 2026-06-30", hint: "按月 rebalance" }, { label: "质量门", value: "缺失率 < 10% · 极值 winsorize", hint: "运行前校验" }],
  };

  if (category === "strategy") return {
    ...common,
    eyebrow: "STRATEGY LAB / LOCAL BACKTEST",
    taskTitle: route.componentKey === "strategyNew" || route.componentKey === "backtestNew" ? "配置策略与回测边界" : `策略结果 · ${route.label}`,
    taskDescription: "策略实验、回测和 Paper Trading 共享参数、结果 ID、风险复核和执行意图；真实执行仍需明确确认。",
    panelTitle: route.componentKey === "strategyRiskReview" ? "风险复核" : route.componentKey === "strategyExecution" ? "执行意图与审计" : "策略结果与配置",
    panelDescription: "结果来自本地快照或模拟回测，所有收益数字均不代表真实成交。",
    stats: [{ label: "策略收益", value: "+18.6%", detail: "年化模拟", tone: "success" }, { label: "最大回撤", value: "-9.4%", detail: "风险门内", tone: "warning" }, { label: "交易次数", value: "126", detail: "模拟成交", tone: "neutral" }, { label: "执行状态", value: "OFF", detail: "Binance 默认关闭", tone: "danger" }],
    rows: [{ id: "signal", name: "Signal definition", status: "READY", value: "Value + Momentum", source: "factor run", detail: "可复现" }, { id: "backtest", name: "Backtest window", status: "READY", value: "2018–2026", source: "local DuckDB", detail: "月频" }, { id: "risk", name: "Risk review", status: "REVIEW", value: "最大回撤 -9.4%", source: "risk gate", detail: "待确认" }, { id: "execution", name: "Execution intent", status: "BLOCKED", value: "默认关闭", source: "Binance gate", detail: "人工确认" }],
    columns: [{ key: "name", label: "模块" }, { key: "status", label: "状态" }, { key: "value", label: "结果" }, { key: "source", label: "来源" }, { key: "detail", label: "动作" }],
    kind: route.componentKey === "strategyNew" || route.componentKey === "backtestNew" ? "form" : route.componentKey === "strategyRiskReview" || route.componentKey === "strategyExecution" ? "checklist" : "chart",
    formFields: [{ label: "策略名称", value: "Quality Momentum v1", hint: "本地策略记录" }, { label: "风险预算", value: "最大单标的 12% / 组合回撤 15%", hint: "需要风险复核" }, { label: "执行模式", value: "Paper only", hint: "真实执行默认关闭" }],
  };

  if (category === "workflow" || category === "screener") {
    const workflow = category === "workflow";
    return {
      ...common,
      eyebrow: workflow ? "WORKFLOW STUDIO / AUDITABLE AUTOMATION" : "SCREENERS / EXPLAINABLE RESULTS",
      taskTitle: workflow ? "把研究步骤组织成可审计工作流" : "从筛选条件到可解释结果",
      taskDescription: workflow ? "工作流模板、配置、运行时间线、证据产物和人工确认保持分离，敏感动作不会自动越过边界。" : "筛选器展示宇宙、条件、命中结果和解释；缺失指标与缓存状态不会被隐藏。",
      panelTitle: workflow ? "工作流目录与运行记录" : "筛选器结果与命中解释",
      panelDescription: workflow ? "当前模板：数据源 → 研究简报；最近一次运行已生成 3 个证据产物。" : "当前宇宙：US large cap；命中 18 个标的，4 个因缺失指标被排除。",
      stats: workflow ? [{ label: "模板", value: "06", detail: "安全模板", tone: "info" }, { label: "运行中", value: "01", detail: "可查看时间线", tone: "warning" }, { label: "证据产物", value: "18", detail: "本地文件", tone: "success" }, { label: "需确认", value: "02", detail: "人工边界", tone: "danger" }] : [{ label: "筛选宇宙", value: "482", detail: "US large cap", tone: "info" }, { label: "命中", value: "18", detail: "评分排序", tone: "success" }, { label: "缺失指标", value: "04", detail: "已单列", tone: "warning" }, { label: "运行时间", value: "42s", detail: "本地快照", tone: "neutral" }],
      rows: workflow ? [{ id: "template-1", name: "数据源 → 研究简报", status: "AVAILABLE", value: "3 steps", source: "local template", detail: "开始配置" }, { id: "template-2", name: "筛选 → 因子解释", status: "AVAILABLE", value: "4 steps", source: "local template", detail: "开始配置" }, { id: "run-1", name: "run-20260715-001", status: "RUNNING", value: "2 / 3 steps", source: "local API", detail: "查看时间线" }, { id: "confirm-1", name: "Execution confirmation", status: "BLOCKED", value: "人工确认", source: "risk gate", detail: "未执行" }] : [{ id: "AAPL", name: "AAPL · Apple", status: "MATCH", value: "92.4", source: "screen run", detail: "全部指标" }, { id: "MSFT", name: "MSFT · Microsoft", status: "MATCH", value: "89.8", source: "screen run", detail: "全部指标" }, { id: "NVDA", name: "NVDA · NVIDIA", status: "MATCH", value: "87.1", source: "screen run", detail: "1 项缓存" }, { id: "TSLA", name: "TSLA · Tesla", status: "EXCLUDED", value: "—", source: "quality gate", detail: "缺少 ROIC" }],
      columns: [{ key: "name", label: workflow ? "工作流 / 运行" : "命中标的" }, { key: "status", label: "状态" }, { key: "value", label: workflow ? "进度" : "评分" }, { key: "source", label: "来源" }, { key: "detail", label: "下一步" }],
      kind: route.pageKind === "config" ? "form" : route.pageKind === "review" || route.pageKind === "result" ? "checklist" : "table",
      formFields: [{ label: workflow ? "输入来源" : "筛选条件", value: workflow ? "SEC EDGAR + Market Quotes" : "ROIC > 12% · 12M Momentum > 0", hint: "保存到当前配置" }, { label: workflow ? "输出" : "排序", value: workflow ? "Research brief + evidence pack" : "Score descending", hint: "确定性运行" }, { label: "人工边界", value: "外部执行必须确认", hint: "不会自动提交" }],
      timeline: [{ title: "输入已固定", description: workflow ? "数据源和凭证状态已记录。" : "筛选宇宙和指标版本已记录。", status: "done" }, { title: workflow ? "运行步骤" : "结果解释", description: workflow ? "当前运行生成中，可查看每一步的证据。" : "每个命中结果可打开 Context Inspector。", status: "current" }, { title: "人工复核", description: "确认后才能进入下一工作区。", status: "pending" }],
    };
  }

  if (category === "portfolio") return {
    ...common,
    eyebrow: "PORTFOLIO / OFFLINE-FIRST LEDGER",
    taskTitle: `组合 · ${route.label}`,
    taskDescription: "组合页面以本地账本为准，展示持仓、配置、收益、风险、交易和研究交接；离线状态会明确标记。",
    panelTitle: route.componentKey === "portfolioRisk" ? "风险与异常" : route.componentKey === "portfolioTransactions" ? "交易记录" : "组合数据",
    panelDescription: "当前组合为本地示例账本，所有金额和收益均标记为 simulated，不能视为券商账户状态。",
    stats: [{ label: "组合价值", value: "$248,620", detail: "simulated", tone: "info" }, { label: "今日变化", value: "+0.74%", detail: "本地估算", tone: "success" }, { label: "集中度", value: "32.0%", detail: "AAPL", tone: "warning" }, { label: "数据状态", value: "CACHED", detail: "离线可读", tone: "neutral" }],
    rows: portfolioRows,
    columns: [{ key: "name", label: "持仓 / 项目" }, { key: "status", label: "状态" }, { key: "value", label: "权重" }, { key: "source", label: "账本" }, { key: "detail", label: "详情" }],
    kind: route.componentKey === "portfolioTransactionNew" ? "form" : route.componentKey === "portfolioRisk" ? "checklist" : "chart",
    formFields: [{ label: "交易类型", value: "Buy / Sell / Dividend", hint: "仅写入本地账本" }, { label: "标的与数量", value: "AAPL · 10 shares", hint: "提交前校验" }, { label: "备注", value: "研究交接来源：brief-20260715-aapl", hint: "保留 provenance" }],
  };

  if (category === "connection" || category === "settings") return {
    ...common,
    eyebrow: category === "connection" ? "CONNECTIONS / LOCAL CREDENTIAL BRIDGE" : "SETTINGS / LOCAL CONTROL PLANE",
    taskTitle: route.label,
    taskDescription: category === "connection" ? "连接页面只展示 provider 能力、凭证状态、健康探测和本地 Stronghold 桥接，不显示 secret。" : "设置页面控制主题、数据、AI、执行边界和运行时；保存后立即反映在当前工作区。",
    panelTitle: category === "connection" ? "Provider 状态" : "当前配置与安全边界",
    panelDescription: category === "connection" ? "凭证值永远不会进入 React 状态、日志或导出。" : "修改前后都会保留本地审计记录；Binance 仍然默认关闭。",
    stats: [{ label: category === "connection" ? "Provider" : "配置项", value: category === "connection" ? "08" : "14", detail: "可查看", tone: "info" }, { label: "可用", value: "04", detail: "本地 API", tone: "success" }, { label: "需凭证", value: "02", detail: "用户可选", tone: "warning" }, { label: "高风险", value: "OFF", detail: "Kill Switch", tone: "danger" }],
    rows: category === "connection" ? providerRows : [{ id: "theme", name: "主题与密度", status: "READY", value: "Light · Standard", source: "Zustand", detail: "立即生效" }, { id: "security", name: "本地解锁", status: "LOCKED", value: "10m idle timeout", source: "sidecar", detail: "当前路由" }, { id: "ai", name: "AI 权限", status: "LOCAL ONLY", value: "证据范围受限", source: "AIContext", detail: "可选云端" }, { id: "execution", name: "Binance execution", status: "OFF", value: "Kill Switch enabled", source: "risk gate", detail: "人工确认" }],
    columns: [{ key: "name", label: "项目" }, { key: "status", label: "状态" }, { key: "value", label: "当前值" }, { key: "source", label: "控制面" }, { key: "detail", label: "动作" }],
    kind: route.componentKey === "connectionCredentials" || route.componentKey === "settingsAppearance" || route.componentKey === "settingsAi" || route.componentKey === "settingsExecution" ? "form" : "checklist",
    formFields: [{ label: "当前设置", value: category === "connection" ? "EDGAR credential bridge" : "Light mode · Standard density", hint: "只保存非 secret 元数据" }, { label: "访问范围", value: "Local only", hint: "不上传到云端" }, { label: "下一步", value: "运行健康检查并记录审计", hint: "可回滚" }],
  };

  if (category === "manual") return {
    ...common,
    eyebrow: "MANUAL / LOCAL-FIRST OPERATING GUIDE",
    taskTitle: route.label,
    taskDescription: "手册将研究流程、数据来源、策略工作流、凭证安全和状态含义拆成可操作章节。",
    panelTitle: "本章节内容",
    panelDescription: "每个章节都连接到真实路由和下一步动作，帮助用户理解边界而不是只阅读说明。",
    stats: [{ label: "章节", value: "05", detail: "当前章节可读", tone: "info" }, { label: "示例", value: "12", detail: "本地 fixture", tone: "success" }, { label: "风险提示", value: "04", detail: "需确认", tone: "warning" }],
    rows: [{ id: "one", name: "01 · 当前章节", status: "OPEN", value: route.label, source: "manual", detail: "阅读中" }, { id: "two", name: "02 · 相关数据", status: "AVAILABLE", value: "Data Sources", source: "route", detail: "打开" }, { id: "three", name: "03 · 下一步", status: "AVAILABLE", value: "Research Inbox", source: "handoff", detail: "开始研究" }],
    columns: [{ key: "name", label: "章节" }, { key: "status", label: "状态" }, { key: "value", label: "内容" }, { key: "source", label: "来源" }, { key: "detail", label: "动作" }],
    kind: "timeline",
    timeline: [{ title: "理解当前边界", description: "本地数据、缓存和凭证状态先于任何结论。", status: "done" }, { title: "查看证据", description: "进入对应页面查看来源和更新时间。", status: "current" }, { title: "开始研究", description: "创建或打开一个 Research brief。", status: "pending" }],
  };

  return {
    ...common,
    eyebrow: "AI ASSISTANT / EVIDENCE-BOUNDED",
    taskTitle: "通用 AI 工作区",
    taskDescription: "没有研究、资产或实验上下文时，在此选择模板和模型；生成前会明确证据范围、权限和云端 opt-in。",
    panelTitle: "AI 请求工作区",
    panelDescription: "当前没有外部上下文，默认只允许本地模型；云端模型必须由用户明确开启。",
    stats: [{ label: "上下文", value: "NONE", detail: "通用请求", tone: "neutral" }, { label: "本地模型", value: "READY", detail: "可选", tone: "success" }, { label: "云端模型", value: "OPT-IN", detail: "默认关闭", tone: "warning" }, { label: "审计", value: "ON", detail: "记录元数据", tone: "info" }],
    rows: [{ id: "summarize", name: "摘要模板", status: "AVAILABLE", value: "本地文档", source: "local model", detail: "选择" }, { id: "compare", name: "比较模板", status: "AVAILABLE", value: "两份证据", source: "local model", detail: "选择" }, { id: "research", name: "研究模板", status: "CONTEXT REQUIRED", value: "需要 brief", source: "AI boundary", detail: "打开研究" }],
    columns: [{ key: "name", label: "模板" }, { key: "status", label: "状态" }, { key: "value", label: "输入" }, { key: "source", label: "模型" }, { key: "detail", label: "动作" }],
    kind: "form",
    formFields: [{ label: "请求模板", value: "选择一个本地模板", hint: "不发送 session token" }, { label: "用户输入", value: "在此输入研究问题或文档范围", hint: "生成前预览" }, { label: "证据范围", value: "当前请求无上下文", hint: "证据不足时禁止生成" }],
  };
}

function StatGrid({ stats }: { stats: RouteContent["stats"] }) {
  return <div className="route-stat-grid">{stats.map((stat) => <article className="route-stat-card" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.detail}</small>{stat.tone ? <Badge tone={stat.tone}>{stat.tone === "success" ? "READY" : stat.tone.toUpperCase()}</Badge> : null}</article>)}</div>;
}

function ChartPanel({ chart }: { chart: NonNullable<RouteContent["chart"]> }) {
  const points = chart.map((point, index) => `${36 + index * 120},${136 - Number(point.value) / 2}`).join(" ");
  return <div className="route-chart-panel"><div className="route-chart-legend"><span><TrendingUp size={14} />趋势</span><span>来源：本地快照</span><span>更新时间：02m</span></div><svg aria-label="趋势图" className="route-chart" role="img" viewBox="0 0 520 170"><path d="M36 136 H500" /><path d="M36 96 H500" /><path d="M36 56 H500" /><polyline points={points} /><circle cx="500" cy={136 - Number(chart[chart.length - 1].value) / 2} r="5" /></svg><div className="route-chart-axis">{chart.map((point) => <span key={point.label}>{point.label}</span>)}</div></div>;
}

function FormPanel({ fields, onAction }: { fields: NonNullable<RouteContent["formFields"]>; onAction: () => void }) {
  return <div className="route-form-grid">{fields.map((field) => <label className="route-form-field" key={field.label}><span>{field.label}</span><input aria-label={field.label} defaultValue={field.value} /><small>{field.hint}</small></label>)}<div className="route-form-actions"><Button variant="primary" onClick={onAction}><CheckCircle2 size={15} />保存本地草稿</Button><Button variant="ghost" onClick={onAction}>预览下一步</Button></div></div>;
}

function TimelinePanel({ timeline }: { timeline: NonNullable<RouteContent["timeline"]> }) {
  return <ol className="route-timeline">{timeline.map((item, index) => <li className={`route-timeline-item is-${item.status}`} key={item.title}><span className="route-timeline-marker">{item.status === "done" ? <CheckCircle2 size={15} /> : item.status === "current" ? <Play size={13} /> : index + 1}</span><div><strong>{item.title}</strong><p>{item.description}</p></div><Badge tone={item.status === "done" ? "success" : item.status === "current" ? "info" : "neutral"}>{item.status === "done" ? "已完成" : item.status === "current" ? "当前" : "待处理"}</Badge></li>)}</ol>;
}

function ChecklistPanel({ rows }: { rows: ContentRow[] }) {
  return <div className="route-checklist">{rows.map((row) => <div className="route-checklist-item" key={row.id}>{row.status === "READY" || row.status === "AVAILABLE" || row.status === "HELD" || row.status === "MATCH" ? <CheckCircle2 size={17} /> : row.status === "BLOCKED" || row.status === "CREDENTIAL REQUIRED" ? <LockKeyhole size={17} /> : <CircleAlert size={17} />}<div><strong>{row.name}</strong><span>{row.value} · {row.detail}</span></div><Badge tone={row.status === "READY" || row.status === "AVAILABLE" || row.status === "MATCH" ? "success" : row.status === "BLOCKED" ? "danger" : "warning"}>{row.status}</Badge></div>)}</div>;
}

export function RouteContentSurface({ route, params, state, onAction }: { route: FrameRouteRecord; params: Readonly<Record<string, string | undefined>>; state: string; onAction: () => void }) {
  if (state !== "ready") return null;
  const content = getRouteContent(route, params);
  return <section className="route-content-surface" aria-label={content.panelTitle}>
    <div className="route-content-heading"><div><p className="eyebrow">{content.eyebrow}</p><h2>{content.panelTitle}</h2><p>{content.panelDescription}</p></div><Badge tone="info">{content.sourceLabel}</Badge></div>
    <StatGrid stats={content.stats} />
    {content.kind === "chart" && content.chart ? <ChartPanel chart={content.chart} /> : null}
    {content.kind === "form" && content.formFields ? <FormPanel fields={content.formFields} onAction={onAction} /> : null}
    {content.kind === "timeline" && content.timeline ? <TimelinePanel timeline={content.timeline} /> : null}
    {content.kind === "checklist" ? <ChecklistPanel rows={content.rows} /> : null}
    {content.kind === "table" || content.kind === "chart" || content.kind === "form" ? <DataTable<ContentRow> ariaLabel={content.panelTitle} columns={content.columns} rows={content.rows} rowKey={(row) => row.id} dataSource={content.sourceLabel} freshness="本地快照 · 02m" labels={{ filter: "筛选", rows: "行", source: "来源", freshness: "新鲜度", inspector: "查看上下文", ai: "打开 AI" }} /> : null}
    <div className="route-content-footnote"><Database size={14} /><span>数据标记：sample / cached / simulated；页面离开后不会把结果仅保存在内存中。</span></div>
  </section>;
}
