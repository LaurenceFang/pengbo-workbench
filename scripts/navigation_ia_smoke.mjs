import { spawn, execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "logs", "navigation-ia-screenshots");
const port = Number(process.env.PENGBO_T99_PORT ?? 4179);
const appUrl = `http://127.0.0.1:${port}`;
const children = [];
const failures = [];

const groups = ["home", "research", "markets", "portfolio", "factorLab", "automation", "settings"];
const viewsByGroup = {
  home: ["dashboard", "commandCenter"],
  research: ["research"],
  markets: ["asset", "watchlist", "dataSources"],
  portfolio: ["portfolio"],
  factorLab: ["factorLab", "strategyLab"],
  automation: ["workflowStudio", "screeners"],
  settings: ["settings", "connections", "manual"],
};

function start(command, args) {
  const child = spawn(command, args, { cwd: repoRoot, shell: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } });
  child.stdout.on("data", (chunk) => process.stdout.write(`[vite] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[vite] ${chunk}`));
  children.push(child);
}

async function waitForHttp(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`${url} did not become ready`);
}

function stopTree(child) {
  return new Promise((resolve) => {
    if (!child.pid || child.exitCode !== null || child.killed) return resolve();
    if (process.platform === "win32") return execFile("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], () => resolve());
    child.once("exit", resolve);
    child.kill("SIGTERM");
    setTimeout(resolve, 2000);
  });
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  start("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)]);
  await waitForHttp(appUrl);

  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".app-shell").waitFor({ state: "visible" });

    const visibleGroupCount = await page.locator(".nav-group-trigger").count();
    if (visibleGroupCount !== 7) failures.push(`expected 7 visible groups, found ${visibleGroupCount}`);

    for (const group of groups) {
      const views = viewsByGroup[group];
      const groupSelector = views.length === 1 ? `[aria-label="nav-${views[0]}"]` : `[aria-label="nav-group-${group}"]`;
      const trigger = page.locator(groupSelector);
      if ((await trigger.count()) !== 1) {
        failures.push(`${group}: group trigger or single-view automation anchor is missing`);
        continue;
      }
      if (views.length > 1 && (await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
      for (const view of views) {
        const item = page.locator(`[aria-label="nav-${view}"]`);
        if ((await item.count()) !== 1) failures.push(`${group}/${view}: existing nav anchor is not reachable`);
      }
    }

    const expandedCount = await page.locator('.nav-group-trigger[aria-expanded="true"]').count();
    if (expandedCount !== 1) failures.push(`expected one expanded navigation group, found ${expandedCount}`);

    const home = page.locator('[aria-label="nav-group-home"]');
    await home.focus();
    if (!(await home.evaluate((element) => element === document.activeElement))) failures.push("group trigger cannot receive keyboard focus");
    await home.press("Enter");

    await page.evaluate(() => {
      const shell = document.querySelector(".app-shell");
      shell?.classList.remove("density-standard");
      shell?.classList.add("density-compact");
    });
    const sidebar = await page.locator(".sidebar").boundingBox();
    if (!sidebar || sidebar.height < 700) failures.push("compact sidebar did not render at desktop height");
    await page.screenshot({ path: path.join(outputDir, "navigation-groups-compact.png"), fullPage: true });
  } finally {
    await browser.close();
  }

  await writeFile(path.join(outputDir, "navigation-ia-smoke-latest.json"), `${JSON.stringify({ generated_at: new Date().toISOString(), failures, groups, views_by_group: viewsByGroup }, null, 2)}\n`);
  if (failures.length) throw new Error(failures.join("; "));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => Promise.all(children.map(stopTree)));
