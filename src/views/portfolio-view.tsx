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
  formatMoney,
  formatPercent,
  formatPrice,
  formatSignedMoney,
  type BackendStatus,
} from "../components/shared";
import { useI18n, type TranslationKey } from "../i18n";

type PortfolioViewState = "connecting" | "empty" | "degraded" | "ready";
type AllocationGroupKey = "asset" | "asset_class" | "currency" | "market" | "sector";

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
}: {
  assetOptions: WatchlistAssetSnapshot[];
  assetUniverse: AssetSearchResult[];
  onGlobalRefresh: () => Promise<void>;
  backendStatus: BackendStatus;
}) {
  const i18n = useI18n();
  const sidecarReady = backendStatus === "online";
  const summary = useAsyncResource<PortfolioSummaryResponse>(async () => api.getPortfolioSummary(), [], {
    enabled: sidecarReady,
  });
  const holdings = useAsyncResource(async () => api.getPortfolioHoldings(), [], {
    enabled: sidecarReady,
  });
  const transactions = useAsyncResource(async () => api.getPortfolioTransactions(), [], {
    enabled: sidecarReady,
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
    if (!portfolioHandoffDraft) {
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
  }, [portfolioHandoffDraft, setPortfolioHandoffDraft]);

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

  const portfolioState: PortfolioViewState =
    !sidecarReady ||
    ((summary.loading && summary.data === null) ||
      (holdings.loading && holdings.data === null) ||
      (transactions.loading && transactions.data === null))
      ? "connecting"
      : !hasTransactions && transactions.error === null
        ? "empty"
        : summary.error !== null || holdings.error !== null || transactions.error !== null || Boolean(summary.data?.degraded)
          ? "degraded"
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

  return (
    <div aria-label={`portfolio-view state=${portfolioState}`} className="portfolio-layout">
      <section className="card portfolio-overview-card">
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
                <strong>{i18n.t("portfolio.sampleTitle")}</strong>
                <span>{i18n.t("portfolio.sampleCopy")}</span>
              </div>
              <div>
                <strong>AAPL / SPY / BTC</strong>
                <span>{i18n.t("portfolio.sampleBoundary")}</span>
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
              <MetricCard label="Quality" value={summary.data.data_quality?.overall ?? "unknown"} />
            </div>
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

      <section className="card portfolio-analytics-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Analytics</p>
            <h3>{i18n.t("portfolio.analyticsTitle")}</h3>
          </div>
        </div>
        {summary.data ? (
          <>
            <div className="segmented-control" aria-label="portfolio-analytics-window-tabs">
              {summary.data.analytics.windows.map((item) => (
                <button
                  aria-label={`portfolio-window key=${item.key} status=${item.status}`}
                  className={item.key === selectedWindowKey ? "active" : ""}
                  key={item.key}
                  onClick={() => setSelectedWindowKey(item.key)}
                  type="button"
                >
                  {windowLabels[item.key]}
                </button>
              ))}
            </div>
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
                <MetricCard label="Sharpe-style" value={formatMaybeNumber(selectedWindow.sharpe_style, 2, i18n.t("portfolio.unavailable"))} />
                <MetricCard
                  label={`${i18n.t("portfolio.relative")} ${selectedWindow.benchmark_symbol ?? "Benchmark"}`}
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
          <InlineState label={i18n.t("portfolio.analyticsEmpty")} />
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("portfolio.allocationEyebrow")}</p>
            <h3>{i18n.t("portfolio.allocationTitle")}</h3>
          </div>
          {summary.data?.analytics.concentration_pct !== null && summary.data?.analytics.concentration_pct !== undefined ? (
            <span className="mini-pill">Top {summary.data.analytics.concentration_pct.toFixed(1)}%</span>
          ) : null}
        </div>
        <div className="segmented-control" aria-label="portfolio-allocation-tabs">
          {(Object.keys(allocationLabelKeys) as AllocationGroupKey[]).map((key) => (
            <button
              className={allocationGroup === key ? "active" : ""}
              key={key}
              onClick={() => setAllocationGroup(key)}
              type="button"
            >
              {i18n.t(allocationLabelKeys[key])}
            </button>
          ))}
        </div>
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

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("portfolio.transactionsEyebrow")}</p>
            <h3>{editing ? i18n.t("portfolio.editTransactionTitle") : i18n.t("portfolio.addTransactionTitle")}</h3>
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
                  <optgroup key={group.category.key} label={group.category.label}>
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

      <section className="card">
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
                  {holding.data_quality ? <span>Quality: {holding.data_quality.overall}</span> : null}
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

      <section className="card">
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
    </div>
  );
}
