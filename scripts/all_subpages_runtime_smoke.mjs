import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolveEvidenceSamples, sampleRoutePath } from "./m1_evidence_samples.mjs";

const baseUrl = process.env.PENGBO_WEB_URL ?? "http://127.0.0.1:4190";
const registry = JSON.parse(await readFile("logs/svg-frame-registry.json", "utf8"));

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
  if (!response.ok) throw new Error(`Runtime smoke unlock failed: HTTP ${response.status}`);
  const status = await response.json();
  return { attempted: true, unlocked: status.locked === false };
}

const runtimeUnlock = await unlockAcceptanceRuntime();
const evidenceSamples = await resolveEvidenceSamples(baseUrl);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const records = [];

async function inspectStructure(root, frame) {
  return root.evaluate((rootElement, expected) => {
    const childWorkspace = rootElement.querySelector(":scope > .route-child-workspace");
    const childStyle = childWorkspace ? getComputedStyle(childWorkspace) : null;
    const workspace = document.querySelector(".app-shell-workspace");
    const workspaceStyle = workspace ? getComputedStyle(workspace) : null;
    const activeSubroutes = rootElement.querySelectorAll('.ui-subroute-nav [aria-current="page"]');
    const primaryTasks = Array.from(rootElement.querySelectorAll("[data-primary-task]"));
    return {
      routePageCount: rootElement.querySelectorAll("[data-route-page]").length,
      routePageId: rootElement.querySelector("[data-route-page]")?.getAttribute("data-route-page") ?? null,
      familyPageCount: rootElement.querySelectorAll(".route-family-page").length,
      primaryTaskCount: primaryTasks.length,
      primaryTaskIds: primaryTasks.map((node) => node.getAttribute("data-primary-task")),
      childWorkspaceCount: rootElement.querySelectorAll(":scope > .route-child-workspace").length,
      childWorkspaceSurface: childWorkspace?.getAttribute("data-real-business-surface") ?? null,
      childWorkspaceState: childWorkspace?.getAttribute("data-surface-state") ?? null,
      childWorkspaceBackground: childStyle?.backgroundColor ?? null,
      childWorkspaceBorderWidths: childStyle ? [childStyle.borderTopWidth, childStyle.borderRightWidth, childStyle.borderBottomWidth, childStyle.borderLeftWidth] : [],
      childWorkspaceBorderRadius: childStyle?.borderRadius ?? null,
      childWorkspaceHeight: childWorkspace ? Math.round(childWorkspace.getBoundingClientRect().height) : null,
      childWorkspaceOverflowY: childStyle?.overflowY ?? null,
      workspaceOverflowY: workspaceStyle?.overflowY ?? null,
      stateLegendCount: rootElement.querySelectorAll(".route-state-legend").length,
      legacySurfaceCount: rootElement.querySelectorAll(".route-real-surface").length,
      currentSubrouteCount: activeSubroutes.length,
      currentSubrouteId: activeSubroutes[0]?.getAttribute("aria-label")?.replace(/^subroute:/, "") ?? null,
      expected,
    };
  }, { componentKey: frame.componentKey, route: frame.svgRoute, section: frame.surface.section, view: frame.surface.view });
}

