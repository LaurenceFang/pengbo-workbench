import { FlaskConical, LineChart, RefreshCcw, Search, Send } from "lucide-react";
import { useMemo, useState } from "react";
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

function formatBucket(bucket: FactorResult["bucket"]): string {
  switch (bucket) {
    case "leader":
      return "Leader";
    case "candidate":
      return "Candidate";
    case "watch":
      return "Watch";
    default:
      return "Insufficient";
  }
}

function metricValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return value;
}

export function FactorLabView({
  backendStatus,
}: {
  backendStatus: BackendStatus;
}) {
  const sidecarReady = backendStatus === "online";
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const lastFactorRunResult = useAppStore((state) => state.lastFactorRunResult);
  const selectedFactorRunId = useAppStore((state) => state.selectedFactorRunId);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const setSelectedAssetId = useAppStore((state) => state.setSelectedAssetId);
  const setSelectedResearchBriefId = useAppStore((state) => state.setSelectedResearchBriefId);
  const setSelectedFactorRunId = useAppStore((state) => state.setSelectedFactorRunId);
  const setLastFactorRunResult = useAppStore((state) => state.setLastFactorRunResult);
  const setLatestCommandFeedback = useAppStore((state) => state.setLatestCommandFeedback);

  const families = useAsyncResource(async () => api.getFactorFamilies(), [], { enabled: sidecarReady });
  const recentRuns = useAsyncResource(async () => api.getRecentFactorRuns(20), [], { enabled: sidecarReady });
  const [universeSource, setUniverseSource] = useState<ScreenerUniverseSource>("expanded");
  const [family, setFamily] = useState<FactorFamilyKey>("composite");
  const [assetType, setAssetType] = useState<"equity" | "etf" | "index" | "crypto">("crypto");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const activeRun = lastFactorRunResult;
  const selectedResult =
    activeRun?.results.find((item) => item.symbol === selectedAssetId) ?? activeRun?.results[0] ?? null;
  const familyLookup = useMemo<Record<string, FactorFamilyDefinition>>(
    () => Object.fromEntries((families.data ?? []).map((item) => [item.key, item])),
    [families.data],
  );

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
      setActionMessage(`Factor run ${result.run_id} completed.`);
      recentRuns.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to run Factor Lab.");
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
      setActionError(error instanceof Error ? error.message : "Failed to open factor run.");
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
        title: `Opened research for ${result.symbol}`,
        detail: `Brief ${brief.brief_id} includes factor run ${activeRun.run_id}.`,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create research brief.");
    } finally {
      setBusy(false);
    }
  }

  if (!sidecarReady) {
    return (
      <PanelState
        title="Factor Lab is waiting for the local sidecar"
        copy="Once the desktop runtime is healthy again, local factor runs and saved snapshots will become available."
      />
    );
  }

  return (
    <div className="stack-layout">
      <section
        aria-label={`factor-lab-view state=${activeRun ? "ready" : "empty"} run=${selectedFactorRunId ?? "none"}`}
        className="card"
      >
        <div className="card-header">
          <div>
            <p className="eyebrow">Factor Lab</p>
            <h3>Local factor evidence, rankings, diagnostics, and research handoff</h3>
          </div>
          <button aria-label="factor-lab-refresh" className="ghost-button" onClick={() => recentRuns.reload()} type="button">
            <RefreshCcw size={16} />
            Reload
          </button>
        </div>

        <div className="factor-lab-control-grid">
          <div className="research-panel">
            <div className="screeners-column-head">
              <div>
                <p className="eyebrow">Run Setup</p>
                <strong>Controlled research universe</strong>
              </div>
              <span className="mini-pill">research-only</span>
            </div>
            <label className="field">
              <span>Universe</span>
              <select value={universeSource} onChange={(event) => setUniverseSource(event.target.value as ScreenerUniverseSource)}>
                <option value="expanded">Expanded</option>
                <option value="catalog">Catalog</option>
              </select>
            </label>
            <label className="field">
              <span>Asset type</span>
              <select value={assetType} onChange={(event) => setAssetType(event.target.value as typeof assetType)}>
                {ASSET_TYPE_OPTIONS.map((item) => (
                  <option value={item.value} key={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Family</span>
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
              {busy ? "Running..." : "Run Factor Lab"}
            </button>
            {families.data?.find((item) => item.key === family) ? (
              <p className="panel-note">
                {familyLookup[family]?.simple_description} {familyLookup[family]?.research_only_note}
              </p>
            ) : null}
          </div>

          <div className="research-panel">
            <div className="screeners-column-head">
              <div>
                <p className="eyebrow">Recent</p>
                <strong>Persisted snapshots</strong>
              </div>
              <span className="mini-pill">{recentRuns.data?.length ?? 0}</span>
            </div>
            {recentRuns.loading && !recentRuns.data ? <InlineState label="Loading recent factor runs..." /> : null}
            {recentRuns.error ? <InlineState label={recentRuns.error} actionLabel="Retry" onAction={recentRuns.reload} /> : null}
            <div className="research-list">
              {(recentRuns.data ?? []).map((item) => (
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
              ))}
            </div>
          </div>
        </div>

        {activeRun ? (
          <>
            <div
              aria-label={`factor-run-attribution run=${activeRun.run_id} universe=${activeRun.universe_source} assetType=${activeRun.asset_type} family=${activeRun.family} results=${activeRun.result_count}`}
              className="metric-grid"
            >
              <MetricCard label="Evaluated" value={String(activeRun.evaluated_count)} />
              <MetricCard label="Ranked" value={metricValue(activeRun.diagnostics.ranked_count)} />
              <MetricCard label="Insufficient" value={metricValue(activeRun.diagnostics.insufficient_count)} />
              <MetricCard label="As of" value={new Date(activeRun.as_of).toLocaleTimeString()} />
            </div>

            <div className="factor-lab-workspace">
              <section className="research-panel">
                <div className="screeners-column-head">
                  <div>
                    <p className="eyebrow">Results</p>
                    <strong>Ranked factor rows</strong>
                  </div>
                  <span className="mini-pill">{activeRun.result_count}</span>
                </div>
                <div className="table-list">
                  {activeRun.results.map((item) => (
                    <button
                      aria-label={`factor-result symbol=${item.symbol} rank=${item.rank ?? "na"} bucket=${item.bucket}`}
                      className={`table-row factor-result-row ${item.symbol === selectedResult?.symbol ? "selected" : ""}`}
                      key={item.symbol}
                      onClick={() => setSelectedAssetId(item.symbol)}
                      type="button"
                    >
                      <div className="table-main">
                        <strong>
                          {item.rank ? `${item.rank}. ` : ""}
                          {item.symbol}
                        </strong>
                        <span>{item.name}</span>
                      </div>
                      <div className="table-meta">
                        <span>{item.composite_score !== null ? item.composite_score.toFixed(1) : "n/a"}</span>
                        <small>{formatBucket(item.bucket)}</small>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="research-panel">
                {selectedResult ? (
                  <>
                    <div className="card-header">
                      <div>
                        <p className="eyebrow">Selected</p>
                        <h3>
                          {selectedResult.name}
                          <span className="inline-symbol">{selectedResult.symbol}</span>
                        </h3>
                      </div>
                      <span className="mini-pill accent">{formatBucket(selectedResult.bucket)}</span>
                    </div>
                    <div className="metric-grid">
                      <MetricCard
                        label="Score"
                        value={selectedResult.composite_score !== null ? selectedResult.composite_score.toFixed(1) : "n/a"}
                      />
                      <MetricCard
                        label="Percentile"
                        value={selectedResult.percentile !== null ? `${selectedResult.percentile.toFixed(1)}%` : "n/a"}
                      />
                      <MetricCard
                        label="Price"
                        value={
                          selectedResult.price !== null
                            ? formatPrice(selectedResult.price, selectedResult.symbol.includes("/") ? "USDT" : "USD", selectedResult.asset_class)
                            : "n/a"
                        }
                      />
                      <MetricCard
                        label="Change"
                        value={selectedResult.change_pct !== null ? formatPercent(selectedResult.change_pct) : "n/a"}
                        tone={(selectedResult.change_pct ?? 0) >= 0 ? "up" : "down"}
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
                              <p>{familyLookup[item.family]?.simple_description ?? "研究信号。"}</p>
                              <p>Score {item.score !== null ? item.score.toFixed(1) : "n/a"} / weight {item.weight}</p>
                            </div>
                            <span className="mini-pill">{item.family}</span>
                          </div>
                          {item.evidence.map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                          {item.missing_metrics.length ? (
                            <p className="panel-note">Missing: {item.missing_metrics.join(", ")}</p>
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
                        Open Research
                      </button>
                      <button className="ghost-button" onClick={() => setActiveView("asset")} type="button">
                        <Search size={16} />
                        Open Asset
                      </button>
                      <button
                        aria-label={`factor-open-strategy-lab run=${activeRun.run_id}`}
                        className="ghost-button"
                        onClick={() => setActiveView("strategyLab")}
                        type="button"
                      >
                        <LineChart size={16} />
                        Open Strategy Lab
                      </button>
                    </div>
                  </>
                ) : (
                  <PanelState title="No factor row is selected" copy="Run Factor Lab or open a recent snapshot." />
                )}
              </section>

              <section className="research-panel">
                <div className="screeners-column-head">
                  <div>
                    <p className="eyebrow">Data Quality</p>
                    <strong>Diagnostics and missing inputs</strong>
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
                            <span>{metricValue(value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedResult.notes.map((note) => (
                      <InlineState label={note} key={note} />
                    ))}
                  </>
                ) : null}
                {actionMessage ? <InlineState label={actionMessage} /> : null}
                {actionError ? <InlineState label={actionError} /> : null}
              </section>
            </div>
          </>
        ) : (
          <PanelState
            title="No local factor run yet"
            copy="Choose the controlled equity universe, then run a composite or single-family factor ranking."
          />
        )}
      </section>
    </div>
  );
}
