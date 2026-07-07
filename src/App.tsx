import {
  ArrowRight,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Cable,
  ChartCandlestick,
  ChevronDown,
  Command,
  DatabaseZap,
  FolderCog,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  Lock,
  RefreshCcw,
  Search,
  Sparkles,
  Star,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CommandPalette } from "./components/command-palette";
import { LocalUnlockGate } from "./components/local-unlock-gate";
import { InlineState, StatusBadge, type BackendStatus } from "./components/shared";
import { useAsyncResource } from "./hooks/use-async-resource";
import { useI18n } from "./i18n";
import {
  api,
  type AppPreferences,
  type AIControlPreferences,
  type AssetSearchResult,
  type AssetWorkspaceResponse,
  type DashboardOverviewResponse,
  type DemoModeStatus,
  type DiagnosticsExportResult,
  type LocalSecurityStatus,
  type OnboardingState,
  type OnboardingStepKey,
  type SetupStatus,
  type UpdateAIControlPreferencesRequest,
} from "./lib/api";
import { FirstRunOnboarding } from "./components/first-run-onboarding";
import { deriveDesktopConnectionStatus, getRuntimeConfig, type RuntimeConfig } from "./lib/runtime";
import { getNavigationGroupForView, getNavigationItem, navigationGroups, type NavGroupKey } from "./navigation";
import { useAppStore, type ViewKey } from "./store/app-store";
import { AssetView } from "./views/asset-view";
import { CommandCenterView } from "./views/command-center-view";
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

const navigationGroupIcons: Record<NavGroupKey, typeof LayoutDashboard> = {
  home: LayoutDashboard,
  research: Search,
  markets: ChartCandlestick,
  portfolio: BriefcaseBusiness,
  factorLab: FlaskConical,
  automation: Workflow,
  settings: FolderCog,
};

const navigationViewIcons: Record<ViewKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  commandCenter: Command,
  asset: ChartCandlestick,
  watchlist: Star,
  research: Search,
  factorLab: FlaskConical,
  strategyLab: LineChart,
  workflowStudio: Workflow,
  dataSources: DatabaseZap,
  screeners: BarChart3,
  manual: BookOpen,
  portfolio: BriefcaseBusiness,
  connections: Cable,
  settings: FolderCog,
};

const sensitiveViews = new Set<ViewKey>([
  "research",
  "factorLab",
  "strategyLab",
  "workflowStudio",
  "dataSources",
  "portfolio",
  "connections",
  "settings",
]);

const securitySurfaceByView: Partial<Record<ViewKey, string>> = {
  research: "research_workspace",
  factorLab: "factor_lab",
  strategyLab: "execution_risk",
  workflowStudio: "workflow_sensitive",
  dataSources: "data_sources",
  portfolio: "portfolio",
  connections: "provider_credentials",
  settings: "settings_runtime",
};

const onboardingStepKeys: OnboardingStepKey[] = [
  "demo_mode",
  "provider_setup",
  "local_unlock",
  "privacy_boundary",
  "execution_boundary",
];

