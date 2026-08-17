import { PencilLine, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAsyncResource } from "../hooks/use-async-resource";
import { useAppStore } from "../store/app-store";
import {
  api,
  type AssetSearchResult,
  type PortfolioAnalyticsWindow,
  type PortfolioDataStatus,
  type PortfolioHolding,
  type PortfolioProvenanceItem,
  type PortfolioSummaryResponse,
  type PortfolioTransaction,
  type PortfolioTransactionInput,
  type WatchlistAssetSnapshot,
} from "../lib/api";
import {
  assetOptionLabel,
  groupAssetOptions,
  normalizeAssetOptions,
  watchlistToAssetOptions,
} from "../lib/asset-options";
import {
  InlineState,
  MetricCard,
  PanelState,
  ProfessionalChartPanel,
  DataStatusStrip,
  formatMoney,
  formatPercent,
  formatPrice,
  formatSignedMoney,
  type BackendStatus,
  type DataStatusItem,
} from "../components/shared";
import { useI18n, type TranslationKey } from "../i18n";
import { Badge, SegmentedControl } from "../components/ui-kit";

type PortfolioViewState = "connecting" | "empty" | "degraded" | "ready";
type AllocationGroupKey = "asset" | "asset_class" | "currency" | "market" | "sector";

export type PortfolioRouteSection =
  | "portfolioOverview"
  | "portfolioHoldings"
  | "portfolioAllocation"
  | "portfolioAnalytics"
  | "portfolioRisk"
  | "portfolioTransactions"
  | "portfolioTransactionNew"
  | "portfolioHandoff";

const windowLabels: Record<PortfolioAnalyticsWindow["key"], string> = {
  today: "Today",
  mtd: "MTD",
  ytd: "YTD",
  one_year: "1Y",
  max: "Max",
};

const allocationLabelKeys: Record<AllocationGroupKey, TranslationKey> = {
  asset: "portfolio.asset",
  asset_class: "portfolio.assetClass",
  currency: "portfolio.currency",
  market: "portfolio.market",
  sector: "portfolio.sector",
};

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function formatMaybeMoney(value: number | null, currency: string, fallback: string): string {
  return value === null ? fallback : formatMoney(value, currency);
}

function formatMaybeSignedMoney(value: number | null, currency: string, fallback: string): string {
  return value === null ? fallback : formatSignedMoney(value, currency);
}

function formatMaybePercent(value: number | null, fallback: string): string {
  return value === null ? fallback : formatPercent(value);
}

function formatMaybeNumber(value: number | null, digits: number, fallback: string): string {
  return value === null ? fallback : value.toFixed(digits);
}

function portfolioStatusLabel(status: PortfolioDataStatus, i18n: ReturnType<typeof useI18n>): string {
  if (status === "cached") {
    return i18n.t("portfolio.cached");
  }
  if (status === "unavailable") {
    return i18n.t("portfolio.unavailable");
  }
  return i18n.t("portfolio.live");
}

function buildHoldingSummary(holding: PortfolioHolding, i18n: ReturnType<typeof useI18n>): string {
  if (holding.valuation_status === "unavailable") {
    return i18n.t("portfolio.valuationUnavailable");
  }

  return [
    formatMaybeMoney(holding.current_price, holding.currency, i18n.t("portfolio.unavailable")),
    formatMaybePercent(holding.day_change_pct, i18n.t("portfolio.unavailable")),
    portfolioStatusLabel(holding.valuation_status, i18n),
  ].join(" | ");
}

function provenanceTone(status: PortfolioProvenanceItem["status"]): DataStatusItem["tone"] {
  if (status === "cached") {
    return "cached";
  }
  if (status === "unavailable") {
    return "blocked";
  }
  if (status === "audited") {
    return "audited";
  }
  return "observed";
}

function provenanceTile(item: PortfolioProvenanceItem): DataStatusItem {
  return {
    label: item.label,
    value: item.status,
    detail: [item.provider, item.source_id, item.detail].filter(Boolean).join(" / "),
    tone: provenanceTone(item.status),
  };
}

function getWindowTone(value: number | null): "up" | "down" | "neutral" {
  if (value === null || value === 0) {
    return "neutral";
  }
  return value > 0 ? "up" : "down";
}

