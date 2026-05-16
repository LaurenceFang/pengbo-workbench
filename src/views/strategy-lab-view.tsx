import { FileText, FlaskConical, Play, Power, RefreshCcw, ShieldAlert, WalletCards } from "lucide-react";
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
  type BinanceExecutionIntentResponse,
  type StrategyBacktestResponse,
  type StrategyPaperSessionResponse,
} from "../lib/api";
import { useAppStore } from "../store/app-store";

function metricDisplay(value: number | string, unit: string | null): string {
  if (typeof value === "number") {
    return unit === "pct" ? `${value.toFixed(2)}%` : Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return unit ? `${value} ${unit}` : value;
}

function metricLookup(backtest: StrategyBacktestResponse | null, label: string): string {
  const metric = backtest?.metrics.find((item) => item.label === label);
  return metric ? metricDisplay(metric.value, metric.unit) : "n/a";
}

export function StrategyLabView({ backendStatus }: { backendStatus: BackendStatus }) {
  const sidecarReady = backendStatus === "online";
  const selectedFactorRunId = useAppStore((state) => state.selectedFactorRunId);
  const lastFactorRunResult = useAppStore((state) => state.lastFactorRunResult);
  const selectedStrategyBacktestId = useAppStore((state) => state.selectedStrategyBacktestId);
  const lastStrategyBacktestResult = useAppStore((state) => state.lastStrategyBacktestResult);
  const lastStrategyPaperSession = useAppStore((state) => state.lastStrategyPaperSession);
  const selectedStrategyPaperSessionId = useAppStore((state) => state.selectedStrategyPaperSessionId);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const setSelectedFactorRunId = useAppStore((state) => state.setSelectedFactorRunId);
  const setLastFactorRunResult = useAppStore((state) => state.setLastFactorRunResult);
  const setSelectedStrategyBacktestId = useAppStore((state) => state.setSelectedStrategyBacktestId);
  const setLastStrategyBacktestResult = useAppStore((state) => state.setLastStrategyBacktestResult);
  const setSelectedStrategyPaperSessionId = useAppStore((state) => state.setSelectedStrategyPaperSessionId);
  const setLastStrategyPaperSession = useAppStore((state) => state.setLastStrategyPaperSession);
  const setLatestCommandFeedback = useAppStore((state) => state.setLatestCommandFeedback);

  const templates = useAsyncResource(async () => api.getStrategyTemplates(), [], { enabled: sidecarReady });
  const recentFactorRuns = useAsyncResource(async () => api.getRecentFactorRuns(12), [], { enabled: sidecarReady });
  const recentBacktests = useAsyncResource(async () => api.getRecentStrategyBacktests(12), [], { enabled: sidecarReady });
  const recentPaper = useAsyncResource(async () => api.getRecentStrategyPaperSessions(12), [], { enabled: sidecarReady });
  const executionConfig = useAsyncResource(async () => api.getBinanceExecutionConfig(), [], { enabled: sidecarReady });
  const executionAudit = useAsyncResource(async () => api.getBinanceExecutionAudit(10), [], { enabled: sidecarReady });
  const recentExecutionIntents = useAsyncResource(async () => api.getRecentBinanceExecutionIntents(8), [], {
    enabled: sidecarReady,
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

  async function openFactorRun(runId: string) {
    setBusy(true);
    setActionError(null);
    try {
      const run = await api.getFactorRun(runId);
      setSelectedFactorRunId(run.run_id);
      setLastFactorRunResult(run);
      setFactorRunId(run.run_id);
      setActionMessage(`Factor run ${run.run_id} loaded for Strategy Lab.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to load factor run.");
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
      setActionMessage(`Backtest ${result.run_id} completed.`);
      recentBacktests.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to run strategy backtest.");
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
      setActionError(error instanceof Error ? error.message : "Failed to open strategy backtest.");
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
      setActionMessage(`Paper session ${result.session_id} started.`);
      recentPaper.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to start paper session.");
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
      setActionError(error instanceof Error ? error.message : "Failed to open paper session.");
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
        title: "Strategy report exported",
        detail: result.export_path,
      });
      setActionMessage(`Exported ${result.artifact_type} report.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to export strategy report.");
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
        notes: "Created from Strategy Lab Live Execution panel.",
      });
      setActiveExecutionIntent(result);
      setActionMessage(`Execution intent ${result.intent_id} created.`);
      recentExecutionIntents.reload();
      executionAudit.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create execution intent.");
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
          ? `Execution intent ${result.intent_id} blocked by ${blocked.map((item) => item.check).join(", ")}.`
          : `Execution intent ${result.intent_id} submitted with ${result.fills.length} fills.`,
      );
      recentExecutionIntents.reload();
      executionAudit.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to submit execution intent.");
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
        reason: enabled ? "Enabled from Strategy Lab." : "Cleared from Strategy Lab.",
      });
      executionConfig.reload();
      executionAudit.reload();
      setActionMessage(enabled ? "Global Binance execution kill switch enabled." : "Global Binance execution kill switch cleared.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update kill switch.");
    } finally {
      setBusy(false);
    }
  }

  if (!sidecarReady) {
    return (
      <PanelState
        title="Strategy Lab is waiting for the local sidecar"
        copy="Backtests, saved snapshots, paper sessions, and reports will be available once runtime health recovers."
      />
    );
  }

  return (
    <div className="stack-layout">
      <section
        aria-label={`strategy-lab-view state=${activeBacktest ? "ready" : "empty"} backtest=${selectedStrategyBacktestId ?? "none"} paper=${selectedStrategyPaperSessionId ?? "none"}`}
        className="card"
      >
        <div className="card-header">
          <div>
            <p className="eyebrow">Strategy Lab</p>
            <h3>Backtesting, paper trading, diagnostics, and simulated reports</h3>
          </div>
          <button className="ghost-button" onClick={() => recentBacktests.reload()} type="button">
            <RefreshCcw size={16} />
            Reload
          </button>
        </div>

        <div className="factor-lab-control-grid">
          <div className="research-panel">
            <div className="screeners-column-head">
              <div>
                <p className="eyebrow">Template</p>
                <strong>{template?.title ?? "Top-N Factor Rotation"}</strong>
              </div>
              <span className="mini-pill">paper-only</span>
            </div>
            <label className="field">
              <span>Factor run</span>
              <input
                aria-label={`strategy-factor-run-input value=${factorRunId || "none"}`}
                placeholder="factor-..."
                value={factorRunId}
                onChange={(event) => setFactorRunId(event.target.value)}
              />
            </label>
            <div className="form-grid two-up">
              <label className="field">
                <span>Top N</span>
                <input min={1} max={50} type="number" value={topN} onChange={(event) => setTopN(Number(event.target.value || 5))} />
              </label>
              <label className="field">
                <span>Rebalance</span>
                <select value={rebalanceInterval} onChange={(event) => setRebalanceInterval(event.target.value as "monthly" | "quarterly")}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </label>
              <label className="field">
                <span>Capital</span>
                <input type="number" value={initialCapital} onChange={(event) => setInitialCapital(Number(event.target.value || 100000))} />
              </label>
              <label className="field">
                <span>Max weight</span>
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
                <span>Cash reserve</span>
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
                <span>Benchmark</span>
                <input value={benchmarkSymbol} onChange={(event) => setBenchmarkSymbol(event.target.value)} />
              </label>
              <label className="field">
                <span>Cost bps</span>
                <input min={0} type="number" value={transactionCostBps} onChange={(event) => setTransactionCostBps(Number(event.target.value || 0))} />
              </label>
              <label className="field">
                <span>Slippage bps</span>
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
              {busy ? "Running..." : "Run Backtest"}
            </button>
            <button className="ghost-button" onClick={() => setActiveView("factorLab")} type="button">
              <FlaskConical size={16} />
              Open Factor Lab
            </button>
          </div>

          <div className="research-panel">
            <div className="screeners-column-head">
              <div>
                <p className="eyebrow">Recent Factor Runs</p>
                <strong>Open a saved snapshot</strong>
              </div>
              <span className="mini-pill">{recentFactorRuns.data?.length ?? 0}</span>
            </div>
            <div className="research-list">
              {(recentFactorRuns.data ?? []).map((item) => (
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
              ))}
            </div>
          </div>
        </div>

        {activeBacktest ? (
          <>
            <div
              aria-label={`strategy-backtest-attribution run=${activeBacktest.run_id} factorRun=${activeBacktest.factor_run_id} trades=${activeBacktest.trades.length} noLiveOrders=${activeBacktest.diagnostics.no_live_orders}`}
              className="metric-grid"
            >
              <MetricCard label="Total return" value={metricLookup(activeBacktest, "Total return")} />
              <MetricCard label="Max drawdown" value={metricLookup(activeBacktest, "Max drawdown")} />
              <MetricCard label="Trades" value={String(activeBacktest.trades.length)} />
              <MetricCard label="Window" value={`${activeBacktest.data_window.start ?? "n/a"} / ${activeBacktest.data_window.end ?? "n/a"}`} />
            </div>

            <div className="factor-lab-workspace">
              <section className="research-panel">
                <div className="screeners-column-head">
                  <div>
                    <p className="eyebrow">Backtests</p>
                    <strong>Persisted strategy runs</strong>
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
                    <p className="eyebrow">Backtest Result</p>
                    <h3>{activeBacktest.run_id}</h3>
                  </div>
                  <span className="mini-pill accent">simulated</span>
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
                    Start Paper Session
                  </button>
                  <button
                    aria-label={`strategy-export-report artifact=${activeBacktest.run_id}`}
                    className="ghost-button"
                    disabled={busy}
                    onClick={() => void exportReport(activeBacktest.run_id)}
                    type="button"
                  >
                    <FileText size={16} />
                    Export Report
                  </button>
                </div>
              </section>

              <section className="research-panel">
                <div className="screeners-column-head">
                  <div>
                    <p className="eyebrow">Paper Trading</p>
                    <strong>No live order path</strong>
                  </div>
                  <span className="mini-pill">{activePaper?.orders.length ?? 0} orders</span>
                </div>
                {activePaper ? <PaperSessionPanel session={activePaper} onExport={exportReport} busy={busy} /> : <PanelState title="No paper session yet" copy="Start a paper session from the current backtest to create simulated orders, fills, cash ledger, and PnL." />}
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
          <PanelState title="No strategy backtest yet" copy="Load a saved Factor Lab snapshot, tune the top-N strategy parameters, and run a local simulation." />
        )}

        <section
          aria-label={`strategy-live-execution status=${executionConfig.data?.live_enabled ? "live-enabled" : "default-off"} killSwitch=${executionConfig.data?.kill_switch_enabled ? "enabled" : "clear"} intent=${activeExecutionIntent?.intent_id ?? "none"}`}
          className="research-panel"
        >
          <div className="card-header">
            <div>
              <p className="eyebrow">Live Execution</p>
              <h3>Binance execution intents and risk controls</h3>
            </div>
            <span className={`mini-pill ${executionConfig.data?.live_enabled ? "accent" : ""}`}>
              {executionConfig.data?.live_enabled ? "explicit live mode" : "default off"}
            </span>
          </div>

          <div className="metric-grid">
            <MetricCard label="Credentials" value={executionConfig.data?.credentials_configured ? "configured" : "missing"} />
            <MetricCard label="Risk ack" value={executionConfig.data?.risk_acknowledged ? "recorded" : "required"} />
            <MetricCard label="Kill switch" value={executionConfig.data?.kill_switch_enabled ? "enabled" : "clear"} />
            <MetricCard label="Max order" value={formatPrice(executionConfig.data?.max_order_notional ?? 0, "USDT", "crypto")} />
          </div>

          <div className="factor-lab-control-grid">
            <div className="research-panel">
              <div className="screeners-column-head">
                <div>
                  <p className="eyebrow">Intent Draft</p>
                  <strong>{activePaper ? "Paper evidence linked" : "Paper evidence missing"}</strong>
                </div>
                <span className="mini-pill">{activeBacktest?.run_id ?? "no backtest"}</span>
              </div>
              <div className="form-grid two-up">
                <label className="field">
                  <span>Symbol</span>
                  <input value={executionSymbol} onChange={(event) => setExecutionSymbol(event.target.value)} />
                </label>
                <label className="field">
                  <span>Quantity</span>
                  <input
                    min={0.000001}
                    step={0.000001}
                    type="number"
                    value={executionQuantity}
                    onChange={(event) => setExecutionQuantity(Number(event.target.value || 0.01))}
                  />
                </label>
                <label className="field wide-field">
                  <span>Client order id</span>
                  <input
                    placeholder="optional unique id"
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
                  Create Intent
                </button>
                <button
                  aria-label={`strategy-live-intent-submit intent=${activeExecutionIntent?.intent_id ?? "none"}`}
                  className="ghost-button"
                  disabled={busy || !activeExecutionIntent}
                  onClick={() => activeExecutionIntent && void submitExecutionIntent(activeExecutionIntent.intent_id)}
                  type="button"
                >
                  <Power size={16} />
                  Run Risk Submit
                </button>
              </div>
              <div className="form-actions">
                <button
                  className="ghost-button"
                  disabled={busy}
                  onClick={() => void setGlobalKillSwitch(true)}
                  type="button"
                >
                  Enable Kill Switch
                </button>
                <button
                  className="ghost-button"
                  disabled={busy}
                  onClick={() => void setGlobalKillSwitch(false)}
                  type="button"
                >
                  Clear Kill Switch
                </button>
              </div>
            </div>

            <LiveExecutionEvidencePanel
              activeIntent={activeExecutionIntent}
              recentIntents={recentExecutionIntents.data ?? []}
              auditEvents={executionAudit.data ?? []}
              notes={executionConfig.data?.notes ?? []}
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
  session,
  onExport,
  busy,
}: {
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
        <MetricCard label="Cash" value={formatPrice(session.pnl.cash_balance ?? 0, "USD", "equity")} />
        <MetricCard label="PnL" value={formatPrice(session.pnl.total_pnl ?? 0, "USD", "equity")} />
        <MetricCard label="Fills" value={String(session.fills.length)} />
        <MetricCard label="Mode" value={session.execution_mode} />
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
        Export Paper Report
      </button>
    </>
  );
}

