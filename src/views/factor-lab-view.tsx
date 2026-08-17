import { FlaskConical, LineChart, RefreshCcw, Search, Send } from "lucide-react";
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
import { Badge, DataTable, SegmentedControl } from "../components/ui-kit";
import { useAsyncResource } from "../hooks/use-async-resource";
import { usePengboNavigation } from "../hooks/use-pengbo-navigation";
import {
  api,
  type FactorFamilyDefinition,
  type FactorFamilyKey,
  type FactorResult,
  type FactorRunResponse,
  type ScreenerUniverseSource,
} from "../lib/api";
import { useAppStore } from "../store/app-store";

const FAMILY_OPTIONS: FactorFamilyKey[] = [
  "composite",
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
];

const ASSET_TYPE_OPTIONS = [
  { value: "equity", label: "股票" },
  { value: "etf", label: "ETF / 指数代理" },
  { value: "index", label: "大盘指数" },
  { value: "crypto", label: "加密货币" },
];

export type FactorRouteSection = "factorRunNew" | "factorRuns" | "factorResults" | "factorAssetExplanation" | "factorQuality" | "factorHandoff";
const factorRoutePaths: Record<FactorRouteSection, string> = {
  factorRunNew: "/factor-lab/runs/new",
  factorRuns: "/factor-lab/runs",
  factorResults: "/factor-lab/runs/:runId/results",
  factorAssetExplanation: "/factor-lab/runs/:runId/assets/:symbol",
  factorQuality: "/factor-lab/runs/:runId/quality",
  factorHandoff: "/factor-lab/runs/:runId/handoff",
};

type FactorCopy = {
  eyebrow: string;
  title: string;
  reload: string;
  runSetup: string;
  controlledUniverse: string;
  researchOnly: string;
  universe: string;
  expanded: string;
  catalog: string;
  assetType: string;
  family: string;
  run: string;
  running: string;
  recent: string;
  persistedSnapshots: string;
  loadingRecent: string;
  retry: string;
  emptyRecent: string;
  evaluated: string;
  ranked: string;
  insufficient: string;
  asOf: string;
  results: string;
  rankedRows: string;
  selected: string;
  score: string;
  percentile: string;
  price: string;
  change: string;
  quality: string;
  signal: string;
  scoreWeight: string;
  missing: string;
  openResearch: string;
  openAsset: string;
  openStrategy: string;
  emptySelectedTitle: string;
  emptySelectedCopy: string;
  dataQuality: string;
  diagnostics: string;
  noRunTitle: string;
  noRunCopy: string;
  waitingTitle: string;
  waitingCopy: string;
  statusRunning: string;
  statusFailed: string;
  statusCompleted: string;
  statusPending: string;
  leader: string;
  candidate: string;
  watch: string;
  insufficientBucket: string;
  notAvailable: string;
  yes: string;
  no: string;
  runFailed: string;
  openFailed: string;
  researchFailed: string;
};

type FactorTableRow = FactorResult & {
  scoreLabel: string;
  bucketLabel: string;
};

