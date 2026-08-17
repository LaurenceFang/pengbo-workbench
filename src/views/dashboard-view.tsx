import { Activity, Bot, DatabaseZap, ShieldCheck, TrendingUp } from "lucide-react";
import type {
  DashboardOverviewResponse,
  WatchlistAssetSnapshot,
} from "../lib/api";
import { MiniTrend, PanelState, PulseCard } from "../components/shared";
import { useI18n } from "../i18n";

export function DashboardView({
  selectedAsset,
  dashboard,
  loading,
  error,
  onRetry,
  onOpenResearch,
  onOpenAI,
  routeSection = "dashboardOverview",
}: {
  selectedAsset: WatchlistAssetSnapshot | null;
  dashboard: DashboardOverviewResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenResearch: () => void;
  onOpenAI: () => void;
  routeSection?: "dashboardOverview" | "dashboardRuntime";
}) {
  const i18n = useI18n();
  const routePath = routeSection === "dashboardRuntime" ? "/dashboard/runtime" : "/dashboard/overview";

  if (loading) {
    return <div className="p1-page p1-dashboard-page" data-route-id={routePath} data-context-inspector="dashboard" data-primary-task={routeSection}><PanelState title={i18n.t("dashboard.loadingTitle")} copy={i18n.t("dashboard.loadingCopy")} /></div>;
  }

  if (error || !dashboard) {
    return <div className="p1-page p1-dashboard-page" data-route-id={routePath} data-context-inspector="dashboard" data-primary-task={routeSection}><PanelState title={i18n.t("dashboard.errorTitle")} copy={error ?? i18n.t("dashboard.errorCopy")} actionLabel={i18n.t("common.retry")} onAction={onRetry} /></div>;
  }

  return (
    <div className="p1-page p1-dashboard-page" data-route-id={routePath} data-context-inspector="dashboard" data-primary-task={routeSection}>
      <header className="p1-page-header p1-dashboard-header">
        <div>
          <p className="eyebrow">{i18n.t("dashboard.marketPulse")}</p>
          <h2>{i18n.t("dashboard.marketPulseTitle")}</h2>
          <p className="p1-page-lede">{i18n.t("dashboard.workspaceCopy")}</p>
        </div>
        <div className="p1-page-actions">
          <span className={`p1-status-dot ${dashboard.connection_summary.data_mode === "live" ? "is-live" : "is-cached"}`}>
            {dashboard.connection_summary.data_mode === "live" ? i18n.t("dashboard.live") : i18n.t("dashboard.cached")}
          </span>
          <button className="primary-button" type="button" onClick={onOpenResearch}>
            {i18n.t("dashboard.openResearch")}
          </button>
          <button className="ghost-button" type="button" onClick={onOpenAI}><Bot size={15} />打开 AI</button>
        </div>
      </header>

      {routeSection === "dashboardOverview" ? (
      <section className="p1-signal-row" aria-label="dashboard-research-signals">
        <article className="p1-signal-card p1-signal-card-wide">
          <div className="p1-section-heading">
            <div>
              <p className="eyebrow">{i18n.t("dashboard.marketPulse")}</p>
              <h3>{i18n.t("dashboard.marketPulseTitle")}</h3>
            </div>
            <span className="mini-pill">{dashboard.market_pulse.length} signals</span>
          </div>
          <div className="pulse-grid p1-pulse-grid">
            {dashboard.market_pulse.map((item) => (
              <PulseCard key={item.label} item={item} />
            ))}
          </div>
        </article>

        <article className="p1-signal-card p1-focus-signal">
          <div className="p1-section-heading">
            <div>
              <p className="eyebrow">{i18n.t("dashboard.focusAsset")}</p>
              <h3>{selectedAsset?.symbol ?? "--"}</h3>
            </div>
            <span className="mini-pill">{selectedAsset?.market ?? i18n.t("dashboard.noAsset")}</span>
          </div>
          <p className="body-copy">{selectedAsset?.summary ?? i18n.t("dashboard.noAssetCopy")}</p>
          {selectedAsset ? <MiniTrend trend={selectedAsset.trend} dense /> : null}
        </article>
      </section>
      ) : null}

      <div className="p1-dashboard-grid">
      {routeSection === "dashboardOverview" ? (
      <section className="card p1-panel p1-market-panel">
        <div className="p1-section-heading">
          <div>
            <p className="eyebrow">{i18n.t("dashboard.researchContext")}</p>
            <h3>{i18n.t("dashboard.nextDecisionTitle")}</h3>
          </div>
        </div>
        <div className="p1-flow-list">
          <div className="p1-flow-step is-current"><span>01</span><div><strong>{i18n.t("dashboard.orient")}</strong><small>{i18n.t("dashboard.orientCopy")}</small></div><span className="mini-pill accent">{i18n.t("dashboard.current")}</span></div>
          <div className="p1-flow-step"><span>02</span><div><strong>{i18n.t("dashboard.inspect")}</strong><small>{i18n.t("dashboard.inspectCopy")}</small></div><span className="mini-pill">{i18n.t("dashboard.next")}</span></div>
          <div className="p1-flow-step"><span>03</span><div><strong>{i18n.t("dashboard.evidence")}</strong><small>{i18n.t("dashboard.evidenceCopy")}</small></div><span className="mini-pill">{i18n.t("dashboard.local")}</span></div>
        </div>
      </section>
      ) : null}

      {routeSection === "dashboardRuntime" ? (
      <section className="card p1-panel terminal-readiness-card">
        <div className="p1-section-heading">
          <div>
            <p className="eyebrow">{i18n.t("dashboard.terminalReadiness")}</p>
            <h3>{i18n.t("dashboard.terminalReadinessTitle")}</h3>
          </div>
        </div>
        <div className="task-list">
          <div className="task-item done">
            <ShieldCheck size={16} />
            <span>{i18n.t("dashboard.localBackend")}</span>
          </div>
          <div className="task-item done">
            <DatabaseZap size={16} />
            <span>{i18n.t("dashboard.providerStatus")}</span>
          </div>
          <div className="task-item">
            <TrendingUp size={16} />
            <span>{i18n.t("dashboard.researchReady")}</span>
          </div>
          <div className="task-item">
            <Activity size={16} />
            <span>{i18n.t("dashboard.workspaceCopy")}</span>
          </div>
        </div>
      </section>
      ) : null}

      </div>
    </div>
  );
}
