import { useEffect, useMemo, useState } from "react";
import {
  api,
  type AssetSearchResult,
  type AssetWorkspaceResponse,
  type PortfolioHolding,
  type PriceHistoryInterval,
  type PricePoint,
  type ResearchBriefListItem,
  type WatchlistAssetSnapshot,
} from "../lib/api";
import {
  DataStatusStrip,
  InlineState,
  KLineChartPanel,
  PanelState,
  formatPercent,
  formatPrice,
  formatSignedMoney,
  type DataStatusItem,
} from "../components/shared";
import { useI18n } from "../i18n";
import { usePengboNavigation } from "../hooks/use-pengbo-navigation";
import { useAppStore } from "../store/app-store";

type CoverageStatus = AssetWorkspaceResponse["capabilities"]["fundamentals_status"];
export type AssetRouteSection = "assetSearch" | "assetOverview" | "assetPrice" | "assetFundamentals" | "assetFilings" | "assetData" | "assetResearch";
const assetRoutePaths: Record<AssetRouteSection, string> = {
  assetSearch: "/markets/assets",
  assetOverview: "/markets/assets/:symbol/overview",
  assetPrice: "/markets/assets/:symbol/price",
  assetFundamentals: "/markets/assets/:symbol/fundamentals",
  assetFilings: "/markets/assets/:symbol/filings",
  assetData: "/markets/assets/:symbol/data",
  assetResearch: "/markets/assets/:symbol/research",
};

const DEFAULT_INTERVAL: PriceHistoryInterval = "30m";
const QUICK_INTERVALS: Array<{ value: PriceHistoryInterval; label: string }> = [
  { value: "15m", label: "15分钟图" },
  { value: "1h", label: "1小时图" },
  { value: "1d", label: "日线图" },
  { value: "1wk", label: "周线图" },
];
const MORE_INTERVALS: Array<{ value: PriceHistoryInterval; label: string }> = [
  { value: "30m", label: "30分钟图" },
  { value: "2h", label: "2小时图" },
  { value: "4h", label: "4小时图" },
  { value: "8h", label: "8小时图" },
  { value: "1mo", label: "月线图" },
  { value: "1y", label: "年度K线图" },
  { value: "1d", label: "日线图" },
  { value: "1wk", label: "周线图" },
];

const CLEAN_QUICK_INTERVALS: Array<{ value: PriceHistoryInterval; label: string }> = [
  { value: "15m", label: "15 分钟" },
  { value: "1h", label: "1 小时" },
  { value: "1d", label: "日线" },
  { value: "1wk", label: "周线" },
];
const CLEAN_MORE_INTERVALS: Array<{ value: PriceHistoryInterval; label: string }> = [
  { value: "30m", label: "30 分钟" },
  { value: "2h", label: "2 小时" },
  { value: "4h", label: "4 小时" },
  { value: "8h", label: "8 小时" },
  { value: "1mo", label: "月线" },
  { value: "1y", label: "年度 K 线" },
  { value: "1d", label: "日线" },
  { value: "1wk", label: "周线" },
];

function chartRangeFor(interval: PriceHistoryInterval): string {
  if (["15m", "30m", "1h"].includes(interval)) {
    return "1mo";
  }
  if (["2h", "4h", "8h"].includes(interval)) {
    return "6mo";
  }
  if (interval === "1wk") {
    return "5y";
  }
  if (interval === "1mo" || interval === "1y") {
    return "10y";
  }
  return "1y";
}

