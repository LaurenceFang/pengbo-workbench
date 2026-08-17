import { spawn, execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const port = Number(process.env.PENGBO_T105_PORT ?? 4285);
const appUrl = `http://127.0.0.1:${port}`;
const targetUrl = `${appUrl}/portfolio/overview`;
const evidenceLabel = process.env.PENGBO_T105_EVIDENCE_LABEL ?? "latest";
const evidencePath = path.join(repoRoot, "logs", `t105-security-state-regression-${evidenceLabel}.json`);
const children = [];

function startVite() {
  const viteBin = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: repoRoot,
    env: { ...process.env, BROWSER: "none" },
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  children.push(child);
  return child;
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
    if (process.platform === "win32") {
      execFile("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true }, () => resolve());
      return;
    }
    child.once("exit", resolve);
    child.kill("SIGTERM");
    setTimeout(resolve, 2_000);
  });
}

async function run() {
  await mkdir(path.dirname(evidencePath), { recursive: true });
  startVite();
  await waitForHttp(appUrl);

  const browser = await chromium.launch({ headless: true });
  const apiRequests = [];
  const failures = [];
  let evidence = {};
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      apiRequests.push({ method: request.method(), url: request.url() });
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "T105 deterministic sidecar-offline simulation" }),
      });
    });

    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.locator(".app-shell").waitFor({ state: "visible", timeout: 20_000 });
    const routeFrame = page.locator('[data-route-id="/portfolio/overview"]');
    await routeFrame.waitFor({ state: "attached", timeout: 20_000 });
    await page.waitForFunction(() => performance.now() > 2_000);

    const initialState = await routeFrame.getAttribute("data-ui-state");
    const action = routeFrame.locator(".ui-state-action button");
    const retryVisible = await action.isVisible().catch(() => false);
    const securityRequestsBeforeUnlock = apiRequests.filter(({ url }) => url.includes("/security/local/status"));
    const sensitiveBusinessRequestsBeforeUnlock = apiRequests.filter(({ url }) => /\/portfolio(?:\/|$)/.test(new URL(url).pathname));

    if (initialState !== "error") failures.push(`sidecar-offline sensitive route must settle at error, got ${initialState}`);
    if (!retryVisible) failures.push("sidecar-offline error state must expose a retry action");
    if (securityRequestsBeforeUnlock.length !== 0) failures.push(`security status was requested while backend was offline: ${securityRequestsBeforeUnlock.length}`);
    if (sensitiveBusinessRequestsBeforeUnlock.length !== 0) failures.push(`sensitive portfolio data was requested before unlock: ${sensitiveBusinessRequestsBeforeUnlock.length}`);

    let stateAfterRetry = null;
    if (retryVisible) {
      await action.click();
      await page.waitForFunction(() => document.querySelector('[data-route-id="/portfolio/overview"]')?.getAttribute("data-ui-state") === "error", undefined, { timeout: 8_000 }).catch(() => undefined);
      stateAfterRetry = await routeFrame.getAttribute("data-ui-state");
      if (stateAfterRetry !== "error") failures.push(`retry must settle back to error while sidecar remains offline, got ${stateAfterRetry}`);
    }

    evidence = {
      generated_at: new Date().toISOString(),
      browser: "chromium-headless",
      target: "/portfolio/overview",
      simulation: "all /api/v1 requests return HTTP 503",
      initial_state: initialState,
      retry_visible: retryVisible,
      state_after_retry: stateAfterRetry,
      security_requests_before_unlock: securityRequestsBeforeUnlock,
      sensitive_business_requests_before_unlock: sensitiveBusinessRequestsBeforeUnlock,
      api_requests: apiRequests,
      failures,
      passed: failures.length === 0,
    };
    await context.close();
  } finally {
    await browser.close();
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  }

  console.log(JSON.stringify({ evidence: path.relative(repoRoot, evidencePath).replaceAll("\\", "/"), ...evidence }, null, 2));
  if (failures.length > 0) throw new Error(failures.join("; "));
}

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(children.map(stopTree));
  });