const FACTOR_COPY: Record<"zh-CN" | "en-US", FactorCopy> = {
  "zh-CN": {
    eyebrow: "因子实验室",
    title: "本地因子证据、排名、诊断与研究交接",
    reload: "刷新",
    runSetup: "运行设置",
    controlledUniverse: "受控研究范围",
    researchOnly: "仅研究",
    universe: "范围",
    expanded: "受控扩容",
    catalog: "当前目录",
    assetType: "资产类型",
    family: "因子族",
    run: "运行因子实验室",
    running: "运行中...",
    recent: "最近运行",
    persistedSnapshots: "已保存快照",
    loadingRecent: "正在加载最近的因子运行...",
    retry: "重试",
    emptyRecent: "还没有保存的因子快照。运行一次因子实验室即可创建首个快照。",
    evaluated: "已评估",
    ranked: "已排名",
    insufficient: "数据不足",
    asOf: "截至",
    results: "结果",
    rankedRows: "因子排名行",
    selected: "当前选择",
    score: "评分",
    percentile: "百分位",
    price: "价格",
    change: "变化",
    quality: "质量",
    signal: "研究信号。",
    scoreWeight: "评分 / 权重",
    missing: "缺少",
    openResearch: "打开研究",
    openAsset: "打开资产",
    openStrategy: "打开策略实验室",
    emptySelectedTitle: "尚未选择因子结果",
    emptySelectedCopy: "运行因子实验室，或打开一个最近的快照。",
    dataQuality: "数据质量",
    diagnostics: "诊断与缺失输入",
    noRunTitle: "还没有本地因子运行",
    noRunCopy: "选择受控股票范围，然后运行复合因子或单因子排名。",
    waitingTitle: "因子实验室正在等待本地服务",
    waitingCopy: "桌面运行时恢复健康后，本地因子运行和已保存快照会重新可用。",
    statusRunning: "运行中",
    statusFailed: "失败",
    statusCompleted: "已完成",
    statusPending: "待运行",
    leader: "领先",
    candidate: "候选",
    watch: "观察",
    insufficientBucket: "数据不足",
    notAvailable: "暂无",
    yes: "是",
    no: "否",
    runFailed: "运行因子实验室失败。",
    openFailed: "打开因子运行失败。",
    researchFailed: "创建研究简报失败。",
  },
  "en-US": {
    eyebrow: "Factor Lab",
    title: "Local factor evidence, rankings, diagnostics, and research handoff",
    reload: "Reload",
    runSetup: "Run setup",
    controlledUniverse: "Controlled research universe",
    researchOnly: "research-only",
    universe: "Universe",
    expanded: "Expanded",
    catalog: "Catalog",
    assetType: "Asset type",
    family: "Family",
    run: "Run Factor Lab",
    running: "Running...",
    recent: "Recent",
    persistedSnapshots: "Persisted snapshots",
    loadingRecent: "Loading recent factor runs...",
    retry: "Retry",
    emptyRecent: "No saved factor snapshots yet. Run Factor Lab to create the first one.",
    evaluated: "Evaluated",
    ranked: "Ranked",
    insufficient: "Insufficient",
    asOf: "As of",
    results: "Results",
    rankedRows: "Ranked factor rows",
    selected: "Selected",
    score: "Score",
    percentile: "Percentile",
    price: "Price",
    change: "Change",
    quality: "Quality",
    signal: "Research signal.",
    scoreWeight: "Score / weight",
    missing: "Missing",
    openResearch: "Open Research",
    openAsset: "Open Asset",
    openStrategy: "Open Strategy Lab",
    emptySelectedTitle: "No factor row is selected",
    emptySelectedCopy: "Run Factor Lab or open a recent snapshot.",
    dataQuality: "Data Quality",
    diagnostics: "Diagnostics and missing inputs",
    noRunTitle: "No local factor run yet",
    noRunCopy: "Choose the controlled equity universe, then run a composite or single-family factor ranking.",
    waitingTitle: "Factor Lab is waiting for the local sidecar",
    waitingCopy: "Once the desktop runtime is healthy again, local factor runs and saved snapshots will become available.",
    statusRunning: "Running",
    statusFailed: "Failed",
    statusCompleted: "Completed",
    statusPending: "Pending",
    leader: "Leader",
    candidate: "Candidate",
    watch: "Watch",
    insufficientBucket: "Insufficient",
    notAvailable: "n/a",
    yes: "yes",
    no: "no",
    runFailed: "Failed to run Factor Lab.",
    openFailed: "Failed to open factor run.",
    researchFailed: "Failed to create research brief.",
  },
};

function formatBucket(bucket: FactorResult["bucket"], copy: FactorCopy): string {
  switch (bucket) {
    case "leader":
      return copy.leader;
    case "candidate":
      return copy.candidate;
    case "watch":
      return copy.watch;
    default:
      return copy.insufficientBucket;
  }
}

