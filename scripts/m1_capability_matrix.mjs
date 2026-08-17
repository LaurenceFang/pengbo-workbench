import { readFile, writeFile } from "node:fs/promises";

const [registry, stateMatrix] = await Promise.all([
  readFile("logs/svg-frame-registry.json", "utf8").then(JSON.parse),
  readFile("logs/t105-route-state-matrix.json", "utf8").then(JSON.parse),
]);
const stateByFrame = new Map(stateMatrix.records.map((record) => [record.frameNo, record]));
const ownership = {
  dashboard: { component: "DashboardView", file: "src/views/dashboard-view.tsx", capability: "总览、市场脉搏、首次运行与本地运行状态", api: "getDashboardOverview / getHealth" },
  commandCenter: { component: "CommandCenterView", file: "src/views/command-center-view.tsx", capability: "本地命令目录、搜索、执行反馈与审计入口", api: "command actions / security audit" },
  asset: { component: "AssetView", file: "src/views/asset-view.tsx", capability: "资产概览、行情、基本面、申报、来源与研究交接", api: "getAssetWorkspace / getPriceHistory / createResearchBrief" },
  watchlist: { component: "WatchlistView", file: "src/views/watchlist-view.tsx", capability: "默认自选查询、更新与资产跳转", api: "getDashboardOverview / updateDefaultWatchlist" },
  dataSources: { component: "DataSourcesView", file: "src/views/data-sources-view.tsx", capability: "来源目录、详情、预览、质量与报告", api: "getDataSourceStatus / getDataSourceProviderStatus / exportDataSourceReport" },
  research: { component: "ResearchView", file: "src/views/research-view.tsx", capability: "简报、结论、资产数据、分析、证据、真实 Research AI、笔记与导出", api: "getResearchBrief / previewResearchAssistant / generateResearchAssistant / updateResearchNotes / exportResearchBrief" },
  factorLab: { component: "FactorLabView", file: "src/views/factor-lab-view.tsx", capability: "因子配置、运行、结果、质量与交接", api: "getRecentFactorRuns / getFactorRun / runFactorLab" },
  strategyLab: { component: "StrategyLabView", file: "src/views/strategy-lab-view.tsx", capability: "模板、回测、Paper、风险数据与受控执行", api: "getStrategyTemplates / runStrategyBacktest / paper APIs / Binance risk gates" },
  workflowStudio: { component: "WorkflowStudioView", file: "src/views/workflow-studio-view.tsx", capability: "模板、配置、运行、步骤、产物与阻断", api: "getWorkflowTemplates / getWorkflowRun / createWorkflowRun" },
  screeners: { component: "ScreenersView", file: "src/views/screeners-view.tsx", capability: "预设、变体、调优、Universe、运行结果与研究交接", api: "screener preset / variant / run APIs" },
  portfolio: { component: "PortfolioView", file: "src/views/portfolio-view.tsx", capability: "总览、持仓、配置、分析、交易与交接", api: "getPortfolioSummary / getPortfolioHoldings / getPortfolioTransactions / mutation APIs" },
  connections: { component: "ConnectionsView", file: "src/views/connections-view.tsx", capability: "连接目录、详情、凭证与健康诊断", api: "getConnectionsStatus / credentials / testConnection" },
  settings: { component: "SettingsView", file: "src/views/settings-view.tsx", capability: "偏好、外观、安全、执行边界与运行诊断", api: "settings / local security / execution configuration APIs" },
  manual: { component: "ManualView", file: "src/views/manual-view.tsx", capability: "研究、数据、策略、安全与排障章节", api: "local static documentation" },
  aiAssistant: { component: "AiAssistantView", file: "src/views/ai-assistant-view.tsx", capability: "独立 AI 本地与云端配置、运行状态和真实阻断边界", api: "getAiControlSettings / getAiRuntimeStatus / updateAiControlSettings" },
};

