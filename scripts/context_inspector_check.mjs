import { readFile } from "node:fs/promises";

const files = {
  "src/components/ui-kit.tsx": [
    "ContextInspector",
    "InspectorSection",
    "InspectorAction",
    "data-inspector-object-type",
    "data-inspector-route-id",
    "evidenceScope",
    "permissionState",
    "aiState",
    "ui-inspector-locked",
  ],
  "src/components/context-rail.tsx": ["ContextInspector", "app-shell-context"],
  "src/views/asset-view.tsx": ["assetRoutePaths", "data-route-id={assetRoutePaths[routeSection]}", "data-context-inspector=\"asset\""],
  "src/views/dashboard-view.tsx": ["routeSection === \"dashboardRuntime\"", "data-route-id={routePath}", "data-context-inspector=\"dashboard\""],
  "src/views/data-sources-view.tsx": ["data-route-id=\"/markets/data-sources/catalog\"", "data-context-inspector=\"data-source\""],
  "src/views/research-view.tsx": ["data-context-inspector=\"research\"", "research/inbox"],
  "src/views/screeners-view.tsx": ["data-route-id=\"/automation/screeners\"", "data-context-inspector=\"screener-result\""],
  "src/views/factor-lab-view.tsx": ["factorRoutePaths", "data-route-id={factorRoutePaths[routeSection]}", "data-context-inspector=\"factor-result\""],
  "src/routes/route-workspace-adapter.tsx": ["data-route-id={route.svgRoute}", "data-route-section={route.surface.section}"],
  "src/lib/api.ts": ["path.startsWith(\"/security/local/\")", "localAuthSessionPromise"],
  "src/styles.css": [".ui-context-inspector", ".ui-inspector-section", ".ui-inspector-locked"],
};

const missing = [];
for (const [file, markers] of Object.entries(files)) {
  const source = await readFile(file, "utf8");
  for (const marker of markers) if (!source.includes(marker)) missing.push(`${file}: ${marker}`);
}

const uiKit = await readFile("src/components/ui-kit.tsx", "utf8");
const forbidden = ["api_key", "apiKey", "session_token", "sessionToken", "Stronghold"];
const forbiddenInComponent = forbidden.filter((marker) => uiKit.includes(marker));
const result = {
  scope: "T104",
  files: Object.keys(files),
  missing,
  forbiddenInComponent,
  passed: missing.length === 0 && forbiddenInComponent.length === 0,
};
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
