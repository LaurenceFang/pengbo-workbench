import { createHash } from "node:crypto";
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
const themes = ["light", "dark"];
const requestedComponentKeys = process.env.PENGBO_THEME_COMPONENT_KEYS
  ? new Set(process.env.PENGBO_THEME_COMPONENT_KEYS.split(",").map((key) => key.trim()).filter(Boolean))
  : null;
const screenshotRoot = "logs/full-route-theme-screenshots";
const outputPath = "logs/full-route-theme-smoke.json";
const manualKeys = new Set([
  "manualGettingStarted",
  "manualResearchData",
  "manualStrategyWorkflows",
  "manualSecurityExecution",
  "manualTroubleshooting",
]);
const targetFrames = requestedComponentKeys
  ? registry.frames.filter((frame) => requestedComponentKeys.has(frame.componentKey))
  : registry.frames;
if (requestedComponentKeys && targetFrames.length !== requestedComponentKeys.size) {
  const found = new Set(targetFrames.map((frame) => frame.componentKey));
  throw new Error(`Missing theme target frames: ${[...requestedComponentKeys].filter((key) => !found.has(key)).join(", ")}`);
}

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
  if (!response.ok) throw new Error(`Full-route theme unlock failed: HTTP ${response.status}`);
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
  if (!response.ok) throw new Error(`Full-route theme research seed failed: HTTP ${response.status}`);
  const brief = await response.json();
  samples.briefId = brief.brief_id;
  return { created: true, briefId: brief.brief_id };
}

