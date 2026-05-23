import { Activity, Bot, Cloud, Cpu, DatabaseZap, Save, ShieldCheck, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  AICloudProviderKey,
  AIControlPreferences,
  DashboardOverviewResponse,
  UpdateAIControlPreferencesRequest,
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
  aiControl,
  aiSaving,
  aiError,
  onSaveAIControl,
  onOpenResearch,
}: {
  selectedAsset: WatchlistAssetSnapshot | null;
  dashboard: DashboardOverviewResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  aiControl: AIControlPreferences | null;
  aiSaving: boolean;
  aiError: string | null;
  onSaveAIControl: (payload: UpdateAIControlPreferencesRequest) => Promise<void>;
  onOpenResearch: () => void;
}) {
  const i18n = useI18n();
  const [aiEnabled, setAIEnabled] = useState(false);
  const [providerMode, setProviderMode] = useState<"local" | "cloud">("local");
  const [localModel, setLocalModel] = useState("");
  const [cloudProvider, setCloudProvider] = useState<AICloudProviderKey>("deepseek");
  const [cloudBaseUrl, setCloudBaseUrl] = useState("");
  const [cloudModel, setCloudModel] = useState("");

  const cloudProviders = aiControl?.available_cloud_providers ?? [];
  const selectedCloudProvider = useMemo(
    () => cloudProviders.find((provider) => provider.provider === cloudProvider) ?? cloudProviders[0] ?? null,
    [cloudProvider, cloudProviders],
  );

  useEffect(() => {
    if (!aiControl) {
      return;
    }
    setAIEnabled(aiControl.enabled);
    setProviderMode(aiControl.provider_mode);
    setLocalModel(aiControl.local_model ?? "");
    setCloudProvider(aiControl.cloud_provider);
    setCloudBaseUrl(aiControl.cloud_base_url ?? "");
    setCloudModel(aiControl.cloud_model ?? "");
  }, [aiControl]);

  useEffect(() => {
    if (!selectedCloudProvider) {
      return;
    }
    setCloudBaseUrl((value) => value || selectedCloudProvider.base_url);
    setCloudModel((value) => value || selectedCloudProvider.default_model);
  }, [selectedCloudProvider]);

  async function handleSaveAIControl() {
    await onSaveAIControl({
      enabled: aiEnabled,
      provider_mode: providerMode,
      local_model: localModel.trim() || null,
      cloud_provider: cloudProvider,
      cloud_base_url: cloudBaseUrl.trim() || null,
      cloud_model: cloudModel.trim() || null,
    });
  }

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

      <section className="card ai-control-card" aria-label="dashboard-ai-control">
        <div className="card-header">
          <div>
            <p className="eyebrow">AI Control</p>
            <h3>本地 AI 研究助手</h3>
          </div>
          <span className={`mini-pill ${aiEnabled ? "accent" : ""}`}>{aiEnabled ? "Enabled" : "Off"}</span>
        </div>

        <label className="checkbox-row">
          <input type="checkbox" checked={aiEnabled} onChange={(event) => setAIEnabled(event.target.checked)} />
          <span>启用 AI 研究助手</span>
        </label>

        <div className="segmented-control ai-mode-toggle" aria-label="ai-provider-mode">
          <button
            className={providerMode === "local" ? "active" : ""}
            type="button"
            onClick={() => setProviderMode("local")}
          >
            <Cpu size={15} />
            本地
          </button>
          <button
            className={providerMode === "cloud" ? "active" : ""}
            type="button"
            onClick={() => setProviderMode("cloud")}
          >
            <Cloud size={15} />
            云端
          </button>
        </div>

        {providerMode === "local" ? (
          <div className="ai-control-fields" aria-label="ai-local-config">
            <label>
              <span>接口</span>
              <input value={aiControl?.local_base_url ?? "http://127.0.0.1:11434"} disabled />
            </label>
            <label>
              <span>模型</span>
              <input
                value={localModel}
                placeholder="qwen3:8b / llama3.1 / local default"
                onChange={(event) => setLocalModel(event.target.value)}
              />
            </label>
            <p className="panel-note">本地模式走 Ollama，不会把研究上下文发到云端。</p>
          </div>
        ) : (
          <div className="ai-control-fields" aria-label="ai-cloud-config">
            <label>
              <span>供应商</span>
              <select
                value={cloudProvider}
                onChange={(event) => {
                  const nextProvider = event.target.value as AICloudProviderKey;
                  const definition = cloudProviders.find((provider) => provider.provider === nextProvider);
                  setCloudProvider(nextProvider);
                  setCloudBaseUrl(definition?.base_url ?? "");
                  setCloudModel(definition?.default_model ?? "");
                }}
              >
                {cloudProviders.map((provider) => (
                  <option key={provider.provider} value={provider.provider}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Base URL</span>
              <input value={cloudBaseUrl} onChange={(event) => setCloudBaseUrl(event.target.value)} />
            </label>
            <label>
              <span>Model</span>
              <input value={cloudModel} onChange={(event) => setCloudModel(event.target.value)} />
            </label>
            <div className="ai-key-status">
              <Bot size={15} />
              <span>
                API key: <code>{aiControl?.cloud_api_key_env ?? "PENGBO_AI_CLOUD_API_KEY"}</code>
              </span>
              <span className={`mini-pill ${aiControl?.cloud_key_configured ? "accent" : ""}`}>
                {aiControl?.cloud_key_configured ? "configured" : "missing"}
              </span>
            </div>
            {selectedCloudProvider?.notes.length ? (
              <p className="panel-note">{selectedCloudProvider.notes.join(" ")}</p>
            ) : (
              <p className="panel-note">云端模式只在研究页逐次确认后发送已脱敏的证据上下文。</p>
            )}
          </div>
        )}

        {aiError ? <p className="inline-error">{aiError}</p> : null}
        <div className="ai-control-actions">
          <button className="primary-button" type="button" onClick={handleSaveAIControl} disabled={aiSaving || !aiControl}>
            <Save size={16} />
            {aiSaving ? "保存中" : "保存 AI 设置"}
          </button>
          <button className="ghost-button" type="button" onClick={onOpenResearch}>
            打开 Research
          </button>
        </div>
      </section>
    </div>
  );
}