function LiveExecutionEvidencePanel({
  activeIntent,
  recentIntents,
  auditEvents,
  notes,
  onOpenIntent,
}: {
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
          <p className="eyebrow">Risk Evidence</p>
          <strong>{activeIntent ? activeIntent.status : "No active intent"}</strong>
        </div>
        <span className="mini-pill">{blocked.length} blocks</span>
      </div>

      {activeIntent ? (
        <>
          <div
            aria-label={`strategy-live-intent intent=${activeIntent.intent_id} status=${activeIntent.status} blocks=${blocked.length} noLiveBeforeSubmit=${activeIntent.no_live_order_until_submit}`}
            className="metric-grid"
          >
            <MetricCard label="Intent" value={activeIntent.intent_id.slice(-8)} />
            <MetricCard label="Notional" value={formatPrice(activeIntent.estimated_notional ?? 0, "USDT", "crypto")} />
            <MetricCard label="Fills" value={String(activeIntent.fills.length)} />
            <MetricCard label="Audit" value={String(activeIntent.audit_event_count)} />
          </div>
          <div className="table-list">
            {activeIntent.risk_decisions.length === 0 ? (
              <div className="table-row">
                <div className="table-main">
                  <strong>No risk run yet</strong>
                  <span>Create an intent, then run risk submit to record decisions.</span>
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
                  <span>{decision.status}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <InlineState label="Create an execution intent from a paper-backed strategy result to inspect risk gates before any broker request is possible." />
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
          <p className="eyebrow">Recent Intents</p>
          <strong>Local execution ledger</strong>
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
              <span className="mini-pill">{intent.status}</span>
            </div>
            <p>{intent.intent_id}</p>
            <small>{new Date(intent.updated_at).toLocaleString()}</small>
          </button>
        ))}
      </div>

      <div className="screeners-column-head">
        <div>
          <p className="eyebrow">Audit Trail</p>
          <strong>Latest events</strong>
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