function inspectTheme({ componentKey, expectedTheme }) {
  const manualComponentKeys = new Set([
    "manualGettingStarted",
    "manualResearchData",
    "manualStrategyWorkflows",
    "manualSecurityExecution",
    "manualTroubleshooting",
  ]);
  const shell = document.querySelector(".app-shell");
  const root = document.querySelector(`[data-route-page="${componentKey}"]`);
  const routeFrame = root?.closest("[data-frame-id]") ?? null;
  const excludedTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "PATH"]);
  const surfaceSelector = [
    ".card",
    ".watchlist-card",
    ".pulse-card",
    ".connection-card",
    ".preset-card",
    ".hero-panel",
    ".research-panel",
    ".variant-card",
    ".screeners-summary-card",
    ".tuning-card",
    ".analysis-card",
    ".ui-state-block",
    ".ui-context-inspector",
    "input:not([type=checkbox]):not([type=radio])",
    "textarea",
    "select",
  ].join(",");

  const rect = (element) => {
    if (!(element instanceof Element)) return null;
    const value = element.getBoundingClientRect();
    return {
      x: Math.round(value.x * 100) / 100,
      y: Math.round(value.y * 100) / 100,
      width: Math.round(value.width * 100) / 100,
      height: Math.round(value.height * 100) / 100,
    };
  };

  const parseColor = (value) => {
    const rgb = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: rgb[4] === undefined ? 1 : Number(rgb[4]) };
    const srgb = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/i);
    if (srgb) return { r: Number(srgb[1]) * 255, g: Number(srgb[2]) * 255, b: Number(srgb[3]) * 255, a: srgb[4] === undefined ? 1 : Number(srgb[4]) };
    const hex = value.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
    if (!hex) return null;
    return {
      r: Number.parseInt(hex[1].slice(0, 2), 16),
      g: Number.parseInt(hex[1].slice(2, 4), 16),
      b: Number.parseInt(hex[1].slice(4, 6), 16),
      a: hex[2] ? Number.parseInt(hex[2], 16) / 255 : 1,
    };
  };

  const composite = (foreground, background) => ({
    r: foreground.r * foreground.a + background.r * (1 - foreground.a),
    g: foreground.g * foreground.a + background.g * (1 - foreground.a),
    b: foreground.b * foreground.a + background.b * (1 - foreground.a),
    a: 1,
  });

  const backgroundFor = (element) => {
    const layers = [];
    let current = element;
    while (current instanceof HTMLElement) {
      const parsed = parseColor(getComputedStyle(current).backgroundColor);
      if (parsed && parsed.a > 0) layers.push(parsed);
      if (parsed?.a === 1) break;
      current = current.parentElement;
    }
    let result = expectedTheme === "dark"
      ? { r: 13, g: 18, b: 17, a: 1 }
      : { r: 238, g: 243, b: 239, a: 1 };
    for (const layer of layers.reverse()) result = composite(layer, result);
    return result;
  };

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

  const visible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    if (element.closest('[aria-hidden="true"], [hidden]')) return false;
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number.parseFloat(style.fontSize) > 0;
  };

  const effectiveOpacity = (element) => {
    let opacity = 1;
    let current = element;
    while (current instanceof HTMLElement) {
      opacity *= Number.parseFloat(getComputedStyle(current).opacity || "1");
      current = current.parentElement;
    }
    return opacity;
  };

  const textElements = new Set();
  if (shell) {
    const walker = document.createTreeWalker(shell, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.textContent?.trim() ?? "";
      const parent = node.parentElement;
      if (text && parent && !excludedTags.has(parent.tagName) && visible(parent)) textElements.add(parent);
      node = walker.nextNode();
    }
    for (const control of shell.querySelectorAll("input, textarea, select")) {
      if (visible(control)) textElements.add(control);
    }
  }

  const contrastRecords = [];
  for (const element of textElements) {
    const style = getComputedStyle(element);
    const parsedForeground = parseColor(style.color);
    if (!parsedForeground) continue;
    const background = backgroundFor(element);
    const foreground = composite({ ...parsedForeground, a: parsedForeground.a * effectiveOpacity(element) }, background);
    const ratio = contrast(foreground, background);
    const fontSize = Number.parseFloat(style.fontSize);
    const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
    const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
    const disabled = element.matches(":disabled, [aria-disabled=true]") || Boolean(element.closest(":disabled, [aria-disabled=true]"));
    const required = disabled ? 3 : largeText ? 3 : 4.5;
    contrastRecords.push({
      selector: element.className ? `${element.tagName.toLowerCase()}.${String(element.className).trim().replace(/\s+/g, ".")}` : element.tagName.toLowerCase(),
      text: (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
        ? element.value || element.getAttribute("placeholder") || element.getAttribute("aria-label") || "control"
        : element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 120),
      color: style.color,
      background: `rgb(${Math.round(background.r)}, ${Math.round(background.g)}, ${Math.round(background.b)})`,
      ratio: Math.round(ratio * 100) / 100,
      required,
      passed: ratio >= required,
    });
  }

  if (shell) {
    for (const element of shell.querySelectorAll("input[placeholder], textarea[placeholder]")) {
      if (!visible(element)) continue;
      const style = getComputedStyle(element, "::placeholder");
      const parsedForeground = parseColor(style.color);
      if (!parsedForeground) continue;
      const background = backgroundFor(element);
      const foreground = composite({ ...parsedForeground, a: parsedForeground.a * effectiveOpacity(element) }, background);
      const ratio = contrast(foreground, background);
      contrastRecords.push({
        selector: "::placeholder",
        text: element.getAttribute("placeholder") ?? "",
        color: style.color,
        background: `rgb(${Math.round(background.r)}, ${Math.round(background.g)}, ${Math.round(background.b)})`,
        ratio: Math.round(ratio * 100) / 100,
        required: 4.5,
        passed: ratio >= 4.5,
      });
    }
  }

  const surfaces = Array.from(shell?.querySelectorAll(surfaceSelector) ?? [])
    .filter((element) => visible(element) && !element.closest(".app-shell-sidebar, .sidebar"))
    .map((element) => {
      const background = backgroundFor(element);
      const value = luminance(background);
      const passed = expectedTheme === "dark" ? value <= 0.25 : value >= 0.5;
      return {
        selector: element.className ? `${element.tagName.toLowerCase()}.${String(element.className).trim().replace(/\s+/g, ".")}` : element.tagName.toLowerCase(),
        background: `rgb(${Math.round(background.r)}, ${Math.round(background.g)}, ${Math.round(background.b)})`,
        luminance: Math.round(value * 1000) / 1000,
        passed,
      };
    });

  const manualWorkspace = manualComponentKeys.has(componentKey) ? root?.querySelector(".manual-workspace") ?? null : null;
  const manualContent = manualComponentKeys.has(componentKey) ? root?.querySelector(".manual-content") ?? null : null;
  const manualStyle = manualWorkspace ? getComputedStyle(manualWorkspace) : null;
  const manualBox = rect(manualWorkspace);
  const manualContentBox = rect(manualContent);
  const manualNestedScrollers = manualWorkspace
    ? Array.from(manualWorkspace.querySelectorAll("*")).filter((element) => {
        if (!(element instanceof HTMLElement) || !visible(element)) return false;
        const style = getComputedStyle(element);
        return ["auto", "scroll"].includes(style.overflowY) && element.scrollHeight > element.clientHeight;
      })
    : [];
  const manual = manualWorkspace ? {
    workspaceBox: manualBox,
    contentBox: manualContentBox,
    contentWidthRatio: manualBox && manualContentBox && manualBox.width > 0
      ? Math.round((manualContentBox.width / manualBox.width) * 10_000) / 10_000
      : null,
    gridTemplateColumns: manualStyle?.gridTemplateColumns ?? null,
    columnCount: manualStyle?.gridTemplateColumns.split(/\s+/).filter(Boolean).length ?? null,
    overflowY: manualStyle?.overflowY ?? null,
    nestedScrollerCount: manualNestedScrollers.length,
  } : null;

  const contrastFailures = contrastRecords.filter((item) => !item.passed);
  const surfaceFailures = surfaces.filter((item) => !item.passed);
  return {
    theme: shell?.getAttribute("data-theme") ?? null,
    htmlTheme: document.documentElement.dataset.theme ?? null,
    routeId: routeFrame?.getAttribute("data-route-id") ?? null,
    uiState: routeFrame?.getAttribute("data-ui-state") ?? null,
    routePageCount: routeFrame?.querySelectorAll("[data-route-page]").length ?? 0,
    contrastSampleCount: contrastRecords.length,
    minimumContrast: contrastRecords.length ? Math.min(...contrastRecords.map((item) => item.ratio)) : null,
    contrastFailureCount: contrastFailures.length,
    contrastFailures: contrastFailures.slice(0, 80),
    surfaceSampleCount: surfaces.length,
    surfaceFailureCount: surfaceFailures.length,
    surfaceFailures: surfaceFailures.slice(0, 80),
    manual,
  };
}

