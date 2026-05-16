import { Activity, LifeBuoy, RefreshCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  ColorType,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from "lightweight-charts";
import { useI18n } from "../i18n";

export type BackendStatus = "connecting" | "online" | "offline";

export function PulseCard({
  item,
}: {
  item: {
    label: string;
    symbol: string;
    value: number;
    change_pct: number;
    currency: string;
    tone: "up" | "down" | "neutral";
  };
}) {
  return (
    <article className="pulse-card">
      <span>{item.label}</span>
      <strong>{formatPrice(item.value, item.currency, item.symbol.includes("/") ? "crypto" : "macro")}</strong>
      <small className={`tone-${item.tone}`}>{formatPercent(item.change_pct)}</small>
    </article>
  );
}

export function StatusBadge({
  status,
  note,
  onRestart,
  restarting,
  canRestart,
  onExportDiagnostics,
  exportingDiagnostics = false,
  canExportDiagnostics = false,
  labels,
}: {
  status: BackendStatus;
  note: string;
  onRestart: () => void;
  restarting: boolean;
  canRestart: boolean;
  onExportDiagnostics?: () => void;
  exportingDiagnostics?: boolean;
  canExportDiagnostics?: boolean;
  labels?: {
    online: string;
    offline: string;
    connecting: string;
    restart: string;
    restarting: string;
    exportDiagnostics: string;
    exporting: string;
  };
}) {
  const statusLabel =
    status === "online"
      ? labels?.online ?? "Local service online"
      : status === "offline"
        ? labels?.offline ?? "Local service offline"
        : labels?.connecting ?? "Connecting";

  return (
    <div className={`status-badge ${status}`}>
      <span className="status-dot" />
      <div>
        <strong>{statusLabel}</strong>
        <small>{note}</small>
      </div>
      {canRestart ? (
        <button className="text-button" disabled={restarting} onClick={onRestart} type="button">
          <RefreshCcw size={14} />
          {restarting ? labels?.restarting ?? "Restarting..." : labels?.restart ?? "Restart"}
        </button>
      ) : null}
      {canExportDiagnostics && onExportDiagnostics ? (
        <button className="text-button" disabled={exportingDiagnostics} onClick={onExportDiagnostics} type="button">
          <LifeBuoy size={14} />
          {exportingDiagnostics ? labels?.exporting ?? "Exporting..." : labels?.exportDiagnostics ?? "Export diagnostics"}
        </button>
      ) : null}
    </div>
  );
}

export function InlineState({
  label,
  actionLabel,
  onAction,
}: {
  label: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}) {
  return (
    <div className="task-item">
      <Activity size={16} />
      <span>{label}</span>
      {actionLabel && onAction ? (
        <button className="text-button" onClick={() => void onAction()} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function PanelState({
  title,
  copy,
  actionLabel,
  onAction,
}: {
  title: string;
  copy: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
}) {
  const i18n = useI18n();
  return (
    <div className="stack-layout">
      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("common.status")}</p>
            <h3>{title}</h3>
          </div>
        </div>
        <p className="body-copy">{copy}</p>
        {actionLabel && onAction ? (
          <button className="ghost-button" onClick={() => void onAction()} type="button">
            {actionLabel}
          </button>
        ) : null}
      </section>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong className={`tone-${tone}`}>{value}</strong>
    </div>
  );
}

export function SettingRow({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="setting-item">
      <div>
        <strong>{label}</strong>
        <p>{helper}</p>
      </div>
      <span className="setting-value mono">{value}</span>
    </div>
  );
}

export function MiniTrend({ trend, dense = false }: { trend: number[]; dense?: boolean }) {
  if (trend.length === 0) {
    return null;
  }
  const width = 200;
  const height = dense ? 72 : 48;
  const min = Math.min(...trend);
  const max = Math.max(...trend);
  const range = Math.max(max - min, 1);
  const points = trend
    .map((value, index) => {
      const x = (index / Math.max(trend.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className={`mini-trend ${dense ? "dense" : ""}`} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" points={points} stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export function ChartPanel({
  data,
  comparisons = [],
}: {
  data: number[];
  comparisons?: Array<{ label: string; data: number[]; variant?: "primary" | "secondary" }>;
}) {
  const i18n = useI18n();
  if (data.length === 0) {
    return <InlineState label={i18n.t("common.noChartData")} />;
  }

  const width = 680;
  const height = 260;
  const all = [data, ...comparisons.map((item) => item.data)].flat();
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = Math.max(max - min, 1);

  const buildPath = (series: number[]) =>
    series
      .map((value, index) => {
        const x = (index / Math.max(series.length - 1, 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

  const gradientArea = `${buildPath(data)} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="chart-panel">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg">
        <defs>
          <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(112, 243, 193, 0.42)" />
            <stop offset="100%" stopColor="rgba(112, 243, 193, 0.02)" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((index) => (
          <line
            key={index}
            className="chart-grid-line"
            x1="0"
            x2={width}
            y1={(height / 4) * index}
            y2={(height / 4) * index}
          />
        ))}
        <path d={gradientArea} fill="url(#chart-fill)" />
        {comparisons.map((comparison) => (
          <path
            key={comparison.label}
            className={`chart-comparison ${comparison.variant === "secondary" ? "secondary" : ""}`}
            d={buildPath(comparison.data)}
          />
        ))}
        <path className="chart-primary" d={buildPath(data)} />
      </svg>
      <div className="chart-legend">
        <span>
          <i className="legend-swatch primary" />
          {i18n.t("common.primarySeries")}
        </span>
        {comparisons.map((comparison) => (
          <span key={comparison.label}>
            <i className={`legend-swatch comparison ${comparison.variant === "secondary" ? "secondary" : ""}`} />
            {comparison.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProfessionalChartPanel({
  primary,
  comparisons = [],
}: {
  primary: Array<{ date: string; value: number }>;
  comparisons?: Array<{
    label: string;
    points: Array<{ date: string; value: number }>;
    variant?: "primary" | "secondary";
  }>;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || primary.length === 0) {
      return;
    }

    const chart = createChart(container, {
      height: 300,
      layout: {
        background: { type: ColorType.Solid, color: "rgba(5, 11, 19, 0.2)" },
        textColor: "rgba(223, 235, 250, 0.72)",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(255, 255, 255, 0.12)" },
      timeScale: { borderColor: "rgba(255, 255, 255, 0.12)" },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const series: Array<ISeriesApi<"Line">> = [];
    const primarySeries = chart.addLineSeries({
      color: "#70f3c1",
      lineWidth: 3,
      priceLineVisible: false,
    });
    primarySeries.setData(primary.map((point) => ({ time: point.date as Time, value: point.value }) satisfies LineData));
    series.push(primarySeries);

    comparisons.forEach((comparison) => {
      if (comparison.points.length === 0) {
        return;
      }
      const comparisonSeries = chart.addLineSeries({
        color: comparison.variant === "secondary" ? "#ffe48b" : "#9fdaff",
        lineWidth: 2,
        priceLineVisible: false,
      });
      comparisonSeries.setData(
        comparison.points.map((point) => ({ time: point.date as Time, value: point.value }) satisfies LineData),
      );
      series.push(comparisonSeries);
    });

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) {
        chart.applyOptions({ width });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      series.forEach((item) => chart.removeSeries(item));
      chart.remove();
      chartRef.current = null;
    };
  }, [comparisons, primary]);

  if (primary.length === 0) {
    return <ChartPanel data={[]} />;
  }

  return (
    <div className="professional-chart-panel">
      <div aria-label="portfolio-professional-chart" className="professional-chart-canvas" ref={containerRef} />
      <div className="chart-legend">
        <span>
          <i className="legend-swatch primary" />
          Portfolio
        </span>
        {comparisons.map((comparison) => (
          <span key={comparison.label}>
            <i className={`legend-swatch comparison ${comparison.variant === "secondary" ? "secondary" : ""}`} />
            {comparison.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function KLineChartPanel({
  data,
  legend = "K line",
}: {
  data: Array<{ timestamp: string; open?: number | null; high?: number | null; low?: number | null; close: number; volume: number }>;
  legend?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const bars = data
      .filter((point) => point.close !== null && point.close !== undefined)
      .map((point) => {
        const close = Number(point.close);
        return {
          time: toChartTime(point.timestamp),
          open: Number(point.open ?? close),
          high: Number(point.high ?? point.open ?? close),
          low: Number(point.low ?? point.open ?? close),
          close,
        } satisfies CandlestickData;
      });
    if (!container || bars.length === 0) {
      return;
    }

    const chart = createChart(container, {
      height: 300,
      layout: {
        background: { type: ColorType.Solid, color: "rgba(5, 11, 19, 0.2)" },
        textColor: "rgba(223, 235, 250, 0.72)",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        horzLines: { color: "rgba(255, 255, 255, 0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(255, 255, 255, 0.12)" },
      timeScale: { borderColor: "rgba(255, 255, 255, 0.12)" },
      crosshair: { mode: 0 },
    });
    const series = chart.addCandlestickSeries({
      upColor: "#70f3c1",
      downColor: "#ff8f8f",
      borderUpColor: "#70f3c1",
      borderDownColor: "#ff8f8f",
      wickUpColor: "#70f3c1",
      wickDownColor: "#ff8f8f",
    });
    series.setData(bars);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) {
        chart.applyOptions({ width });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.removeSeries(series);
      chart.remove();
    };
  }, [data]);

  if (data.length === 0) {
    return <ChartPanel data={[]} />;
  }

  return (
    <div className="professional-chart-panel">
      <div aria-label="asset-kline-chart" className="professional-chart-canvas" ref={containerRef} />
      <div className="chart-legend">
        <span>
          <i className="legend-swatch primary" />
          {legend}
        </span>
      </div>
    </div>
  );
}

function toChartTime(timestamp: string): Time {
  if (timestamp.includes("T")) {
    return Math.floor(Date.parse(timestamp) / 1000) as Time;
  }
  return timestamp as Time;
}

export function formatPrice(value: number, currency: string, assetClass: string): string {
  const symbol = currency === "USD" || currency === "USDT" ? "$" : `${currency} `;
  const decimals = assetClass === "crypto" ? 2 : 2;
  return `${symbol}${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatMoney(value: number, currency: string): string {
  return formatPrice(value, currency, "equity");
}

export function formatSignedMoney(value: number, currency: string): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatMoney(Math.abs(value), currency)}`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value.toFixed(2)}%`;
}
