import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const views = [
  ["dashboard", "home"], ["commandCenter", "home"], ["research", "research"],
  ["asset", "markets"], ["watchlist", "markets"], ["dataSources", "markets"],
  ["portfolio", "portfolio"], ["factorLab", "factorLab"], ["strategyLab", "factorLab"],
  ["workflowStudio", "automation"], ["screeners", "automation"],
  ["settings", "settings"], ["connections", "settings"], ["manual", "settings"],
];
const width = Number(process.env.VIEWPORT_WIDTH ?? 1600);
const height = Number(process.env.VIEWPORT_HEIGHT ?? 1000);
const outputDir = `logs/all-views-render-smoke/${width}x${height}`;
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const consoleErrors = [];
const securityBlocks = [];
page.on("console", (message) => { if (message.type() === "error" && !/(401 \(Unauthorized\)|403 \(Forbidden\)|423 \(Locked\))/.test(message.text())) consoleErrors.push(message.text()); });
page.on("response", (response) => { if ([401, 403, 423].includes(response.status()) && response.url().includes("/api/")) securityBlocks.push(response.url()); });
await page.goto("http://127.0.0.1:4190", { waitUntil: "domcontentloaded" });
await page.locator(".app-shell").waitFor({ state: "visible", timeout: 15_000 });
const records = [];
for (const [view, group] of views) {
  const target = page.getByLabel(`nav-${view}`);
  if (await target.count() === 0) await page.getByLabel(`nav-group-${group}`).click();
  await page.getByLabel(`nav-${view}`).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outputDir}/${view}.png`, fullPage: true });
  records.push({ view, shell: await page.locator(".app-shell-main").count() > 0, workspace: await page.locator(".app-shell-workspace").count() > 0, theme: await page.locator(".app-shell").getAttribute("data-theme"), density: await page.locator(".app-shell").evaluate((node) => [...node.classList].find((name) => name.startsWith("density-")) ?? null), language: await page.locator("html").getAttribute("lang"), consoleErrors: [...consoleErrors], expectedSecurityBlocks: [...new Set(securityBlocks)] });
  consoleErrors.length = 0;
  securityBlocks.length = 0;
}
await browser.close();
const result = { viewport: `${width}x${height}`, viewCount: records.length, records, passed: records.length === views.length && records.every((record) => record.shell && record.workspace && record.consoleErrors.length === 0) };
await writeFile(`${outputDir}/latest.json`, JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