function structureFailures(structure, frame, uiState) {
  const failures = [];
  if (!structure) return ["structure inspection missing"];
  if (structure.routePageCount !== 1 || structure.routePageId !== frame.componentKey) failures.push(`route page ${structure.routePageCount}/${structure.routePageId ?? "missing"}`);
  if (structure.familyPageCount !== 1) failures.push(`family page count ${structure.familyPageCount}`);
  if (structure.primaryTaskCount !== 1 || structure.primaryTaskIds[0] !== frame.surface.section) failures.push(`primary task ${structure.primaryTaskCount}/${structure.primaryTaskIds[0] ?? "missing"}`);
  if (structure.childWorkspaceCount !== 1) failures.push(`child workspace count ${structure.childWorkspaceCount}`);
  if (structure.childWorkspaceSurface !== frame.surface.view) failures.push(`child workspace surface ${structure.childWorkspaceSurface ?? "missing"}`);
  if (structure.childWorkspaceState !== uiState) failures.push(`child workspace state ${structure.childWorkspaceState ?? "missing"}`);
  if (structure.childWorkspaceBackground !== "rgba(0, 0, 0, 0)") failures.push(`child workspace background ${structure.childWorkspaceBackground ?? "missing"}`);
  if (structure.childWorkspaceBorderWidths.some((value) => value !== "0px")) failures.push(`child workspace border ${structure.childWorkspaceBorderWidths.join("/")}`);
  if (structure.childWorkspaceBorderRadius !== "0px") failures.push(`child workspace radius ${structure.childWorkspaceBorderRadius ?? "missing"}`);
  if (structure.childWorkspaceHeight === 500) failures.push("child workspace fixed at 500px");
  if (structure.childWorkspaceOverflowY !== "visible") failures.push(`child workspace overflow-y ${structure.childWorkspaceOverflowY ?? "missing"}`);
  if (!["auto", "scroll"].includes(structure.workspaceOverflowY)) failures.push(`workspace overflow-y ${structure.workspaceOverflowY ?? "missing"}`);
  if (structure.stateLegendCount !== 0) failures.push(`state legend count ${structure.stateLegendCount}`);
  if (structure.legacySurfaceCount !== 0) failures.push(`legacy surface count ${structure.legacySurfaceCount}`);
  if (structure.currentSubrouteCount !== 1 || structure.currentSubrouteId !== frame.svgRoute) failures.push(`current subroute ${structure.currentSubrouteCount}/${structure.currentSubrouteId ?? "missing"}`);
  return failures;
}

