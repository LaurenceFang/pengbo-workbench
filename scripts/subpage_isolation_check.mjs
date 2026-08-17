import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const registrySource = read("src/routes/route-registry.ts");
const adapterSource = read("src/routes/route-workspace-adapter.tsx");
const appSource = read("src/App.tsx");
const businessPagePath = path.join(root, "src/routes/route-business-pages.tsx");
const businessPageSource = fs.existsSync(businessPagePath) ? fs.readFileSync(businessPagePath, "utf8") : "";
const aiPagePath = path.join(root, "src/views/ai-assistant-view.tsx");
const aiPageSource = fs.existsSync(aiPagePath) ? fs.readFileSync(aiPagePath, "utf8") : "";
const apiSource = read("src/lib/api.ts");

const routeLines = registrySource
  .split(/\r?\n/)
  .filter((line) => line.trim().startsWith("route("));
const availableComponentKeys = routeLines
  .filter((line) => !line.includes('availability: { kind: "planned"'))
  .map((line) => line.match(/^\s*route\(\d+,\s*"[^"]+",\s*"[^"]+",\s*"[^"]+",\s*"([^"]+)"/)?.[1])
  .filter(Boolean);

expect(fs.existsSync(businessPagePath), "missing src/routes/route-business-pages.tsx");
expect(!adapterSource.includes("surface: ReactNode"), "RouteWorkspaceAdapter still accepts one top-level surface for every sibling route");
expect(!adapterSource.includes("props.surface"), "RouteWorkspaceAdapter still renders props.surface instead of a route business page");
expect(adapterSource.includes("<RouteBusinessPage"), "RouteWorkspaceAdapter does not mount RouteBusinessPage");
expect(!appSource.includes("surface={("), "AppRouteOutlet still receives the stacked mega-view surface");
expect(!appSource.includes("legacySurface"), "App still builds the retired stacked mega-view as a legacySurface prop");
expect(!adapterSource.includes("legacySurface"), "RouteWorkspaceAdapter still exposes the retired legacySurface prop");
expect(!adapterSource.includes("materializeRoutePath(candidate.svgRoute, params)"), "SubrouteNav materializes sibling URLs before the navigation hook can merge stored route params");
expect(adapterSource.includes("id: candidate.svgRoute"), "SubrouteNav must hand route templates to the unified navigation hook");
expect(!businessPageSource.includes("RouteContentSurface"), "production route pages must not use the generic hard-coded RouteContentSurface");
expect(businessPageSource.includes("data-route-page"), "route business pages need a stable data-route-page identity");
expect(!businessPageSource.includes("data-primary-task={route.componentKey}"), "RouteBusinessPage must not duplicate the primary-task marker owned by the concrete page");
expect(fs.existsSync(aiPagePath), "missing independent AI assistant configuration page");
expect(aiPageSource.includes("ai-local-endpoint"), "AI page is missing the local endpoint control");
expect(aiPageSource.includes("ai-cloud-endpoint"), "AI page is missing the cloud endpoint control");
expect(aiPageSource.includes("probeAIRuntime"), "AI page is missing the local runtime probe action");
expect(apiSource.includes("local_base_url?: string | null"), "AI control update contract cannot persist the local endpoint");

for (const key of availableComponentKeys) {
  expect(
    businessPageSource.includes(`${key}:`) || businessPageSource.includes(`\"${key}\":`),
    `available route componentKey is not registered: ${key}`,
  );
}

for (const key of [
  "assetSearch",
  "assetPrice",
  "assetFundamentals",
  "assetFilings",
  "researchDecision",
  "researchNotes",
  "portfolioHoldings",
  "portfolioTransactionNew",
  "factorRunNew",
  "factorResults",
  "aiAssistant",
]) {
  expect(businessPageSource.includes(`${key}:`) || businessPageSource.includes(`\"${key}\":`), `required independent page missing: ${key}`);
}

if (failures.length > 0) {
  console.error(`subpage isolation check failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  passed: true,
  availableRouteCount: availableComponentKeys.length,
  registeredRoutePageFile: "src/routes/route-business-pages.tsx",
  stackedSurfaceRemoved: true,
}, null, 2));
