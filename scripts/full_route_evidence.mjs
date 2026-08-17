import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolveEvidenceSamples, sampleRoutePath } from "./m1_evidence_samples.mjs";

const baseUrl = process.env.PENGBO_WEB_URL ?? "http://127.0.0.1:4190";
const viewports = [
  { width: 1440, height: 900 },
  { width: 1600, height: 1000 },
  { width: 1180, height: 820 },
  { width: 960, height: 820 },
];
const registry = JSON.parse(await readFile("logs/svg-frame-registry.json", "utf8"));
const registrySource = await readFile("src/routes/route-registry.ts", "utf8");
const sourceGitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const sourceDirty = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0;
const registrySha256 = createHash("sha256").update(registrySource).digest("hex").toUpperCase();
const evidenceSamples = await resolveEvidenceSamples(baseUrl);
const browser = await chromium.launch({ headless: true });
const records = [];
const page = await browser.newPage({ viewport: viewports[0], deviceScaleFactor: 1 });
const consoleErrors = [];
const pageErrors = [];
const networkFailures = [];
const httpFailures = [];
const warmedViews = new Set();
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("requestfailed", (request) => networkFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? "failed"}`));
page.on("response", (response) => { if (response.status() >= 400) httpFailures.push(`${response.status()} ${response.request().method()} ${response.url()}`); });

for (const viewport of viewports) {
  const outputDir = `logs/full-route-screenshots/${viewport.width}x${viewport.height}`;
  await mkdir(outputDir, { recursive: true });
  await page.setViewportSize(viewport);
  for (const frame of registry.frames) {
    consoleErrors.length = 0;
    pageErrors.length = 0;
    networkFailures.length = 0;
    httpFailures.length = 0;
    const url = `${baseUrl}${sampleRoutePath(frame.svgRoute, evidenceSamples)}`;
    const screenshotPath = `${outputDir}/frame-${String(frame.frameNo).padStart(2, "0")}.png`;
    let failure = null;
    try {
      if (records.length === 0) {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      } else {
        await page.evaluate((nextUrl) => {
          window.history.pushState({}, "", nextUrl);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, url);
      }
      const root = page.locator(`[data-frame-id="frame-${String(frame.frameNo).padStart(2, "0")}"]`);
      await root.waitFor({ state: "visible", timeout: 10_000 });
      const warmupTimeout = frame.availability?.kind === "available" && frame.accessPolicy === "public" && !warmedViews.has(frame.topLevelView)
        ? 120_000
        : 20_000;
      await page.waitForFunction((frameId) => {
        const element = document.querySelector(`[data-frame-id="${frameId}"]`);
        const state = element?.getAttribute("data-ui-state");
        return Boolean(state && state !== "loading" && !element?.querySelector('[data-ui-state="loading"]'));
      }, `frame-${String(frame.frameNo).padStart(2, "0")}`, { timeout: warmupTimeout });
      await page.waitForTimeout(150);
      await page.waitForFunction((frameId) => {
        const element = document.querySelector(`[data-frame-id="${frameId}"]`);
        const state = element?.getAttribute("data-ui-state");
        return Boolean(state && state !== "loading" && !element?.querySelector('[data-ui-state="loading"]'));
      }, `frame-${String(frame.frameNo).padStart(2, "0")}`, { timeout: warmupTimeout });
      warmedViews.add(frame.topLevelView);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: screenshotPath, fullPage: false });
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    const routeId = await page.locator("[data-route-id]").first().getAttribute("data-route-id").catch(() => null);
    const uiState = await page.locator("[data-ui-state]").first().getAttribute("data-ui-state").catch(() => null);
    const loadingDescendants = await page.locator(`[data-frame-id="frame-${String(frame.frameNo).padStart(2, "0")}"] [data-ui-state="loading"]`).count().catch(() => -1);
    const expectedStates = frame.availability?.kind === "planned"
      ? ["blocked"]
      : frame.accessPolicy === "local_unlock"
        ? ["locked", "ready", "empty"]
        : ["ready", "empty"];
    records.push({
      frameNo: frame.frameNo,
      route: frame.svgRoute,
      url,
      viewport,
      deviceScaleFactor: 1,
      routeId,
      uiState,
      fixtureKey: frame.fixtureKey ?? null,
      screenshotPath: failure ? null : screenshotPath,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      networkFailures: [...networkFailures],
      httpFailures: [...httpFailures],
      availability: frame.availability ?? null,
      accessPolicy: frame.accessPolicy ?? null,
      actionPolicy: frame.actionPolicy ?? null,
      loadingDescendants,
      expectedStates,
      failure,
      passed: !failure && routeId === frame.svgRoute && expectedStates.includes(uiState) && uiState !== "loading" && loadingDescendants === 0 && consoleErrors.length === 0 && pageErrors.length === 0 && networkFailures.length === 0 && httpFailures.length === 0,
    });
  }
}

await page.close();
await browser.close();
const evidence = {
  generatedAt: new Date().toISOString(),
  sourceSvg: "Pengbo_UI_Rebuild.svg",
  sourceSvgSha256: registry.svgSha256,
  sourceGitSha,
  sourceDirty,
  registrySha256,
  evidenceSamples,
  frameCount: registry.frameCount,
  viewportCount: viewports.length,
  screenshotCount: records.filter((record) => record.screenshotPath).length,
  recordCount: records.length,
  passedCount: records.filter((record) => record.passed).length,
  records,
};
await writeFile("logs/full-route-evidence.jsonl", `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
await writeFile("logs/full-route-console.jsonl", `${records.flatMap((record) => record.consoleErrors.map((message) => JSON.stringify({ frameNo: record.frameNo, route: record.route, viewport: record.viewport, message }))).join("\n")}\n`, "utf8");
await writeFile("logs/full-route-network.jsonl", `${records.flatMap((record) => record.networkFailures.map((message) => JSON.stringify({ frameNo: record.frameNo, route: record.route, viewport: record.viewport, message }))).join("\n")}\n`, "utf8");
await writeFile("logs/full-route-http.jsonl", `${records.flatMap((record) => record.httpFailures.map((message) => JSON.stringify({ frameNo: record.frameNo, route: record.route, viewport: record.viewport, message }))).join("\n")}\n`, "utf8");
await writeFile("logs/full-route-security.json", `${JSON.stringify({ generatedAt: evidence.generatedAt, sourceSvgSha256: evidence.sourceSvgSha256, sourceGitSha, sourceDirty, registrySha256, routes: registry.frames.map((frame) => ({ frameNo: frame.frameNo, route: frame.svgRoute, availability: frame.availability ?? null, accessPolicy: frame.accessPolicy ?? null, actionPolicy: frame.actionPolicy ?? null })) }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ frameCount: evidence.frameCount, recordCount: evidence.recordCount, screenshotCount: evidence.screenshotCount, passedCount: evidence.passedCount }, null, 2));
if (evidence.recordCount !== 316 || evidence.passedCount !== 316) process.exitCode = 1;