export function AssetView({
  asset,
  selectedAsset,
  loading,
  error,
  onRetry,
  sensitiveContextReady,
  routeSection = "assetOverview",
}: {
  asset: AssetWorkspaceResponse | null;
  selectedAsset: WatchlistAssetSnapshot | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  sensitiveContextReady: boolean;
  routeSection?: AssetRouteSection;
}) {
  const i18n = useI18n();
  const { openAsset, openView: setActiveView } = usePengboNavigation();
  const setSelectedAssetId = useAppStore((state) => state.setSelectedAssetId);
  const setSelectedResearchBriefId = useAppStore((state) => state.setSelectedResearchBriefId);
  const [interval, setInterval] = useState<PriceHistoryInterval>(DEFAULT_INTERVAL);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [recentBriefs, setRecentBriefs] = useState<ResearchBriefListItem[]>([]);
  const [portfolioHoldings, setPortfolioHoldings] = useState<PortfolioHolding[]>([]);
  const [contextError, setContextError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (routeSection !== "assetSearch") return;
    let cancelled = false;
    setSearchLoading(true);
    setSearchError(null);
    api.searchAssets(searchTerm.trim())
      .then((results) => { if (!cancelled) setSearchResults(results); })
      .catch((searchFailure) => { if (!cancelled) setSearchError(searchFailure instanceof Error ? searchFailure.message : "资产搜索失败"); })
      .finally(() => { if (!cancelled) setSearchLoading(false); });
    return () => { cancelled = true; };
  }, [routeSection, searchTerm]);

  useEffect(() => {
    if (routeSection !== "assetPrice") {
      return;
    }
    if (!asset?.asset.symbol) {
      return;
    }
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    api
      .getPriceHistory(asset.asset.symbol, interval, chartRangeFor(interval))
      .then((points) => {
        if (!cancelled) {
          setHistory(points);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setHistoryError(error instanceof Error ? error.message : "K线数据加载失败。");
          setHistory(asset.history);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [asset?.asset.symbol, interval, routeSection]);

  useEffect(() => {
    if (routeSection !== "assetResearch") {
      return;
    }
    if (!asset?.asset.symbol) {
      return;
    }
    if (!sensitiveContextReady) {
      setRecentBriefs([]);
      setPortfolioHoldings([]);
      setContextError("Local unlock is required before Research and Portfolio context can be loaded.");
      return;
    }
    let cancelled = false;
    setContextError(null);
    Promise.allSettled([api.getRecentResearchBriefs(50), api.getPortfolioHoldings()])
      .then(([briefsResult, holdingsResult]) => {
        if (cancelled) {
          return;
        }
        if (briefsResult.status === "fulfilled") {
          setRecentBriefs(briefsResult.value);
        }
        if (holdingsResult.status === "fulfilled") {
          setPortfolioHoldings(holdingsResult.value);
        }
        const failures = [briefsResult, holdingsResult].filter((result) => result.status === "rejected");
        setContextError(failures.length ? "Some local context is unavailable; Research actions still work." : null);
      });
    return () => {
      cancelled = true;
    };
  }, [asset?.asset.symbol, routeSection, sensitiveContextReady]);

  const selectedIntervalLabel = useMemo(
    () => [...QUICK_INTERVALS, ...MORE_INTERVALS].find((item) => item.value === interval)?.label ?? interval,
    [interval],
  );

  if (routeSection === "assetSearch") {
    return (
      <div className="p1-page p1-asset-page asset-search-page" data-route-id="/markets/assets" data-context-inspector="asset-search" data-primary-task={routeSection}>
        <header className="p1-page-header">
          <div><p className="eyebrow">ASSET DIRECTORY</p><h2>资产搜索</h2><p className="p1-page-lede">搜索本地资产目录，选择后进入该资产的独立概览页面。</p></div>
        </header>
        <section className="card p1-panel asset-search-workspace" aria-label="asset-search-primary-task">
          <div className="p1-section-heading"><div><p className="eyebrow">PRIMARY TASK</p><h3>搜索并选择一个资产</h3></div><span className="mini-pill accent">{searchResults.length} 项</span></div>
          <label className="asset-search-control"><span>名称、代码或市场</span><input autoFocus aria-label="asset-search-query" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="例如 AAPL、BTC、沪深300" /></label>
          {searchLoading ? <InlineState label="正在搜索资产目录…" /> : null}
          {searchError ? <InlineState label={`搜索失败：${searchError}`} /> : null}
          {!searchLoading && !searchError && searchResults.length === 0 ? <InlineState label="没有匹配资产，请调整关键词。" /> : null}
          <div className="asset-search-results" role="list">
            {searchResults.map((result) => (
              <button key={result.symbol} className="asset-search-result" type="button" role="listitem" onClick={() => { setSelectedAssetId(result.symbol); openAsset(result.symbol, "overview"); }}>
                <span><strong>{result.symbol}</strong><small>{result.name}</small></span>
                <span>{result.market}<small>{result.asset_class}</small></span>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (loading) {
    return <div className="p1-page p1-asset-page" data-route-id={assetRoutePaths[routeSection]} data-context-inspector="asset" data-primary-task={routeSection}><PanelState title={i18n.t("asset.loadingTitle")} copy={i18n.t("asset.loadingCopy")} /></div>;
  }

  if (error || !asset) {
    return <div className="p1-page p1-asset-page" data-route-id={assetRoutePaths[routeSection]} data-context-inspector="asset" data-primary-task={routeSection}><PanelState title={i18n.t("asset.errorTitle")} copy={error ?? i18n.t("asset.errorCopy")} actionLabel={i18n.t("common.retry")} onAction={onRetry} /></div>;
  }

  const fundamentalsMessage = asset.capabilities.fundamentals_message ?? asset.capabilities.notes[0] ?? i18n.t("asset.noFundamentals");
  const filingsMessage =
    asset.capabilities.filings_message ??
    (asset.capabilities.notes.join(" / ") || i18n.t("asset.noFilings"));
  const chartData = history.length ? history : asset.history;
  const symbol = asset.asset.symbol;
  const relatedBrief = recentBriefs.find((item) => item.symbol === symbol) ?? null;
  const holding = portfolioHoldings.find((item) => item.symbol === symbol) ?? null;
  const watchlistState = selectedAsset?.symbol === symbol ? "watchlist" : "catalog";
  const evidenceState = relatedBrief ? "brief-linked" : "ready";
  const dataStatusCopy = summarizeDataStatus(asset);

  function openResearchBrief() {
    setSelectedAssetId(symbol);
    setSelectedResearchBriefId(relatedBrief?.brief_id ?? null);
    setActiveView("research");
  }

  function openDataSources() {
    setActiveView("dataSources");
  }

  return (
    <div aria-label={`asset-workspace symbol=${asset.asset.symbol} section=${routeSection}`} className="p1-page p1-asset-page asset-layout terminal-asset-layout" data-route-id={assetRoutePaths[routeSection]} data-context-inspector="asset" data-primary-task={routeSection}>
      <header className="p1-page-header p1-asset-header">
        <div>
          <p className="eyebrow">{i18n.t("asset.detailEyebrow")}</p>
          <h2>{asset.asset.name}<span className="inline-symbol">{asset.asset.symbol}</span></h2>
          <p className="p1-page-lede">{i18n.language === "zh-CN" ? "在进入研究前，先统一查看行情、覆盖范围和数据来源。" : "Quote, coverage, and source context stay together before the Research handoff."}</p>
        </div>
        <div className="p1-page-actions">
          <span className={`p1-status-dot ${asset.stale ? "is-cached" : "is-live"}`}>{asset.stale ? "cached" : "observed"}</span>
          <button className="primary-button" type="button" onClick={openResearchBrief}>
            {relatedBrief ? (i18n.language === "zh-CN" ? "打开研究简报" : "Open research brief") : (i18n.language === "zh-CN" ? "创建研究简报" : "Create research brief")}
          </button>
        </div>
      </header>

      {routeSection === "assetOverview" ? (
        <section className="card p1-panel asset-overview-page" aria-label="asset-overview-primary-task">
          <div className="p1-section-heading">
            <div><p className="eyebrow">ASSET OVERVIEW</p><h3>{asset.asset.symbol} 当前概览</h3></div>
            <div className="price-stack"><strong>{formatPrice(asset.quote.price, asset.quote.currency, asset.asset.asset_class)}</strong><span className={`delta-pill ${asset.quote.change < 0 ? "down" : "up"}`}>{formatSignedMoney(asset.quote.change, asset.quote.currency)} / {formatPercent(asset.quote.change_pct)}</span></div>
          </div>
          <DataStatusStrip ariaLabel={`asset-overview-status symbol=${symbol}`} items={[
            { label: "Market", value: asset.asset.market, detail: `${asset.asset.asset_class} · ${asset.asset.currency}`, tone: "observed" },
            { label: "Quote", value: asset.stale ? "Cached" : "Observed", detail: new Date(asset.quote.as_of).toLocaleString(), tone: asset.stale ? "cached" : "observed" },
            { label: "Coverage", value: dataStatusCopy.title, detail: dataStatusCopy.copy, tone: dataStatusCopy.tone },
          ]} />
          <div className="asset-overview-summary"><span>公司与资产说明</span><strong>{asset.overview?.company ?? asset.asset.name}</strong><p>{asset.overview?.summary ?? "当前资产暂无额外公司摘要；行情和来源状态仍可独立检查。"}</p></div>
        </section>
      ) : null}

      {routeSection === "assetPrice" ? (
      <section className="card p1-panel hero-chart p1-asset-primary">
        <div className="p1-section-heading">
          <div>
            <p className="eyebrow">{i18n.t("asset.detailEyebrow")}</p>
            <h3>
              {asset.asset.name}
              <span className="inline-symbol">{asset.asset.symbol}</span>
            </h3>
          </div>
          <div className="price-stack">
            <strong>{formatPrice(asset.quote.price, asset.quote.currency, asset.asset.asset_class)}</strong>
            <span className={`delta-pill ${asset.quote.change < 0 ? "down" : "up"}`}>
              {formatSignedMoney(asset.quote.change, asset.quote.currency)} / {formatPercent(asset.quote.change_pct)}
            </span>
          </div>
        </div>

        <div className="chart-control-bar">
          <div className="range-row">
            {CLEAN_QUICK_INTERVALS.map((item) => (
              <button
                key={item.value}
                className={`range-chip ${item.value === interval ? "active" : ""}`}
                onClick={() => setInterval(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="chart-interval-select">
            <span>更多周期</span>
            <select
              aria-label={`asset-chart-interval selected=${interval}`}
              value={interval}
              onChange={(event) => setInterval(event.target.value as PriceHistoryInterval)}
            >
              {CLEAN_MORE_INTERVALS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="chart-status-row">
          <span className="mini-pill accent">默认 30分钟图</span>
          <span className="mini-pill">{selectedIntervalLabel}</span>
          <span className="mini-pill">{asset.stale ? "缓存" : "实时"}</span>
          <span className="panel-note">当前价 {formatPrice(asset.quote.price, asset.quote.currency, asset.asset.asset_class)} · {new Date(asset.quote.as_of).toLocaleString()}</span>
        </div>
        {historyLoading ? <InlineState label="正在加载当前周期 K 线..." /> : null}
        {historyError ? <InlineState label={`已回退到缓存/默认历史：${historyError}`} /> : null}
        <KLineChartPanel data={chartData} legend={`${asset.asset.symbol} ${selectedIntervalLabel}`} />
      </section>
      ) : null}

      {routeSection === "assetResearch" ? (
      <section
        aria-label={`asset-research-entry symbol=${symbol} brief=${relatedBrief?.brief_id ?? "none"} holding=${holding ? "held" : "not-held"}`}
        className="card p1-panel asset-research-card p1-asset-handoff"
      >
        <div className="p1-section-heading">
          <div>
          <p className="eyebrow">{i18n.language === "zh-CN" ? "研究闭环" : "Research loop"}</p>
          <h3>{i18n.language === "zh-CN" ? "从当前资产开始研究" : "Start the brief from this asset"}</h3>
          </div>
          <span className={`mini-pill status-${asset.stale ? "cached" : "available"}`}>
            {asset.stale ? "cached" : "observed"}
          </span>
        </div>
        <DataStatusStrip
          ariaLabel={`asset-data-status symbol=${symbol} fundamentals=${asset.capabilities.fundamentals_status} filings=${asset.capabilities.filings_status} stale=${String(asset.stale)}`}
          items={[
            { label: "Data", value: dataStatusCopy.title, detail: dataStatusCopy.copy, tone: dataStatusCopy.tone },
            {
              label: "Portfolio",
              value: holding ? `${holding.quantity} ${symbol}` : "Not held",
              detail: holding ? "Local holding context is available for the Research handoff." : "Research can still create a portfolio handoff later.",
              tone: holding ? "observed" : "audited",
            },
            {
              label: "Brief",
              value: relatedBrief ? "Existing brief" : "Ready to create",
              detail: relatedBrief ? `Updated ${new Date(relatedBrief.updated_at).toLocaleString()}` : "Research will open or create a local brief for this symbol.",
              tone: relatedBrief ? "audited" : "observed",
            },
          ]}
        />
        {contextError ? <InlineState label={`Context fallback: ${contextError}`} /> : null}
        <div className="asset-next-actions">
          <button
            aria-label={`asset-open-research symbol=${symbol} brief=${relatedBrief?.brief_id ?? "auto"}`}
            className="primary-button"
            type="button"
            onClick={openResearchBrief}
          >
            {relatedBrief ? (i18n.language === "zh-CN" ? "打开研究简报" : "Open research brief") : (i18n.language === "zh-CN" ? "创建研究简报" : "Create research brief")}
          </button>
          <button
            aria-label={`asset-next-action action=evidence symbol=${symbol} state=${evidenceState}`}
            className="ghost-button"
            type="button"
            onClick={openResearchBrief}
          >
            {i18n.language === "zh-CN" ? "查看证据" : "Review evidence"}
          </button>
          <button
            aria-label={`asset-next-action action=report symbol=${symbol} state=${relatedBrief ? "ready" : "needs-brief"}`}
            className="ghost-button"
            type="button"
            onClick={openResearchBrief}
          >
            {i18n.language === "zh-CN" ? "准备报告" : "Prepare report"}
          </button>
          <button
            aria-label={`asset-next-action action=data-sources symbol=${symbol} source=${watchlistState}`}
            className="ghost-button"
            type="button"
            onClick={openDataSources}
          >
            {i18n.language === "zh-CN" ? "检查数据来源" : "Check data sources"}
          </button>
        </div>
        <p className="panel-note">
          {i18n.language === "zh-CN" ? "研究输出保留在本地。数据源凭证、Stronghold 数据、生成日志和实盘交易都不会进入本次资产交接。" : "Research outputs stay local. Provider credentials, Stronghold data, generated logs, and live trading remain outside this asset handoff."}
        </p>
      </section>
      ) : null}

      {routeSection === "assetFundamentals" ? (
      <section
        aria-label={`asset-capability symbol=${asset.asset.symbol} capability=fundamentals status=${asset.capabilities.fundamentals_status}`}
        className="card p1-panel ratios-card"
      >
        <div className="p1-section-heading">
          <div>
            <p className="eyebrow">{i18n.t("asset.fundamentals")}</p>
            <h3>{describeCoverageTitle(asset.capabilities.fundamentals_status, i18n.t("asset.fundamentalsAvailable"), i18n)}</h3>
          </div>
          <span className={`mini-pill status-${asset.capabilities.fundamentals_status}`}>
            {formatCoverageStatus(asset.capabilities.fundamentals_status, i18n)}
          </span>
        </div>
        {asset.overview ? (
          <>
            <div className="asset-overview-summary">
              <span>{i18n.t("asset.company")}</span>
              <strong>{asset.overview.company}</strong>
              <p>{asset.overview.summary}</p>
            </div>
            <div className="ratio-grid asset-ratio-grid">
            <div className="ratio-item">
              <span>{i18n.t("asset.sector")}</span>
              <strong>{asset.overview.sector ?? "N/A"}</strong>
              <p>{i18n.t("asset.metadataNote")}</p>
            </div>
            <div className="ratio-item">
              <span>{i18n.t("asset.marketCap")}</span>
              <strong>{asset.overview.market_cap ?? "N/A"}</strong>
              <p>{i18n.t("asset.overviewNote")}</p>
            </div>
            {asset.ratios.map((ratio) => (
              <div key={ratio.label} className="ratio-item">
                <span>{ratio.label}</span>
                <strong>{ratio.value}</strong>
                <p>{ratio.note}</p>
              </div>
            ))}
            </div>
          </>
        ) : (
          <InlineState label={fundamentalsMessage} />
        )}
      </section>
      ) : null}

      {routeSection === "assetFilings" ? (
      <section
        aria-label={`asset-capability symbol=${asset.asset.symbol} capability=filings status=${asset.capabilities.filings_status}`}
        className="card p1-panel filings-card"
      >
        <div className="p1-section-heading">
          <div>
            <p className="eyebrow">{i18n.t("asset.secFilings")}</p>
            <h3>{describeCoverageTitle(asset.capabilities.filings_status, i18n.t("asset.filingsAvailable"), i18n)}</h3>
          </div>
          <span className={`mini-pill status-${asset.capabilities.filings_status}`}>
            {formatCoverageStatus(asset.capabilities.filings_status, i18n)}
          </span>
        </div>
        {asset.filings.length > 0 ? (
          <div className="filings-list">
            {asset.filings.map((filing) => (
              <article key={`${filing.type}-${filing.filed_at}`} className="filing-item">
                <div className="filing-head">
                  <strong>{filing.type}</strong>
                  <span>{filing.filed_at}</span>
                </div>
                <p>{filing.headline}</p>
                <div className="filing-meta">
                  <span className="mini-pill">{filing.status}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <InlineState label={filingsMessage} />
        )}
      </section>
      ) : null}

      {routeSection === "assetData" ? (
        <section className="card p1-panel asset-data-page" aria-label={`asset-data-primary-task symbol=${symbol}`}>
          <div className="p1-section-heading"><div><p className="eyebrow">DATA / PROVENANCE</p><h3>数据覆盖与来源</h3></div><span className={`mini-pill status-${asset.stale ? "cached" : "available"}`}>{asset.stale ? "cached" : "observed"}</span></div>
          <DataStatusStrip ariaLabel={`asset-data-coverage symbol=${symbol}`} items={[
            { label: "Price", value: asset.stale ? "Cached" : "Observed", detail: `${asset.quote.provider} · ${new Date(asset.quote.as_of).toLocaleString()}`, tone: asset.stale ? "cached" : "observed" },
            { label: "Fundamentals", value: formatCoverageStatus(asset.capabilities.fundamentals_status, i18n), detail: fundamentalsMessage, tone: asset.capabilities.fundamentals_status === "available" ? "observed" : "blocked" },
            { label: "Filings", value: formatCoverageStatus(asset.capabilities.filings_status, i18n), detail: filingsMessage, tone: asset.capabilities.filings_status === "available" ? "observed" : "blocked" },
          ]} />
          <div className="holding-list">{asset.capabilities.notes.map((note, index) => <div className="holding-row" key={`${index}-${note}`}><div><strong>限制 {index + 1}</strong><span>{note}</span></div></div>)}</div>
          <div className="hero-actions"><button className="ghost-button" type="button" onClick={openDataSources}>打开数据源中心</button><button className="ghost-button" type="button" onClick={onRetry}>刷新当前资产数据</button></div>
        </section>
      ) : null}
    </div>
  );
}

function describeCoverageTitle(status: CoverageStatus, availableTitle: string, i18n: ReturnType<typeof useI18n>): string {
  switch (status) {
    case "available":
      return availableTitle;
    case "credential_required":
      return i18n.t("asset.credentialsRequired");
    case "temporarily_unavailable":
      return i18n.t("asset.coverageUnavailable");
    default:
      return i18n.t("asset.coverageUnsupported");
  }
}

function summarizeDataStatus(asset: AssetWorkspaceResponse): { title: string; copy: string; tone: NonNullable<DataStatusItem["tone"]> } {
  const statuses = [asset.capabilities.fundamentals_status, asset.capabilities.filings_status];
  if (asset.stale) {
    return {
      title: "Cached snapshot",
      copy: "This asset can still seed a brief, but the report should mention cached or stale data.",
      tone: "cached",
    };
  }
  if (statuses.includes("credential_required")) {
    return {
      title: "Credential gated",
      copy: "Some provider coverage needs local credentials before a refreshed brief can include it.",
      tone: "credential_required",
    };
  }
  if (statuses.includes("temporarily_unavailable")) {
    return {
      title: "Partially degraded",
      copy: "Supported coverage is temporarily unavailable; Research will preserve the observed state.",
      tone: "degraded",
    };
  }
  if (statuses.every((status) => status === "unsupported")) {
    return {
      title: "Limited coverage",
      copy: "The asset is available for price research, but fundamentals and filings are unsupported.",
      tone: "blocked",
    };
  }
  return {
    title: "Observed",
    copy: "Quote, provider state, and available source context are ready for a local research brief.",
    tone: "observed",
  };
}

function formatCoverageStatus(status: CoverageStatus, i18n: ReturnType<typeof useI18n>): string {
  switch (status) {
    case "available":
      return i18n.t("asset.available");
    case "credential_required":
      return i18n.t("asset.needCredentials");
    case "temporarily_unavailable":
      return i18n.t("asset.tempUnavailable");
    default:
      return i18n.t("asset.unsupported");
  }
}
