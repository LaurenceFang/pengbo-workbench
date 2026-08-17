import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const baseUrl = process.env.PENGBO_SMOKE_URL ?? "http://127.0.0.1:4190";
const outputDir = "logs/context-inspector-smoke";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
const expectedSecurityBlocks = [];
page.on("console", (message) => { if (message.type() === "error" && !/(401 \(Unauthorized\)|403 \(Forbidden\)|423 \(Locked\))/.test(message.text())) consoleErrors.push(message.text()); });
page.on("response", (response) => { if ([403, 423].includes(response.status()) && response.url().includes("/api/")) expectedSecurityBlocks.push(response.url()); });

await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
await page.locator(".app-shell").waitFor({ state: "visible", timeout: 15_000 });
const records = [];
const routeTargets = [
  ["dashboard", "home", "dashboard", "/dashboard/overview"],
  ["asset", "markets", "asset", "/markets/assets/:symbol/overview"],
  ["dataSources", "markets", "dataSources", "/markets/data-sources/catalog"],
  ["research", "research", "research", "/research/inbox"],
  ["screeners", "automation", "screener_run", "/automation/screeners"],
  ["factorLab", "factorLab", "factor_run", "/factor-lab/runs"],
];

for (const [view, group, expectedObjectType, expectedRouteId] of routeTargets) {
  const target = page.getByLabel(`nav-${view}`);
  if (await target.count() === 0) await page.getByLabel(`nav-group-${group}`).click();
  await page.getByLabel(`nav-${view}`).click();
  await page.waitForTimeout(250);
  const routePage = page.locator("[data-frame-id]");
  const inspector = page.locator(".context-rail [data-inspector-object-type]").first();
  const record = {
    view,
    routePageCount: await routePage.count(),
    inspectorCount: await inspector.count(),
    objectType: await inspector.count() ? await inspector.getAttribute("data-inspector-object-type") : null,
    objectId: await inspector.count() ? await inspector.getAttribute("data-inspector-object-id") : null,
    routeId: await inspector.count() ? await inspector.getAttribute("data-inspector-route-id") : null,
    evidenceScope: await inspector.count() ? await inspector.getAttribute("data-inspector-evidence-scope") : null,
    permissionState: await inspector.count() ? await inspector.getAttribute("data-inspector-permission-state") : null,
    aiState: await inspector.count() ? await inspector.getAttribute("data-inspector-ai-state") : null,
    expectedObjectType,
    expectedRouteId,
    consoleErrors: [...consoleErrors],
    expectedSecurityBlocks: [...new Set(expectedSecurityBlocks)],
  };
  await page.screenshot({ path: `${outputDir}/${view}.png`, fullPage: false });
  records.push(record);
  consoleErrors.length = 0;
  expectedSecurityBlocks.length = 0;
}

const homeGroup = page.getByLabel("nav-group-home");
const researchTarget = page.getByLabel("nav-research");
if (await researchTarget.count() === 0) await page.getByLabel("nav-group-research").click();
await page.getByLabel("nav-research").click();
const lockedVerified = await page.locator(".ui-inspector-locked").isVisible({ timeout: 2500 }).catch(() => false);
if (await page.getByLabel("nav-dashboard").count() === 0 && await homeGroup.count() === 1) await homeGroup.click();
await page.getByLabel("nav-dashboard").click();
const toggle = page.locator("button.context-rail-toggle");
const toggleCount = await toggle.count();
const before = await page.locator(".context-rail").getAttribute("class");
if (toggleCount === 1) await toggle.click();
const collapsed = await page.locator(".context-rail").getAttribute("class");
if (toggleCount === 1) await toggle.click();
const expanded = await page.locator(".context-rail").getAttribute("class");
const result = {
  scope: "T104",
  baseUrl,
  viewport: "1600x1000",
  records,
  contextRail: { toggleCount, before, collapsed, expanded },
  lockedVerified,
  securityGatePassed: lockedVerified,
  unverified: lockedVerified ? [] : ["locked state was not reachable in the current local session"],
  passed: toggleCount === 1 && records.every((record) => record.routePageCount === 1 && record.inspectorCount === 1 && record.objectType === record.expectedObjectType && record.routeId === record.expectedRouteId && Boolean(record.objectId) && Boolean(record.evidenceScope) && Boolean(record.permissionState) && Boolean(record.aiState) && record.consoleErrors.length === 0),
};
await writeFile(`${outputDir}/latest.json`, JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;

await browser.close();
