import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function main() {
  const [models, service, api, store, app, shell, settings, i18n, styles] = await Promise.all([
    "backend/app/models.py", "backend/app/services/settings_service.py", "src/lib/api.ts", "src/store/app-store.ts",
    "src/App.tsx", "src/components/app-shell.tsx", "src/views/settings-view.tsx", "src/i18n/index.ts", "src/styles.css",
  ].map((relative) => readFile(path.join(repoRoot, relative), "utf8")));
  const failures = [];
  if (!models.includes('ThemePreference = Literal["light", "dark"]')) failures.push("backend theme type is missing");
  if (!service.includes('theme="light"')) failures.push("backend light default is missing");
  if (!api.includes('theme: "light" | "dark"')) failures.push("frontend API theme contract is missing");
  if (!store.includes('ThemePreference = "light" | "dark"')) failures.push("store theme type is missing");
  if (!store.includes('theme: "light"')) failures.push("store light default is missing");
  if (!app.includes("setTheme(preferences.data.theme)")) failures.push("preference hydration does not restore theme");
  if (!shell.includes("data-theme={theme}")) failures.push("AppShell root does not bind data-theme");
  if (!settings.includes("settings-theme") || !/setTheme\s*\(/.test(settings)) failures.push("Settings does not preview theme immediately");
  for (const key of ["settings.theme", "settings.themeLight", "settings.themeDark"]) if (!i18n.includes(`"${key}"`)) failures.push(`missing i18n key: ${key}`);
  if (!styles.includes('html[data-theme="dark"]')) failures.push("dark token map is missing");
  if (!styles.includes("color-scheme: light")) failures.push("light-first token map is missing");
  const darkTokenMap = styles.match(/html\[data-theme="dark"\],[\s\S]*?\.app-shell\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  for (const [alias, semantic] of [
    ["--bg-base", "--surface-canvas"],
    ["--bg-elevated", "--surface-elevated"],
    ["--bg-panel", "--surface-panel"],
    ["--bg-panel-soft", "--surface-muted"],
    ["--bg-control", "--surface-control"],
  ]) {
    if (!darkTokenMap.includes(`${alias}: var(${semantic})`)) failures.push(`dark compatibility alias is missing: ${alias}`);
  }
  if (/\.app-shell-context\s+\.ui-context-inspector\s*\{[^}]*background:\s*#e7efea/is.test(styles)) {
    failures.push("Context Inspector still hard-codes the light surface");
  }
  if (failures.length) throw new Error(`T101 theme preference contract failed:\n- ${failures.join("\n- ")}`);
  console.log("T101 theme preference contract passed (light default, dark persistence binding)." );
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
