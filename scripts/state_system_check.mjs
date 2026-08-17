import { readFile } from "node:fs/promises";

const registry = await readFile("src/ui-state-registry.ts", "utf8");
const shared = await readFile("src/components/shared.tsx", "utf8");
const uiKit = await readFile("src/components/ui-kit.tsx", "utf8");
const app = await readFile("src/App.tsx", "utf8");
const routeAdapter = await readFile("src/routes/route-workspace-adapter.tsx", "utf8");

const requiredStates = [
  "loading",
  "empty",
  "blocked",
  "error",
  "locked",
  "ready",
  "ai-insufficient-evidence",
  "cloud-opt-in",
  "recovery",
];
const failures = [];
for (const state of requiredStates) {
  if (!registry.includes(`  ${state}:`) && !registry.includes(`  "${state}":`)) failures.push(`registry missing ${state}`);
}
if (!shared.includes("data-ui-state={resolvedState}")) failures.push("InlineState does not expose data-ui-state");
if (!shared.includes("ui-panel-${resolvedState}")) failures.push("PanelState does not expose the resolved state");
if (!uiKit.includes("data-ui-state={state}")) failures.push("StateBlock does not expose data-ui-state");
if (!app.includes("activeViewLocked") || !routeAdapter.includes("LocalUnlockGate") || !routeAdapter.includes('workspaceFrame("locked"')) failures.push("locked route boundary is not present");

const viewFiles = [
  "dashboard-view.tsx", "command-center-view.tsx", "asset-view.tsx", "watchlist-view.tsx",
  "research-view.tsx", "factor-lab-view.tsx", "strategy-lab-view.tsx", "workflow-studio-view.tsx",
  "data-sources-view.tsx", "screeners-view.tsx", "manual-view.tsx", "portfolio-view.tsx",
  "connections-view.tsx", "settings-view.tsx",
];
for (const file of viewFiles) {
  const source = await readFile(`src/views/${file}`, "utf8");
  if (!source.includes("InlineState") && !source.includes("PanelState") && !source.includes("StateBlock")) {
    failures.push(`${file} does not use a shared state surface`);
  }
}

if (failures.length) {
  console.error("T105 state system check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ passed: true, requiredStates, viewCount: viewFiles.length }, null, 2));
}