function App() {
  const activeView = useAppStore((state) => state.activeView);
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const commandPaletteOpen = useAppStore((state) => state.commandPaletteOpen);
  const latestCommandFeedback = useAppStore((state) => state.latestCommandFeedback);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const [expandedNavGroups, setExpandedNavGroups] = useState<Set<NavGroupKey>>(
    () => new Set([getNavigationGroupForView(activeView).key]),
  );
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
  const [localSecurityBusy, setLocalSecurityBusy] = useState(false);
  const [onboardingSeenOverride, setOnboardingSeenOverride] = useState<string | null | undefined>(undefined);
  const [shellActionError, setShellActionError] = useState<string | null>(null);
  const [aiControlSaving, setAIControlSaving] = useState(false);
  const [aiControlError, setAIControlError] = useState<string | null>(null);
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
  const aiControl = useAsyncResource<AIControlPreferences>(async () => api.getAIControlPreferences(), [], {
    enabled: sidecarReady,
  });
  const onboarding = useAsyncResource<OnboardingState>(async () => api.getOnboardingState(), [], {
    enabled: sidecarReady,
  });
  const demoMode = useAsyncResource<DemoModeStatus>(async () => api.getDemoModeStatus(), [], {
    enabled: sidecarReady,
  });
  const localSecurity = useAsyncResource<LocalSecurityStatus>(async () => api.getLocalSecurityStatus(), [], {
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
    aiControl.reload();
    onboarding.reload();
    demoMode.reload();
    localSecurity.reload();
    connectionsStatus.reload();
  }, [
    aiControl,
    asset,
    assetUniverse,
    backendStatus,
    connectionsStatus,
    dashboard,
    demoMode,
    localSecurity,
    onboarding,
    preferences,
  ]);

  const selectedAsset =
    dashboard.data?.watchlist.find((item) => item.symbol === selectedAssetId) ??
    dashboard.data?.focus_asset ??
    dashboard.data?.watchlist[0] ??
    null;
  const activeNav = getNavigationItem(activeView);
  const activeNavigationGroup = getNavigationGroupForView(activeView);
  const isDashboardView = activeView === "dashboard";
  const activeViewRequiresUnlock = sensitiveViews.has(activeView);
  const localSecurityStatus = localSecurity.data;
  const activeViewLocked =
    sidecarReady &&
    activeViewRequiresUnlock &&
    localSecurityStatus !== null &&
    (!localSecurityStatus.initialized || localSecurityStatus.locked);

  useEffect(() => {
    setExpandedNavGroups((current) => {
      if (current.size === 1 && current.has(activeNavigationGroup.key)) return current;
      return new Set([activeNavigationGroup.key]);
    });
  }, [activeNavigationGroup.key]);

  function handleNavigationGroup(groupKey: NavGroupKey) {
    const group = navigationGroups.find((candidate) => candidate.key === groupKey) ?? navigationGroups[0];
    if (group.items.length === 1) {
      setActiveView(group.defaultView);
      return;
    }
    if (activeNavigationGroup.key !== group.key) {
      setActiveView(group.defaultView);
      setExpandedNavGroups(new Set([group.key]));
      return;
    }
    setExpandedNavGroups((current) => {
      const next = new Set(current);
      if (next.has(group.key)) next.delete(group.key);
      else next.add(group.key);
      return next;
    });
  }

  const searchableAssets = assetUniverse.data?.length ? assetUniverse.data : (dashboard.data?.watchlist ?? []);
  const searchResults = searchableAssets.filter((assetItem) => {
    const keyword = `${assetItem.symbol} ${assetItem.name} ${assetItem.market}`.toLowerCase();
    return keyword.includes(searchTerm.toLowerCase());
  });

  const diagnosticsEnabled = preferences.data?.diagnostics_export_enabled ?? true;
  const onboardingSeenAt =
    onboardingSeenOverride !== undefined ? onboardingSeenOverride : onboarding.data?.onboarding_seen_at;
  const currentOnboarding: OnboardingState = onboarding.data ?? {
    onboarding_seen_at: onboardingSeenAt ?? null,
    checklist: onboardingStepKeys.map((key) => ({ key, completed_at: null })),
  };
  const missingProviders = (connectionsStatus.data?.providers ?? [])
    .filter((provider) => provider.requires_credentials)
    .map((provider) => provider.label);
  const setupStatus: SetupStatus = {
    firstRun: !onboarding.loading && !onboarding.error && onboardingSeenAt == null,
    needsSetup: backendStatus === "offline" || missingProviders.length > 0,
    sidecarOffline: backendStatus === "offline",
    missingProviders,
  };
  const noKeyDemoReady =
    sidecarReady &&
    demoMode.data?.no_key_evaluation_ready === true &&
    (demoMode.data.missing_credentials.length > 0 || missingProviders.length > 0);

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
    aiControl.reload();
    onboarding.reload();
    demoMode.reload();
    connectionsStatus.reload();
  }

  async function handleSaveAIControl(payload: UpdateAIControlPreferencesRequest) {
    setAIControlSaving(true);
    setAIControlError(null);
    try {
      await api.updateAIControlPreferences(payload);
      aiControl.reload();
    } catch (error) {
      setAIControlError(error instanceof Error ? error.message : "Failed to save AI settings.");
      throw error;
    } finally {
      setAIControlSaving(false);
    }
  }

  async function handleInitializeLocalSecurity(unlockSecret: string) {
    setLocalSecurityBusy(true);
    setShellActionError(null);
    try {
      await api.initializeLocalSecurity(unlockSecret);
      localSecurity.reload();
    } catch (error) {
      setShellActionError(error instanceof Error ? error.message : "Failed to initialize local unlock.");
      throw error;
    } finally {
      setLocalSecurityBusy(false);
    }
  }

  async function handleUnlockLocalSecurity(unlockSecret: string) {
    setLocalSecurityBusy(true);
    setShellActionError(null);
    try {
      await api.unlockLocalSecurity(unlockSecret);
      localSecurity.reload();
    } catch (error) {
      setShellActionError(error instanceof Error ? error.message : "Failed to unlock sensitive surfaces.");
      throw error;
    } finally {
      setLocalSecurityBusy(false);
    }
  }

  async function handleLockLocalSecurity() {
    if (!localSecurity.data?.initialized || localSecurity.data.locked) {
      return;
    }
    setLocalSecurityBusy(true);
    try {
      await api.lockLocalSecurity();
      localSecurity.reload();
    } finally {
      setLocalSecurityBusy(false);
    }
  }

  async function handleResetLocalSecurity(confirmation: string) {
    setLocalSecurityBusy(true);
    setShellActionError(null);
    try {
      await api.resetLocalSecurity(confirmation);
      localSecurity.reload();
    } catch (error) {
      setShellActionError(error instanceof Error ? error.message : "Failed to reset local unlock.");
      throw error;
    } finally {
      setLocalSecurityBusy(false);
    }
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
      await api.updateOnboardingState({ ...currentOnboarding, onboarding_seen_at: nextSeenAt });
      setOnboardingSeenOverride(nextSeenAt);
      onboarding.reload();
    } catch (error) {
      setShellActionError(error instanceof Error ? error.message : "Failed to update onboarding state.");
    } finally {
      setOnboardingBusy(false);
    }
  }

  async function handleToggleOnboardingStep(stepKey: OnboardingStepKey, completed: boolean) {
    const completedAt = completed ? new Date().toISOString() : null;
    const knownKeys = new Set(currentOnboarding.checklist.map((item) => item.key));
    const checklist = [
      ...currentOnboarding.checklist.map((item) =>
        item.key === stepKey ? { ...item, completed_at: completedAt } : item,
      ),
      ...onboardingStepKeys
        .filter((key) => !knownKeys.has(key))
        .map((key) => ({ key, completed_at: key === stepKey ? completedAt : null })),
    ];

    setOnboardingBusy(true);
    setShellActionError(null);
    try {
      await api.updateOnboardingState({ ...currentOnboarding, checklist });
      onboarding.reload();
    } catch (error) {
      setShellActionError(error instanceof Error ? error.message : "Failed to update onboarding checklist.");
    } finally {
      setOnboardingBusy(false);
    }
  }

  useEffect(() => {
    if (!sidecarReady || !localSecurity.data?.initialized || localSecurity.data.locked) {
      return;
    }

    let idleTimer: number | null = null;
    let lastTouch = 0;
    const timeoutMs = Math.max(localSecurity.data.idle_timeout_seconds, 30) * 1000;
    const touchIntervalMs = 30_000;

    const resetIdleTimer = () => {
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
      }
      idleTimer = window.setTimeout(() => {
        void api.idleTimeoutLocalSecurity().finally(localSecurity.reload);
      }, timeoutMs);
    };

    const handleActivity = () => {
      resetIdleTimer();
      if (!activeViewRequiresUnlock) {
        return;
      }
      const now = Date.now();
      if (now - lastTouch < touchIntervalMs) {
        return;
      }
      lastTouch = now;
      void api.touchLocalSecurity(securitySurfaceByView[activeView] ?? activeView).catch(() => undefined);
    };

    resetIdleTimer();
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("scroll", handleActivity, true);

    return () => {
      if (idleTimer !== null) {
        window.clearTimeout(idleTimer);
      }
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("scroll", handleActivity, true);
    };
  }, [activeView, activeViewRequiresUnlock, localSecurity, localSecurity.data, sidecarReady]);

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
          <nav className="nav-stack" aria-label={i18n.t("nav.section")}>
            {navigationGroups.map((group) => {
              const GroupIcon = navigationGroupIcons[group.key];
              const isActiveGroup = activeNavigationGroup.key === group.key;
              const hasChildren = group.items.length > 1;
              const isExpanded = hasChildren && expandedNavGroups.has(group.key);
              const childListId = `nav-group-${group.key}-items`;
              return (
                <div className={`nav-group ${isActiveGroup ? "active" : ""}`} key={group.key}>
                  <button
                    aria-controls={hasChildren ? childListId : undefined}
                    aria-expanded={hasChildren ? isExpanded : undefined}
                    aria-label={hasChildren ? `nav-group-${group.key}` : `nav-${group.defaultView}`}
                    className={`nav-group-trigger ${isActiveGroup ? "active" : ""}`}
                    onClick={() => handleNavigationGroup(group.key)}
                    type="button"
                  >
                    <span className="nav-icon"><GroupIcon size={18} /></span>
                    <span className="nav-group-label">{i18n.t(`nav.group.${group.key}`)}</span>
                    {hasChildren ? <ChevronDown className={`nav-chevron ${isExpanded ? "expanded" : ""}`} size={15} /> : null}
                  </button>
                  {hasChildren && isExpanded ? (
                    <div className="nav-group-children" id={childListId}>
                      {group.items.map((item) => {
                        const ItemIcon = navigationViewIcons[item.viewKey];
                        return (
                          <button
                            aria-label={`nav-${item.viewKey}`}
                            className={`nav-child-item ${activeView === item.viewKey ? "active" : ""}`}
                            key={item.viewKey}
                            onClick={() => setActiveView(item.viewKey)}
                            type="button"
                          >
                            <ItemIcon size={14} />
                            <span>{i18n.viewLabel(item.viewKey)}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>

      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{i18n.viewEyebrow(activeNav.viewKey)}</p>
            <h2>{i18n.viewTitle(activeNav.viewKey)}</h2>
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
            {localSecurity.data?.initialized && !localSecurity.data.locked ? (
              <button
                aria-label="local-security-lock"
                className="ghost-button"
                disabled={localSecurityBusy}
                onClick={() => void handleLockLocalSecurity()}
                type="button"
              >
                <Lock size={16} />
                {language === "zh-CN" ? "锁定" : "Lock"}
              </button>
            ) : null}
          </div>
        </header>

        <div className="workspace-scroll">
          {isDashboardView && setupStatus.firstRun ? (
            <FirstRunOnboarding
              state={currentOnboarding}
              demoMode={demoMode.data ?? null}
              setupStatus={setupStatus}
              localSecurity={localSecurity.data ?? null}
              backendStatus={backendStatus}
              language={language}
              busy={onboardingBusy}
              onToggleStep={handleToggleOnboardingStep}
              onDismiss={handleDismissOnboarding}
              onOpenView={setActiveView}
            />
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

          {isDashboardView && noKeyDemoReady && demoMode.data ? (
            <section
              aria-label={`demo-mode-banner mode=${demoMode.data.mode} missing=${demoMode.data.missing_credentials.length}`}
              className="card panel-banner compact demo-mode-banner"
            >
              <div className="panel-banner-head">
                <div>
                  <p className="eyebrow">NO-KEY DEMO</p>
                  <h3>{language === "zh-CN" ? "无 key 也可以先评估产品" : "Evaluate Pengbo without provider keys"}</h3>
                </div>
                <span className="mini-pill accent">sample</span>
              </div>
              <p className="body-copy">
                {language === "zh-CN"
                  ? "当前启动路径使用本地 seed、sample 和缓存友好的状态展示产品主流程；需要凭证的能力仍会明确显示为 credential_required 或 missing_credentials。"
                  : "This startup path uses local seed, sample, and cache-friendly states for product evaluation; credential-gated capabilities remain visible as credential_required or missing_credentials."}
              </p>
              <div className="demo-mode-grid">
                <div>
                  <strong>{language === "zh-CN" ? "可先查看" : "Available now"}</strong>
                  <span>{demoMode.data.sample_surfaces.slice(0, 5).join(", ")}</span>
                </div>
                <div>
                  <strong>{language === "zh-CN" ? "仍需凭证" : "Still gated"}</strong>
                  <span>{demoMode.data.credential_gated_surfaces.slice(0, 4).join(", ")}</span>
                </div>
              </div>
              <div className="hero-actions">
                <button className="primary-button" type="button" onClick={() => setActiveView("dataSources")}>
                  {language === "zh-CN" ? "查看数据源边界" : "Review data-source boundaries"}
                  <ArrowRight size={16} />
                </button>
                <button className="ghost-button" type="button" onClick={() => setActiveView("portfolio")}>
                  {language === "zh-CN" ? "查看组合 sample" : "View portfolio sample"}
                </button>
              </div>
            </section>
          ) : null}

          {activeViewRequiresUnlock && localSecurity.loading && !localSecurity.data ? (
            <section className="card panel-banner compact">
              <InlineState label={language === "zh-CN" ? "正在检查本地解锁状态..." : "Checking local unlock state..."} />
            </section>
          ) : null}

          {activeViewLocked && localSecurityStatus ? (
            <LocalUnlockGate
              status={localSecurityStatus}
              language={language}
              viewLabel={i18n.viewLabel(activeView)}
              busy={localSecurityBusy}
              onInitialize={handleInitializeLocalSecurity}
              onUnlock={handleUnlockLocalSecurity}
              onReset={handleResetLocalSecurity}
            />
          ) : null}

          {!activeViewLocked && isDashboardView ? (
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

          {!activeViewLocked && activeView === "dashboard" ? (
            <DashboardView
              selectedAsset={selectedAsset}
              dashboard={dashboard.data}
              loading={dashboard.loading}
              error={dashboard.error}
              onRetry={dashboard.reload}
              aiControl={aiControl.data}
              aiSaving={aiControlSaving}
              aiError={aiControl.error ?? aiControlError}
              onSaveAIControl={handleSaveAIControl}
              onOpenResearch={() => setActiveView("research")}
            />
          ) : null}
          {!activeViewLocked && activeView === "commandCenter" ? (
            <CommandCenterView backendStatus={backendStatus} onGlobalRefresh={reloadEverything} />
          ) : null}
          {!activeViewLocked && activeView === "asset" ? (
            <AssetView
              asset={asset.data}
              selectedAsset={selectedAsset}
              loading={asset.loading}
              error={asset.error}
              onRetry={asset.reload}
            />
          ) : null}
          {!activeViewLocked && activeView === "watchlist" ? (
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
          {!activeViewLocked && activeView === "research" ? (
            <ResearchView onGlobalRefresh={reloadEverything} backendStatus={backendStatus} />
          ) : null}
          {!activeViewLocked && activeView === "factorLab" ? <FactorLabView backendStatus={backendStatus} /> : null}
          {!activeViewLocked && activeView === "strategyLab" ? <StrategyLabView backendStatus={backendStatus} /> : null}
          {!activeViewLocked && activeView === "workflowStudio" ? <WorkflowStudioView backendStatus={backendStatus} /> : null}
          {!activeViewLocked && activeView === "dataSources" ? <DataSourcesView backendStatus={backendStatus} /> : null}
          {!activeViewLocked && activeView === "screeners" ? <ScreenersView onGlobalRefresh={reloadEverything} /> : null}
          {!activeViewLocked && activeView === "manual" ? <ManualView /> : null}
          {!activeViewLocked && activeView === "portfolio" ? (
            <PortfolioView
              assetOptions={dashboard.data?.watchlist ?? []}
              assetUniverse={assetUniverse.data ?? []}
              onGlobalRefresh={reloadEverything}
              backendStatus={backendStatus}
            />
          ) : null}
          {!activeViewLocked && activeView === "connections" ? (
            <ConnectionsView onRestart={handleRestartSidecar} onGlobalRefresh={reloadEverything} runtime={runtime.data} />
          ) : null}
          {!activeViewLocked && activeView === "settings" ? (
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
