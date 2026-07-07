import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const expectedGroups = ["home", "research", "markets", "portfolio", "factorLab", "automation", "settings"];
const expectedViews = [
  "dashboard", "commandCenter", "asset", "watchlist", "research", "factorLab", "strategyLab",
  "workflowStudio", "dataSources", "screeners", "manual", "portfolio", "connections", "settings",
];
const expectedSensitiveViews = [
  "research", "factorLab", "strategyLab", "workflowStudio", "dataSources", "portfolio", "connections", "settings",
];

async function main() {
  const [navigation, app, store, i18n] = await Promise.all([
    readFile(path.join(repoRoot, "src", "navigation.ts"), "utf8"),
    readFile(path.join(repoRoot, "src", "App.tsx"), "utf8"),
    readFile(path.join(repoRoot, "src", "store", "app-store.ts"), "utf8"),
    readFile(path.join(repoRoot, "src", "i18n", "index.ts"), "utf8"),
  ]);
  const failures = [];

  for (const group of expectedGroups) {
    if (!navigation.includes(`key: "${group}"`)) failures.push(`missing navigation group: ${group}`);
    if (!i18n.includes(`"nav.group.${group}"`)) failures.push(`missing i18n label: nav.group.${group}`);
  }

  const mappedViews = [...navigation.matchAll(/viewKey: "([A-Za-z]+)"/g)].map((match) => match[1]);
  for (const view of expectedViews) {
    const count = mappedViews.filter((candidate) => candidate === view).length;
    if (count !== 1) failures.push(`view ${view} must be mapped exactly once, found ${count}`);
    if (!store.includes(`| "${view}"`) && !store.includes(`=\n  | "${view}"`)) failures.push(`ViewKey missing: ${view}`);
  }
  const unexpectedViews = mappedViews.filter((view) => !expectedViews.includes(view));
  if (unexpectedViews.length) failures.push(`unexpected mapped views: ${unexpectedViews.join(", ")}`);

  for (const view of expectedSensitiveViews) {
    if (!app.includes(`"${view}"`)) failures.push(`sensitive view no longer represented in App: ${view}`);
  }

  if (!app.includes("aria-expanded")) failures.push("group disclosure is missing aria-expanded");
  if (!app.includes("aria-controls")) failures.push("group disclosure is missing aria-controls");
  if (!app.includes("`nav-${item.viewKey}`")) failures.push("existing nav-ViewKey automation anchors are not preserved");
  if (!app.includes("navigationGroups")) failures.push("App does not consume the shared navigation contract");

  if (failures.length) throw new Error(`T99 navigation IA contract failed:\n- ${failures.join("\n- ")}`);
  console.log(`T99 navigation IA contract passed (${expectedGroups.length} groups, ${expectedViews.length} views).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