export function PortfolioView({
  assetOptions,
  assetUniverse,
  onGlobalRefresh,
  backendStatus,
  routeSection,
}: {
  assetOptions: WatchlistAssetSnapshot[];
  assetUniverse: AssetSearchResult[];
  onGlobalRefresh: () => Promise<void>;
  backendStatus: BackendStatus;
  routeSection?: PortfolioRouteSection;
}) {
  const i18n = useI18n();
  const copy = portfolioCopy(i18n.language);
  const sidecarReady = backendStatus === "online";
  const legacyLayout = routeSection === undefined;
  const summaryEnabled =
    sidecarReady &&
    (legacyLayout ||
      routeSection === "portfolioOverview" ||
      routeSection === "portfolioAllocation" ||
      routeSection === "portfolioAnalytics" ||
      routeSection === "portfolioRisk");
  const holdingsEnabled = sidecarReady && (legacyLayout || routeSection === "portfolioHoldings");
  const transactionsEnabled = sidecarReady && (legacyLayout || routeSection === "portfolioTransactions");
  const summary = useAsyncResource<PortfolioSummaryResponse>(async () => api.getPortfolioSummary(), [], {
    enabled: summaryEnabled,
  });
  const holdings = useAsyncResource(async () => api.getPortfolioHoldings(), [], {
    enabled: holdingsEnabled,
  });
  const transactions = useAsyncResource(async () => api.getPortfolioTransactions(), [], {
    enabled: transactionsEnabled,
  });
  const [editing, setEditing] = useState<PortfolioTransaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedWindowKey, setSelectedWindowKey] = useState<PortfolioAnalyticsWindow["key"]>("max");
  const [allocationGroup, setAllocationGroup] = useState<AllocationGroupKey>("asset");
  const portfolioHandoffDraft = useAppStore((state) => state.portfolioHandoffDraft);
  const setPortfolioHandoffDraft = useAppStore((state) => state.setPortfolioHandoffDraft);
  const transactionAssetOptions = useMemo(
    () => normalizeAssetOptions(assetUniverse.length ? assetUniverse : watchlistToAssetOptions(assetOptions)),
    [assetOptions, assetUniverse],
  );
  const [form, setForm] = useState<PortfolioTransactionInput>({
    symbol: transactionAssetOptions[0]?.symbol ?? "AAPL",
    side: "buy",
    quantity: 1,
    price: 1,
    fees: 0,
    traded_at: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  useEffect(() => {
    if (!transactionAssetOptions.length) {
      return;
    }
    setForm((current) => (current.symbol ? current : { ...current, symbol: transactionAssetOptions[0].symbol }));
  }, [transactionAssetOptions]);

  useEffect(() => {
    if (routeSection !== "portfolioTransactions") {
      setEditing(null);
    }
  }, [routeSection]);

  useEffect(() => {
    if (
      !portfolioHandoffDraft ||
      (routeSection !== undefined &&
        routeSection !== "portfolioTransactionNew" &&
        routeSection !== "portfolioHandoff")
    ) {
      return;
    }

    setEditing(null);
    setForm({
      symbol: portfolioHandoffDraft.symbol,
      side: portfolioHandoffDraft.side,
      quantity: portfolioHandoffDraft.quantity,
      price: portfolioHandoffDraft.price,
      fees: portfolioHandoffDraft.fees,
      traded_at: portfolioHandoffDraft.traded_at,
      notes: portfolioHandoffDraft.notes ?? "",
    });
    setPortfolioHandoffDraft(null);
  }, [portfolioHandoffDraft, routeSection, setPortfolioHandoffDraft]);

  async function refreshPortfolio() {
    summary.reload();
    holdings.reload();
    transactions.reload();
    await onGlobalRefresh();
  }

  function startEdit(transaction: PortfolioTransaction) {
    setEditing(transaction);
    setForm({
      symbol: transaction.symbol,
      side: transaction.side,
      quantity: transaction.quantity,
      price: transaction.price,
      fees: transaction.fees,
      traded_at: transaction.traded_at,
      notes: transaction.notes ?? "",
    });
  }

  function resetForm() {
    setEditing(null);
    setForm({
      symbol: transactionAssetOptions[0]?.symbol ?? "AAPL",
      side: "buy",
      quantity: 1,
      price: 1,
      fees: 0,
      traded_at: new Date().toISOString().slice(0, 10),
      notes: "",
    });
  }

  async function handleSubmit() {
    const payload = {
      ...form,
      symbol: normalizeSymbol(form.symbol),
    };
    if (!payload.symbol) {
      window.alert(i18n.t("portfolio.symbolRequired"));
      return;
    }

    setBusy(true);
    try {
      if (editing) {
        await api.updatePortfolioTransaction(editing.id, payload);
      } else {
        await api.createPortfolioTransaction(payload);
      }
      resetForm();
      await refreshPortfolio();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(transactionId: number) {
    if (!window.confirm(i18n.t("portfolio.deleteConfirm"))) {
      return;
    }
    setBusy(true);
    try {
      await api.deletePortfolioTransaction(transactionId);
      if (editing?.id === transactionId) {
        resetForm();
      }
      await refreshPortfolio();
    } finally {
      setBusy(false);
    }
  }

  const hasTransactions = (transactions.data?.length ?? 0) > 0;
  const selectedWindow = summary.data?.analytics.windows.find((item) => item.key === selectedWindowKey);
  const allocationBuckets = summary.data?.analytics.allocation[allocationGroup] ?? [];
  const chartComparisons = useMemo(
    () => [
      ...((summary.data?.benchmarks["SPY"]?.length ?? 0) > 0
        ? [
            {
              label: `SPY (${portfolioStatusLabel(summary.data?.benchmark_status["SPY"] ?? "live", i18n)})`,
              points: summary.data?.benchmarks["SPY"] ?? [],
              variant: "primary" as const,
            },
          ]
        : []),
      ...((summary.data?.benchmarks["BTC/USDT"]?.length ?? 0) > 0
        ? [
            {
              label: `BTC/USDT (${portfolioStatusLabel(summary.data?.benchmark_status["BTC/USDT"] ?? "live", i18n)})`,
              points: summary.data?.benchmarks["BTC/USDT"] ?? [],
              variant: "secondary" as const,
            },
          ]
        : []),
    ],
    [summary.data],
  );

  const relevantLoading =
    (summaryEnabled && summary.loading && summary.data === null) ||
    (holdingsEnabled && holdings.loading && holdings.data === null) ||
    (transactionsEnabled && transactions.loading && transactions.data === null);
  const relevantError =
    (summaryEnabled ? summary.error : null) ||
    (holdingsEnabled ? holdings.error : null) ||
    (transactionsEnabled ? transactions.error : null);
  const relevantEmpty = legacyLayout
    ? !hasTransactions && transactions.error === null
    : routeSection === "portfolioHoldings"
      ? (holdings.data?.length ?? 0) === 0
      : routeSection === "portfolioTransactions"
        ? (transactions.data?.length ?? 0) === 0
        : summaryEnabled
          ? (summary.data?.positions ?? 0) === 0
          : false;

  const portfolioState: PortfolioViewState =
    !sidecarReady || relevantLoading
      ? "connecting"
      : relevantError !== null || (summaryEnabled && Boolean(summary.data?.degraded))
        ? "degraded"
        : relevantEmpty
          ? "empty"
          : "ready";

  const formDisabled = busy || !sidecarReady;
  const useManualSymbolInput = transactionAssetOptions.length === 0;
  const groupedTransactionAssets = groupAssetOptions(transactionAssetOptions);
  const renderedPortfolioStatus =
    portfolioState === "ready"
      ? summary.data?.stale
        ? "cached"
        : "live"
      : portfolioState === "degraded"
        ? "degraded"
        : portfolioState === "empty"
          ? "empty"
          : "connecting";
  const sectionCopy = portfolioSectionCopy(routeSection, i18n.language);

  return (
    <div
      aria-label={`portfolio-view state=${portfolioState}`}
      className="p2-page p2-portfolio-page portfolio-layout"
      data-portfolio-section={routeSection ?? "legacy"}
    >
      <header className="p2-page-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{sectionCopy.title}</h2>
          <p className="p2-page-description">{sectionCopy.description}</p>
        </div>
        <div className="p2-page-header-meta">
          <Badge tone={renderedPortfolioStatus === "live" ? "success" : renderedPortfolioStatus === "degraded" ? "warning" : "info"}>
            {copy.status[renderedPortfolioStatus]}
          </Badge>
          <span className="p2-header-count">{summary.data?.positions ?? 0} {copy.positions}</span>
        </div>
      </header>

      {legacyLayout || routeSection === "portfolioOverview" ? (
      <section
        className="card p2-section-card p2-primary-section portfolio-overview-card"
        data-primary-task={routeSection}
      >
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("portfolio.eyebrow")}</p>
            <h3>{i18n.t("portfolio.overviewTitle")}</h3>
          </div>
          <span
            aria-label={`portfolio-status-pill state=${renderedPortfolioStatus}`}
            className="mini-pill accent"
          >
            {renderedPortfolioStatus === "live"
              ? i18n.t("portfolio.live")
              : renderedPortfolioStatus === "cached"
                ? i18n.t("portfolio.cached")
                : renderedPortfolioStatus === "degraded"
                  ? i18n.t("portfolio.degradedStatus")
                  : renderedPortfolioStatus === "empty"
                    ? i18n.t("portfolio.emptyStatus")
                    : i18n.t("portfolio.connectingStatus")}
          </span>
        </div>
        {portfolioState === "connecting" ? (
          <PanelState
            title={i18n.t("portfolio.connectingTitle")}
            copy={i18n.t("portfolio.connectingCopy")}
          />
        ) : portfolioState === "empty" ? (
          <>
            <PanelState
              title={i18n.t("portfolio.emptyTitle")}
              copy={i18n.t("portfolio.emptyCopy")}
            />
            <div className="sample-state-grid" aria-label="portfolio-demo-sample state=sample-only">
              <div>
                <strong>{copy.sampleTitle}</strong>
                <span>{copy.sampleCopy}</span>
              </div>
              <div>
                <strong>AAPL / SPY / BTC</strong>
                <span>{copy.sampleBoundary}</span>
              </div>
            </div>
          </>
        ) : summary.data ? (
          <>
            {summary.data.notes.map((note) => (
              <div aria-label={`portfolio-note text=${note}`} key={note}>
                <InlineState label={note} actionLabel="重试" onAction={refreshPortfolio} />
              </div>
            ))}
            <div className="metric-grid">
              <MetricCard label={i18n.t("portfolio.currentValue")} value={formatMoney(summary.data.total_value, summary.data.currency)} />
              <MetricCard
                label={i18n.t("portfolio.totalPnl")}
                value={`${formatSignedMoney(summary.data.total_pnl, summary.data.currency)} (${formatPercent(
                  summary.data.total_pnl_pct,
                )})`}
                tone={summary.data.total_pnl >= 0 ? "up" : "down"}
              />
              <MetricCard
                label={i18n.t("portfolio.dailyPnl")}
                value={formatSignedMoney(summary.data.daily_pnl, summary.data.currency)}
                tone={summary.data.daily_pnl >= 0 ? "up" : "down"}
              />
              <MetricCard label={i18n.t("portfolio.positionCount")} value={String(summary.data.positions)} />
              <MetricCard label={copy.quality} value={summary.data.data_quality?.overall ?? copy.unknown} />
            </div>
            {summary.data.provenance.length ? (
              <DataStatusStrip
                ariaLabel={`portfolio-provenance-summary references=${summary.data.provenance.length}`}
                items={summary.data.provenance.slice(0, 5).map(provenanceTile)}
              />
            ) : null}
            <div className="curve-panel">
              {summary.data.performance.length > 0 ? (
                <ProfessionalChartPanel primary={summary.data.performance} comparisons={chartComparisons} />
              ) : (
                <InlineState
                  label={
                    summary.data.degraded
                      ? i18n.t("portfolio.chartUnavailableDegraded")
                      : i18n.t("portfolio.chartUnavailableEmpty")
                  }
                  actionLabel={i18n.t("common.retry")}
                  onAction={refreshPortfolio}
                />
              )}
            </div>
          </>
        ) : (
          <PanelState
            title={i18n.t("portfolio.summaryDegradedTitle")}
            copy={summary.error ?? i18n.t("portfolio.summaryDegradedCopy")}
            actionLabel={i18n.t("common.retry")}
            onAction={refreshPortfolio}
          />
        )}
      </section>
      ) : null}

      {legacyLayout || routeSection === "portfolioAnalytics" ? (
      <section className="card portfolio-analytics-card" data-primary-task={routeSection}>
        <div className="card-header">
          <div>
            <p className="eyebrow">{copy.analytics}</p>
            <h3>{i18n.t("portfolio.analyticsTitle")}</h3>
          </div>
        </div>
        {summary.data ? (
          <>
            <SegmentedControl
              options={summary.data.analytics.windows.map((item) => ({ value: item.key, label: localizedWindowLabel(item.key, i18n.language) }))}
              value={selectedWindowKey}
              onChange={(value) => setSelectedWindowKey(value as PortfolioAnalyticsWindow["key"])}
            />
            {selectedWindow ? (
              <div className="analytics-window-grid">
                <MetricCard
                  label={i18n.t("portfolio.windowReturn")}
                  value={formatMaybePercent(selectedWindow.total_return_pct, i18n.t("portfolio.unavailable"))}
                  tone={getWindowTone(selectedWindow.total_return_pct)}
                />
                <MetricCard
                  label={i18n.t("portfolio.maxDrawdown")}
                  value={formatMaybePercent(selectedWindow.max_drawdown_pct, i18n.t("portfolio.unavailable"))}
                  tone={selectedWindow.max_drawdown_pct !== null && selectedWindow.max_drawdown_pct < 0 ? "down" : "neutral"}
                />
                <MetricCard label={i18n.t("portfolio.annualVolatility")} value={formatMaybePercent(selectedWindow.volatility_pct, i18n.t("portfolio.unavailable"))} />
                <MetricCard label={copy.sharpeStyle} value={formatMaybeNumber(selectedWindow.sharpe_style, 2, i18n.t("portfolio.unavailable"))} />
                <MetricCard
                  label={`${i18n.t("portfolio.relative")} ${selectedWindow.benchmark_symbol ?? copy.benchmark}`}
                  value={formatMaybePercent(selectedWindow.benchmark_relative_return_pct, i18n.t("portfolio.unavailable"))}
                  tone={getWindowTone(selectedWindow.benchmark_relative_return_pct)}
                />
                <MetricCard label={i18n.t("portfolio.dataStatus")} value={portfolioStatusLabel(selectedWindow.status, i18n)} />
              </div>
            ) : null}
            <div className="analytics-pnl-strip">
              <span>{i18n.t("portfolio.averageCost")}</span>
              <strong>{formatSignedMoney(summary.data.analytics.pnl.realized_pnl, summary.data.currency)}</strong>
              <small>{i18n.t("portfolio.realized")}</small>
              <strong>{formatSignedMoney(summary.data.analytics.pnl.unrealized_pnl, summary.data.currency)}</strong>
              <small>{i18n.t("portfolio.unrealized")}</small>
            </div>
            {summary.data.analytics.notes.map((note) => (
              <InlineState key={note} label={note} />
            ))}
          </>
        ) : (
          <InlineState label={copy.analyticsEmpty} />
        )}
      </section>
      ) : null}

      {routeSection === "portfolioRisk" ? (
      <section className="card p2-risk-section" data-primary-task={routeSection}>
        <div className="card-header">
          <div>
            <p className="eyebrow">{copy.risk}</p>
            <h3>{sectionCopy.title}</h3>
          </div>
        </div>
        {summary.loading && summary.data === null ? (
          <InlineState label={i18n.t("portfolio.connectingCopy")} />
        ) : summary.error ? (
          <InlineState label={summary.error} actionLabel={i18n.t("common.retry")} onAction={refreshPortfolio} />
        ) : summary.data ? (
          <>
            <SegmentedControl
              options={summary.data.analytics.windows.map((item) => ({
                value: item.key,
                label: localizedWindowLabel(item.key, i18n.language),
              }))}
              value={selectedWindowKey}
              onChange={(value) => setSelectedWindowKey(value as PortfolioAnalyticsWindow["key"])}
            />
            <div className="analytics-window-grid">
              <MetricCard
                label={i18n.t("portfolio.maxDrawdown")}
                value={formatMaybePercent(selectedWindow?.max_drawdown_pct ?? null, i18n.t("portfolio.unavailable"))}
                tone={selectedWindow?.max_drawdown_pct !== null && (selectedWindow?.max_drawdown_pct ?? 0) < 0 ? "down" : "neutral"}
              />
              <MetricCard
                label={i18n.t("portfolio.annualVolatility")}
                value={formatMaybePercent(selectedWindow?.volatility_pct ?? null, i18n.t("portfolio.unavailable"))}
              />
              <MetricCard
                label={copy.concentration}
                value={formatMaybePercent(summary.data.analytics.concentration_pct, i18n.t("portfolio.unavailable"))}
              />
              <MetricCard label={copy.missingAssets} value={String(summary.data.missing_symbols.length)} />
              <MetricCard label={copy.quality} value={summary.data.data_quality?.overall ?? copy.unknown} />
            </div>
            {summary.data.analytics.notes.map((note) => (
              <InlineState key={note} label={note} />
            ))}
            {summary.data.provenance.length ? (
              <DataStatusStrip
                ariaLabel={`portfolio-risk-provenance references=${summary.data.provenance.length}`}
                items={summary.data.provenance.slice(0, 5).map(provenanceTile)}
              />
            ) : null}
          </>
        ) : (
          <InlineState label={copy.riskEmpty} />
        )}
      </section>
      ) : null}

      {legacyLayout || routeSection === "portfolioAllocation" ? (
      <section className="card" data-primary-task={routeSection}>
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("portfolio.allocationEyebrow")}</p>
            <h3>{i18n.t("portfolio.allocationTitle")}</h3>
          </div>
          {summary.data?.analytics.concentration_pct !== null && summary.data?.analytics.concentration_pct !== undefined ? (
            <span className="mini-pill">{copy.top} {summary.data.analytics.concentration_pct.toFixed(1)}%</span>
          ) : null}
        </div>
        <SegmentedControl
          options={(Object.keys(allocationLabelKeys) as AllocationGroupKey[]).map((key) => ({ value: key, label: i18n.t(allocationLabelKeys[key]) }))}
          value={allocationGroup}
          onChange={(value) => setAllocationGroup(value as AllocationGroupKey)}
        />
        <div className="allocation-list">
          {allocationBuckets.length === 0 ? (
            <InlineState label={i18n.t("portfolio.allocationEmpty")} />
          ) : (
            allocationBuckets.map((bucket) => (
              <div className="allocation-row" key={`${allocationGroup}-${bucket.key}`}>
                <div>
                  <strong>{bucket.label}</strong>
                  <span>{formatMoney(bucket.value, summary.data?.currency ?? "USD")}</span>
                </div>
                <div className="holding-bar">
                  <div style={{ width: `${Math.min(bucket.allocation, 100)}%` }} />
                </div>
                <span>{bucket.allocation.toFixed(1)}%</span>
              </div>
            ))
          )}
        </div>
      </section>
      ) : null}

      {legacyLayout ||
      routeSection === "portfolioTransactionNew" ||
      routeSection === "portfolioHandoff" ||
      (routeSection === "portfolioTransactions" && editing !== null) ? (
      <section className="card" data-primary-task={routeSection}>
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("portfolio.transactionsEyebrow")}</p>
            <h3>
              {routeSection === "portfolioHandoff"
                ? sectionCopy.title
                : editing
                  ? i18n.t("portfolio.editTransactionTitle")
                  : i18n.t("portfolio.addTransactionTitle")}
            </h3>
          </div>
          {editing ? (
            <button className="ghost-button" onClick={resetForm} type="button">
              {i18n.t("portfolio.reset")}
            </button>
          ) : null}
        </div>
        <div className="form-grid two-up">
          <label className="field">
            <span>{i18n.t("portfolio.symbol")}</span>
            {useManualSymbolInput ? (
              <input
                type="text"
                value={form.symbol}
                disabled={formDisabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, symbol: normalizeSymbol(event.target.value) }))
                }
              />
            ) : (
              <select
                value={form.symbol}
                disabled={formDisabled}
                onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value }))}
              >
                {groupedTransactionAssets.map((group) => (
                  <optgroup key={group.category.key} label={localizedAssetCategoryLabel(group.category.key, i18n.language)}>
                    {group.options.map((item) => (
                      <option key={item.symbol} value={item.symbol}>
                        {assetOptionLabel(item)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </label>
          <label className="field">
            <span>{i18n.t("portfolio.side")}</span>
            <select
              value={form.side}
              disabled={formDisabled}
              onChange={(event) => setForm((current) => ({ ...current, side: event.target.value as "buy" | "sell" }))}
            >
              <option value="buy">{i18n.t("portfolio.buy")}</option>
              <option value="sell">{i18n.t("portfolio.sell")}</option>
            </select>
          </label>
          <label className="field">
            <span>{i18n.t("portfolio.quantity")}</span>
            <input
              min={0}
              step="any"
              type="number"
              disabled={formDisabled}
              value={form.quantity}
              onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) }))}
            />
          </label>
          <label className="field">
            <span>{i18n.t("portfolio.price")}</span>
            <input
              min={0}
              step="any"
              type="number"
              disabled={formDisabled}
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: Number(event.target.value) }))}
            />
          </label>
          <label className="field">
            <span>{i18n.t("portfolio.fees")}</span>
            <input
              min={0}
              step="any"
              type="number"
              disabled={formDisabled}
              value={form.fees}
              onChange={(event) => setForm((current) => ({ ...current, fees: Number(event.target.value) }))}
            />
          </label>
          <label className="field">
            <span>{i18n.t("portfolio.tradeDate")}</span>
            <input
              type="date"
              disabled={formDisabled}
              value={form.traded_at}
              onChange={(event) => setForm((current) => ({ ...current, traded_at: event.target.value }))}
            />
          </label>
          <label className="field wide">
            <span>{i18n.t("portfolio.notes")}</span>
            <textarea
              rows={3}
              disabled={formDisabled}
              value={form.notes ?? ""}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
        </div>
        <div className="form-actions">
          <button
            aria-label={`portfolio-transaction-submit mode=${editing ? "edit" : "add"} enabled=${String(!formDisabled)}`}
            className="primary-button"
            disabled={formDisabled}
            onClick={handleSubmit}
            type="button"
          >
            {editing ? <Save size={16} /> : <Plus size={16} />}
            {busy ? i18n.t("portfolio.saving") : editing ? i18n.t("portfolio.saveTransaction") : i18n.t("portfolio.addTransaction")}
          </button>
        </div>
        {useManualSymbolInput ? (
          <InlineState label={i18n.t("portfolio.manualSymbol")} />
        ) : null}
        {!sidecarReady ? <InlineState label={i18n.t("portfolio.serviceLocked")} /> : null}
      </section>
      ) : null}

      {legacyLayout || routeSection === "portfolioHoldings" ? (
      <section className="card" data-primary-task={routeSection}>
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("portfolio.holdingsEyebrow")}</p>
            <h3>{i18n.t("portfolio.holdingsTitle")}</h3>
          </div>
        </div>
        <div className="holding-list">
          {portfolioState === "connecting" ? (
            <InlineState label={i18n.t("portfolio.holdingsLoading")} />
          ) : holdings.error ? (
            <InlineState label={holdings.error} actionLabel={i18n.t("common.retry")} onAction={refreshPortfolio} />
          ) : (holdings.data ?? []).length === 0 ? (
            <InlineState
              label={
                hasTransactions
                  ? i18n.t("portfolio.holdingsEmptyWithTransactions")
                  : i18n.t("portfolio.holdingsEmpty")
              }
            />
          ) : (
            (holdings.data ?? []).map((holding) => (
              <div
                aria-label={`portfolio-holding symbol=${holding.symbol} valuation=${holding.valuation_status}`}
                key={holding.symbol}
                className="holding-row"
              >
                <div>
                  <strong>{holding.symbol}</strong>
                  <span>{holding.name}</span>
                  <span>{buildHoldingSummary(holding, i18n)}</span>
                  {holding.notes.map((note) => (
                    <span key={note}>{note}</span>
                  ))}
                  {holding.data_quality ? <span>{copy.quality}: {holding.data_quality.overall}</span> : null}
                  {holding.provenance.length ? (
                    <div className="compact-provenance-list">
                      {holding.provenance.map((item) => (
                        <span key={`${holding.symbol}-${item.source_id ?? item.label}`}>
                          {item.label}: {item.status}
                          {item.source_id ? ` / ${item.source_id}` : ""}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="holding-bar">
                  <div style={{ width: `${holding.allocation ?? 0}%` }} />
                </div>
                <div className="holding-meta">
                  <span>{holding.allocation === null ? i18n.t("portfolio.unavailable") : `${holding.allocation.toFixed(1)}%`}</span>
                  <span className={holding.pnl !== null && holding.pnl >= 0 ? "delta-up" : "delta-down"}>
                    {formatMaybeSignedMoney(holding.pnl, holding.currency, i18n.t("portfolio.unavailable"))}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      ) : null}

      {legacyLayout || (routeSection === "portfolioTransactions" && editing === null) ? (
      <section className="card" data-primary-task={routeSection}>
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("portfolio.historyEyebrow")}</p>
            <h3>{i18n.t("portfolio.historyTitle")}</h3>
          </div>
        </div>
        <div className="table-list">
          {portfolioState === "connecting" ? (
            <InlineState label={i18n.t("portfolio.historyLoading")} />
          ) : transactions.error ? (
            <InlineState label={transactions.error} actionLabel={i18n.t("common.retry")} onAction={refreshPortfolio} />
          ) : (
            (transactions.data ?? []).map((transaction) => (
              <div
                aria-label={`portfolio-transaction-row symbol=${transaction.symbol} id=${transaction.id}`}
                key={transaction.id}
                className="table-row"
              >
                <div className="table-main">
                  <strong>{transaction.symbol}</strong>
                  <span>
                    {transaction.side === "buy" ? i18n.t("portfolio.buy") : i18n.t("portfolio.sell")} {transaction.quantity} @{" "}
                    {formatPrice(transaction.price, transaction.currency, transaction.asset_class)}
                  </span>
                </div>
                <div className="table-meta">
                  <span>{transaction.traded_at}</span>
                  <button className="icon-button" disabled={formDisabled} onClick={() => startEdit(transaction)} type="button">
                    <PencilLine size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    disabled={formDisabled}
                    onClick={() => handleDelete(transaction.id)}
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      ) : null}
    </div>
  );
}

function localizedWindowLabel(key: PortfolioAnalyticsWindow["key"], language: "zh-CN" | "en-US"): string {
  if (language === "zh-CN") {
    return { today: "今日", mtd: "本月", ytd: "今年", one_year: "1 年", max: "全部" }[key];
  }
  return windowLabels[key];
}

function localizedAssetCategoryLabel(key: string, language: "zh-CN" | "en-US"): string {
  if (language === "zh-CN") {
    return { usMarket: "美股 / ETF", leveragedNasdaq: "三倍做多纳指", crypto: "加密货币" }[key] ?? key;
  }
  return { usMarket: "US stocks / ETFs", leveragedNasdaq: "3x Nasdaq long", crypto: "Crypto" }[key] ?? key;
}

function portfolioSectionCopy(routeSection: PortfolioRouteSection | undefined, language: "zh-CN" | "en-US") {
  const zh = language === "zh-CN";
  const sections: Record<PortfolioRouteSection, { title: string; description: string }> = {
    portfolioOverview: {
      title: zh ? "组合总览" : "Portfolio overview",
      description: zh ? "集中复核组合价值、损益、数据质量和表现曲线。" : "Review portfolio value, P&L, data quality, and the performance curve.",
    },
    portfolioHoldings: {
      title: zh ? "持仓" : "Holdings",
      description: zh ? "逐项检查当前持仓、权重、估值状态和来源。" : "Inspect current positions, weights, valuation status, and provenance.",
    },
    portfolioAllocation: {
      title: zh ? "配置与集中度" : "Allocation and concentration",
      description: zh ? "按资产、类别、币种、市场和行业检查组合配置。" : "Review allocation by asset, class, currency, market, and sector.",
    },
    portfolioAnalytics: {
      title: zh ? "收益与分析" : "Performance analytics",
      description: zh ? "按时间窗口复核收益、回撤、波动率和基准相对表现。" : "Review returns, drawdown, volatility, and benchmark-relative performance by window.",
    },
    portfolioRisk: {
      title: zh ? "风险" : "Risk",
      description: zh ? "集中检查回撤、波动率、集中度、缺失资产和数据质量。" : "Review drawdown, volatility, concentration, missing assets, and data quality.",
    },
    portfolioTransactions: {
      title: zh ? "交易记录" : "Transaction history",
      description: zh ? "查看、修改或删除保存在本地的组合交易记录。" : "Review, edit, or delete locally stored portfolio transactions.",
    },
    portfolioTransactionNew: {
      title: zh ? "新增交易" : "Add transaction",
      description: zh ? "单独录入一笔本地组合交易。" : "Record one local portfolio transaction.",
    },
    portfolioHandoff: {
      title: zh ? "持仓研究交接" : "Holding research handoff",
      description: zh ? "复核研究交接内容，并将确认后的交易保存到本地组合。" : "Review the research handoff and save the confirmed transaction locally.",
    },
  };

  return routeSection
    ? sections[routeSection]
    : {
        title: zh ? "组合总览" : "Portfolio overview",
        description: zh
          ? "在一个工作区复核敞口、表现、来源、配置和本地交易历史。"
          : "Review exposure, performance, provenance, allocation, and local transaction history in one workspace.",
      };
}

function portfolioCopy(language: "zh-CN" | "en-US") {
  const zh = language === "zh-CN";
  return {
    eyebrow: zh ? "投资组合 / 复核" : "Portfolio / Review",
    description: zh ? "在一个工作区复核敞口、表现、来源、配置和本地交易历史。" : "Review exposure, performance, provenance, and local transaction history in one workspace.",
    positions: zh ? "个持仓" : "positions",
    quality: zh ? "质量" : "Quality",
    unknown: zh ? "未知" : "unknown",
    analytics: zh ? "分析" : "Analytics",
    analyticsEmpty: zh ? "汇总可用后，这里会显示组合分析。" : "Portfolio analytics will appear after the summary is available.",
    sharpeStyle: zh ? "Sharpe 风格" : "Sharpe-style",
    benchmark: zh ? "基准" : "Benchmark",
    top: zh ? "前" : "Top",
    risk: zh ? "风险复核" : "Risk review",
    concentration: zh ? "最高集中度" : "Top concentration",
    missingAssets: zh ? "缺失估值资产" : "Missing valuations",
    riskEmpty: zh ? "组合汇总可用后，这里会显示风险指标。" : "Risk metrics will appear after the portfolio summary is available.",
    sampleTitle: zh ? "示例组合预览" : "Sample portfolio preview",
    sampleCopy: zh ? "保存真实本地交易前，可用示例资产组合了解持仓、配置和风险。" : "Use the sample asset mix to understand holdings, allocation, and risk before saving real local transactions.",
    sampleBoundary: zh ? "仅为示例；不会使用私人账户状态、提供商凭证或真实订单。" : "Sample only; no private account state, provider credentials, or live orders are used.",
    status: { live: zh ? "实时" : "Live", cached: zh ? "缓存" : "Cached", degraded: zh ? "降级" : "Degraded", empty: zh ? "空" : "Empty", connecting: zh ? "连接中" : "Connecting" },
  };
}
