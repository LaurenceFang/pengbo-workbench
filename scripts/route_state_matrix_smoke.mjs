import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { resolveEvidenceSamples, sampleRoutePath } from "./m1_evidence_samples.mjs";

const baseUrl = process.env.PENGBO_WEB_URL ?? "http://127.0.0.1:4190";
const captureAll = process.env.PENGBO_T106_CAPTURE === "true" || process.argv.includes("--capture-all");
const retryFailures = captureAll && process.argv.includes("--retry-failures");
const registry = JSON.parse(await readFile("logs/svg-frame-registry.json", "utf8"));
const stateMatrix = JSON.parse(await readFile("logs/t105-route-state-matrix.json", "utf8"));
const routeByFrame = new Map(registry.frames.map((frame) => [frame.frameNo, frame]));
const viewports = captureAll
  ? [
      { id: "1600x900", width: 1600, height: 900 },
      { id: "1440x900", width: 1440, height: 900 },
      { id: "1180x900", width: 1180, height: 900 },
      { id: "960x900", width: 960, height: 900 },
    ]
  : [{ id: "1440x900", width: 1440, height: 900 }];
const themes = captureAll ? ["light", "dark"] : ["light"];
const outputPath = captureAll ? "logs/t106-route-state-visual.json" : "logs/t105-route-state-runtime.json";
const screenshotRoot = "logs/t106-route-state-screenshots";
const recoveryStates = new Set(["empty", "blocked", "error", "locked", "ai-insufficient-evidence", "cloud-opt-in", "recovery"]);

function recordKey({ viewport, theme, frameNo, state }) {
  return `${viewport}|${theme}|${frameNo}|${state}`;
}

const previousOutput = retryFailures
  ? JSON.parse(await readFile(outputPath, "utf8"))
  : null;
const retryKeys = new Set((previousOutput?.failures ?? []).map(recordKey));

function resolveApiBaseUrl(webBaseUrl) {
  if (process.env.PENGBO_API_URL) return process.env.PENGBO_API_URL.replace(/\/$/, "");
  const url = new URL(webBaseUrl);
  return `${url.protocol}//${url.hostname}:8765`;
}

