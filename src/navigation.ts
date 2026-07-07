import type { ViewKey } from "./store/app-store";

export type NavGroupKey = "home" | "research" | "markets" | "portfolio" | "factorLab" | "automation" | "settings";

export type NavigationItem = {
  viewKey: ViewKey;
};

export type NavigationGroup = {
  key: NavGroupKey;
  defaultView: ViewKey;
  items: readonly NavigationItem[];
};

export const navigationGroups = [
  { key: "home", defaultView: "dashboard", items: [{ viewKey: "dashboard" }, { viewKey: "commandCenter" }] },
  { key: "research", defaultView: "research", items: [{ viewKey: "research" }] },
  { key: "markets", defaultView: "asset", items: [{ viewKey: "asset" }, { viewKey: "watchlist" }, { viewKey: "dataSources" }] },
  { key: "portfolio", defaultView: "portfolio", items: [{ viewKey: "portfolio" }] },
  { key: "factorLab", defaultView: "factorLab", items: [{ viewKey: "factorLab" }, { viewKey: "strategyLab" }] },
  { key: "automation", defaultView: "workflowStudio", items: [{ viewKey: "workflowStudio" }, { viewKey: "screeners" }] },
  { key: "settings", defaultView: "settings", items: [{ viewKey: "settings" }, { viewKey: "connections" }, { viewKey: "manual" }] },
] as const satisfies readonly NavigationGroup[];

export function getNavigationGroupForView(view: ViewKey): NavigationGroup {
  return navigationGroups.find((group) => group.items.some((item) => item.viewKey === view)) ?? navigationGroups[0];
}

export function getNavigationItem(view: ViewKey): NavigationItem {
  return getNavigationGroupForView(view).items.find((item) => item.viewKey === view) ?? navigationGroups[0].items[0];
}