async function verifySiblingNavigation(page, frame) {
  const sibling = registry.frames.find((candidate) => candidate.topLevelView === frame.topLevelView && candidate.svgRoute !== frame.svgRoute);
  if (!sibling) return { applicable: false, passed: true };
  const beforePath = new URL(page.url()).pathname;
  const beforeHistoryLength = await page.evaluate(() => window.history.length);
  const button = page.locator(`.ui-subroute-nav button[aria-label="subroute:${sibling.svgRoute}"]`);
  await button.click();
  const siblingRoot = page.locator(`[data-route-id="${sibling.svgRoute}"]`).first();
  await siblingRoot.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction((routeId) => {
    const element = document.querySelector(`[data-route-id="${routeId}"]`);
    const state = element?.getAttribute("data-ui-state");
    return Boolean(state && state !== "loading");
  }, sibling.svgRoute, { timeout: 30_000 });
  const afterPath = new URL(page.url()).pathname;
  const afterHistoryLength = await page.evaluate(() => window.history.length);
  const oldPageCount = await page.locator(`[data-route-page="${frame.componentKey}"]`).count();
  const newPageCount = await page.locator(`[data-route-page="${sibling.componentKey}"]`).count();
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.locator(`[data-route-id="${frame.svgRoute}"]`).first().waitFor({ state: "visible", timeout: 10_000 });
  const backRouteId = await page.locator("[data-route-id]").first().getAttribute("data-route-id");
  await page.goForward({ waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.locator(`[data-route-id="${sibling.svgRoute}"]`).first().waitFor({ state: "visible", timeout: 10_000 });
  const forwardRouteId = await page.locator("[data-route-id]").first().getAttribute("data-route-id");
  const passed = afterPath !== beforePath
    // Chromium may cap the exposed history length (commonly at 50) even
    // though pushState, back and forward continue to work. The actual
    // navigation contract is therefore proved by the restored route ids.
    && afterHistoryLength >= beforeHistoryLength
    && oldPageCount === 0
    && newPageCount === 1
    && backRouteId === frame.svgRoute
    && forwardRouteId === sibling.svgRoute;
  return {
    applicable: true,
    siblingRoute: sibling.svgRoute,
    beforePath,
    afterPath,
    beforeHistoryLength,
    afterHistoryLength,
    oldPageCount,
    newPageCount,
    backRouteId,
    forwardRouteId,
    passed,
  };
}

for (const frame of registry.frames) {
  const url = `${baseUrl}${sampleRoutePath(frame.svgRoute, evidenceSamples)}`;
  let failure = null;
  let routeId = null;
  let uiState = null;
  let routePageCount = 0;
  let primaryTasks = [];
  let structure = null;
  let navigation = null;
  let rateLimitRecovery = false;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    let root = page.locator(`[data-frame-id="frame-${String(frame.frameNo).padStart(2, "0")}"]`);
    await root.waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForFunction((frameId) => {
      const element = document.querySelector(`[data-frame-id="${frameId}"]`);
      const state = element?.getAttribute("data-ui-state");
      return Boolean(state && state !== "loading" && !element?.querySelector('[data-ui-state="loading"]'));
    }, `frame-${String(frame.frameNo).padStart(2, "0")}`, { timeout: 30_000 });
    const transientState = await root.getAttribute("data-ui-state");
    const transientCopy = await root.innerText();
    if (transientState === "blocked" && transientCopy.includes("rate_limit_exceeded")) {
      rateLimitRecovery = true;
      await page.waitForTimeout(61_000);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 });
      root = page.locator(`[data-frame-id="frame-${String(frame.frameNo).padStart(2, "0")}"]`);
      await root.waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForFunction((frameId) => {
        const element = document.querySelector(`[data-frame-id="${frameId}"]`);
        const state = element?.getAttribute("data-ui-state");
        return Boolean(state && state !== "loading" && !element?.querySelector('[data-ui-state="loading"]'));
      }, `frame-${String(frame.frameNo).padStart(2, "0")}`, { timeout: 30_000 });
    }
    routeId = await page.locator("[data-route-id]").first().getAttribute("data-route-id");
    uiState = await root.getAttribute("data-ui-state");
    routePageCount = await root.locator(`[data-route-page="${frame.componentKey}"]`).count();
    primaryTasks = await root.locator("[data-primary-task]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-primary-task")));
    structure = await inspectStructure(root, frame);
    navigation = await verifySiblingNavigation(page, frame);
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  const planned = frame.availability?.kind === "planned";
  const expectedStatePassed = planned ? uiState === "blocked" : ["ready", "empty"].includes(uiState);
  const structureContractFailures = structureFailures(structure, frame, uiState);
  const passed = !failure
    && routeId === frame.svgRoute
    && expectedStatePassed
    && routePageCount === 1
    && primaryTasks.length === 1
    && primaryTasks[0] === frame.surface.section
    && structureContractFailures.length === 0
    && navigation?.passed === true;

  records.push({
    frameNo: frame.frameNo,
    route: frame.svgRoute,
    componentKey: frame.componentKey,
    availability: frame.availability,
    routeId,
    uiState,
    routePageCount,
    primaryTasks,
    structure,
    structureContractFailures,
    navigation,
    rateLimitRecovery,
    failure,
    passed,
  });
}

await browser.close();
await mkdir("logs", { recursive: true });
const result = {
  generatedAt: new Date().toISOString(),
  routeCount: records.length,
  availableCount: records.filter((record) => record.availability?.kind === "available").length,
  plannedCount: records.filter((record) => record.availability?.kind === "planned").length,
  runtimeUnlock,
  evidenceSamples,
  passedCount: records.filter((record) => record.passed).length,
  failures: records.filter((record) => !record.passed),
  records,
};
await writeFile("logs/all-subpages-runtime-smoke.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  routeCount: result.routeCount,
  availableCount: result.availableCount,
  plannedCount: result.plannedCount,
  passedCount: result.passedCount,
  failureCount: result.failures.length,
  failures: result.failures,
}, null, 2));
if (result.passedCount !== result.routeCount) process.exitCode = 1;
