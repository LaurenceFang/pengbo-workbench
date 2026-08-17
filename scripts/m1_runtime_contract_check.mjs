import { readFile } from "node:fs/promises";

const [app, router, runtime, market] = await Promise.all([
  readFile(new URL("../src/App.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/router.tsx", import.meta.url), "utf8"),
  readFile(new URL("../backend/app/runtime.py", import.meta.url), "utf8"),
  readFile(new URL("../backend/app/providers/market.py", import.meta.url), "utf8"),
]);

const failures = [];
if (!router.includes("rootPath: string | null")) failures.push("router root must accept the persisted default route");
if (!router.includes("to={rootPath}") && !router.includes("to={props.rootPath}")) failures.push("root navigation must use the persisted default route");
if (router.includes('to="/dashboard/overview"')) failures.push("router root must not hardcode Dashboard");
if (!app.includes('previousBackendStatus.current === "offline"')) failures.push("initial connecting-to-online must not trigger recovery reloads");
if (!app.includes("dashboardSurfaceActive")) failures.push("dashboard provider loading must be scoped to dashboard-dependent surfaces");
if (!app.includes("assetSurfaceActive")) failures.push("asset provider loading must be scoped to the asset surface");
if (!runtime.includes("market_fixture_mode")) failures.push("isolated packaged tests need an explicit market fixture runtime flag");
if (!market.includes("market_fixture_mode")) failures.push("market provider must honor only the explicit fixture flag");

if (failures.length > 0) {
  console.error(`M1 runtime contract failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("M1 runtime contract OK: persisted root, scoped loaders, recovery guard, explicit fixtures");
