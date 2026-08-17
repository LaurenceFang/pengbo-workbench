import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const views = ["dashboard", "commandCenter", "asset", "dataSources", "research"];
const outputDir = "logs/p1-render-smoke";
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
const expectedSecurityBlocks = [];
page.on("console", (message) => { if (message.type() === "error" && !/(401 \(Unauthorized\)|403 \(Forbidden\)|423 \(Locked\))/.test(message.text())) consoleErrors.push(message.text()); });
page.on("response", (response) => { if ([401, 403, 423].includes(response.status()) && response.url().includes("/api/")) expectedSecurityBlocks.push(response.url()); });
await page.goto("http://127.0.0.1:4190", { waitUntil: "domcontentloaded" });
await page.locator(".app-shell").waitFor({ state: "visible", timeout: 15_000 });
const records = [];
for (const view of views) {
  const groupByView = { asset: "markets", dataSources: "markets", research: "research" };
  const group = groupByView[view];
  if (group) {
    const groupButton = page.getByLabel(`nav-group-${group}`);
    if (await page.getByLabel(`nav-${view}`).count() === 0 && await groupButton.count()) await groupButton.click();
  }
  await page.getByLabel(`nav-${view}`).click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outputDir}/${view}.png`, fullPage: true });
  records.push({ view, shell: await page.locator(".app-shell-main").count() > 0, workspace: await page.locator(".app-shell-workspace").count() > 0, consoleErrors: [...consoleErrors], expectedSecurityBlocks: [...new Set(expectedSecurityBlocks)] });
  consoleErrors.length = 0;
  expectedSecurityBlocks.length = 0;
}
await browser.close();
const result = { viewport: "1600x1000", views: records, passed: records.every((record) => record.shell && record.workspace && record.consoleErrors.length === 0) };
await writeFile(`${outputDir}/latest.json`, JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
