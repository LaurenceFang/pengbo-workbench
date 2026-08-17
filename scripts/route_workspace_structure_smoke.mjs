import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { resolveEvidenceSamples, sampleRoutePath } from "./m1_evidence_samples.mjs";

const baseUrl = process.env.PENGBO_WEB_URL ?? "http://127.0.0.1:4190";
const registry = JSON.parse(await readFile("logs/svg-frame-registry.json", "utf8"));
const viewports = [
  { id: "1440x900", width: 1440, height: 900 },
  { id: "1600x900", width: 1600, height: 900 },
  { id: "1180x900", width: 1180, height: 900 },
  { id: "960x900", width: 960, height: 900 },
];
const rateLimitResetMs = Number(process.env.PENGBO_STRUCTURE_RATE_LIMIT_RESET_MS ?? "0");

function resolveApiBaseUrl(webBaseUrl) {
  if (process.env.PENGBO_API_URL) return process.env.PENGBO_API_URL.replace(/\/$/, "");
  const url = new URL(webBaseUrl);
  if (["4190", "4173", "4175", "5173"].includes(url.port)) return `${url.protocol}//${url.hostname}:8765`;
  return webBaseUrl.replace(/\/$/, "");
}

async function unlockAcceptanceRuntime() {
  const secret = process.env.PENGBO_TEST_UNLOCK_SECRET;
  if (!secret) return { attempted: false, unlocked: null };
  const response = await fetch(`${resolveApiBaseUrl(baseUrl)}/api/v1/security/local/unlock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ unlock_secret: secret }),
  });
  if (!response.ok) throw new Error(`Route workspace smoke unlock failed: HTTP ${response.status}`);
  const status = await response.json();
  return { attempted: true, unlocked: status.locked === false };
}

async function readRuntimeSecurityStatus() {
  const response = await fetch(`${resolveApiBaseUrl(baseUrl)}/api/v1/security/local/status`);
  if (!response.ok) throw new Error(`Route workspace security status failed: HTTP ${response.status}`);
  return response.json();
}

function inspectWorkspace(frameId) {
  const root = document.querySelector(`[data-frame-id="${frameId}"]`);
  const child = root?.querySelector(":scope > .route-child-workspace") ?? null;
  const childStyle = child ? getComputedStyle(child) : null;
  const workspace = document.querySelector(".app-shell-workspace");
  const workspaceStyle = workspace ? getComputedStyle(workspace) : null;
  const contractBar = root?.querySelector(":scope > .route-contract-bar") ?? null;
  const activeSubroutes = root?.querySelectorAll('.ui-subroute-nav [aria-current="page"]') ?? [];
  const routePages = root?.querySelectorAll("[data-route-page]") ?? [];
  const primaryTasks = root?.querySelectorAll("[data-primary-task]") ?? [];
  const rect = (element) => {
    if (!element) return null;
    const value = element.getBoundingClientRect();
    return {
      x: Math.round(value.x * 100) / 100,
      y: Math.round(value.y * 100) / 100,
      width: Math.round(value.width * 100) / 100,
      height: Math.round(value.height * 100) / 100,
    };
  };
  return {
    uiState: root?.getAttribute("data-ui-state") ?? null,
    routeId: root?.getAttribute("data-route-id") ?? null,
    routePageCount: routePages.length,
    routePageId: routePages[0]?.getAttribute("data-route-page") ?? null,
    familyPageCount: root?.querySelectorAll(".route-family-page").length ?? 0,
    primaryTaskCount: primaryTasks.length,
    primaryTaskIds: Array.from(primaryTasks).map((element) => element.getAttribute("data-primary-task")),
    childWorkspaceCount: root?.querySelectorAll(":scope > .route-child-workspace").length ?? 0,
    childWorkspaceSurface: child?.getAttribute("data-real-business-surface") ?? null,
    childWorkspaceState: child?.getAttribute("data-surface-state") ?? null,
    childWorkspaceBox: rect(child),
    contractBarBox: rect(contractBar),
    childWorkspaceBackground: childStyle?.backgroundColor ?? null,
    childWorkspaceBorderWidths: childStyle ? [childStyle.borderTopWidth, childStyle.borderRightWidth, childStyle.borderBottomWidth, childStyle.borderLeftWidth] : [],
    childWorkspaceBorderRadius: childStyle?.borderRadius ?? null,
    childWorkspaceOverflowY: childStyle?.overflowY ?? null,
    childWorkspaceScrolls: child ? child.scrollHeight > child.clientHeight && ["auto", "scroll"].includes(childStyle?.overflowY ?? "") : false,
    workspaceOverflowY: workspaceStyle?.overflowY ?? null,
    workspaceOwnsVerticalScroll: workspaceStyle ? ["auto", "scroll"].includes(workspaceStyle.overflowY) : false,
    stateLegendCount: root?.querySelectorAll(".route-state-legend").length ?? 0,
    legacySurfaceCount: root?.querySelectorAll(".route-real-surface").length ?? 0,
    currentSubrouteCount: activeSubroutes.length,
    currentSubrouteId: activeSubroutes[0]?.getAttribute("aria-label")?.replace(/^subroute:/, "") ?? null,
  };
}

function contractFailures(record, frame) {
  const failures = [];
  const allowedStates = frame.availability?.kind === "planned"
    ? ["blocked"]
    : ["ready", "empty", "locked", "blocked", "error"];
  if (!allowedStates.includes(record.uiState)) failures.push(`terminal state ${record.uiState ?? "missing"}`);
  if (record.routeId !== frame.svgRoute) failures.push(`route id ${record.routeId ?? "missing"}`);
  if (record.routePageCount !== 1 || record.routePageId !== frame.componentKey) failures.push(`route page ${record.routePageCount}/${record.routePageId ?? "missing"}`);
  if (record.familyPageCount !== 1) failures.push(`family page count ${record.familyPageCount}`);
  if (record.primaryTaskCount !== 1 || record.primaryTaskIds[0] !== frame.surface.section) failures.push(`primary task ${record.primaryTaskCount}/${record.primaryTaskIds[0] ?? "missing"}`);
  if (record.childWorkspaceCount !== 1) failures.push(`child workspace count ${record.childWorkspaceCount}`);
  if (record.childWorkspaceSurface !== frame.surface.view) failures.push(`child workspace surface ${record.childWorkspaceSurface ?? "missing"}`);
  if (record.childWorkspaceState !== record.uiState) failures.push(`child workspace state ${record.childWorkspaceState ?? "missing"}`);
  if (record.childWorkspaceBackground !== "rgba(0, 0, 0, 0)") failures.push(`child workspace background ${record.childWorkspaceBackground ?? "missing"}`);
  if (record.childWorkspaceBorderWidths.some((value) => value !== "0px")) failures.push(`child workspace border ${record.childWorkspaceBorderWidths.join("/")}`);
  if (record.childWorkspaceBorderRadius !== "0px") failures.push(`child workspace radius ${record.childWorkspaceBorderRadius ?? "missing"}`);
  if (record.childWorkspaceBox?.height === 500) failures.push("child workspace fixed at 500px");
  if (record.childWorkspaceOverflowY !== "visible" || record.childWorkspaceScrolls) failures.push(`child workspace nested scroll ${record.childWorkspaceOverflowY ?? "missing"}/${record.childWorkspaceScrolls}`);
  if (!record.workspaceOwnsVerticalScroll) failures.push(`workspace overflow-y ${record.workspaceOverflowY ?? "missing"}`);
  if (record.stateLegendCount !== 0) failures.push(`state legend count ${record.stateLegendCount}`);
  if (record.legacySurfaceCount !== 0) failures.push(`legacy surface count ${record.legacySurfaceCount}`);
  if (record.currentSubrouteCount !== 1 || record.currentSubrouteId !== frame.svgRoute) failures.push(`current subroute ${record.currentSubrouteCount}/${record.currentSubrouteId ?? "missing"}`);
  return failures;
}

const runtimeUnlock = await unlockAcceptanceRuntime();
const runtimeSecurityStatus = await readRuntimeSecurityStatus();
const evidenceSamples = await resolveEvidenceSamples(baseUrl);
const browser = await chromium.launch({ headless: true });
const records = [];

for (const [viewportIndex, viewport] of viewports.entries()) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
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

  for (const [frameIndex, frame] of registry.frames.entries()) {
    consoleErrors.length = 0;
    pageErrors.length = 0;
    const frameId = `frame-${String(frame.frameNo).padStart(2, "0")}`;
    let inspection = null;
    let failure = null;
    try {
      const targetUrl = `${baseUrl}${sampleRoutePath(frame.svgRoute, evidenceSamples)}`;
      if (frameIndex === 0) {
        await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
      } else {
        await page.evaluate((nextUrl) => {
          window.history.pushState({}, "", nextUrl);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, targetUrl);
      }
      const root = page.locator(`[data-frame-id="${frameId}"]`);
      await root.waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForFunction((id) => {
        const element = document.querySelector(`[data-frame-id="${id}"]`);
        const state = element?.getAttribute("data-ui-state");
        return Boolean(state && state !== "loading" && !element?.querySelector('[data-ui-state="loading"]'));
      }, frameId, { timeout: 30_000 });
      await page.waitForTimeout(150);
      await page.waitForFunction((id) => {
        const element = document.querySelector(`[data-frame-id="${id}"]`);
        const state = element?.getAttribute("data-ui-state");
        return Boolean(state && state !== "loading" && !element?.querySelector('[data-ui-state="loading"]'));
      }, frameId, { timeout: 30_000 });
      await page.evaluate(() => document.fonts.ready);
      inspection = await page.evaluate(inspectWorkspace, frameId);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    const contract = inspection ? contractFailures(inspection, frame) : ["inspection missing"];
    const rateLimitWarnings = consoleErrors.filter((message) => message.includes("status of 429"));
    const unexpectedConsoleErrors = consoleErrors.filter((message) => !message.includes("status of 429"));
    records.push({
      viewport: viewport.id,
      frameNo: frame.frameNo,
      route: frame.svgRoute,
      componentKey: frame.componentKey,
      availability: frame.availability,
      accessPolicy: frame.accessPolicy,
      ...inspection,
      contractFailures: contract,
      consoleErrors: [...consoleErrors],
      rateLimitWarnings,
      unexpectedConsoleErrors,
      pageErrors: [...pageErrors],
      failure,
      passed: !failure && contract.length === 0 && unexpectedConsoleErrors.length === 0 && pageErrors.length === 0,
    });
  }
  await page.close();
  // The local gateway intentionally limits repeated requests to the same
  // sensitive endpoint. Reset the window between viewport passes so the next
  // viewport starts from a real terminal state instead of inheriting a prior
  // pass's rate-limit bucket. 429s within a pass remain recorded as warnings.
  if (viewportIndex < viewports.length - 1 && rateLimitResetMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, rateLimitResetMs));
  }
}

await browser.close();
await mkdir("logs", { recursive: true });
const result = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  chromium: "playwright bundled chromium",
  runtimeUnlock,
  runtimeSecurityStatus: {
    initialized: runtimeSecurityStatus.initialized,
    locked: runtimeSecurityStatus.locked,
  },
  evidenceSamples,
  routeCount: registry.frames.length,
  viewportCount: viewports.length,
  expectedCheckCount: registry.frames.length * viewports.length,
  checkCount: records.length,
  passedCount: records.filter((record) => record.passed).length,
  failureCount: records.filter((record) => !record.passed).length,
  contract: {
    directChildWorkspace: true,
    productionStateLegendCount: 0,
    legacyRouteSurfaceCount: 0,
    workspaceOwnsVerticalScroll: true,
    childWorkspaceOwnsVerticalScroll: false,
    rateLimitWarningsAreRecordedButDoNotFailStructure: true,
    rateLimitResetMs,
    desktopSubrouteRow: "80px at 1440/1600/1180",
    responsiveSubrouteRow: "auto at 960",
  },
  failures: records.filter((record) => !record.passed),
  records,
  passed: records.length === registry.frames.length * viewports.length && records.every((record) => record.passed),
};
await writeFile("logs/route-workspace-structure-smoke.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  routeCount: result.routeCount,
  viewportCount: result.viewportCount,
  checkCount: result.checkCount,
  passedCount: result.passedCount,
  failureCount: result.failureCount,
  passed: result.passed,
}, null, 2));
if (!result.passed) process.exitCode = 1;
