import { execFile, spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PENGBO_T105_VISUAL_PORT ?? 4286);
const baseUrl = `http://127.0.0.1:${port}`;
const outputPath = path.join(repoRoot, "logs", "t105-visual-state-regression.json");

function startVite() {
  return spawn(process.execPath, [path.join(repoRoot, "node_modules", "vite", "bin", "vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repoRoot,
    env: { ...process.env, BROWSER: "none", VITE_VISUAL_TEST_MODE: "true" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

async function waitForHttp(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Vite did not become ready at ${url}`);
}

function stopTree(child) {
  return new Promise((resolve) => {
    if (!child.pid || child.exitCode !== null || child.killed) return resolve();
    execFile("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true }, () => resolve());
  });
}

const vite = startVite();
const failures = [];
const records = [];
try {
  await waitForHttp(baseUrl);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route("**/api/v1/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith("/health")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok", message: "ok", app_version: "test", sidecar_version: "test" }) });
        return;
      }
      if (pathname.endsWith("/security/local/status")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ initialized: true, locked: false }) });
        return;
      }
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "isolated visual-state test" }) });
    });

    for (const scenario of [
      { name: "supported-recovery", path: "/markets/assets/AAPL/overview", frameId: "frame-07", queryState: "recovery", expected: "recovery" },
      { name: "unsupported-public-locked", path: "/markets/assets/AAPL/overview", frameId: "frame-07", queryState: "locked", expected: "ready" },
      { name: "planned-recovery-preview", path: "/command-center/recent", frameId: "frame-04", queryState: "recovery", expected: "recovery" },
    ]) {
      await page.goto(`${baseUrl}${scenario.path}?__state=${scenario.queryState}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
      const frame = page.locator(`[data-frame-id="${scenario.frameId}"]`);
      await frame.waitFor({ state: "attached", timeout: 20_000 });
      await page.waitForFunction((frameId) => document.querySelector(`[data-frame-id="${frameId}"]`)?.getAttribute("data-ui-state") !== "loading", scenario.frameId, { timeout: 10_000 });
      const actual = await frame.getAttribute("data-ui-state");
      const recoveryActionCount = await frame.locator(".ui-state-action button").count();
      const passed = actual === scenario.expected && (scenario.queryState !== "recovery" || recoveryActionCount > 0);
      if (!passed) failures.push(`${scenario.name}: expected ${scenario.expected} with applicable recovery action, got ${actual} / actions=${recoveryActionCount}`);
      records.push({ ...scenario, actual, recoveryActionCount, passed });
    }
  } finally {
    await browser.close();
  }
} finally {
  await stopTree(vite);
}

const result = { generatedAt: new Date().toISOString(), browser: "chromium-headless", records, failures, passed: failures.length === 0 };
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
