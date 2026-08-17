import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { resolveEvidenceSamples, sampleRoutePath } from "./m1_evidence_samples.mjs";

const viewport = { width: 1440, height: 900 };
const pixelCount = viewport.width * viewport.height;
const geometryTolerance = 2;
const rawPixelThreshold = 1.5;
const chromeEdgeThreshold = 1.5;
const businessInteriorMask = {
  x: 274,
  y: 174,
  width: 820,
  height: 702,
  reason: "The direct child workspace contains route-owned live data; the shell contract validates its placement and transparent boundary separately.",
};
const expectedGeometry = {
  shell: { x: 0, y: 0, width: 1440, height: 900 },
  toolbar: { x: 0, y: 0, width: 1440, height: 58 },
  sidebar: { x: 0, y: 58, width: 238, height: 842 },
  workspace: { x: 238, y: 58, width: 886, height: 842 },
  contractBar: { x: 274, y: 94, width: 820, height: 56 },
  childWorkspace: { x: 274, y: 174, width: 820, height: 702 },
  inspector: { x: 1124, y: 174, width: 260, height: 500 },
};
const strictRegionSelectors = {
  toolbar: ".app-shell-toolbar",
  sidebar: ".app-shell-sidebar",
  contractBar: ".route-contract-bar",
  childWorkspace: ".route-child-workspace",
  inspector: ".app-shell-context .ui-context-inspector",
};
const expectedStyles = {
  toolbar: { backgroundColor: "rgb(255, 255, 255)" },
  sidebar: { backgroundColor: "rgb(23, 40, 33)" },
  childWorkspace: { backgroundColor: "rgba(0, 0, 0, 0)", borderWidth: 0, borderRadius: 0, overflowY: "visible" },
  inspector: { backgroundColor: "rgb(231, 239, 234)", borderColor: "rgb(200, 215, 207)", borderRadius: 16 },
};
const chromeBands = [
  { name: "toolbar", rect: expectedGeometry.toolbar, edges: ["bottom"], band: 2 },
  { name: "sidebar", rect: expectedGeometry.sidebar, edges: ["right"], band: 2 },
  { name: "inspector", rect: expectedGeometry.inspector, edges: ["top", "right", "bottom", "left"], band: 4 },
];

const baseUrl = process.env.PENGBO_WEB_URL ?? "http://127.0.0.1:4190";

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
  if (!response.ok) throw new Error(`Acceptance runtime unlock failed: HTTP ${response.status}`);
  const status = await response.json();
  return { attempted: true, unlocked: status.locked === false };
}

