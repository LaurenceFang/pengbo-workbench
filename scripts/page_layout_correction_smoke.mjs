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
const targetKeys = new Set([
  "assetOverview",
  "assetFundamentals",
  "assetFilings",
  "assetData",
  "researchDecision",
  "researchAssetData",
  "portfolioHoldings",
  "portfolioAllocation",
  "portfolioTransactions",
  "portfolioTransactionNew",
  "portfolioHandoff",
  "workflowCatalog",
  "workflowDetail",
  "workflowConfigure",
  "workflowRuns",
  "workflowRun",
  "workflowArtifacts",
  "workflowConfirm",
  "screenerCatalog",
  "screenerVariant",
  "screenerTuning",
  "screenerUniverse",
  "screenerRun",
  "screenerExplanations",
]);
const requestedTargetKeys = process.env.PENGBO_LAYOUT_COMPONENT_KEYS
  ? new Set(process.env.PENGBO_LAYOUT_COMPONENT_KEYS.split(",").map((key) => key.trim()).filter(Boolean))
  : targetKeys;
const researchBriefTargetKeys = new Set(["researchDecision", "researchAssetData"]);
const screenshotDir = "logs/page-layout-correction/screenshots";
const rateLimitResetMs = Number(process.env.PENGBO_LAYOUT_RATE_LIMIT_RESET_MS ?? "61000");

function resolveApiBaseUrl(webBaseUrl) {
  if (process.env.PENGBO_API_URL) return process.env.PENGBO_API_URL.replace(/\/$/, "");
  const url = new URL(webBaseUrl);
  if (["4190", "4173", "4175", "5173"].includes(url.port)) return `${url.protocol}//${url.hostname}:8765`;
  return webBaseUrl.replace(/\/$/, "");
}

async function fetchWithRetry(input, init, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function unlockAcceptanceRuntime() {
  const secret = process.env.PENGBO_TEST_UNLOCK_SECRET;
  if (!secret) return { attempted: false, unlocked: null };
  const response = await fetchWithRetry(`${resolveApiBaseUrl(baseUrl)}/api/v1/security/local/unlock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ unlock_secret: secret }),
  });
  if (!response.ok) throw new Error(`Page layout correction unlock failed: HTTP ${response.status}`);
  const status = await response.json();
  return { attempted: true, unlocked: status.locked === false };
}

async function ensureResearchBrief(samples) {
  const apiBaseUrl = resolveApiBaseUrl(baseUrl);
  const existing = await fetchWithRetry(`${apiBaseUrl}/api/v1/research/briefs/${encodeURIComponent(samples.briefId)}`);
  if (existing.ok) return { created: false, briefId: samples.briefId };
  const response = await fetchWithRetry(`${apiBaseUrl}/api/v1/research/briefs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol: "AAPL" }),
  });
  if (!response.ok) throw new Error(`Research brief seed failed: HTTP ${response.status}`);
  const brief = await response.json();
  samples.briefId = brief.brief_id;
  return { created: true, briefId: brief.brief_id };
}

async function ensureLightTheme() {
  const endpoint = `${resolveApiBaseUrl(baseUrl)}/api/v1/settings/preferences`;
  const currentResponse = await fetchWithRetry(endpoint);
  if (!currentResponse.ok) throw new Error(`Settings preference read failed: HTTP ${currentResponse.status}`);
  const current = await currentResponse.json();
  const updateResponse = await fetchWithRetry(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...current, theme: "light" }),
  });
  if (!updateResponse.ok) throw new Error(`Light theme setup failed: HTTP ${updateResponse.status}`);
  const updated = await updateResponse.json();
  if (updated.theme !== "light") throw new Error(`Light theme setup returned ${updated.theme ?? "missing"}`);
  return { requested: "light", applied: updated.theme, previous: current.theme ?? null };
}

