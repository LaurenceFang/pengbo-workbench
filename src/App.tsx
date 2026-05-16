import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Cable,
  ChartCandlestick,
  Command,
  DatabaseZap,
  FolderCog,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  RefreshCcw,
  Search,
  Sparkles,
  Star,
  TriangleAlert,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CommandPalette } from "./components/command-palette";
import { InlineState, StatusBadge, type BackendStatus } from "./components/shared";
import { useAsyncResource } from "./hooks/use-async-resource";
import { useI18n } from "./i18n";
import {
  api,
  type AppPreferences,
  type AssetSearchResult,
  type AssetWorkspaceResponse,
  type DashboardOverviewResponse,
  type DiagnosticsExportResult,
  type OnboardingState,
  type SetupStatus,
} from "./lib/api";
import { deriveDesktopConnectionStatus, getRuntimeConfig, type RuntimeConfig } from "./lib/runtime";
import { useAppStore, type ViewKey } from "./store/app-store";
import { AssetView } from "./views/asset-view";
import { ConnectionsView } from "./views/connections-view";
import { DashboardView } from "./views/dashboard-view";
import { DataSourcesView } from "./views/data-sources-view";
import { FactorLabView } from "./views/factor-lab-view";
import { ManualView } from "./views/manual-view";
import { PortfolioView } from "./views/portfolio-view";
import { ResearchView } from "./views/research-view";
import { ScreenersView } from "./views/screeners-view";
import { SettingsView } from "./views/settings-view";
import { StrategyLabView } from "./views/strategy-lab-view";
import { WatchlistView } from "./views/watchlist-view";
import { WorkflowStudioView } from "./views/workflow-studio-view";

const navigation = [
  { key: "dashboard", icon: LayoutDashboard },
  { key: "asset", icon: ChartCandlestick },
  { key: "watchlist", icon: Star },
  { key: "research", icon: Search },
  { key: "factorLab", icon: FlaskConical },
  { key: "strategyLab", icon: LineChart },
  { key: "workflowStudio", icon: Workflow },
  { key: "dataSources", icon: DatabaseZap },
  { key: "screeners", icon: BarChart3 },
  { key: "manual", icon: BookOpen },
  { key: "portfolio", icon: BriefcaseBusiness },
  { key: "connections", icon: Cable },
  { key: "settings", icon: FolderCog },
] satisfies Array<{
  key: ViewKey;
  icon: typeof LayoutDashboard;
}>;