const runtimeUnlock = await unlockAcceptanceRuntime();
const evidenceSamples = await resolveEvidenceSamples(baseUrl);
const svg = await readFile("Pengbo_UI_Rebuild.svg", "utf8");
const registry = JSON.parse(await readFile("logs/svg-frame-registry.json", "utf8"));
const fontFiles = {
  "IBM Plex Sans": "node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2",
  "IBM Plex Mono": "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
  "Source Serif 4": "node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2",
};
const fontFaces = (await Promise.all(Object.entries(fontFiles).map(async ([family, file]) => {
  const data = (await readFile(file)).toString("base64");
  return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${data}) format("woff2");font-style:normal;font-weight:100 900;font-display:block}`;
}))).join("\n");

function round(value) {
  return Math.round(value * 100) / 100;
}

function delta(actual, expected) {
  if (!actual) return null;
  return {
    x: round(actual.x - expected.x),
    y: round(actual.y - expected.y),
    width: round(actual.width - expected.width),
    height: round(actual.height - expected.height),
  };
}

function withinTolerance(boxDelta, tolerance = geometryTolerance) {
  return boxDelta !== null && Object.values(boxDelta).every((value) => Math.abs(value) <= tolerance);
}

function parsePixels(value) {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

function styleContract(actual, expected) {
  if (!actual) return { expected, actual, passed: false, failures: ["missing element"] };
  const failures = [];
  if (expected.backgroundColor && actual.backgroundColor !== expected.backgroundColor) failures.push(`background ${actual.backgroundColor}`);
  if (expected.borderColor) {
    if (actual.borderColor !== expected.borderColor) failures.push(`border ${actual.borderColor}`);
    if ((parsePixels(actual.borderWidth) ?? 0) < 0.5) failures.push(`border width ${actual.borderWidth}`);
  }
  if (expected.borderWidth !== undefined && Math.abs((parsePixels(actual.borderWidth) ?? -100) - expected.borderWidth) > 0.5) failures.push(`border width ${actual.borderWidth}`);
  if (expected.borderRadius !== undefined && Math.abs((parsePixels(actual.borderRadius) ?? -100) - expected.borderRadius) > 0.5) failures.push(`radius ${actual.borderRadius}`);
  if (expected.fontSize !== undefined && Math.abs((parsePixels(actual.fontSize) ?? -100) - expected.fontSize) > 0.5) failures.push(`font size ${actual.fontSize}`);
  if (expected.overflowY !== undefined && actual.overflowY !== expected.overflowY) failures.push(`overflow-y ${actual.overflowY}`);
  return { expected, actual, failures, passed: failures.length === 0 };
}

function replaceRect(target, source, rect) {
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    const start = (y * viewport.width + rect.x) * 4;
    const end = start + rect.width * 4;
    source.copy(target, start, start, end);
  }
}

function addBand(mask, rect, edge, band) {
  const xStart = Math.max(0, Math.floor(rect.x));
  const yStart = Math.max(0, Math.floor(rect.y));
  const xEnd = Math.min(viewport.width, Math.ceil(rect.x + rect.width));
  const yEnd = Math.min(viewport.height, Math.ceil(rect.y + rect.height));
  for (let y = yStart; y < yEnd; y += 1) {
    for (let x = xStart; x < xEnd; x += 1) {
      const selected = edge === "top" ? y < yStart + band
        : edge === "bottom" ? y >= yEnd - band
          : edge === "left" ? x < xStart + band
            : x >= xEnd - band;
      if (selected) mask[y * viewport.width + x] = 1;
    }
  }
}

function chromeComparison(reference, actual) {
  const selected = new Uint8Array(pixelCount);
  for (const region of chromeBands) {
    for (const edge of region.edges) addBand(selected, region.rect, edge, region.band);
  }
  const isolatedActual = Buffer.from(reference.data);
  let selectedPixels = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (!selected[index]) continue;
    selectedPixels += 1;
    const offset = index * 4;
    isolatedActual[offset] = actual.data[offset];
    isolatedActual[offset + 1] = actual.data[offset + 1];
    isolatedActual[offset + 2] = actual.data[offset + 2];
    isolatedActual[offset + 3] = actual.data[offset + 3];
  }
  const diff = new PNG({ width: viewport.width, height: viewport.height });
  const diffPixels = pixelmatch(reference.data, isolatedActual, diff.data, viewport.width, viewport.height, { threshold: 0.1, includeAA: false });
  return {
    actual: new PNG({ width: viewport.width, height: viewport.height, data: isolatedActual }),
    diff,
    diffPixels,
    selectedPixels,
    diffPercent: round((diffPixels / selectedPixels) * 100),
  };
}

function structureContract(structure, frame, state) {
  const failures = [];
  if (structure.routePageCount !== 1) failures.push(`route-page count ${structure.routePageCount}`);
  if (structure.routePageId !== frame.componentKey) failures.push(`route-page id ${structure.routePageId ?? "missing"}`);
  if (structure.familyPageCount !== 1) failures.push(`route-family-page count ${structure.familyPageCount}`);
  if (structure.primaryTaskCount !== 1) failures.push(`primary-task count ${structure.primaryTaskCount}`);
  if (structure.primaryTaskIds[0] !== frame.surface.section) failures.push(`primary-task id ${structure.primaryTaskIds[0] ?? "missing"}`);
  if (structure.childWorkspaceCount !== 1) failures.push(`child workspace count ${structure.childWorkspaceCount}`);
  if (!structure.childWorkspaceIsDirectChild) failures.push("child workspace is not a direct RoutePageFrame child");
  if (structure.childWorkspaceSurface !== frame.surface.view) failures.push(`child workspace surface ${structure.childWorkspaceSurface ?? "missing"}`);
  if (structure.childWorkspaceState !== state) failures.push(`child workspace state ${structure.childWorkspaceState ?? "missing"}`);
  if (structure.legacySurfaceCount !== 0) failures.push(`legacy surface count ${structure.legacySurfaceCount}`);
  if (structure.stateLegendCount !== 0) failures.push(`state legend count ${structure.stateLegendCount}`);
  if (structure.currentSubrouteCount !== 1) failures.push(`current subroute count ${structure.currentSubrouteCount}`);
  if (structure.currentSubrouteId !== frame.svgRoute) failures.push(`current subroute ${structure.currentSubrouteId ?? "missing"}`);
  if (!structure.workspaceOwnsVerticalScroll) failures.push(`workspace overflow-y ${structure.workspaceOverflowY ?? "missing"}`);
  if (structure.childWorkspaceOverflowY !== "visible") failures.push(`child workspace overflow-y ${structure.childWorkspaceOverflowY ?? "missing"}`);
  if (structure.childWorkspaceHeight === 500) failures.push("child workspace retains fixed 500px height");
  if (structure.genericRouteContentCount !== 0) failures.push(`generic route content count ${structure.genericRouteContentCount}`);
  if (structure.loadingStateCount !== 0) failures.push(`nested loading count ${structure.loadingStateCount}`);
  if (structure.surfaceElementCount < 2) failures.push(`surface element count ${structure.surfaceElementCount}`);
  if (structure.surfaceTextLength < 24) failures.push(`surface text length ${structure.surfaceTextLength}`);
  if (!structure.meaningfulContent) failures.push("no meaningful controls, visualization, structured content, or substantial text");
  if (frame.availability?.kind === "planned") {
    if (state !== "blocked") failures.push(`planned route state ${state ?? "missing"}`);
    if (!structure.plannedTaskVisible) failures.push(`planned task ${frame.availability.plannedTask} is not visible`);
    if (structure.recoveryActionCount < 1) failures.push("planned route has no recovery action");
  } else if (state !== "ready") {
    failures.push(`available route state ${state ?? "missing"}`);
  }
  return { failures, passed: failures.length === 0 };
}

const outputRoot = "logs/visual-acceptance";
const referenceDir = `${outputRoot}/reference`;
const actualDir = `${outputRoot}/actual`;
const rawDiffDir = `${outputRoot}/diff`;
const maskedActualDir = `${outputRoot}/masked-actual`;
const maskedDiffDir = `${outputRoot}/masked-diff`;
const chromeActualDir = `${outputRoot}/chrome-actual`;
const chromeDiffDir = `${outputRoot}/chrome-diff`;
await Promise.all([referenceDir, actualDir, rawDiffDir, maskedActualDir, maskedDiffDir, chromeActualDir, chromeDiffDir].map((dir) => mkdir(dir, { recursive: true })));

const browser = await chromium.launch({ headless: true });
const referencePage = await browser.newPage({ viewport, deviceScaleFactor: 1 });
await referencePage.setContent(`<style>${fontFaces}html,body{margin:0;padding:0;width:${viewport.width}px;height:${viewport.height}px;overflow:hidden}svg{position:absolute;left:0;top:0;display:block;transform-origin:0 0}</style>${svg}`, { waitUntil: "load" });
await referencePage.evaluate(() => document.fonts.ready);

for (const frame of registry.frames) {
  await referencePage.evaluate(({ x, y }) => {
    const element = document.querySelector("svg");
    if (element instanceof SVGElement) element.style.transform = `translate(${-x}px, ${-y}px)`;
  }, frame.svgBounds);
  await referencePage.screenshot({ path: `${referenceDir}/frame-${String(frame.frameNo).padStart(2, "0")}.png`, fullPage: false });
}
await referencePage.close();

const records = [];
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
const consoleErrors = [];
const pageErrors = [];
const warmedViews = new Set();
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => pageErrors.push(error.message));

for (const frame of registry.frames) {
  consoleErrors.length = 0;
  pageErrors.length = 0;
  const number = String(frame.frameNo).padStart(2, "0");
  const actualPath = `${actualDir}/frame-${number}.png`;
  const referencePath = `${referenceDir}/frame-${number}.png`;
  const rawDiffPath = `${rawDiffDir}/frame-${number}.png`;
  const maskedActualPath = `${maskedActualDir}/frame-${number}.png`;
  const maskedDiffPath = `${maskedDiffDir}/frame-${number}.png`;
  const chromeActualPath = `${chromeActualDir}/frame-${number}.png`;
  const chromeDiffPath = `${chromeDiffDir}/frame-${number}.png`;
  let failure = null;
  let state = null;
  let geometry = null;
  let styles = null;
  let structure = null;
  let structureResult = null;

  try {
    const url = `${baseUrl}${sampleRoutePath(frame.svgRoute, evidenceSamples)}`;
    if (frame.frameNo === 1) {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    } else {
      await page.evaluate((nextUrl) => {
        window.history.pushState({}, "", nextUrl);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, url);
    }
    const root = page.locator(`[data-frame-id="frame-${number}"]`);
    await root.waitFor({ state: "visible", timeout: 10_000 });
    const warmupTimeout = frame.availability?.kind === "available" && frame.accessPolicy === "public" && !warmedViews.has(frame.topLevelView)
      ? 120_000
      : 20_000;
    await page.waitForFunction((frameId) => {
      const element = document.querySelector(`[data-frame-id="${frameId}"]`);
      const value = element?.getAttribute("data-ui-state");
      return Boolean(value && value !== "loading" && !element?.querySelector('[data-ui-state="loading"]'));
    }, `frame-${number}`, { timeout: warmupTimeout });
    await page.waitForTimeout(150);
    await page.waitForFunction((frameId) => {
      const element = document.querySelector(`[data-frame-id="${frameId}"]`);
      const value = element?.getAttribute("data-ui-state");
      return Boolean(value && value !== "loading" && !element?.querySelector('[data-ui-state="loading"]'));
    }, `frame-${number}`, { timeout: warmupTimeout });
    warmedViews.add(frame.topLevelView);
    await page.evaluate(() => document.fonts.ready);
    state = await root.getAttribute("data-ui-state");
    const inspection = await page.evaluate(({ componentKey, plannedTask, selectors }) => {
      const rootElement = document.querySelector(`[data-route-page="${componentKey}"]`)?.closest("[data-frame-id]");
      const surface = document.querySelector(".route-child-workspace");
      const workspace = document.querySelector(".app-shell-workspace");
      const box = (selector) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
      };
      const style = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const value = getComputedStyle(element);
        return {
          backgroundColor: value.backgroundColor,
          borderColor: value.borderTopColor,
          borderWidth: value.borderTopWidth,
          borderRadius: value.borderRadius,
          fontSize: value.fontSize,
          overflowY: value.overflowY,
        };
      };
      const routePages = document.querySelectorAll("[data-route-page]");
      const primaryTasks = document.querySelectorAll("[data-primary-task]");
      const text = (surface?.textContent ?? "").trim();
      const interactiveCount = surface?.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[role="button"],[role="row"]').length ?? 0;
      const visualizationCount = surface?.querySelectorAll('svg,canvas,table,[role="table"],.chart,.sparkline,.metric-grid,.table-list').length ?? 0;
      const structuredContentCount = surface?.querySelectorAll('section,article,form,dl,ul,ol,.card,.panel').length ?? 0;
      return {
        boxes: {
          shell: box(".app-shell"),
          toolbar: box(".app-shell-toolbar"),
          sidebar: box(".app-shell-sidebar"),
          workspace: box(".app-shell-main"),
          contractBar: box(".route-contract-bar"),
          childWorkspace: box(".route-child-workspace"),
          inspector: box(".app-shell-context .ui-context-inspector"),
        },
        styles: Object.fromEntries(Object.entries(selectors).map(([key, selector]) => [key, style(selector)])),
        structure: {
          routePageCount: routePages.length,
          routePageId: routePages[0]?.getAttribute("data-route-page") ?? null,
          familyPageCount: document.querySelectorAll(".route-family-page").length,
          primaryTaskCount: primaryTasks.length,
          primaryTaskIds: Array.from(primaryTasks).map((element) => element.getAttribute("data-primary-task")),
          childWorkspaceCount: document.querySelectorAll(".route-child-workspace").length,
          childWorkspaceIsDirectChild: surface?.parentElement === rootElement,
          childWorkspaceSurface: surface?.getAttribute("data-real-business-surface") ?? null,
          childWorkspaceState: surface?.getAttribute("data-surface-state") ?? null,
          childWorkspaceOverflowY: surface ? getComputedStyle(surface).overflowY : null,
          childWorkspaceHeight: surface ? Math.round(surface.getBoundingClientRect().height) : null,
          legacySurfaceCount: document.querySelectorAll(".route-real-surface").length,
          stateLegendCount: document.querySelectorAll(".route-state-legend").length,
          currentSubrouteCount: document.querySelectorAll('.ui-subroute-nav [aria-current="page"]').length,
          currentSubrouteId: document.querySelector('.ui-subroute-nav [aria-current="page"]')?.getAttribute("aria-label")?.replace(/^subroute:/, "") ?? null,
          workspaceOverflowY: workspace ? getComputedStyle(workspace).overflowY : null,
          workspaceOwnsVerticalScroll: workspace ? ["auto", "scroll"].includes(getComputedStyle(workspace).overflowY) : false,
          genericRouteContentCount: surface?.querySelectorAll('.route-content,[data-route-content]').length ?? 0,
          loadingStateCount: rootElement?.querySelectorAll('[data-ui-state="loading"]').length ?? 0,
          surfaceElementCount: surface?.querySelectorAll("*").length ?? 0,
          surfaceTextLength: text.length,
          interactiveCount,
          visualizationCount,
          structuredContentCount,
          meaningfulContent: interactiveCount > 0 || visualizationCount > 0 || structuredContentCount > 1 || text.length >= 80,
          plannedTaskVisible: plannedTask ? text.includes(plannedTask) : false,
          recoveryActionCount: surface?.querySelectorAll("button,a[href]").length ?? 0,
        },
      };
    }, { componentKey: frame.componentKey, plannedTask: frame.availability?.plannedTask ?? null, selectors: strictRegionSelectors });

    geometry = Object.fromEntries(Object.entries(expectedGeometry).map(([key, value]) => {
      const boxDelta = delta(inspection.boxes[key], value);
      const passed = key === "childWorkspace"
        ? boxDelta !== null
          && Math.abs(boxDelta.x) <= geometryTolerance
          && Math.abs(boxDelta.y) <= geometryTolerance
          && Math.abs(boxDelta.width) <= geometryTolerance
          && inspection.boxes[key].height >= value.height - geometryTolerance
        : withinTolerance(boxDelta);
      return [key, {
        actual: inspection.boxes[key],
        expected: value,
        heightPolicy: key === "childWorkspace" ? "minimum" : "exact",
        delta: boxDelta,
        passed,
      }];
    }));
    styles = Object.fromEntries(Object.entries(expectedStyles).map(([key, value]) => [key, styleContract(inspection.styles[key], value)]));
    structure = inspection.structure;
    structureResult = structureContract(structure, frame, state);
    await page.screenshot({ path: actualPath, fullPage: false });
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  let rawDiffPixels = null;
  let rawDiffPercent = null;
  let maskedDiffPixels = null;
  let maskedDiffPercent = null;
  let chromeEdgeDiffPixels = null;
  let chromeEdgeDiffPercent = null;
  let chromeSelectedPixels = null;
  if (!failure) {
    const reference = PNG.sync.read(await readFile(referencePath));
    const actual = PNG.sync.read(await readFile(actualPath));
    const rawDiff = new PNG({ width: viewport.width, height: viewport.height });
    rawDiffPixels = pixelmatch(reference.data, actual.data, rawDiff.data, viewport.width, viewport.height, { threshold: 0.1, includeAA: false });
    rawDiffPercent = round((rawDiffPixels / pixelCount) * 100);
    await writeFile(rawDiffPath, PNG.sync.write(rawDiff));

    const maskedActual = new PNG({ width: viewport.width, height: viewport.height, data: Buffer.from(actual.data) });
    replaceRect(maskedActual.data, reference.data, businessInteriorMask);
    const maskedDiff = new PNG({ width: viewport.width, height: viewport.height });
    maskedDiffPixels = pixelmatch(reference.data, maskedActual.data, maskedDiff.data, viewport.width, viewport.height, { threshold: 0.1, includeAA: false });
    maskedDiffPercent = round((maskedDiffPixels / pixelCount) * 100);
    await Promise.all([
      writeFile(maskedActualPath, PNG.sync.write(maskedActual)),
      writeFile(maskedDiffPath, PNG.sync.write(maskedDiff)),
    ]);

    const chrome = chromeComparison(reference, actual);
    chromeEdgeDiffPixels = chrome.diffPixels;
    chromeEdgeDiffPercent = chrome.diffPercent;
    chromeSelectedPixels = chrome.selectedPixels;
    await Promise.all([
      writeFile(chromeActualPath, PNG.sync.write(chrome.actual)),
      writeFile(chromeDiffPath, PNG.sync.write(chrome.diff)),
    ]);
  }

  const geometryPassed = geometry !== null && Object.values(geometry).every((item) => item.passed);
  const stylePassed = styles !== null && Object.values(styles).every((item) => item.passed);
  const structurePassed = structureResult?.passed === true;
  const chromePixelDiagnosticPassed = chromeEdgeDiffPercent !== null && chromeEdgeDiffPercent <= chromeEdgeThreshold;
  const legalMaskArtifactGenerated = maskedDiffPercent !== null && maskedActualPath !== null && maskedDiffPath !== null;
  records.push({
    frameNo: frame.frameNo,
    route: frame.svgRoute,
    componentKey: frame.componentKey,
    state,
    availability: frame.availability,
    referencePath,
    actualPath: failure ? null : actualPath,
    rawDiffPath: failure ? null : rawDiffPath,
    rawDiffPixels,
    rawDiffPercent,
    rawPixelThreshold,
    rawPixelGate: "diagnostic_only",
    businessInteriorMask,
    maskedActualPath: failure ? null : maskedActualPath,
    maskedDiffPath: failure ? null : maskedDiffPath,
    maskedDiffPixels,
    maskedDiffPercent,
    maskedFullFrameGate: "diagnostic_only",
    chromeActualPath: failure ? null : chromeActualPath,
    chromeDiffPath: failure ? null : chromeDiffPath,
    chromeSelectedPixels,
    chromeEdgeDiffPixels,
    chromeEdgeDiffPercent,
    maxChromeEdgeDiffPercent: chromeEdgeThreshold,
    chromePixelDiagnosticPassed,
    geometry,
    geometryPassed,
    styles,
    stylePassed,
    structure,
    structureResult,
    structurePassed,
    consoleErrors: [...consoleErrors],
    pageErrors: [...pageErrors],
    failure,
    legalMaskArtifactGenerated,
    passed: !failure && geometryPassed && stylePassed && structurePassed && legalMaskArtifactGenerated && consoleErrors.length === 0 && pageErrors.length === 0,
  });
}
await page.close();
await browser.close();

const result = {
  generatedAt: new Date().toISOString(),
  sourceSvg: "Pengbo_UI_Rebuild.svg",
  sourceSvgSha256: createHash("sha256").update(svg).digest("hex").toUpperCase(),
  chromium: "playwright bundled chromium",
  fontFiles,
  runtimeUnlock,
  evidenceSamples,
  acceptanceRule: {
    id: "m1-svg-direct-child-workspace-v2",
    approved: true,
    strict: ["toolbar geometry and rendered style tokens", "sidebar geometry and rendered style tokens", "80px subroute contract row", "transparent direct child workspace without a generic boundary or nested scroll", "context inspector geometry and rendered style tokens", "no production state legend"],
    businessInteriorMask,
    functionalAssertions: ["one route page", "one route family page", "one primary task", "one active subroute", "no legacy route surface", "no production state legend", "workspace owns vertical scrolling", "no loading terminal", "non-empty meaningful content", "planned task blocking and recovery"],
    rawPixelPolicy: "retained as diagnostic evidence; illustrative SVG placeholder content and contradictory edge painting are not completion gates",
    chromePixelPolicy: "retained as diagnostic evidence; strict shell acceptance is enforced by rendered geometry and computed style contracts",
    geometryTolerance,
    chromeEdgeThreshold,
  },
  frameCount: records.length,
  passedCount: records.filter((record) => record.passed).length,
  geometryPassedCount: records.filter((record) => record.geometryPassed).length,
  stylePassedCount: records.filter((record) => record.stylePassed).length,
  structurePassedCount: records.filter((record) => record.structurePassed).length,
  legalMaskArtifactCount: records.filter((record) => record.legalMaskArtifactGenerated).length,
  chromePixelDiagnosticPassedCount: records.filter((record) => record.chromePixelDiagnosticPassed).length,
  rawPixelDiagnosticPassedCount: records.filter((record) => record.rawDiffPercent !== null && record.rawDiffPercent <= rawPixelThreshold).length,
  humanSignoff: "pending",
  records,
  passed: records.length === 79 && records.every((record) => record.passed),
  m1ExitEligible: false,
  m1ExitBlocker: "Automated acceptance does not replace the required per-frame human signoff and remaining T105/T106 state matrix work.",
};
await writeFile(`${outputRoot}/index.json`, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  frameCount: result.frameCount,
  passedCount: result.passedCount,
  geometryPassedCount: result.geometryPassedCount,
  stylePassedCount: result.stylePassedCount,
  structurePassedCount: result.structurePassedCount,
  legalMaskArtifactCount: result.legalMaskArtifactCount,
  chromePixelDiagnosticPassedCount: result.chromePixelDiagnosticPassedCount,
  rawPixelDiagnosticPassedCount: result.rawPixelDiagnosticPassedCount,
  humanSignoff: result.humanSignoff,
  passed: result.passed,
  m1ExitEligible: result.m1ExitEligible,
}, null, 2));
if (!result.passed) process.exitCode = 1;
