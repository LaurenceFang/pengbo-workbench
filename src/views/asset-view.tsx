import { useEffect, useMemo, useState } from "react";
import { api, type AssetWorkspaceResponse, type PriceHistoryInterval, type PricePoint, type WatchlistAssetSnapshot } from "../lib/api";
import { InlineState, KLineChartPanel, PanelState, formatPercent, formatPrice, formatSignedMoney } from "../components/shared";
import { useI18n } from "../i18n";

type CoverageStatus = AssetWorkspaceResponse["capabilities"]["fundamentals_status"];

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
}: {
  asset: AssetWorkspaceResponse | null;
  selectedAsset: WatchlistAssetSnapshot | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const i18n = useI18n();
  const [interval, setInterval] = useState<PriceHistoryInterval>(DEFAULT_INTERVAL);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [asset?.asset.symbol, interval]);
  const selectedIntervalLabel = useMemo(
    () => [...QUICK_INTERVALS, ...MORE_INTERVALS].find((item) => item.value === interval)?.label ?? interval,
    [interval],
  );

  if (loading) {
    return <PanelState title={i18n.t("asset.loadingTitle")} copy={i18n.t("asset.loadingCopy")} />;
  }

  if (error || !asset) {
    return (
      <PanelState
        title={i18n.t("asset.errorTitle")}
        copy={error ?? i18n.t("asset.errorCopy")}
        actionLabel={i18n.t("common.retry")}
        onAction={onRetry}
      />
    );
  }

  const fundamentalsMessage = asset.capabilities.fundamentals_message ?? asset.capabilities.notes[0] ?? i18n.t("asset.noFundamentals");
  const filingsMessage =
    asset.capabilities.filings_message ??
    (asset.capabilities.notes.join(" / ") || i18n.t("asset.noFilings"));
  const chartData = history.length ? history : asset.history;

  return (
    <div aria-label={`asset-workspace symbol=${asset.asset.symbol}`} className="asset-layout terminal-asset-layout">
      <section className="card hero-chart">
        <div className="card-header">
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
            {QUICK_INTERVALS.map((item) => (
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
              {MORE_INTERVALS.map((item) => (
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

      <section
        aria-label={`asset-capability symbol=${asset.asset.symbol} capability=fundamentals status=${asset.capabilities.fundamentals_status}`}
        className="card ratios-card"
      >
        <div className="card-header">
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

      <section
        aria-label={`asset-capability symbol=${asset.asset.symbol} capability=filings status=${asset.capabilities.filings_status}`}
        className="card filings-card"
      >
        <div className="card-header">
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
