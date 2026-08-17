import { api } from "../lib/api";
import type { FrameRouteRecord } from "./route-registry";

type RouteResultBase = { fixtureKey: string; source: "api" | "cache" | "fixture" | "security" | "route-contract"; payload: unknown; locked?: boolean };
export type RoutePageData =
  | (RouteResultBase & { state: "loading" })
  | (RouteResultBase & { state: "ready"; data: unknown; freshness: string; limitations: string[]; demo?: boolean })
  | (RouteResultBase & { state: "empty"; recovery: "refresh" | "change-filter" | "import-data" })
  | (RouteResultBase & { state: "locked"; locked: true; recovery: "local-unlock" })
  | (RouteResultBase & { state: "blocked"; reason: string; plannedTask?: `T${number}`; recovery: "review-requirements" | "local-unlock" })
  | (RouteResultBase & { state: "error"; error: string; recovery: "retry" | "restart-sidecar" });

type RouteParams = Readonly<Record<string, string | undefined>>;
const ROUTE_API_TIMEOUT_MS = 1_500;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`route loader timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function fixture(route: FrameRouteRecord, params: RouteParams): RoutePageData {
  const payload = { route: route.svgRoute, frameId: route.frameId, params, sample: true, simulated: true };
  return {
    state: "ready",
    source: "fixture",
    fixtureKey: route.fixtureKey,
    payload,
    data: payload,
    freshness: "demo fixture",
    limitations: ["DEMO MODE", "not live data"],
    demo: true,
  };
}

function isEmptyPayload(payload: unknown): boolean {
  if (payload === null || payload === undefined) return true;
  if (Array.isArray(payload)) return payload.length === 0;
  return false;
}

async function apiForRoute(route: FrameRouteRecord, params: RouteParams): Promise<unknown> {
  const symbol = params.symbol ?? "AAPL";
  const provider = params.provider ?? "local";
  const runId = params.runId ?? params.backtestId;
  if (route.topLevelView === "dashboard") return api.getDashboardOverview();
  if (route.svgRoute === "/markets/assets") return api.searchAssets(symbol);
  if (route.svgRoute.includes("/markets/assets/") && route.svgRoute.endsWith("/price")) return api.getPriceHistory(symbol);
  if (route.svgRoute.includes("/markets/assets/")) return api.getAssetWorkspace(symbol);
  if (route.topLevelView === "research" && route.svgRoute === "/research/inbox") return api.getRecentResearchBriefs();
  if (route.topLevelView === "research" && params.briefId) return api.getResearchBrief(params.briefId);
  if (route.topLevelView === "factorLab" && runId) return api.getFactorRun(runId);
  if (route.topLevelView === "factorLab") return api.getRecentFactorRuns();
  if (route.topLevelView === "strategyLab" && runId) return api.getStrategyBacktest(runId);
  if (route.topLevelView === "strategyLab") return api.getStrategyTemplates();
  if (route.topLevelView === "workflowStudio" && params.runId) return api.getWorkflowRun(params.runId);
  if (route.topLevelView === "workflowStudio") return api.getWorkflowTemplates();
  if (route.topLevelView === "dataSources" && params.provider) return api.getDataSourceProviderStatus(provider);
  if (route.topLevelView === "dataSources") return api.getDataSourceStatus();
  if (route.topLevelView === "portfolio" && route.svgRoute.endsWith("/holdings")) return api.getPortfolioHoldings();
  if (route.topLevelView === "portfolio" && route.svgRoute.endsWith("/transactions")) return api.getPortfolioTransactions();
  if (route.topLevelView === "portfolio") return api.getPortfolioSummary();
  if (route.topLevelView === "connections") return api.getConnectionsStatus();
  if (route.topLevelView === "settings" && route.svgRoute.endsWith("/runtime")) return api.getSettingsRuntime();
  if (route.topLevelView === "settings" && route.svgRoute.endsWith("/preferences")) return api.getSettingsPreferences();
  if (route.topLevelView === "settings" && route.svgRoute.endsWith("/ai")) return api.getAIControlPreferences();
  return api.getHealth();
}

export async function loadRoutePageData(route: FrameRouteRecord, params: RouteParams): Promise<RoutePageData> {
  if (route.availability.kind === "planned") {
    return { state: "blocked", source: "route-contract", fixtureKey: route.fixtureKey, payload: null, reason: route.availability.missingCondition, plannedTask: route.availability.plannedTask, recovery: "review-requirements" };
  }
  if (route.accessPolicy === "local_unlock") {
    try {
      const security = await withTimeout(api.getLocalSecurityStatus(), ROUTE_API_TIMEOUT_MS);
      if (!security.initialized || security.locked) {
        return { state: "locked", source: "security", fixtureKey: route.fixtureKey, payload: null, locked: true, recovery: "local-unlock" };
      }
    } catch (error) {
      return { state: "error", source: "security", fixtureKey: route.fixtureKey, payload: null, error: error instanceof Error ? error.message : "local security status unavailable", recovery: "restart-sidecar" };
    }
  }
  try {
    const payload = await withTimeout(apiForRoute(route, params), ROUTE_API_TIMEOUT_MS);
    if (isEmptyPayload(payload)) return { state: "empty", source: "api", fixtureKey: route.fixtureKey, payload, recovery: "change-filter" };
    return { state: "ready", source: "api", fixtureKey: route.fixtureKey, payload, data: payload, freshness: "reported by local API", limitations: [] };
  } catch (error) {
    if (import.meta.env.VITE_DEMO_MODE === "true") return fixture(route, params);
    const message = error instanceof Error ? error.message : "route request failed";
    const status = Number((error as { status?: number }).status ?? message.match(/\b(401|403|423)\b/)?.[1]);
    if (status === 401 || status === 423) return { state: "locked", source: "security", fixtureKey: route.fixtureKey, payload: null, locked: true, recovery: "local-unlock" };
    if (status === 403) return { state: "blocked", source: "security", fixtureKey: route.fixtureKey, payload: null, reason: message, recovery: "local-unlock" };
    return { state: "error", source: "api", fixtureKey: route.fixtureKey, payload: null, error: message, recovery: "retry" };
  }
}