function inspectCorrection(componentKey) {
  const visible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };
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
  const parseColor = (value) => {
    const match = value.match(/rgba?\((?:\s*)([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    if (!match) return null;
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] === undefined ? 1 : Number(match[4]) };
  };
  const backgroundFor = (element) => {
    let current = element;
    while (current instanceof HTMLElement) {
      const parsed = parseColor(getComputedStyle(current).backgroundColor);
      if (parsed && parsed.a >= 0.95) return parsed;
      current = current.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const composite = (foreground, background) => ({
    r: foreground.r * foreground.a + background.r * (1 - foreground.a),
    g: foreground.g * foreground.a + background.g * (1 - foreground.a),
    b: foreground.b * foreground.a + background.b * (1 - foreground.a),
    a: 1,
  });
  const luminance = (color) => {
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  };
  const contrast = (foreground, background) => {
    const first = luminance(foreground);
    const second = luminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };

  const root = document.querySelector(`[data-route-page="${componentKey}"]`);
  const family = root?.querySelector(".route-family-page") ?? null;
  const primary = root?.querySelector(`[data-primary-task="${componentKey}"]`) ?? null;
  const childWorkspace = root?.closest(".route-child-workspace") ?? null;
  const researchSubwindow = componentKey === "researchAssetData" ? root?.querySelector(".research-brief-subwindow") ?? null : null;
  const researchPanel = componentKey === "researchAssetData" ? root?.querySelector(".research-column > .research-panel") ?? null : null;
  const familyBox = rect(family);
  const primaryBox = rect(primary);
  const childBox = rect(childWorkspace);
  const widthReferenceBox = childBox;
  const researchSubwindowBox = rect(researchSubwindow);
  const widthRatio = widthReferenceBox && primaryBox && widthReferenceBox.width > 0
    ? Math.round((primaryBox.width / widthReferenceBox.width) * 10_000) / 10_000
    : null;
  const researchSubwindowWidthRatio = primaryBox && researchSubwindowBox && primaryBox.width > 0
    ? Math.round((researchSubwindowBox.width / primaryBox.width) * 10_000) / 10_000
    : null;

  const contrastSelectors = [
    ".data-status-tile span",
    ".data-status-tile strong",
    ".data-status-tile p",
    ".data-status-note",
    ".inline-symbol",
    ".panel-note",
    ".eyebrow",
    ".research-copy",
    ".variant-card p",
    ".analysis-card p",
    ".tuning-card-head span",
    ".workflow-template-card p",
    ".workflow-recent-card small",
    ".command-empty",
    ".command-item-copy span",
    ".chart-legend",
    ".analytics-pnl-strip span",
    ".analytics-pnl-strip small",
    ".allocation-row span",
    ".compact-provenance-list span",
    ".capability-item p",
    ".capability-matrix-details dt",
    ".decision-list ul",
    ".decision-list > strong",
    ".decision-evidence-item p",
    ".decision-provenance-item p",
    ".decision-conclusion",
    ".portfolio-provenance-item p",
    ".portfolio-provenance-item small",
    ".manual-step p",
    ".translation-status-card p",
    ".analysis-highlight span",
  ];
  const contrastRecords = Array.from(root?.querySelectorAll(contrastSelectors.join(",")) ?? [])
    .filter(visible)
    .map((element) => {
      const style = getComputedStyle(element);
      const foreground = parseColor(style.color);
      const background = backgroundFor(element);
      const renderedForeground = foreground ? composite(foreground, background) : null;
      const ratio = renderedForeground ? contrast(renderedForeground, background) : null;
      const fontSize = Number.parseFloat(style.fontSize);
      const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
      const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      return {
        selector: contrastSelectors.find((selector) => element.matches(selector)) ?? element.tagName.toLowerCase(),
        text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 100),
        color: style.color,
        background: `rgb(${Math.round(background.r)}, ${Math.round(background.g)}, ${Math.round(background.b)})`,
        ratio: ratio === null ? null : Math.round(ratio * 100) / 100,
        required: largeText ? 3 : 4.5,
        passed: ratio !== null && ratio >= (largeText ? 3 : 4.5),
      };
    });

  const placeholders = Array.from(root?.querySelectorAll("input[placeholder], textarea[placeholder]") ?? [])
    .filter(visible)
    .map((element) => {
      const style = getComputedStyle(element, "::placeholder");
      const foreground = parseColor(style.color);
      const background = backgroundFor(element);
      const renderedForeground = foreground ? composite(foreground, background) : null;
      const ratio = renderedForeground ? contrast(renderedForeground, background) : null;
      return {
        selector: "::placeholder",
        text: element.getAttribute("placeholder") ?? "",
        color: style.color,
        background: `rgb(${Math.round(background.r)}, ${Math.round(background.g)}, ${Math.round(background.b)})`,
        ratio: ratio === null ? null : Math.round(ratio * 100) / 100,
        required: 4.5,
        passed: ratio !== null && ratio >= 4.5,
      };
    });

  const subwindowStyle = researchSubwindow ? getComputedStyle(researchSubwindow) : null;
  const panelStyle = researchPanel ? getComputedStyle(researchPanel) : null;
  const compactToolbarButtons = Array.from(document.querySelectorAll('.app-shell-toolbar .toolbar-ai-launch, .app-shell-toolbar [aria-label="local-security-lock"]'))
    .filter(visible)
    .map((element) => {
      const box = rect(element);
      const style = getComputedStyle(element);
      return {
        label: element.getAttribute("aria-label"),
        box,
        fontSize: style.fontSize,
        whiteSpace: style.whiteSpace,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });
  return {
    viewportWidth: window.innerWidth,
    theme: root?.closest(".app-shell")?.getAttribute("data-theme") ?? null,
    state: root?.closest("[data-ui-state]")?.getAttribute("data-ui-state") ?? null,
    familyBox,
    primaryBox,
    childBox,
    widthReferenceBox,
    widthRatio,
    primaryUsesWorkspaceWidth: widthRatio !== null && widthRatio >= (["researchDecision", "researchAssetData"].includes(componentKey) ? 0.85 : 0.9),
    researchSubwindow: researchSubwindow ? {
      box: researchSubwindowBox,
      widthRatio: researchSubwindowWidthRatio,
      maxHeight: subwindowStyle?.maxHeight ?? null,
      overflowY: subwindowStyle?.overflowY ?? null,
      scrolls: researchSubwindow.scrollHeight > researchSubwindow.clientHeight && ["auto", "scroll"].includes(subwindowStyle?.overflowY ?? ""),
    } : null,
    researchPanel: researchPanel ? {
      overflowY: panelStyle?.overflowY ?? null,
      scrolls: researchPanel.scrollHeight > researchPanel.clientHeight && ["auto", "scroll"].includes(panelStyle?.overflowY ?? ""),
    } : null,
    compactToolbarButtons,
    contrastRecords: [...contrastRecords, ...placeholders],
  };
}

function failuresFor(record, frame) {
  const failures = [];
  if (record.theme !== "light") failures.push(`theme ${record.theme ?? "missing"}`);
  const expectedStates = frame.availability?.kind === "planned"
    ? ["blocked"]
    : ["ready", "empty", "locked", "blocked", "error"];
  if (!expectedStates.includes(record.state)) failures.push(`terminal state ${record.state ?? "missing"}`);
  if (!record.primaryUsesWorkspaceWidth) failures.push(`primary width ratio ${record.widthRatio ?? "missing"}`);
  if (frame.componentKey === "researchAssetData") {
    if (record.researchSubwindow?.maxHeight !== "none") failures.push(`research max-height ${record.researchSubwindow?.maxHeight ?? "missing"}`);
    if ((record.researchSubwindow?.widthRatio ?? 0) < 0.98) failures.push(`research subwindow-to-primary width ratio ${record.researchSubwindow?.widthRatio ?? "missing"}`);
    if (["auto", "scroll", "hidden"].includes(record.researchSubwindow?.overflowY ?? "")) failures.push(`research subwindow overflow-y ${record.researchSubwindow?.overflowY}`);
    if (record.researchSubwindow?.scrolls) failures.push("research subwindow owns vertical scroll");
    if (record.researchPanel?.scrolls) failures.push("research panel owns vertical scroll");
  }
  if (record.viewportWidth <= 960) {
    for (const button of record.compactToolbarButtons) {
      if (!button.label) failures.push("compact toolbar button is missing an accessible label");
      if (!button.box || button.box.width < 32 || button.box.height > 44) failures.push(`compact toolbar button geometry ${JSON.stringify(button.box)}`);
      if (button.whiteSpace !== "nowrap") failures.push(`compact toolbar white-space ${button.whiteSpace}`);
      if (button.scrollWidth > button.clientWidth) failures.push(`compact toolbar overflow ${button.scrollWidth}/${button.clientWidth}`);
    }
  }
  const contrastFailures = record.contrastRecords.filter((item) => !item.passed);
  if (contrastFailures.length) failures.push(`${contrastFailures.length} low-contrast text samples`);
  return failures;
}

const targetFrames = registry.frames.filter((frame) => requestedTargetKeys.has(frame.componentKey));
if (targetFrames.length !== requestedTargetKeys.size) {
  const found = new Set(targetFrames.map((frame) => frame.componentKey));
  throw new Error(`Missing target frames: ${[...requestedTargetKeys].filter((key) => !found.has(key)).join(", ")}`);
}

await mkdir(screenshotDir, { recursive: true });
const runtimeUnlock = await unlockAcceptanceRuntime();
const themeSetup = await ensureLightTheme();
const evidenceSamples = await resolveEvidenceSamples(baseUrl);
const researchBrief = await ensureResearchBrief(evidenceSamples);
const browser = await chromium.launch({ headless: true });
const records = [];

for (const [viewportIndex, viewport] of viewports.entries()) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !/(401 \(Unauthorized\)|403 \(Forbidden\)|423 \(Locked\))/.test(message.text())) consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const frame of targetFrames) {
    consoleErrors.length = 0;
    pageErrors.length = 0;
    let inspection = null;
    let failure = null;
    try {
      const routePath = sampleRoutePath(frame.svgRoute, evidenceSamples);
      if (researchBriefTargetKeys.has(frame.componentKey)) {
        await page.goto(`${baseUrl}/research/inbox`, { waitUntil: "domcontentloaded", timeout: 20_000 });
        const briefButton = page.getByLabel(`research-brief-item id=${researchBrief.briefId} symbol=AAPL`);
        await briefButton.waitFor({ state: "visible", timeout: 30_000 });
        await briefButton.click();
        await page.getByLabel(`subroute:${frame.svgRoute}`).click();
        await page.waitForURL((url) => url.pathname === routePath, { timeout: 10_000 });
      } else {
        await page.goto(`${baseUrl}${routePath}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
      }
      const root = page.locator(`[data-route-page="${frame.componentKey}"]`);
      await root.waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForFunction((componentKey) => {
        const pageRoot = document.querySelector(`[data-route-page="${componentKey}"]`);
        const stateRoot = pageRoot?.closest("[data-ui-state]");
        const state = stateRoot?.getAttribute("data-ui-state");
        return Boolean(state && state !== "loading" && !pageRoot?.querySelector('[data-ui-state="loading"]'));
      }, frame.componentKey, { timeout: 30_000 });
      if (frame.componentKey === "researchAssetData") {
        await root.locator(".research-brief-subwindow").waitFor({ state: "visible", timeout: 30_000 });
      }
      await page.evaluate(() => document.fonts.ready);
      inspection = await page.evaluate(inspectCorrection, frame.componentKey);
      await page.screenshot({
        path: `${screenshotDir}/${viewport.id}-${String(frame.frameNo).padStart(2, "0")}-${frame.componentKey}.png`,
        fullPage: true,
      });
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    const failures = inspection ? failuresFor(inspection, frame) : ["inspection missing"];
    records.push({
      viewport: viewport.id,
      frameNo: frame.frameNo,
      route: frame.svgRoute,
      componentKey: frame.componentKey,
      availability: frame.availability,
      ...inspection,
      failures,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failure,
      passed: !failure && failures.length === 0 && consoleErrors.length === 0 && pageErrors.length === 0,
    });
  }
  await page.close();
  if (viewportIndex < viewports.length - 1 && rateLimitResetMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, rateLimitResetMs));
  }
}

await browser.close();
const result = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  runtimeUnlock,
  themeSetup,
  evidenceSamples,
  researchBrief,
  viewportCount: viewports.length,
  targetRouteCount: targetFrames.length,
  expectedCheckCount: targetFrames.length * viewports.length,
  checkCount: records.length,
  passedCount: records.filter((record) => record.passed).length,
  failureCount: records.filter((record) => !record.passed).length,
  contract: {
    minimumPrimaryWidthRatio: 0.9,
    minimumResearchPrimaryWidthRatio: 0.85,
    minimumResearchSubwindowToPrimaryWidthRatio: 0.98,
    researchAssetDataNestedScroll: false,
    normalTextContrast: 4.5,
    largeTextContrast: 3,
    themes: ["light"],
    rateLimitResetMs,
  },
  failures: records.filter((record) => !record.passed),
  records,
  passed: records.length === targetFrames.length * viewports.length && records.every((record) => record.passed),
};
await writeFile("logs/page-layout-correction-smoke.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  targetRouteCount: result.targetRouteCount,
  viewportCount: result.viewportCount,
  checkCount: result.checkCount,
  passedCount: result.passedCount,
  failureCount: result.failureCount,
  passed: result.passed,
}, null, 2));
if (!result.passed) process.exitCode = 1;