function failuresFor(record, frame, expectedTheme) {
  const failures = [];
  if (record.theme !== expectedTheme || record.htmlTheme !== expectedTheme) failures.push(`theme ${record.theme}/${record.htmlTheme}`);
  if (record.routeId !== frame.svgRoute) failures.push(`route ${record.routeId ?? "missing"}`);
  if (record.routePageCount !== 1) failures.push(`route page count ${record.routePageCount}`);
  if (!record.uiState || record.uiState === "loading") failures.push(`terminal state ${record.uiState ?? "missing"}`);
  if (record.contrastFailureCount > 0) failures.push(`${record.contrastFailureCount} low-contrast text samples`);
  if (record.surfaceFailureCount > 0) failures.push(`${record.surfaceFailureCount} theme surface mismatches`);
  if (manualKeys.has(frame.componentKey)) {
    if (!record.manual) failures.push("manual workspace missing");
    if ((record.manual?.contentWidthRatio ?? 0) < 0.9) failures.push(`manual width ratio ${record.manual?.contentWidthRatio ?? "missing"}`);
    if (record.manual?.columnCount !== 1) failures.push(`manual columns ${record.manual?.gridTemplateColumns ?? "missing"}`);
    if (["auto", "scroll", "hidden"].includes(record.manual?.overflowY ?? "")) failures.push(`manual overflow-y ${record.manual?.overflowY}`);
    if ((record.manual?.nestedScrollerCount ?? -1) !== 0) failures.push(`manual nested scrollers ${record.manual?.nestedScrollerCount ?? "missing"}`);
  }
  return failures;
}

