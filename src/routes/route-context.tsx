import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useLocation, useParams } from "react-router-dom";
import type { InspectorContext, InspectorPermissionState, InspectorAIState } from "../components/ui-kit";
import { getFrameRouteForPath, getRouteObjectType, type FrameRouteRecord } from "./route-registry";

export type RouteContextValue = {
  route: FrameRouteRecord;
  params: Readonly<Record<string, string | undefined>>;
  inspector: InspectorContext;
};

const RouteContext = createContext<RouteContextValue | null>(null);

function permissionForRoute(route: FrameRouteRecord): InspectorPermissionState {
  if (route.availability.kind === "planned") return "blocked";
  if (route.actionPolicy === "explicit_confirmation") return "confirmation_required";
  if (route.accessPolicy === "local_unlock") return "unlocked";
  return "read_only";
}

function aiStateForRoute(route: FrameRouteRecord): InspectorAIState {
  if (route.aiPolicy.mode === "none") return "disabled";
  if (route.aiPolicy.availability.kind === "planned") return "blocked";
  if (route.aiPolicy.mode === "standalone" || route.aiPolicy.mode === "contextual") return "available";
  return "disabled";
}

export function RouteContextProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const params = useParams();
  const route = getFrameRouteForPath(location.pathname) ?? getFrameRouteForPath("/dashboard/overview")!;
  const value = useMemo<RouteContextValue>(() => {
    const objectType = getRouteObjectType(route);
    const objectId = params.symbol ?? params.briefId ?? params.runId ?? params.backtestId ?? params.sessionId ?? params.provider ?? params.listId;
    return {
      route,
      params,
      inspector: {
        routeId: route.svgRoute,
        objectType,
        objectId,
        assetId: params.symbol,
        researchBriefId: params.briefId,
        runId: params.runId ?? params.backtestId ?? params.sessionId,
        evidenceScope: [route.label, route.svgRoute, route.fixtureKey],
        source: route.availability.kind === "planned" ? "planned route contract" : "local API / local cache",
        freshness: route.availability.kind === "planned" ? "not available" : "由真实业务页面报告",
        permissionState: permissionForRoute(route),
        aiState: aiStateForRoute(route),
      },
    };
  }, [location.pathname, params, route]);
  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

export function useRouteContext(): RouteContextValue {
  const context = useContext(RouteContext);
  if (!context) throw new Error("useRouteContext must be used inside RouteContextProvider");
  return context;
}

export function useRouteInspector(): InspectorContext {
  return useRouteContext().inspector;
}
