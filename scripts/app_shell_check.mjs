import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

async function main() {
  const files = {
    app: "src/App.tsx",
    shell: "src/components/app-shell.tsx",
    sidebar: "src/components/app-sidebar.tsx",
    toolbar: "src/components/app-toolbar.tsx",
    context: "src/components/context-rail.tsx",
    navigation: "src/navigation.ts",
  };
  const sources = {};
  for (const [key, relative] of Object.entries(files)) sources[key] = await readFile(path.join(repoRoot, relative), "utf8");
  const failures = [];

  for (const component of ["AppShell", "AppSidebar", "AppToolbar", "ContextRail"]) {
    if (!sources.app.includes(`<${component}`)) failures.push(`App does not render ${component}`);
  }
  for (const marker of ["app-shell", "app-shell-sidebar", "app-shell-toolbar", "app-shell-workspace", "app-shell-context"]) {
    if (!Object.values(sources).some((source) => source.includes(marker))) failures.push(`missing shell region marker: ${marker}`);
  }
  if (!sources.sidebar.includes("navigationGroups")) failures.push("AppSidebar does not consume the T99 navigation contract");
  if (!sources.context.includes("locked")) failures.push("ContextRail does not declare locked-context handling");
  if (!sources.context.includes("aria-expanded")) failures.push("ContextRail collapse control is not accessible");
  if (!sources.shell.includes("workspace-scroll")) failures.push("AppShell does not own the workspace scroll boundary");
  if (!sources.navigation.includes("navigationGroups")) failures.push("T99 navigation contract is missing");

  if (failures.length) throw new Error(`T100 AppShell contract failed:\n- ${failures.join("\n- ")}`);
  console.log("T100 AppShell contract passed (4 stable regions plus safe context rail)." );
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