await mkdir(screenshotRoot, { recursive: true });
const runtimeUnlock = await unlockAcceptanceRuntime();
const evidenceSamples = await resolveEvidenceSamples(baseUrl);
const researchBrief = await ensureResearchBrief(evidenceSamples);
const browser = await chromium.launch({ headless: true });
const records = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const [frameIndex, frame] of targetFrames.entries()) {
      consoleErrors.length = 0;
      pageErrors.length = 0;
      const frameId = `frame-${String(frame.frameNo).padStart(2, "0")}`;
      const url = `${baseUrl}${sampleRoutePath(frame.svgRoute, evidenceSamples)}`;
      let navigationFailure = null;
      try {
        if (frameIndex === 0) {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
        } else {
          await page.evaluate((nextUrl) => {
            window.history.pushState({}, "", nextUrl);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }, url);
        }
        const root = page.locator(`[data-frame-id="${frameId}"]`);
        await root.waitFor({ state: "visible", timeout: 15_000 });
        await page.waitForFunction((id) => {
          const element = document.querySelector(`[data-frame-id="${id}"]`);
          const state = element?.getAttribute("data-ui-state");
          return Boolean(state && state !== "loading" && !element?.querySelector('[data-ui-state="loading"]'));
        }, frameId, { timeout: 60_000 });
        await page.evaluate(() => document.fonts.ready);
      } catch (error) {
        navigationFailure = error instanceof Error ? error.message : String(error);
      }

      for (const theme of themes) {
        let inspection = null;
        let failure = navigationFailure;
        const screenshotDir = `${screenshotRoot}/${theme}/${viewport.id}`;
        const screenshotPath = `${screenshotDir}/frame-${String(frame.frameNo).padStart(2, "0")}.png`;
        await mkdir(screenshotDir, { recursive: true });
        if (!failure) {
          try {
            await page.evaluate((nextTheme) => {
              document.documentElement.dataset.theme = nextTheme;
              document.querySelector(".app-shell")?.setAttribute("data-theme", nextTheme);
            }, theme);
            await page.waitForTimeout(80);
            inspection = await page.evaluate(inspectTheme, { componentKey: frame.componentKey, expectedTheme: theme });
            await page.screenshot({ path: screenshotPath, fullPage: false });
          } catch (error) {
            failure = error instanceof Error ? error.message : String(error);
          }
        }
        const contractFailures = inspection ? failuresFor(inspection, frame, theme) : ["inspection missing"];
        records.push({
          viewport: viewport.id,
          theme,
          frameNo: frame.frameNo,
          route: frame.svgRoute,
          componentKey: frame.componentKey,
          screenshotPath: failure ? null : screenshotPath,
          ...inspection,
          contractFailures,
          consoleErrors: [...consoleErrors],
          pageErrors: [...pageErrors],
          failure,
          passed: !failure && contractFailures.length === 0 && consoleErrors.length === 0 && pageErrors.length === 0,
        });
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}

const output = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  chromium: "playwright bundled chromium",
  routeRegistrySha256: createHash("sha256").update(await readFile("src/routes/route-registry.ts")).digest("hex").toUpperCase(),
  runtimeUnlock,
  evidenceSamples,
  researchBrief,
  routeCount: targetFrames.length,
  registryRouteCount: registry.frames.length,
  themeCount: themes.length,
  viewportCount: viewports.length,
  expectedCheckCount: targetFrames.length * themes.length * viewports.length,
  checkCount: records.length,
  screenshotCount: records.filter((record) => record.screenshotPath).length,
  passedCount: records.filter((record) => record.passed).length,
  failureCount: records.filter((record) => !record.passed).length,
  passed: records.length === targetFrames.length * themes.length * viewports.length && records.every((record) => record.passed),
  themes,
  viewports,
  contrastContract: {
    normalText: 4.5,
    largeText: 3,
    disabledText: 3,
    placeholders: 4.5,
  },
  manualContract: {
    componentKeys: [...manualKeys],
    minimumContentWidthRatio: 0.9,
    columnCount: 1,
    nestedScrollerCount: 0,
  },
  failures: records.filter((record) => !record.passed),
  records,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  routeCount: output.routeCount,
  themeCount: output.themeCount,
  viewportCount: output.viewportCount,
  expectedCheckCount: output.expectedCheckCount,
  checkCount: output.checkCount,
  screenshotCount: output.screenshotCount,
  passedCount: output.passedCount,
  failureCount: output.failureCount,
  passed: output.failureCount === 0 && output.checkCount === output.expectedCheckCount,
}, null, 2));

if (output.failureCount > 0 || output.checkCount !== output.expectedCheckCount) process.exitCode = 1;