function App() {
  const activeView = useAppStore((state) => state.activeView);
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const commandPaletteOpen = useAppStore((state) => state.commandPaletteOpen);
  const latestCommandFeedback = useAppStore((state) => state.latestCommandFeedback);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const setSelectedAssetId = useAppStore((state) => state.setSelectedAssetId);
  const language = useAppStore((state) => state.language);
  const density = useAppStore((state) => state.density);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setDensity = useAppStore((state) => state.setDensity);
  const i18n = useI18n();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [diagnosticsExport, setDiagnosticsExport] = useState<DiagnosticsExportResult | null>(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [onboardingSeenOverride, setOnboardingSeenOverride] = useState<string | null | undefined>(undefined);
  const [shellActionError, setShellActionError] = useState<string | null>(null);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const previousBackendStatus = useRef<BackendStatus | null>(null);

  const runtime = useAsyncResource<RuntimeConfig>(async () => getRuntimeConfig(), []);
  const health = useAsyncResource(async () => api.getHealth(), [], {
    enabled: !runtime.loading && runtime.data !== null,
  });
  const backendStatus: BackendStatus = deriveDesktopConnectionStatus({
    runtime: runtime.data,
    runtimeLoading: runtime.loading,
    healthLoading: health.loading,
    healthError: health.error,
    recoveryInFlight: actionBusy,
  });
  const shouldRetryDesktopStartup =
    runtime.data?.mode === "tauri" &&
    !actionBusy &&
    (runtime.data.sidecarStatus !== "online" || (!health.loading && health.error !== null));
  const sidecarReady = backendStatus === "online";
  const dashboard = useAsyncResource<DashboardOverviewResponse>(async () => api.getDashboardOverview(), [], {
    enabled: sidecarReady,
  });
  const assetUniverse = useAsyncResource<AssetSearchResult[]>(async () => api.searchAssets(""), [], {
    enabled: sidecarReady,
  });
  const preferences = useAsyncResource<AppPreferences>(async () => api.getSettingsPreferences(), [], {
    enabled: sidecarReady,
  });
  const onboarding = useAsyncResource<OnboardingState>(async () => api.getOnboardingState(), [], {
    enabled: sidecarReady,
  });
  const connectionsStatus = useAsyncResource(async () => api.getConnectionsStatus(), [], {
    enabled: sidecarReady,
  });
  const asset = useAsyncResource<AssetWorkspaceResponse | null>(
    async () => (selectedAssetId ? api.getAssetWorkspace(selectedAssetId) : null),
    [selectedAssetId],
    { enabled: sidecarReady },
  );

  useEffect(() => {
    const watchlist = dashboard.data?.watchlist ?? [];
    if (watchlist.length === 0) {
      return;
    }

    if (!selectedAssetId) {
      setSelectedAssetId(dashboard.data?.focus_asset?.symbol ?? watchlist[0].symbol);
    }
  }, [dashboard.data, selectedAssetId, setSelectedAssetId]);

  useEffect(() => {
    if (!preferences.data || preferencesHydrated) {
      return;
    }

    setActiveView(preferences.data.default_view);
    setLanguage(preferences.data.language);
    setDensity(preferences.data.density);
    setPreferencesHydrated(true);
  }, [preferences.data, preferencesHydrated, setActiveView, setDensity, setLanguage]);

  useEffect(() => {
    if (!shouldRetryDesktopStartup) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (runtime.data?.sidecarStatus !== "online") {
        runtime.reload();
        return;
      }

      health.reload();
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [health, runtime, shouldRetryDesktopStartup, runtime.data?.sidecarStatus]);

  useEffect(() => {
    const shouldRecover =
      backendStatus === "online" &&
      previousBackendStatus.current !== null &&
      previousBackendStatus.current !== "online";
    previousBackendStatus.current = backendStatus;

    if (!shouldRecover) {
      return;
    }

    dashboard.reload();
    assetUniverse.reload();
    asset.reload();
    preferences.reload();
    onboarding.reload();
    connectionsStatus.reload();
  }, [asset, assetUniverse, backendStatus, connectionsStatus, dashboard, onboarding, preferences]);

  const selectedAsset =
    dashboard.data?.watchlist.find((item) => item.symbol === selectedAssetId) ??
    dashboard.data?.focus_asset ??
    dashboard.data?.watchlist[0] ??
    null;
  const activeNav = navigation.find((item) => item.key === activeView) ?? navigation[0];
  const isDashboardView = activeView === "dashboard";

  const searchableAssets = assetUniverse.data?.length ? assetUniverse.data : (dashboard.data?.watchlist ?? []);
  const searchResults = searchableAssets.filter((assetItem) => {
    const keyword = `${assetItem.symbol} ${assetItem.name} ${assetItem.market}`.toLowerCase();
    return keyword.includes(searchTerm.toLowerCase());
  });

  const diagnosticsEnabled = preferences.data?.diagnostics_export_enabled ?? true;
  const onboardingSeenAt =
    onboardingSeenOverride !== undefined ? onboardingSeenOverride : onboarding.data?.onboarding_seen_at;
  const missingProviders = (connectionsStatus.data?.providers ?? [])
    .filter((provider) => provider.requires_credentials)
    .map((provider) => provider.label);
  const setupStatus: SetupStatus = {
    firstRun: !onboarding.loading && !onboarding.error && onboardingSeenAt == null,
    needsSetup: backendStatus === "offline" || missingProviders.length > 0,
    sidecarOffline: backendStatus === "offline",
    missingProviders,
  };

  const backendNote =
    backendStatus === "offline"
      ? runtime.data?.lastError ?? health.error ?? (language === "zh-CN" ? "本地服务当前不可用。" : "The local sidecar is currently unavailable.")
      : backendStatus === "connecting"
        ? actionBusy
          ? language === "zh-CN" ? "正在重启本地服务，请稍候。" : "Restarting the local sidecar. Please wait."
          : language === "zh-CN" ? "正在连接本地服务。" : "Connecting to the local sidecar."
        : language === "zh-CN" ? "本地服务在线，正在提供真实数据。" : "The local sidecar is online and serving real data.";

  const setupLead =
    backendStatus === "connecting"
      ? language === "zh-CN" ? "应用正在等待本地服务重新连接，当前页面会自动刷新。" : "The app is waiting for the local sidecar to reconnect. The current page will refresh automatically."
      : setupStatus.sidecarOffline
        ? runtime.data?.lastError ?? (language === "zh-CN" ? "本地服务离线，请恢复后继续。" : "The local sidecar is offline. Restore it before continuing.")
        : setupStatus.missingProviders.length > 0
          ? language === "zh-CN"
            ? `请完成这些数据源设置：${setupStatus.missingProviders.join(", ")}。`
            : `Complete provider setup for: ${setupStatus.missingProviders.join(", ")}.`
          : language === "zh-CN" ? "当前运行环境已就绪。" : "The current runtime environment is ready.";

  const diagnosticsDisabledReason =
    preferences.data && !preferences.data.diagnostics_export_enabled
      ? i18n.t("settings.diagnosticsDisabled")
      : null;

  async function reloadEverything() {
    runtime.reload();
    health.reload();
    dashboard.reload();
    assetUniverse.reload();
    asset.reload();
    preferences.reload();
    onboarding.reload();
    connectionsStatus.reload();
  }

  async function handleRestartSidecar() {
    setActionBusy(true);
    setShellActionError(null);
    try {
      await api.restartSidecar();
      await reloadEverything();
    } catch (error) {
      setShellActionError(error instanceof Error ? error.message : "Failed to restart the local sidecar.");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleExportDiagnostics() {
    if (!diagnosticsEnabled) {
      return;
    }

    setDiagnosticsBusy(true);
    setShellActionError(null);
    try {
      const result = await api.exportDiagnosticsBundle();
      setDiagnosticsExport(result);
    } catch (error) {
      setShellActionError(error instanceof Error ? error.message : "Failed to export diagnostics.");
    } finally {
      setDiagnosticsBusy(false);
    }
  }

  async function handleDismissOnboarding() {
    const nextSeenAt = new Date().toISOString();
    setOnboardingBusy(true);
    setShellActionError(null);
    try {
      await api.updateOnboardingState({ onboarding_seen_at: nextSeenAt });
      setOnboardingSeenOverride(nextSeenAt);
    } catch (error) {
      setShellActionError(error instanceof Error ? error.message : "Failed to update onboarding state.");
    } finally {
      setOnboardingBusy(false);
    }
  }

  return (
      <div className={`app-shell density-${density}`}>
      <div className="backdrop-orb orb-left" />
      <div className="backdrop-orb orb-right" />

      <aside className="sidebar">
        <div className="brand-panel">
          <div className="brand-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="eyebrow">{i18n.t("app.brandEyebrow")}</p>
            <h1>{i18n.t("app.brandName")}</h1>
          </div>
        </div>

        <div className="sidebar-section">
          <span className="section-caption">{i18n.t("nav.section")}</span>
          <nav className="nav-stack">
            {navigation.map(({ key, icon: Icon }) => (
              <button
                aria-label={`nav-${key}`}
                key={key}
                className={`nav-item ${activeView === key ? "active" : ""}`}
                onClick={() => setActiveView(key)}
                type="button"
              >
                <span className="nav-icon">
                  <Icon size={18} />
                </span>
                <span>{i18n.viewLabel(key)}</span>
              </button>
            ))}
          </nav>
        </div>

      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{i18n.viewEyebrow(activeNav.key)}</p>
            <h2>{i18n.viewTitle(activeNav.key)}</h2>
          </div>

          <div className="toolbar">
            {latestCommandFeedback ? (
              <div className={`command-feedback-pill ${latestCommandFeedback.tone}`}>
                <strong>{latestCommandFeedback.title}</strong>
                {latestCommandFeedback.detail ? <span>{latestCommandFeedback.detail}</span> : null}
              </div>
            ) : null}

            <div className="search-box">
              <Search size={16} />
              <input
                aria-label="search-asset"
                placeholder={i18n.t("topbar.searchPlaceholder")}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <span className="search-hint">
                <Command size={12} /> K
              </span>
              {searchTerm ? (
                <div className="search-results">
                  {searchResults.map((assetItem) => (
                    <button
                      key={assetItem.symbol}
                      className="search-result"
                      onClick={() => {
                        setSelectedAssetId(assetItem.symbol);
                        setActiveView("asset");
                        setSearchTerm("");
                      }}
                      type="button"
                    >
                      <strong>{assetItem.symbol}</strong>
                      <span>{assetItem.name}</span>
                    </button>
                  ))}
                  {searchResults.length === 0 ? <div className="search-empty">{i18n.t("topbar.noMatchingAsset")}</div> : null}
                </div>
              ) : null}
            </div>

            <button
              aria-label="open-command-palette"
              className={`ghost-button palette-launch ${commandPaletteOpen ? "active" : ""}`}
              onClick={() => setCommandPaletteOpen(!commandPaletteOpen)}
              type="button"
            >
              <Command size={16} />
              {i18n.t("topbar.commandPalette")}
            </button>

            <StatusBadge
              status={backendStatus}
              note={backendNote}
              onRestart={handleRestartSidecar}
              restarting={actionBusy}
              canRestart={runtime.data?.mode === "tauri"}
              onExportDiagnostics={handleExportDiagnostics}
              exportingDiagnostics={diagnosticsBusy}
              canExportDiagnostics={runtime.data?.mode === "tauri" && backendStatus === "offline" && diagnosticsEnabled}
              labels={{
                online: i18n.t("runtime.online"),
                offline: i18n.t("runtime.offline"),
                connecting: i18n.t("runtime.connecting"),
                restart: i18n.t("runtime.restart"),
                restarting: i18n.t("runtime.restarting"),
                exportDiagnostics: i18n.t("runtime.exportDiagnostics"),
                exporting: i18n.t("runtime.exporting"),
              }}
            />
          </div>
        </header>

        <div className="workspace-scroll">
          {isDashboardView && setupStatus.firstRun ? (
            <section className="card panel-banner">
              <div className="panel-banner-head">
                <div>
                  <p className="eyebrow">{i18n.t("setup.firstRun")}</p>
                  <h3>
                    {backendStatus === "connecting"
                      ? i18n.t("setup.connectingTitle")
                      : setupStatus.needsSetup
                        ? i18n.t("setup.needsSetupTitle")
                        : i18n.t("setup.readyTitle")}
                  </h3>
                </div>
                <button
                  className="icon-button"
                  disabled={onboardingBusy}
                  onClick={handleDismissOnboarding}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="body-copy">{setupLead}</p>
              <div className="setup-summary-list">
                <div className="task-item">
                  <TriangleAlert size={16} />
                  <span>
                    {setupStatus.sidecarOffline
                      ? language === "zh-CN" ? "本地服务离线时，所有工作区都会保持降级或不可用状态。" : "When the local sidecar is offline, every workspace will stay degraded or unavailable."
                      : backendStatus === "connecting"
                        ? language === "zh-CN" ? "本地服务连接后，当前页面会自动刷新。" : "The current page will refresh automatically once the sidecar is connected."
                        : language === "zh-CN" ? "连接页会显示数据源状态、测试结果和缓存新鲜度。" : "The connections page shows provider status, test results, and cache freshness."}
                  </span>
                </div>
                <div className="task-item">
                  <Cable size={16} />
                  <span>
                    {setupStatus.missingProviders.length > 0
                      ? language === "zh-CN"
                        ? `仍缺少这些配置：${setupStatus.missingProviders.join(", ")}。`
                        : `Still missing configuration for: ${setupStatus.missingProviders.join(", ")}.`
                      : language === "zh-CN" ? "核心数据源设置已就绪，应用可以继续使用实时数据。" : "Core data-provider setup is in place and the app can continue with live data."}
                  </span>
                </div>
              </div>
              <div className="hero-actions">
                <button className="primary-button" type="button" onClick={() => setActiveView("connections")}>
                  {i18n.t("setup.openConnections")}
                  <ArrowRight size={16} />
                </button>
                <button className="ghost-button" type="button" onClick={() => setActiveView("settings")}>
                  {i18n.t("setup.openSettings")}
                </button>
                <button
                  className="ghost-button"
                  disabled={actionBusy || runtime.data?.mode !== "tauri"}
                  type="button"
                  onClick={handleRestartSidecar}
                >
                  <RefreshCcw size={16} />
                  {actionBusy ? i18n.t("runtime.restarting") : i18n.t("setup.restartSidecar")}
                </button>
                <button
                  className="ghost-button"
                  disabled={diagnosticsBusy || runtime.data?.mode !== "tauri" || !diagnosticsEnabled}
                  type="button"
                  onClick={handleExportDiagnostics}
                >
                  {diagnosticsBusy ? i18n.t("runtime.exporting") : i18n.t("setup.exportDiagnostics")}
                </button>
              </div>
              {diagnosticsDisabledReason ? <p className="panel-note">{diagnosticsDisabledReason}</p> : null}
              {diagnosticsExport ? <p className="panel-note">{i18n.t("setup.diagnosticsExported")} {diagnosticsExport.exportPath}</p> : null}
            </section>
          ) : null}

          {isDashboardView && !setupStatus.firstRun && setupStatus.needsSetup ? (
            <section className="card panel-banner compact">
              <div className="panel-banner-head">
                <div>
                  <p className="eyebrow">{i18n.t("setup.environment")}</p>
                  <h3>{setupStatus.sidecarOffline ? i18n.t("setup.sidecarOfflineTitle") : i18n.t("setup.providersNeedSetupTitle")}</h3>
                </div>
                <span className="mini-pill">{setupStatus.sidecarOffline ? "offline" : "pending"}</span>
              </div>
              <p className="body-copy">{setupLead}</p>
              <div className="hero-actions">
                <button className="ghost-button" type="button" onClick={() => setActiveView("connections")}>
                  {i18n.t("setup.openConnections")}
                </button>
                <button className="ghost-button" type="button" onClick={() => setActiveView("settings")}>
                  {i18n.t("setup.openSettings")}
                </button>
                {setupStatus.sidecarOffline ? (
                  <button className="ghost-button" disabled={actionBusy} onClick={handleRestartSidecar} type="button">
                    <RefreshCcw size={16} />
                    {actionBusy ? i18n.t("runtime.restarting") : i18n.t("setup.restartSidecar")}
                  </button>
                ) : null}
                <button
                  className="ghost-button"
                  disabled={diagnosticsBusy || runtime.data?.mode !== "tauri" || !diagnosticsEnabled}
                  onClick={handleExportDiagnostics}
                  type="button"
                >
                  {diagnosticsBusy ? i18n.t("runtime.exporting") : i18n.t("setup.exportDiagnostics")}
                </button>
              </div>
              {diagnosticsDisabledReason ? <p className="panel-note">{diagnosticsDisabledReason}</p> : null}
              {diagnosticsExport ? <p className="panel-note">{i18n.t("setup.diagnosticsExported")} {diagnosticsExport.exportPath}</p> : null}
            </section>
          ) : null}

          {shellActionError ? (
            <section className="card panel-banner compact">
              <div className="task-item">
                <TriangleAlert size={16} />
                <span>{shellActionError}</span>
              </div>
            </section>
          ) : null}

          {isDashboardView ? (
            <section className="hero-panel">
              <div>
                <p className="eyebrow">{i18n.t("dashboard.workspaceEyebrow")}</p>
                <h3>{i18n.t("dashboard.workspaceTitle")}</h3>
                <p className="hero-copy">{i18n.t("dashboard.workspaceCopy")}</p>
              </div>
              <div className="hero-actions">
                <button className="primary-button" type="button" onClick={() => setActiveView("research")}>
                  {i18n.t("dashboard.openResearch")}
                  <ArrowRight size={16} />
                </button>
                <button className="ghost-button" type="button" onClick={() => setActiveView("settings")}>
                  {i18n.t("setup.openSettings")}
                </button>
              </div>
            </section>
          ) : null}

          {activeView === "dashboard" ? (
            <DashboardView
              selectedAsset={selectedAsset}
              dashboard={dashboard.data}
              loading={dashboard.loading}
              error={dashboard.error}
              onRetry={dashboard.reload}
            />
          ) : null}
          {activeView === "asset" ? (
            <AssetView
              asset={asset.data}
              selectedAsset={selectedAsset}
              loading={asset.loading}
              error={asset.error}
              onRetry={asset.reload}
            />
          ) : null}
          {activeView === "watchlist" ? (
            <WatchlistView
              watchlist={dashboard.data?.watchlist ?? []}
              assetUniverse={assetUniverse.data ?? []}
              loading={dashboard.loading || assetUniverse.loading}
              error={dashboard.error ?? assetUniverse.error}
              onRetry={() => {
                dashboard.reload();
                assetUniverse.reload();
              }}
              onSelectAsset={(symbol) => {
                setSelectedAssetId(symbol);
                setActiveView("asset");
              }}
              onWatchlistChange={async (symbols) => {
                await api.updateDefaultWatchlist(symbols);
                dashboard.reload();
                asset.reload();
              }}
            />
          ) : null}
          {activeView === "research" ? (
            <ResearchView onGlobalRefresh={reloadEverything} backendStatus={backendStatus} />
          ) : null}
          {activeView === "factorLab" ? <FactorLabView backendStatus={backendStatus} /> : null}
          {activeView === "strategyLab" ? <StrategyLabView backendStatus={backendStatus} /> : null}
          {activeView === "workflowStudio" ? <WorkflowStudioView backendStatus={backendStatus} /> : null}
          {activeView === "dataSources" ? <DataSourcesView backendStatus={backendStatus} /> : null}
          {activeView === "screeners" ? <ScreenersView onGlobalRefresh={reloadEverything} /> : null}
          {activeView === "manual" ? <ManualView /> : null}
          {activeView === "portfolio" ? (
            <PortfolioView
              assetOptions={dashboard.data?.watchlist ?? []}
              assetUniverse={assetUniverse.data ?? []}
              onGlobalRefresh={reloadEverything}
              backendStatus={backendStatus}
            />
          ) : null}
          {activeView === "connections" ? (
            <ConnectionsView onRestart={handleRestartSidecar} onGlobalRefresh={reloadEverything} runtime={runtime.data} />
          ) : null}
          {activeView === "settings" ? (
            <SettingsView
              appRuntime={runtime.data}
              activeView={activeView}
              onDefaultViewSaved={setActiveView}
              onGlobalRefresh={reloadEverything}
              diagnosticsExport={diagnosticsExport}
              diagnosticsBusy={diagnosticsBusy}
              onExportDiagnostics={handleExportDiagnostics}
            />
          ) : null}
        </div>
      </main>
      <CommandPalette onGlobalRefresh={reloadEverything} sidecarReady={sidecarReady} />
    </div>
  );
}

export default App;