function metricValue(value: string | number | boolean | null | undefined, copy: FactorCopy): string {
  if (value === null || value === undefined) {
    return copy.notAvailable;
  }
  if (typeof value === "boolean") {
    return value ? copy.yes : copy.no;
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return value;
}

export function FactorLabView({
  backendStatus,
  routeSection = "factorRuns",
}: {
  backendStatus: BackendStatus;
  routeSection?: FactorRouteSection;
}) {
  const sidecarReady = backendStatus === "online";
  const language = useAppStore((state) => state.language);
  const copy = FACTOR_COPY[language];
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const lastFactorRunResult = useAppStore((state) => state.lastFactorRunResult);
  const selectedFactorRunId = useAppStore((state) => state.selectedFactorRunId);
  const { openView: setActiveView } = usePengboNavigation();
  const setSelectedAssetId = useAppStore((state) => state.setSelectedAssetId);
  const setSelectedResearchBriefId = useAppStore((state) => state.setSelectedResearchBriefId);
  const setSelectedFactorRunId = useAppStore((state) => state.setSelectedFactorRunId);
  const setLastFactorRunResult = useAppStore((state) => state.setLastFactorRunResult);
  const setLatestCommandFeedback = useAppStore((state) => state.setLatestCommandFeedback);

  const families = useAsyncResource(async () => api.getFactorFamilies(), [], { enabled: sidecarReady && (routeSection === "factorRunNew" || routeSection === "factorRuns") });
  const recentRuns = useAsyncResource(async () => api.getRecentFactorRuns(20), [], { enabled: sidecarReady && routeSection === "factorRuns" });
  const [universeSource, setUniverseSource] = useState<ScreenerUniverseSource>("expanded");
  const [family, setFamily] = useState<FactorFamilyKey>("composite");
  const [assetType, setAssetType] = useState<"equity" | "etf" | "index" | "crypto">("crypto");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const activeRun = lastFactorRunResult;
  const selectedResult =
    activeRun?.results.find((item) => item.symbol === selectedAssetId) ?? activeRun?.results[0] ?? null;
  const selectedMetricRows = useMemo<Array<Record<string, unknown>>>(
    () => Object.entries(selectedResult?.metrics ?? {}).map(([metric, value]) => ({ metric, value: metricValue(value, copy) })),
    [copy, selectedResult],
  );
  const factorTableRows = useMemo<FactorTableRow[]>(() => (activeRun?.results ?? []).map((item) => ({
    ...item,
    scoreLabel: item.composite_score !== null ? item.composite_score.toFixed(1) : copy.notAvailable,
    bucketLabel: formatBucket(item.bucket, copy),
  })), [activeRun, copy]);
  const familyLookup = useMemo<Record<string, FactorFamilyDefinition>>(
    () => Object.fromEntries((families.data ?? []).map((item) => [item.key, item])),
    [families.data],
  );

  useEffect(() => {
    if (!sidecarReady || !selectedFactorRunId || routeSection === "factorRunNew" || routeSection === "factorRuns") return;
    if (lastFactorRunResult?.run_id === selectedFactorRunId) return;
    let cancelled = false;
    setBusy(true);
    api.getFactorRun(selectedFactorRunId)
      .then((result) => {
        if (cancelled) return;
        setLastFactorRunResult(result);
        if (result.results[0]) setSelectedAssetId(result.results[0].symbol);
      })
      .catch((loadError) => { if (!cancelled) setActionError(loadError instanceof Error ? loadError.message : copy.openFailed); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [copy.openFailed, lastFactorRunResult?.run_id, routeSection, selectedFactorRunId, setLastFactorRunResult, setSelectedAssetId, sidecarReady]);

  async function runFactorLab() {
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await api.runFactorLab({
        universeSource,
        assetType,
        family,
      });
      setLastFactorRunResult(result);
      setSelectedFactorRunId(result.run_id);
      if (result.results[0]) {
        setSelectedAssetId(result.results[0].symbol);
      }
      setActionMessage(`${copy.statusCompleted}: ${result.run_id}`);
      recentRuns.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.runFailed);
    } finally {
      setBusy(false);
    }
  }

  async function openRecentRun(runId: string) {
    setBusy(true);
    setActionError(null);
    try {
      const result = await api.getFactorRun(runId);
      setLastFactorRunResult(result);
      setSelectedFactorRunId(result.run_id);
      if (result.results[0]) {
        setSelectedAssetId(result.results[0].symbol);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.openFailed);
    } finally {
      setBusy(false);
    }
  }

  async function openResearch(result: FactorResult) {
    if (!activeRun) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const brief = await api.createResearchBrief({
        symbol: result.symbol,
        factorRunId: activeRun.run_id,
        sourceUniverseSource: activeRun.universe_source,
      });
      setSelectedAssetId(result.symbol);
      setSelectedResearchBriefId(brief.brief_id);
      setActiveView("research");
      setLatestCommandFeedback({
        tone: "success",
        title: `${copy.openResearch}: ${result.symbol}`,
        detail: `${brief.brief_id} / ${activeRun.run_id}`,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.researchFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!sidecarReady) {
    return (
      <PanelState
        title={copy.waitingTitle}
        copy={copy.waitingCopy}
      />
    );
  }

  return (
    <div className="stack-layout p3-page" data-route-id={factorRoutePaths[routeSection]} data-context-inspector="factor-result" data-primary-task={routeSection}>
      <section
        aria-label={`factor-lab-view state=${activeRun ? "ready" : "empty"} run=${selectedFactorRunId ?? "none"}`}
        className="card p3-page-shell"
      >
        <div className="card-header p3-page-header">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h3>{copy.title}</h3>
          </div>
          <div className="p3-status-cluster">
          <Badge tone={busy ? "info" : actionError ? "danger" : activeRun ? "success" : "neutral"}>{busy ? copy.statusRunning : actionError ? copy.statusFailed : activeRun ? copy.statusCompleted : copy.statusPending}</Badge>
          <button aria-label="factor-lab-refresh" className="ghost-button" onClick={() => recentRuns.reload()} type="button">
            <RefreshCcw size={16} />
            {copy.reload}
          </button>
          </div>
        </div>

        <div className="factor-lab-control-grid">
          {routeSection === "factorRunNew" ? (
          <div className="research-panel">
            <div className="screeners-column-head">
              <div>
                <p className="eyebrow">{copy.runSetup}</p>
                <strong>{copy.controlledUniverse}</strong>
              </div>
              <span className="mini-pill">{copy.researchOnly}</span>
            </div>
            <label className="field">
              <span>{copy.universe}</span>
              <select value={universeSource} onChange={(event) => setUniverseSource(event.target.value as ScreenerUniverseSource)}>
                <option value="expanded">{copy.expanded}</option>
                <option value="catalog">{copy.catalog}</option>
              </select>
            </label>
            <label className="field">
              <span>{copy.assetType}</span>
              <select value={assetType} onChange={(event) => setAssetType(event.target.value as typeof assetType)}>
                {ASSET_TYPE_OPTIONS.map((item) => (
                  <option value={item.value} key={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{copy.family}</span>
              <select value={family} onChange={(event) => setFamily(event.target.value as FactorFamilyKey)}>
                {FAMILY_OPTIONS.map((key) => (
                  <option value={key} key={key}>
                    {familyLookup[key]?.label ?? key}
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label={`factor-run-submit universe=${universeSource} assetType=${assetType} family=${family}`}
              className="primary-button"
              disabled={busy}
              onClick={() => void runFactorLab()}
              type="button"
            >
              <FlaskConical size={16} />
              {busy ? copy.running : copy.run}
            </button>
            {families.data?.find((item) => item.key === family) ? (
              <p className="panel-note">
                {familyLookup[family]?.simple_description} {familyLookup[family]?.research_only_note}
              </p>
            ) : null}
          </div>
          ) : null}

          {routeSection === "factorRuns" ? (
          <div className="research-panel">
            <div className="screeners-column-head">
              <div>
                <p className="eyebrow">{copy.recent}</p>
                <strong>{copy.persistedSnapshots}</strong>
              </div>
              <span className="mini-pill">{recentRuns.data?.length ?? 0}</span>
            </div>
            {recentRuns.loading && !recentRuns.data ? <InlineState label={copy.loadingRecent} /> : null}
            {recentRuns.error ? <InlineState label={recentRuns.error} actionLabel={copy.retry} onAction={recentRuns.reload} /> : null}
            <div className="research-list">
              {(recentRuns.data ?? []).length > 0 ? (recentRuns.data ?? []).map((item) => (
                <button
                  aria-label={`factor-run-recent run=${item.run_id} family=${item.family}`}
                  className={`variant-card ${item.run_id === selectedFactorRunId ? "selected" : ""}`}
                  disabled={busy}
                  key={item.run_id}
                  onClick={() => void openRecentRun(item.run_id)}
                  type="button"
                >
                  <div className="variant-card-head">
                    <strong>{familyLookup[item.family]?.label ?? item.family}</strong>
                    <span className="mini-pill">{item.result_count}</span>
                  </div>
                  <p>{item.run_id}</p>
                  <small>{new Date(item.as_of).toLocaleString()}</small>
                </button>
              )) : <InlineState label={copy.emptyRecent} actionLabel={copy.reload} onAction={recentRuns.reload} />}
            </div>
          </div>
          ) : null}
        </div>

        {routeSection !== "factorRunNew" && routeSection !== "factorRuns" && activeRun ? (
          <>
            <div
              aria-label={`factor-run-attribution run=${activeRun.run_id} universe=${activeRun.universe_source} assetType=${activeRun.asset_type} family=${activeRun.family} results=${activeRun.result_count}`}
              className="metric-grid"
            >
              <MetricCard label={copy.evaluated} value={String(activeRun.evaluated_count)} />
              <MetricCard label={copy.ranked} value={metricValue(activeRun.diagnostics.ranked_count, copy)} />
              <MetricCard label={copy.insufficient} value={metricValue(activeRun.diagnostics.insufficient_count, copy)} />
              <MetricCard label={copy.asOf} value={new Date(activeRun.as_of).toLocaleTimeString(language)} />
            </div>

            <div className="factor-lab-workspace">
              {routeSection === "factorResults" ? (
              <section className="research-panel">
                <div className="screeners-column-head">
                  <div>
                    <p className="eyebrow">{copy.results}</p>
                    <strong>{copy.rankedRows}</strong>
                  </div>
                  <span className="mini-pill">{activeRun.result_count}</span>
                </div>
                <DataTable<FactorTableRow>
                  columns={[
                    { key: "symbol", label: "Symbol", sortable: true },
                    { key: "name", label: "Name", sortable: true },
                    { key: "rank", label: "Rank", align: "right", sortable: true },
                    { key: "scoreLabel", label: "Score", align: "right", sortable: true, sortValue: (row) => row.composite_score as number | null },
                    { key: "bucketLabel", label: "Bucket", sortable: true },
                    { key: "data_source", label: language === "zh-CN" ? "来源" : "Source", sortable: true },
                    { key: "stale", label: language === "zh-CN" ? "新鲜度" : "Freshness", sortable: true, render: (value) => value ? (language === "zh-CN" ? "需复核" : "Review") : (language === "zh-CN" ? "最新" : "Fresh") },
                  ]}
                  labels={{ filter: language === "zh-CN" ? "筛选" : "Filter", inspector: copy.selected }}
                  ariaLabel={language === "zh-CN" ? "因子结果数据表" : "Factor results data table"}
                  dataSource={activeRun.universe_source}
                  freshness={new Date(activeRun.as_of).toLocaleString(language)}
                  error={actionError ?? undefined}
                  onRetry={() => { setActionError(null); recentRuns.reload(); }}
                  state={actionError ? "error" : factorTableRows.length > 0 ? "ready" : "empty"}
                  onOpenAI={(row) => setLatestCommandFeedback({ tone: "success", title: `${language === "zh-CN" ? "因子结果 AI 入口" : "Factor result AI entry"}: ${String(row.symbol)}`, detail: String(row.name) })}
                  onOpenInspector={(row) => setSelectedAssetId(String(row.symbol))}
                  inspectorContext={(row) => ({
                    routeId: "/factor-lab/runs/:runId/results",
                    objectType: "factor-result",
                    objectId: String(row.symbol),
                    assetId: String(row.symbol),
                    runId: activeRun.run_id,
                    evidenceScope: ["factor ranking", "contributions", "data quality"],
                    source: String(row.data_source),
                    freshness: new Date(activeRun.as_of).toLocaleString(language),
                    permissionState: "read_only",
                    aiState: "available",
                  })}
                  onSelectRow={(row) => setSelectedAssetId(String(row.symbol))}
                  rowKey={(row) => String(row.symbol)}
                  rows={factorTableRows}
                  selectedRowKey={selectedResult?.symbol ?? null}
                  virtualized={factorTableRows.length > 40}
                />
              </section>
              ) : null}

              {routeSection === "factorAssetExplanation" ? (
              <section className="research-panel">
                {selectedResult ? (
                  <>
                    <div className="card-header">
                      <div>
                        <p className="eyebrow">{copy.selected}</p>
                        <h3>
                          {selectedResult.name}
                          <span className="inline-symbol">{selectedResult.symbol}</span>
                        </h3>
                      </div>
                      <span className="mini-pill accent">{formatBucket(selectedResult.bucket, copy)}</span>
                    </div>
                    <div className="metric-grid">
                      <MetricCard
                        label={copy.score}
                        value={selectedResult.composite_score !== null ? selectedResult.composite_score.toFixed(1) : copy.notAvailable}
                      />
                      <MetricCard
                        label={copy.percentile}
                        value={selectedResult.percentile !== null ? `${selectedResult.percentile.toFixed(1)}%` : copy.notAvailable}
                      />
                      <MetricCard
                        label={copy.price}
                        value={
                          selectedResult.price !== null
                            ? formatPrice(selectedResult.price, selectedResult.symbol.includes("/") ? "USDT" : "USD", selectedResult.asset_class)
                            : copy.notAvailable
                        }
                      />
                      <MetricCard
                        label={copy.change}
                        value={selectedResult.change_pct !== null ? formatPercent(selectedResult.change_pct) : copy.notAvailable}
                        tone={(selectedResult.change_pct ?? 0) >= 0 ? "up" : "down"}
                      />
                      <MetricCard
                        label={copy.quality}
                        value={selectedResult.data_quality?.overall ?? copy.notAvailable}
                      />
                    </div>
                    <div className="factor-chart-wrap">
                      <ProfessionalChartPanel
                        primary={selectedResult.score_history}
                        comparisons={[]}
                      />
                    </div>
                    <div className="analysis-card-list">
                      {selectedResult.contributions.map((item) => (
                        <article className="analysis-card" key={item.family}>
                          <div className="analysis-card-head">
                            <div>
                              <strong>{item.label}</strong>
                              <p>{familyLookup[item.family]?.simple_description ?? copy.signal}</p>
                              <p>{copy.scoreWeight} {item.score !== null ? item.score.toFixed(1) : copy.notAvailable} / {item.weight}</p>
                            </div>
                            <span className="mini-pill">{item.family}</span>
                          </div>
                          {item.evidence.map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                          {item.missing_metrics.length ? (
                            <p className="panel-note">{copy.missing}: {item.missing_metrics.join(", ")}</p>
                          ) : null}
                        </article>
                      ))}
                    </div>
                    <div className="form-actions">
                      <button
                        aria-label={`factor-open-research symbol=${selectedResult.symbol} run=${activeRun.run_id}`}
                        className="primary-button"
                        disabled={busy}
                        onClick={() => void openResearch(selectedResult)}
                        type="button"
                      >
                        <Send size={16} />
                        {copy.openResearch}
                      </button>
                      <button className="ghost-button" onClick={() => setActiveView("asset")} type="button">
                        <Search size={16} />
                        {copy.openAsset}
                      </button>
                      <button
                        aria-label={`factor-open-strategy-lab run=${activeRun.run_id}`}
                        className="ghost-button"
                        onClick={() => setActiveView("strategyLab")}
                        type="button"
                      >
                        <LineChart size={16} />
                        {copy.openStrategy}
                      </button>
                    </div>
                  </>
                ) : (
                  <PanelState title={copy.emptySelectedTitle} copy={copy.emptySelectedCopy} />
                )}
              </section>
              ) : null}

              {routeSection === "factorQuality" ? (
              <section className="research-panel">
                <div className="screeners-column-head">
                  <div>
                    <p className="eyebrow">{copy.dataQuality}</p>
                    <strong>{copy.diagnostics}</strong>
                  </div>
                </div>
                {selectedResult ? (
                  <>
                    <div className="table-list">
                      {Object.entries(selectedResult.metrics).map(([key, value]) => (
                        <div className="table-row" key={key}>
                          <div className="table-main">
                            <strong>{key}</strong>
                          </div>
                          <div className="table-meta">
                            <span>{metricValue(value, copy)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedResult.notes.map((note) => (
                      <InlineState label={note} key={note} />
                    ))}
                    {selectedResult.data_quality?.limitations.map((note) => (
                      <InlineState label={`${copy.quality}: ${note}`} key={`quality-${note}`} />
                    ))}
                  </>
                ) : null}
                {actionMessage ? <InlineState label={actionMessage} /> : null}
                {actionError ? <InlineState label={actionError} /> : null}
              </section>
              ) : null}

              {routeSection === "factorHandoff" ? (
                <section className="research-panel factor-handoff-page" aria-label="factor-handoff-primary-task">
                  {selectedResult ? (
                    <>
                      <div className="card-header"><div><p className="eyebrow">FACTOR HANDOFF</p><h3>{selectedResult.name}<span className="inline-symbol">{selectedResult.symbol}</span></h3></div><span className="mini-pill accent">{formatBucket(selectedResult.bucket, copy)}</span></div>
                      <p className="body-copy">把当前因子运行、标的解释和数据质量上下文交接到研究或策略工作区。</p>
                      <div className="metric-grid"><MetricCard label={copy.score} value={selectedResult.composite_score !== null ? selectedResult.composite_score.toFixed(1) : copy.notAvailable} /><MetricCard label={copy.quality} value={selectedResult.data_quality?.overall ?? copy.notAvailable} /><MetricCard label="Run" value={activeRun.run_id} /></div>
                      <div className="form-actions">
                        <button aria-label={`factor-open-research symbol=${selectedResult.symbol} run=${activeRun.run_id}`} className="primary-button" disabled={busy} onClick={() => void openResearch(selectedResult)} type="button"><Send size={16} />{copy.openResearch}</button>
                        <button className="ghost-button" onClick={() => setActiveView("asset")} type="button"><Search size={16} />{copy.openAsset}</button>
                        <button aria-label={`factor-open-strategy-lab run=${activeRun.run_id}`} className="ghost-button" onClick={() => setActiveView("strategyLab")} type="button"><LineChart size={16} />{copy.openStrategy}</button>
                      </div>
                    </>
                  ) : <PanelState title={copy.emptySelectedTitle} copy={copy.emptySelectedCopy} />}
                  {actionError ? <InlineState label={actionError} /> : null}
                </section>
              ) : null}
            </div>
          </>
        ) : routeSection !== "factorRunNew" && routeSection !== "factorRuns" ? (
          <PanelState
            title={copy.noRunTitle}
            copy={copy.noRunCopy}
          />
        ) : null}
      </section>
    </div>
  );
}