async function unlockRuntime() {
  const secret = process.env.PENGBO_TEST_UNLOCK_SECRET;
  if (!secret) return { attempted: false, unlocked: null };
  const response = await fetch(`${resolveApiBaseUrl(baseUrl)}/api/v1/security/local/unlock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ unlock_secret: secret }),
  });
  if (!response.ok) throw new Error(`State matrix unlock failed: HTTP ${response.status}`);
  const status = await response.json();
  return { attempted: true, unlocked: status.locked === false };
}

async function readRuntimeSecurityStatus() {
  const response = await fetch(`${resolveApiBaseUrl(baseUrl)}/api/v1/security/local/status`);
  if (!response.ok) throw new Error(`State matrix security status failed: HTTP ${response.status}`);
  return response.json();
}

function buildUrl(route, samples, state) {
  const url = new URL(sampleRoutePath(route, samples), baseUrl);
  url.searchParams.set("__state", state);
  return url.toString();
}

function inspectFrame({ frameId }) {
  const frame = document.querySelector(`[data-frame-id="${frameId}"]`);
  return {
    uiState: frame?.getAttribute("data-ui-state") ?? null,
    routePageCount: frame?.querySelectorAll("[data-route-page]").length ?? 0,
    routeFamilyPageCount: frame?.querySelectorAll(".route-family-page").length ?? 0,
    primaryTaskCount: frame?.querySelectorAll("[data-primary-task]").length ?? 0,
    loadingDescendantCount: frame?.querySelectorAll('[data-ui-state="loading"]').length ?? 0,
    recoveryActionCount: frame?.querySelectorAll(".ui-state-action button, [data-recovery-action]").length ?? 0,
    stateLegendCount: document.querySelectorAll(".route-state-legend").length,
  };
}

if (registry.frameCount !== 79 || stateMatrix.routeCount !== 79 || !stateMatrix.passed) {
  throw new Error("T105/T106 state smoke requires accepted 79-route registry and state matrix");
}

const runtimeUnlock = await unlockRuntime();
const runtimeSecurityStatus = await readRuntimeSecurityStatus();
const evidenceSamples = await resolveEvidenceSamples(baseUrl);
const browser = await chromium.launch({ headless: true });
const records = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    // The state matrix validates route/state rendering, not gateway throughput.
    // Reuse the one real unlocked status read above so hundreds of deliberate
    // route transitions cannot trip the production security-endpoint limiter.
    await page.route("**/api/v1/security/local/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(runtimeSecurityStatus),
      });
    });
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const stateRecord of stateMatrix.records) {
      const frame = routeByFrame.get(stateRecord.frameNo);
      if (!frame) throw new Error(`Missing SVG registry frame ${stateRecord.frameNo}`);
      const frameId = `frame-${String(frame.frameNo).padStart(2, "0")}`;
      let routeDocumentLoaded = false;
      for (const state of stateRecord.supportedStates) {
        const stateThemes = themes.filter((theme) => !retryFailures || retryKeys.has(recordKey({
          viewport: viewport.id,
          theme,
          frameNo: frame.frameNo,
          state,
        })));
        if (stateThemes.length === 0) continue;
        consoleErrors.length = 0;
        pageErrors.length = 0;
        let navigationFailure = null;
        let inspection = null;
        try {
          const targetUrl = buildUrl(frame.svgRoute, evidenceSamples, state);
          if (!routeDocumentLoaded) {
            await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
            routeDocumentLoaded = true;
          } else {
            await page.evaluate((nextUrl) => {
              history.replaceState(history.state, "", nextUrl);
              window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
            }, targetUrl);
          }
          const root = page.locator(`[data-frame-id="${frameId}"]`);
          await root.waitFor({ state: "visible", timeout: 20_000 });
          await page.waitForFunction(({ id, expected }) => {
            const frame = document.querySelector(`[data-frame-id="${id}"]`);
            if (frame?.getAttribute("data-ui-state") !== expected) return false;
            return expected !== "ready" || !frame.querySelector('[data-ui-state="loading"]');
          }, { id: frameId, expected: state }, { timeout: 30_000 });
          await page.evaluate(() => document.fonts.ready);
        } catch (error) {
          navigationFailure = error instanceof Error ? error.message : String(error);
        }

        for (const theme of stateThemes) {
          let failure = navigationFailure;
          let screenshotPath = null;
          if (!failure) {
            try {
              await page.evaluate((nextTheme) => {
                document.documentElement.dataset.theme = nextTheme;
                document.querySelector(".app-shell")?.setAttribute("data-theme", nextTheme);
              }, theme);
              await page.waitForTimeout(40);
              if (state === "ready") {
                // Some business surfaces replace an initial query with a
                // follow-up chart/data query. Inspect only after the route has
                // reached ready with no loading descendant at the final theme.
                await page.waitForFunction((id) => {
                  const frame = document.querySelector(`[data-frame-id="${id}"]`);
                  return frame?.getAttribute("data-ui-state") === "ready" && !frame.querySelector('[data-ui-state="loading"]');
                }, frameId, { timeout: 30_000 });
              }
              inspection = await page.evaluate(inspectFrame, { frameId });
              if (captureAll) {
                const dir = `${screenshotRoot}/${theme}/${viewport.id}/${state}`;
                await mkdir(dir, { recursive: true });
                screenshotPath = `${dir}/${frameId}.png`;
                await page.screenshot({ path: screenshotPath, fullPage: false });
              }
            } catch (error) {
              failure = error instanceof Error ? error.message : String(error);
            }
          }

          const rateLimitWarnings = consoleErrors.filter((message) => message.includes("status of 429"));
          const unexpectedConsoleErrors = consoleErrors.filter((message) => !message.includes("status of 429"));
          const contractFailures = [];
          if (!inspection) contractFailures.push("inspection missing");
          if (inspection?.uiState !== state) contractFailures.push(`state ${inspection?.uiState ?? "missing"} != ${state}`);
          if (inspection?.routePageCount !== 1) contractFailures.push(`route page count ${inspection?.routePageCount ?? "missing"}`);
          if (inspection?.routeFamilyPageCount !== 1) contractFailures.push(`route family count ${inspection?.routeFamilyPageCount ?? "missing"}`);
          if (inspection?.primaryTaskCount !== 1) contractFailures.push(`primary task count ${inspection?.primaryTaskCount ?? "missing"}`);
          if (inspection?.stateLegendCount !== 0) contractFailures.push(`state legend count ${inspection?.stateLegendCount ?? "missing"}`);
          if (state !== "loading" && (inspection?.loadingDescendantCount ?? 0) !== 0) contractFailures.push(`unexpected loading descendants ${inspection?.loadingDescendantCount}`);
          if (recoveryStates.has(state) && (inspection?.recoveryActionCount ?? 0) < 1) contractFailures.push(`${state} has no recovery action`);

          records.push({
            viewport: viewport.id,
            theme,
            frameNo: frame.frameNo,
            frameId,
            route: frame.svgRoute,
            state,
            screenshotPath,
            ...inspection,
            contractFailures,
            consoleErrors: [...consoleErrors],
            rateLimitWarnings,
            unexpectedConsoleErrors,
            pageErrors: [...pageErrors],
            failure,
            passed: !failure && contractFailures.length === 0 && unexpectedConsoleErrors.length === 0 && pageErrors.length === 0,
          });
        }
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}

const combinedRecords = retryFailures
  ? [
      ...previousOutput.records.filter((record) => !retryKeys.has(recordKey(record))),
      ...records,
    ]
  : records;
const applicableStateCount = stateMatrix.records.reduce((total, record) => total + record.supportedStates.length, 0);
const expectedCheckCount = applicableStateCount * themes.length * viewports.length;
const failures = combinedRecords.filter((record) => !record.passed);
const output = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  mode: captureAll ? "t106-all-states" : "t105-runtime-matrix",
  retryFailures,
  retriedCheckCount: records.length,
  chromium: "playwright bundled chromium headless",
  routeRegistrySha256: createHash("sha256").update(await readFile("src/routes/route-registry.ts")).digest("hex").toUpperCase(),
  stateMatrixSha256: createHash("sha256").update(await readFile("logs/t105-route-state-matrix.json")).digest("hex").toUpperCase(),
  runtimeUnlock,
  runtimeSecurityStatus: {
    initialized: runtimeSecurityStatus.initialized,
    locked: runtimeSecurityStatus.locked,
  },
  evidenceSamples,
  routeCount: stateMatrix.routeCount,
  applicableStateCount,
  themeCount: themes.length,
  viewportCount: viewports.length,
  expectedCheckCount,
  checkCount: combinedRecords.length,
  screenshotCount: combinedRecords.filter((record) => record.screenshotPath).length,
  passedCount: combinedRecords.filter((record) => record.passed).length,
  failureCount: failures.length,
  themes,
  viewports,
  failures,
  records: combinedRecords,
  passed: failures.length === 0 && combinedRecords.length === expectedCheckCount,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  mode: output.mode,
  routeCount: output.routeCount,
  applicableStateCount: output.applicableStateCount,
  expectedCheckCount: output.expectedCheckCount,
  checkCount: output.checkCount,
  screenshotCount: output.screenshotCount,
  passedCount: output.passedCount,
  failureCount: output.failureCount,
  passed: output.passed,
}, null, 2));
if (!output.passed) process.exitCode = 1;