const records = registry.frames.map((frame) => {
  const owner = ownership[frame.topLevelView];
  const stateRecord = stateByFrame.get(frame.frameNo);
  const requiredTransitions = frame.availability.kind === "planned"
    ? ["blocked -> recovery"]
    : frame.accessPolicy === "local_unlock"
      ? ["loading -> locked -> ready", "offline -> error -> recovery"]
      : ["loading -> ready", "empty/error -> recovery"];
  if (frame.aiPolicy !== "none") requiredTransitions.push("AI boundary -> blocked/opt-in/evidence recovery");
  if (frame.actionPolicy === "explicit_confirmation") requiredTransitions.push("ready -> explicit confirmation gate");
  return {
    frameNo: frame.frameNo,
    frameId: `frame-${String(frame.frameNo).padStart(2, "0")}`,
    svgRoute: frame.svgRoute,
    url: frame.route,
    label: frame.label,
    view: frame.topLevelView,
    section: frame.componentKey,
    realComponent: owner.component,
    componentFile: owner.file,
    existingCapability: owner.capability,
    dataContract: owner.api,
    availability: frame.availability,
    accessPolicy: frame.accessPolicy,
    actionPolicy: frame.actionPolicy,
    aiPolicy: frame.aiPolicy,
    supportedStates: stateRecord?.supportedStates ?? [],
    requiredTransitions,
    recoveryRequired: stateRecord?.supportedStates.some((state) => ["empty", "blocked", "error", "locked", "ai-insufficient-evidence", "cloud-opt-in", "recovery"].includes(state)) ?? false,
    stateContractPassed: stateRecord?.passed === true,
    responsive: "1440 strict; 1600 three-region; 1180 inspector drawer; 960 single-column drawers",
    acceptance: "Acceptance Pending",
  };
});

const failures = [];
if (records.length !== 79) failures.push(`expected 79 routes, found ${records.length}`);
if (stateMatrix.routeCount !== 79 || !stateMatrix.passed) failures.push("T105 route state matrix is not 79/79");
if (records.some((record) => !record.realComponent || !record.componentFile || !record.dataContract)) failures.push("route without a real owner or data contract");
if (records.some((record) => !record.stateContractPassed || record.supportedStates.length === 0)) failures.push("route without an accepted state contract");
if (records.some((record) => record.availability.kind === "planned" && !record.availability.plannedTask)) failures.push("planned route without task number");
if (records.some((record) => record.actionPolicy === "explicit_confirmation" && record.accessPolicy !== "local_unlock")) failures.push("confirmation route without unlock requirement");

const rows = records.map((record) => `| ${String(record.frameNo).padStart(2, "0")} | \`${record.url}\` | ${record.realComponent} / ${record.section} | ${record.availability.kind === "planned" ? `Blocked → ${record.availability.plannedTask}` : "Available"} | ${record.accessPolicy} / ${record.actionPolicy} | ${record.supportedStates.join(" / ")} | ${record.acceptance} |`);
const markdown = [
  "# M1 79 路由能力矩阵",
  "",
  "> 由 `npm.cmd run check:m1-capability-matrix` 从固定 SVG 注册表生成。Available 路由挂载 T1–T101 的真实业务 View；Planned 路由只显示带任务号的阻断态。",
  "",
  `- SVG SHA-256：\`${registry.svgSha256}\``,
  `- 路由：${records.length}/79`,
  `- Available：${records.filter((record) => record.availability.kind === "available").length}`,
  `- Planned blocked：${records.filter((record) => record.availability.kind === "planned").length}`,
  `- 校验：${failures.length ? `失败（${failures.join("；")}）` : "通过"}`,
  "- 动态和 packaged 已通过；SVG 像素与逐 Frame 人工签收仍保持 `Acceptance Pending`。",
  "",
  "| Frame | URL | 真实组件 / section | 可用性 | Access / action | Applicable states | 验收 |",
  "| ---: | --- | --- | --- | --- | --- | --- |",
  ...rows,
  "",
  "## 数据与状态原则",
  "",
  "- Available 页面由真实业务 View 及其 API/cache 状态渲染；生产失败不会回退为 fixture ready。",
  "- Fixture 仅允许 `VITE_DEMO_MODE=true`；视觉状态强制仅允许开发态 `VITE_VISUAL_TEST_MODE=true`。",
  "- `local_unlock` 与 `explicit_confirmation` 可组合；确认型操作不能绕过本地解锁。",
  "- Research AI 使用现有真实 assistant API；其余尚未实现的上下文 AI 显示带后续任务号的阻断态。独立 AI 页面提供本地/云端配置与状态，但不伪造模型输出。",
  "",
].join("\n");

await writeFile("logs/m1-route-capability-matrix.json", `${JSON.stringify({ generatedAt: new Date().toISOString(), svgSha256: registry.svgSha256, records, failures, passed: failures.length === 0 }, null, 2)}\n`, "utf8");
await writeFile("docs/m1-route-capability-matrix.md", markdown, "utf8");
console.log(JSON.stringify({ routeCount: records.length, available: records.filter((record) => record.availability.kind === "available").length, planned: records.filter((record) => record.availability.kind === "planned").length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
