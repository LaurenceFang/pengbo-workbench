import {
  ArrowRight,
  Bot,
  Command,
  Lock,
  Menu,
  PanelRightOpen,
  RefreshCcw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { CommandPalette } from "./components/command-palette";
import { Button } from "./components/button";
import { AppShell } from "./components/app-shell";
import { AppSidebar } from "./components/app-sidebar";
import { AppToolbar } from "./components/app-toolbar";
import { ContextRail } from "./components/context-rail";
import { StatusBadge, type BackendStatus } from "./components/shared";
import { useAsyncResource } from "./hooks/use-async-resource";
import { usePengboNavigation } from "./hooks/use-pengbo-navigation";
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
import { AppRouteOutlet } from "./router";
import { defaultRouteByView, getFrameRouteForPath, getRouteObjectType, getRouteParams, materializeRoutePath } from "./routes/route-registry";

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
  const location = useLocation();
  const { openAsset, openRoute, openView } = usePengboNavigation();
  const activeView = useAppStore((state) => state.activeView);
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const commandPaletteOpen = useAppStore((state) => state.commandPaletteOpen);
  const latestCommandFeedback = useAppStore((state) => state.latestCommandFeedback);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const [expandedNavGroups, setExpandedNavGroups] = useState<Set<NavGroupKey>>(
    () => new Set([getNavigationGroupForView(activeView).key]),
  );
  const [contextRailCollapsed, setContextRailCollapsed] = useState(false);
  const [contextDrawerOpen, setContextDrawerOpen] = useState(false);
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
  const setCommandPaletteOpen = useAppStore((state) => state.setCommandPaletteOpen);
  const setSelectedAssetId = useAppStore((state) => state.setSelectedAssetId);
  const language = useAppStore((state) => state.language);
  const density = useAppStore((state) => state.density);
  const theme = useAppStore((state) => state.theme);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setDensity = useAppStore((state) => state.setDensity);
  const setTheme = useAppStore((state) => state.setTheme);
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
  const dashboardRefreshRequested = useRef(false);
  const assetRefreshRequested = useRef(false);
  const frameRoute = getFrameRouteForPath(location.pathname);
  const frameRouteParams = frameRoute ? getRouteParams(frameRoute, location.pathname) : {};
  const frameRouteObjectId = frameRouteParams.symbol ?? frameRouteParams.briefId ?? frameRouteParams.runId ?? frameRouteParams.backtestId ?? frameRouteParams.sessionId ?? frameRouteParams.provider ?? frameRouteParams.listId ?? frameRoute?.componentKey ?? selectedAssetId;
  const aiRouteActive = frameRoute?.topLevelView === "aiAssistant";
  const shellView: ViewKey = frameRoute?.topLevelView && frameRoute.topLevelView !== "aiAssistant"
    ? frameRoute.topLevelView
    : aiRouteActive
      ? "workflowStudio"
      : activeView;
  const activeNav = getNavigationItem(shellView);
  const activeNavigationGroup = getNavigationGroupForView(shellView);
  const isRootRoute = location.pathname === "/";
  const dashboardSurfaceActive = !isRootRoute && (shellView === "dashboard" || shellView === "watchlist" || shellView === "portfolio");
  const assetSurfaceActive = !isRootRoute && shellView === "asset";

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
  const localSecurity = useAsyncResource<LocalSecurityStatus>(async () => api.getLocalSecurityStatus(), [], {
    enabled: sidecarReady,
  });
  const routeAccessReady = frameRoute?.accessPolicy !== "local_unlock" || (
    localSecurity.data?.initialized === true && localSecurity.data.locked === false
  );
  const dashboard = useAsyncResource<DashboardOverviewResponse>(async () => {
    const refresh = dashboardRefreshRequested.current;
    dashboardRefreshRequested.current = false;
    return api.getDashboardOverview({ refresh });
  }, [], { enabled: sidecarReady && routeAccessReady && dashboardSurfaceActive });
  const assetUniverse = useAsyncResource<AssetSearchResult[]>(async () => api.searchAssets(""), [], {
    enabled: sidecarReady && routeAccessReady,
  });
  const preferences = useAsyncResource<AppPreferences>(async () => api.getSettingsPreferences(), [], {
    enabled: sidecarReady && routeAccessReady,
  });
  const aiControl = useAsyncResource<AIControlPreferences>(async () => api.getAIControlPreferences(), [], {
    enabled: sidecarReady && routeAccessReady,
  });
  const onboarding = useAsyncResource<OnboardingState>(async () => api.getOnboardingState(), [], {
    enabled: sidecarReady,
  });
  const demoMode = useAsyncResource<DemoModeStatus>(async () => api.getDemoModeStatus(), [], {
    enabled: sidecarReady,
  });
  const connectionsStatus = useAsyncResource(async () => api.getConnectionsStatus(), [], {
    enabled: sidecarReady && routeAccessReady,
  });
  const asset = useAsyncResource<AssetWorkspaceResponse | null>(
    async () => {
      const refresh = assetRefreshRequested.current;
      assetRefreshRequested.current = false;
      return selectedAssetId ? api.getAssetWorkspace(selectedAssetId, { refresh }) : null;
    },
    [selectedAssetId],
    { enabled: sidecarReady && routeAccessReady && assetSurfaceActive },
  );

  function refreshDashboardFromProviders() {
    dashboardRefreshRequested.current = true;
    dashboard.reload();
  }

  function refreshAssetFromProviders() {
    assetRefreshRequested.current = true;
    asset.reload();
  }

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
    setTheme(preferences.data.theme);
    setPreferencesHydrated(true);
  }, [preferences.data, preferencesHydrated, setActiveView, setDensity, setLanguage, setTheme]);

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
      previousBackendStatus.current === "offline";
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
  const activeViewRequiresUnlock = frameRoute ? frameRoute.accessPolicy === "local_unlock" : sensitiveViews.has(shellView);
  const localSecurityStatus = localSecurity.data;
  const activeViewLocked =
    sidecarReady &&
    activeViewRequiresUnlock &&
    localSecurityStatus !== null &&
    (!localSecurityStatus.initialized || localSecurityStatus.locked);

  useEffect(() => {
    if (frameRoute && frameRoute.topLevelView !== "aiAssistant" && frameRoute.topLevelView !== activeView) {
      setActiveView(frameRoute.topLevelView);
    }
  }, [activeView, frameRoute, setActiveView]);

  useEffect(() => {
    setExpandedNavGroups((current) => {
      if (current.size === 1 && current.has(activeNavigationGroup.key)) return current;
      return new Set([activeNavigationGroup.key]);
    });
  }, [activeNavigationGroup.key]);

  function navigateToView(view: ViewKey) {
    setSidebarDrawerOpen(false);
    openView(view, { params: { symbol: selectedAssetId || "AAPL" } });
  }

  function handleNavigationGroup(groupKey: NavGroupKey) {
    const group = navigationGroups.find((candidate) => candidate.key === groupKey) ?? navigationGroups[0];
    if (group.items.length === 1) {
      navigateToView(group.defaultView);
      return;
    }
    if (activeNavigationGroup.key !== group.key) {
      navigateToView(group.defaultView);
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
  const rootPath = preferences.data
    ? materializeRoutePath(defaultRouteByView[preferences.data.default_view] ?? "/dashboard/overview", {
        symbol: selectedAssetId || "AAPL",
      })
    : null;

  async function reloadEverything() {
    runtime.reload();
    health.reload();
    refreshDashboardFromProviders();
    assetUniverse.reload();
    refreshAssetFromProviders();
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
      void api.touchLocalSecurity(securitySurfaceByView[shellView] ?? shellView).catch(() => undefined);
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
  }, [activeViewRequiresUnlock, localSecurity, localSecurity.data, shellView, sidecarReady]);

  const routeBusinessDependencies = {
    globalNotice: shellActionError ? (
      <section className="card panel-banner compact">
        <div className="task-item"><TriangleAlert size={16} /><span>{shellActionError}</span></div>
      </section>
    ) : null,
    dashboardPrelude: (
      <>
        {setupStatus.firstRun ? (
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
            onOpenView={openView}
          />
        ) : null}
        {!setupStatus.firstRun && setupStatus.needsSetup ? (
          <section className="card panel-banner compact">
            <div className="panel-banner-head">
              <div><p className="eyebrow">{i18n.t("setup.environment")}</p><h3>{setupStatus.sidecarOffline ? i18n.t("setup.sidecarOfflineTitle") : i18n.t("setup.providersNeedSetupTitle")}</h3></div>
              <span className="mini-pill">{setupStatus.sidecarOffline ? "offline" : "pending"}</span>
            </div>
            <p className="body-copy">{setupLead}</p>
            <div className="hero-actions">
              <Button variant="ghost" onClick={() => openView("connections")}>{i18n.t("setup.openConnections")}</Button>
              <Button variant="ghost" onClick={() => openView("settings")}>{i18n.t("setup.openSettings")}</Button>
              {setupStatus.sidecarOffline ? <Button variant="ghost" disabled={actionBusy} onClick={handleRestartSidecar}><RefreshCcw size={16} />{actionBusy ? i18n.t("runtime.restarting") : i18n.t("setup.restartSidecar")}</Button> : null}
              <Button disabled={diagnosticsBusy || runtime.data?.mode !== "tauri" || !diagnosticsEnabled} onClick={handleExportDiagnostics} variant="ghost">{diagnosticsBusy ? i18n.t("runtime.exporting") : i18n.t("setup.exportDiagnostics")}</Button>
            </div>
            {diagnosticsDisabledReason ? <p className="panel-note">{diagnosticsDisabledReason}</p> : null}
            {diagnosticsExport ? <p className="panel-note">{i18n.t("setup.diagnosticsExported")} {diagnosticsExport.exportPath}</p> : null}
          </section>
        ) : null}
        {noKeyDemoReady && demoMode.data ? (
          <section aria-label={`demo-mode-banner mode=${demoMode.data.mode} missing=${demoMode.data.missing_credentials.length}`} className="card panel-banner compact demo-mode-banner">
            <div className="panel-banner-head"><div><p className="eyebrow">NO-KEY DEMO</p><h3>{language === "zh-CN" ? "无 key 也可以先评估产品" : "Evaluate Pengbo without provider keys"}</h3></div><span className="mini-pill accent">sample</span></div>
            <p className="body-copy">{language === "zh-CN" ? "当前启动路径使用本地 seed、sample 和缓存友好的状态展示产品主流程；需要凭证的能力仍会明确显示。" : "This startup path uses local seed, sample, and cache-friendly states for product evaluation; credential-gated capabilities remain visible."}</p>
            <div className="demo-mode-grid"><div><strong>{language === "zh-CN" ? "可先查看" : "Available now"}</strong><span>{demoMode.data.sample_surfaces.slice(0, 5).join(", ")}</span></div><div><strong>{language === "zh-CN" ? "仍需凭证" : "Still gated"}</strong><span>{demoMode.data.credential_gated_surfaces.slice(0, 4).join(", ")}</span></div></div>
            <div className="hero-actions"><Button variant="primary" onClick={() => openView("dataSources")}>{language === "zh-CN" ? "查看数据源边界" : "Review data-source boundaries"}<ArrowRight size={16} /></Button><Button variant="ghost" onClick={() => openView("portfolio")}>{language === "zh-CN" ? "查看组合 sample" : "View portfolio sample"}</Button></div>
          </section>
        ) : null}
      </>
    ),
    dashboard: {
      selectedAsset,
      dashboard: dashboard.data,
      loading: dashboard.loading,
      error: dashboard.error,
      onRetry: refreshDashboardFromProviders,
      onOpenResearch: () => openView("research"),
      onOpenAI: () => openRoute("/ai-assistant"),
    },
    commandCenter: { backendStatus, onGlobalRefresh: reloadEverything },
    asset: {
      asset: asset.data,
      selectedAsset,
      loading: asset.loading,
      error: asset.error,
      onRetry: refreshAssetFromProviders,
      sensitiveContextReady: localSecurity.data?.initialized === true && !localSecurity.data.locked,
    },
    watchlist: {
      watchlist: dashboard.data?.watchlist ?? [],
      assetUniverse: assetUniverse.data ?? [],
      loading: dashboard.loading || assetUniverse.loading,
      error: dashboard.error ?? assetUniverse.error,
      onRetry: () => { refreshDashboardFromProviders(); assetUniverse.reload(); },
      onSelectAsset: (symbol: string) => { setSelectedAssetId(symbol); openAsset(symbol); },
      onWatchlistChange: async (symbols: string[]) => { await api.updateDefaultWatchlist(symbols); refreshDashboardFromProviders(); refreshAssetFromProviders(); },
    },
    research: { onGlobalRefresh: reloadEverything, backendStatus },
    factorLab: { backendStatus },
    strategyLab: { backendStatus },
    workflowStudio: { backendStatus },
    dataSources: { backendStatus },
    screeners: { onGlobalRefresh: reloadEverything },
    manual: {},
    portfolio: { assetOptions: dashboard.data?.watchlist ?? [], assetUniverse: assetUniverse.data ?? [], onGlobalRefresh: reloadEverything, backendStatus },
    connections: { onRestart: handleRestartSidecar, onGlobalRefresh: reloadEverything, runtime: runtime.data },
    settings: {
      appRuntime: runtime.data,
      activeView: shellView,
      onDefaultViewSaved: setActiveView,
      onGlobalRefresh: reloadEverything,
      diagnosticsExport,
      diagnosticsBusy,
      onExportDiagnostics: handleExportDiagnostics,
    },
    aiAssistant: {
      preferences: aiControl.data,
      loading: aiControl.loading,
      saving: aiControlSaving,
      error: aiControl.error ?? aiControlError,
      onSave: handleSaveAIControl,
    },
  };

  return (
    <>
      <AppShell
        contextRailCollapsed={contextRailCollapsed}
        density={density}
        theme={theme}
        sidebar={(
          <AppSidebar
            mobileOpen={sidebarDrawerOpen}
            backendStatus={backendStatus}
            activeGroup={activeNavigationGroup.key}
            activeView={aiRouteActive ? null : activeView}
            expandedGroups={expandedNavGroups}
            groupLabel={(key) => i18n.t(`nav.group.${key}`)}
            navigationLabel={i18n.t("nav.section")}
            onGroupClick={handleNavigationGroup}
            onViewClick={navigateToView}
            viewLabel={i18n.viewLabel}
          />
        )}
        toolbar={(
          <AppToolbar
            brandEyebrow={i18n.t("app.brandEyebrow")}
            brandName={i18n.t("app.brandName")}
            eyebrow={aiRouteActive ? "AI" : i18n.viewEyebrow(activeNav.viewKey)}
            frameLabel={frameRoute ? `${String(frameRoute.frameNo).padStart(2, "0")} / FRAME` : undefined}
            title={aiRouteActive ? frameRoute.label : i18n.viewTitle(activeNav.viewKey)}
          >
            <Button aria-controls="pengbo-sidebar" aria-expanded={sidebarDrawerOpen} aria-label="打开导航" className="sidebar-drawer-trigger" onClick={() => setSidebarDrawerOpen((open) => !open)} variant="ghost"><Menu size={17} /></Button>
            <Button aria-controls="pengbo-context-inspector" aria-expanded={contextDrawerOpen} aria-label="打开上下文检查器" className="context-drawer-trigger" onClick={() => setContextDrawerOpen((open) => !open)} variant="ghost"><PanelRightOpen size={17} /></Button>
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
                        openAsset(assetItem.symbol);
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

            <Button
              aria-label="open-command-palette"
              className={`palette-launch ${commandPaletteOpen ? "active" : ""}`}
              onClick={() => setCommandPaletteOpen(!commandPaletteOpen)}
              variant="ghost"
            >
              <Command size={16} />
              {i18n.t("topbar.commandPalette")}
            </Button>

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
            {frameRoute?.aiPolicy.mode !== "none" ? (
              <Button aria-label={language === "zh-CN" ? "打开 AI 助手" : "Open AI assistant"} className="toolbar-ai-launch" onClick={() => openRoute("/ai-assistant")} variant="ghost">
                <Bot size={16} />
                {language === "zh-CN" ? "打开 AI 助手" : "Open AI assistant"}
              </Button>
            ) : null}
            {localSecurity.data?.initialized && !localSecurity.data.locked ? (
              <Button
                aria-label="local-security-lock"
                disabled={localSecurityBusy}
                onClick={() => void handleLockLocalSecurity()}
                variant="ghost"
              >
                <Lock size={16} />
                {language === "zh-CN" ? "锁定" : "Lock"}
              </Button>
            ) : null}
          </AppToolbar>
        )}
        contextRail={(
          <ContextRail
            backendStatus={backendStatus}
            collapsed={contextRailCollapsed}
            drawerOpen={contextDrawerOpen}
            routeId={frameRoute?.svgRoute ?? `view/${activeView}`}
            objectType={frameRoute ? getRouteObjectType(frameRoute) : "app-shell-context"}
            objectId={frameRouteObjectId}
            source={frameRoute?.availability.kind === "planned" ? "planned route contract" : backendStatus === "online" ? "local API / local cache" : backendStatus}
            freshness={frameRoute?.availability.kind === "planned" ? "not available" : backendStatus === "online" ? "reported by business surface" : backendStatus}
            evidenceScope={[frameRoute?.label ?? i18n.viewLabel(activeView), "当前路由上下文"]}
            permissionState={frameRoute?.availability.kind === "planned" ? "blocked" : frameRoute?.actionPolicy === "explicit_confirmation" ? "confirmation_required" : frameRoute?.accessPolicy === "local_unlock" ? (activeViewLocked ? "locked" : "unlocked") : activeViewLocked ? "locked" : "read_only"}
            aiState={frameRoute && frameRoute.aiPolicy.mode !== "none" ? (frameRoute.aiPolicy.availability.kind === "planned" ? "blocked" : "available") : aiControl.data?.enabled ? "available" : "disabled"}
            groupLabel={i18n.t(`nav.group.${activeNavigationGroup.key}`)}
            labels={{
              collapse: language === "zh-CN" ? "收起上下文栏" : "Collapse context rail",
              expand: language === "zh-CN" ? "展开上下文栏" : "Expand context rail",
              workspace: language === "zh-CN" ? "当前工作区" : "Current workspace",
              activeAsset: language === "zh-CN" ? "当前资产" : "Active asset",
              runtime: language === "zh-CN" ? "本地运行状态" : "Local runtime",
              locked: language === "zh-CN" ? "敏感上下文已锁定" : "Sensitive context locked",
              noAsset: language === "zh-CN" ? "尚未选择" : "Not selected",
            }}
            locked={activeViewLocked}
            onToggle={() => window.innerWidth <= 1180 ? setContextDrawerOpen(false) : setContextRailCollapsed((current) => !current)}
            selectedAsset={activeViewLocked ? undefined : selectedAssetId}
            title={language === "zh-CN" ? "上下文" : "Context"}
            viewLabel={frameRoute?.label ?? i18n.viewLabel(activeView)}
          />
        )}
      >
        <AppRouteOutlet
            rootPath={rootPath}
            backendStatus={backendStatus}
            localSecurity={localSecurity.data}
            securityLoading={localSecurity.loading}
            securityError={localSecurity.error}
            language={language}
            securityBusy={localSecurityBusy}
            onInitialize={handleInitializeLocalSecurity}
            onUnlock={handleUnlockLocalSecurity}
            onReset={handleResetLocalSecurity}
            onRetry={reloadEverything}
            businessDependencies={routeBusinessDependencies}
          />
      </AppShell>
      <CommandPalette onGlobalRefresh={reloadEverything} sidecarReady={sidecarReady} />
    </>
  );
}

export default App;
