import { Activity, DatabaseZap, ShieldCheck, TrendingUp } from "lucide-react";
import type { DashboardOverviewResponse, WatchlistAssetSnapshot } from "../lib/api";
import { MiniTrend, PanelState, PulseCard } from "../components/shared";
import { useI18n } from "../i18n";

export function DashboardView({
  selectedAsset,
  dashboard,
  loading,
  error,
  onRetry,
}: {
  selectedAsset: WatchlistAssetSnapshot | null;
  dashboard: DashboardOverviewResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const i18n = useI18n();

  if (loading) {
    return <PanelState title={i18n.t("dashboard.loadingTitle")} copy={i18n.t("dashboard.loadingCopy")} />;
  }

  if (error || !dashboard) {
    return (
      <PanelState
        title={i18n.t("dashboard.errorTitle")}
        copy={error ?? i18n.t("dashboard.errorCopy")}
        actionLabel={i18n.t("common.retry")}
        onAction={onRetry}
      />
    );
  }

  return (
    <div className="workspace-grid terminal-dashboard">
      <section className="card panorama-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("dashboard.marketPulse")}</p>
            <h3>{i18n.t("dashboard.marketPulseTitle")}</h3>
          </div>
          <div className="badge-row horizontal">
            <span className="mini-pill accent">
              {dashboard.stale ? i18n.t("dashboard.cached") : i18n.t("dashboard.realtime")}
            </span>
            <span className="mini-pill">
              {dashboard.connection_summary.data_mode === "live" ? i18n.t("dashboard.live") : i18n.t("dashboard.cached")}
            </span>
          </div>
        </div>

        <div className="pulse-grid">
          {dashboard.market_pulse.map((item) => (
            <PulseCard key={item.label} item={item} />
          ))}
        </div>
      </section>

      <section className="card focus-card">
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("dashboard.focusAsset")}</p>
            <h3>{selectedAsset?.symbol ?? "--"}</h3>
          </div>
          <span className="mini-pill">{selectedAsset?.market ?? i18n.t("dashboard.noAsset")}</span>
        </div>
        <p className="body-copy">{selectedAsset?.summary ?? i18n.t("dashboard.noAssetCopy")}</p>
        {selectedAsset ? <MiniTrend trend={selectedAsset.trend} dense /> : null}
      </section>

      <section className="card tasks-card terminal-readiness-card">
        <div className="card-header">
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
    </div>
  );
}
