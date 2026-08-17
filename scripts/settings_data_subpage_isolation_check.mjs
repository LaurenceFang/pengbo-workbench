import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const contracts = [
  {
    file: "src/views/data-sources-view.tsx",
    typeName: "DataSourcesRouteSection",
    keys: ["dataSourcesCatalog", "dataSourceDetail", "dataSourcePreview", "dataSourceQuality", "dataSourcesReport"],
    scopedLoaders: ["catalogEnabled", "detailEnabled", "previewEnabled", "qualityEnabled", "reportEnabled"],
  },
  {
    file: "src/views/connections-view.tsx",
    typeName: "ConnectionsRouteSection",
    keys: ["connectionsCatalog", "connectionDetail", "connectionCredentials", "connectionHealth"],
    scopedLoaders: ["catalogEnabled", "detailEnabled", "credentialsEnabled", "healthEnabled"],
  },
  {
    file: "src/views/settings-view.tsx",
    typeName: "SettingsRouteSection",
    keys: ["settingsPreferences", "settingsAppearance", "settingsSecurity", "settingsExecution", "settingsRuntime"],
    scopedLoaders: ["preferencesEnabled", "appearanceEnabled", "securityEnabled", "executionEnabled", "runtimeEnabled"],
    forbidden: ["getAICloudStatus", "settings-ai-cloud-boundary"],
  },
];

const failures = [];

for (const contract of contracts) {
  const source = fs.readFileSync(path.join(root, contract.file), "utf8");

  if (!source.includes(`export type ${contract.typeName}`)) {
    failures.push(`${contract.file}: missing exported ${contract.typeName}`);
  }
  if (!source.includes("routeSection:")) {
    failures.push(`${contract.file}: view props do not require routeSection`);
  }
  if (!source.includes("data-route-section={routeSection}")) {
    failures.push(`${contract.file}: root does not expose the active route section`);
  }
  if (!source.includes("data-primary-task={routeSection}")) {
    failures.push(`${contract.file}: active route does not expose one primary workflow`);
  }
  if (contract.file === "src/views/connections-view.tsx" && !source.includes("&& binanceAccountRequested")) {
    failures.push("Binance private account data must only load after an explicit user request.");
  }

  for (const key of contract.keys) {
    if (!source.includes(`"${key}"`)) {
      failures.push(`${contract.file}: missing route section ${key}`);
    }
    if (!source.includes(`routeSection === "${key}"`)) {
      failures.push(`${contract.file}: ${key} is not independently mounted`);
    }
  }

  for (const gate of contract.scopedLoaders) {
    if (!source.includes(`const ${gate}`)) {
      failures.push(`${contract.file}: missing scoped loader gate ${gate}`);
    }
  }

  for (const forbidden of contract.forbidden ?? []) {
    if (source.includes(forbidden)) {
      failures.push(`${contract.file}: planned workflow leaked into available settings pages (${forbidden})`);
    }
  }
}

const dataSourcesSource = fs.readFileSync(path.join(root, "src/views/data-sources-view.tsx"), "utf8");
const connectionsSource = fs.readFileSync(path.join(root, "src/views/connections-view.tsx"), "utf8");
if (!dataSourcesSource.includes("usePengboNavigation") || !dataSourcesSource.includes("/markets/data-sources/${encodeURIComponent(provider.provider)}")) {
  failures.push("src/views/data-sources-view.tsx: catalog selection does not navigate to the provider detail route");
}
for (const surfaceClass of ["data-source-detail", "data-source-preview", "data-source-quality", "data-sources-report"]) {
  const surfacePattern = new RegExp(`className="[^"]*${surfaceClass}[^"]*p1-source-overview|className="[^"]*p1-source-overview[^"]*${surfaceClass}`);
  if (!surfacePattern.test(dataSourcesSource)) {
    failures.push(`src/views/data-sources-view.tsx: ${surfaceClass} does not span the standalone workspace grid`);
  }
}
if (!connectionsSource.includes("usePengboNavigation") || !connectionsSource.includes("/settings/connections/${encodeURIComponent(item.provider)}")) {
  failures.push("src/views/connections-view.tsx: catalog item does not navigate to the connection detail route");
}

if (failures.length > 0) {
  console.error("Settings/data subpage isolation contract failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Settings/data subpage isolation contract passed for 14 independently mounted routes.");
