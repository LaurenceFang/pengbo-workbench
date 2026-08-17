import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const baseUrl = process.env.PENGBO_WEB_URL ?? "http://127.0.0.1:4190";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const checks = [];

async function direct(pathname, frameId) {
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  const root = page.locator(`[data-frame-id="${frameId}"]`);
  await root.waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForFunction((id) => {
    const state = document.querySelector(`[data-frame-id="${id}"]`)?.getAttribute("data-ui-state");
    return Boolean(state && state !== "loading");
  }, frameId, { timeout: 15_000 });
  checks.push({ name: `direct:${pathname}`, passed: (await page.locator("[data-route-id]").first().count()) === 1 });
}

await direct("/dashboard/overview", "frame-01");
await direct("/markets/assets/AAPL/overview", "frame-07");
checks.push({ name: "url-param:AAPL", passed: (await page.getByText("AAPL", { exact: true }).count()) > 0 });
checks.push({ name: "context-inspector", passed: (await page.locator(".ui-context-inspector").count()) === 1 });
checks.push({ name: "real-asset-surface", passed: (await page.locator('[data-real-business-surface="asset"] .p1-asset-page').count()) === 1 });

await direct("/markets/assets/AAPL/price", "frame-08");
checks.push({ name: "asset-price:route-page", passed: (await page.locator('[data-route-page="assetPrice"]').count()) === 1 });
await page.locator(".p1-asset-primary").waitFor({ state: "visible", timeout: 10_000 });
const priceCounts = { chart: await page.locator(".p1-asset-primary").count(), siblings: await page.locator(".ratios-card,.filings-card,.asset-research-card").count() };
checks.push({ name: "asset-price:isolated", passed: priceCounts.chart === 1 && priceCounts.siblings === 0, detail: priceCounts });

await direct("/markets/assets/AAPL/fundamentals", "frame-09");
checks.push({ name: "asset-fundamentals:route-page", passed: (await page.locator('[data-route-page="assetFundamentals"]').count()) === 1 });
await page.locator(".ratios-card").waitFor({ state: "visible", timeout: 10_000 });
const fundamentalsCounts = { panel: await page.locator(".ratios-card").count(), siblings: await page.locator(".p1-asset-primary,.filings-card,.asset-research-card").count() };
checks.push({ name: "asset-fundamentals:isolated", passed: fundamentalsCounts.panel === 1 && fundamentalsCounts.siblings === 0, detail: fundamentalsCounts });

await direct("/ai-assistant", "frame-79");
const aiFrame = page.locator('[data-frame-id="frame-79"]');
const aiState = await aiFrame.getAttribute("data-ui-state");
checks.push({ name: "standalone-ai:available", passed: (await aiFrame.getAttribute("data-availability")) === "available" && (await page.getByText(/T117/).count()) === 0 });
let aiRealOrLocked = aiState === "locked";
let aiLocalEndpointVisible = false;
let aiCloudEndpointVisible = false;
if (aiState === "ready") {
  await page.locator('[aria-label="ai-local-endpoint"]').waitFor({ state: "visible", timeout: 10_000 });
  aiLocalEndpointVisible = (await page.locator('[aria-label="ai-local-endpoint"]').count()) === 1;
  await page.getByRole("tab", { name: "云端", exact: true }).click();
  aiCloudEndpointVisible = (await page.locator('[aria-label="ai-cloud-endpoint"]').count()) === 1;
  aiRealOrLocked = aiLocalEndpointVisible && aiCloudEndpointVisible;
}
checks.push({ name: "standalone-ai:real-or-locked", passed: aiRealOrLocked, detail: { aiState, localEndpointVisible: aiLocalEndpointVisible, cloudEndpointVisible: aiCloudEndpointVisible } });

await page.goto(`${baseUrl}/dashboard/overview`, { waitUntil: "domcontentloaded" });
await page.goto(`${baseUrl}/markets/assets/AAPL/overview`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => window.history.back());
await page.waitForURL(/dashboard\/overview$/, { timeout: 10_000 });
checks.push({ name: "history:back", passed: page.url().endsWith("/dashboard/overview") });
await page.evaluate(() => window.history.forward());
await page.waitForURL(/markets\/assets\/AAPL\/overview$/, { timeout: 10_000 });
checks.push({ name: "history:forward", passed: page.url().endsWith("/markets/assets/AAPL/overview") });

await page.goto(`${baseUrl}/not-a-real-route`, { waitUntil: "domcontentloaded" });
checks.push({ name: "unknown-route:404", passed: (await page.locator(".route-not-found").count()) === 1 });

await browser.close();
const result = { generatedAt: new Date().toISOString(), checks, passed: checks.every((check) => check.passed) };
await writeFile("logs/route-contract-smoke.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
