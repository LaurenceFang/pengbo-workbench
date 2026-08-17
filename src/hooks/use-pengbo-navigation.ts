import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore, type ViewKey } from "../store/app-store";
import {
  defaultRouteByView,
  getFrameRouteForPath,
  materializeRoutePath,
  type RouteTopLevelView,
} from "../routes/route-registry";

type RouteParams = Readonly<Record<string, string | null | undefined>>;
type NavigationOptions = { replace?: boolean; params?: RouteParams };

/**
 * The single URL-aware navigation contract for Pengbo. Store context and the
 * browser history are updated together so refresh/back/forward restore the
 * same route instead of falling back to a legacy ViewKey-only state.
 */
export function usePengboNavigation() {
  const navigate = useNavigate();
  const setActiveView = useAppStore((state) => state.setActiveView);
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const selectedResearchBriefId = useAppStore((state) => state.selectedResearchBriefId);
  const selectedFactorRunId = useAppStore((state) => state.selectedFactorRunId);
  const selectedStrategyBacktestId = useAppStore((state) => state.selectedStrategyBacktestId);
  const selectedStrategyPaperSessionId = useAppStore((state) => state.selectedStrategyPaperSessionId);
  const selectedWorkflowRunId = useAppStore((state) => state.selectedWorkflowRunId);
  const selectedScreenerPresetKey = useAppStore((state) => state.selectedScreenerPresetKey);
  const selectedScreenerVariantKey = useAppStore((state) => state.selectedScreenerVariantKey);

  const contextParams = useMemo<RouteParams>(() => ({
    symbol: selectedAssetId || "AAPL",
    briefId: selectedResearchBriefId || "current-brief",
    runId: selectedWorkflowRunId || selectedFactorRunId || "current-run",
    backtestId: selectedStrategyBacktestId || "current-backtest",
    sessionId: selectedStrategyPaperSessionId || "current-session",
    presetKey: selectedScreenerPresetKey || "core",
    variantKey: selectedScreenerVariantKey || "default",
    listId: "default",
    provider: "local",
    id: "current",
    resultId: "current",
    templateId: "current",
  }), [
    selectedAssetId,
    selectedFactorRunId,
    selectedResearchBriefId,
    selectedScreenerPresetKey,
    selectedScreenerVariantKey,
    selectedStrategyBacktestId,
    selectedStrategyPaperSessionId,
    selectedWorkflowRunId,
  ]);

  const openRoute = useCallback((routePath: string, options: NavigationOptions = {}) => {
    const target = materializeRoutePath(routePath, { ...contextParams, ...options.params });
    const record = getFrameRouteForPath(target);
    if (record && record.topLevelView !== "aiAssistant") setActiveView(record.topLevelView);
    navigate(target, { replace: options.replace });
  }, [contextParams, navigate, setActiveView]);

  const openView = useCallback((view: ViewKey, options: NavigationOptions = {}) => {
    const routePath = defaultRouteByView[view];
    setActiveView(view);
    if (routePath) openRoute(routePath, options);
  }, [openRoute, setActiveView]);

  const openSurface = useCallback((view: RouteTopLevelView, sectionRoute?: string, options: NavigationOptions = {}) => {
    const routePath = sectionRoute ?? defaultRouteByView[view];
    if (view !== "aiAssistant") setActiveView(view);
    if (routePath) openRoute(routePath, options);
  }, [openRoute, setActiveView]);

  const openAsset = useCallback((symbol: string, section: "overview" | "price" | "fundamentals" | "filings" | "data" | "research" = "overview") => {
    openRoute(`/markets/assets/:symbol/${section}`, { params: { symbol } });
  }, [openRoute]);

  return { openAsset, openRoute, openSurface, openView };
}
