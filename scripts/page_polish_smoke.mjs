import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "logs", "page-polish-screenshots");
const vitePort = Number(process.env.PENGBO_PAGE_POLISH_PORT ?? 4175);
const apiBaseUrl = "http://127.0.0.1:8765/api/v1";
const backendHealthUrl = `${apiBaseUrl}/health`;
const appUrl = `http://127.0.0.1:${vitePort}`;

const viewports = [
  { name: "desktop-min", width: 1280, height: 820 },
  { name: "desktop-wide", width: 1680, height: 1000 },
];

const languages = ["zh-CN", "en-US"];

const pages = [
  { key: "dashboard", label: "Dashboard", nav: "nav-dashboard" },
  { key: "asset", label: "Asset", nav: "nav-asset" },
  { key: "research", label: "Research", nav: "nav-research" },
  { key: "factorLab", label: "Factor Lab", nav: "nav-factorLab" },
  { key: "strategyLab", label: "Strategy Lab", nav: "nav-strategyLab" },
  { key: "workflowStudio", label: "Workflow Studio", nav: "nav-workflowStudio" },
  { key: "dataSources", label: "Data Sources", nav: "nav-dataSources" },
  { key: "screeners", label: "Screeners", nav: "nav-screeners" },
  { key: "manual", label: "Manual", nav: "nav-manual" },
  { key: "portfolio", label: "Portfolio", nav: "nav-portfolio" },
  { key: "connections", label: "Connections", nav: "nav-connections" },
  { key: "settings", label: "Settings", nav: "nav-settings" },
];

const children = [];
const failures = [];
const screenshots = [];
let originalPreferences = null;

function startProcess(command, args, name) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  children.push(child);
  return child;
}

async function waitForHttp(url, label, timeoutMs = 60000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return { ok: true, elapsedMs: Date.now() - started };
      }
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`${label} did not become ready: ${lastError?.message ?? "timeout"}`);
}

async function stopChildren() {
  await Promise.all(children.map((child) => stopProcessTree(child)));
}

function stopProcessTree(child) {
  return new Promise((resolve) => {
    if (!child.pid || child.exitCode !== null || child.killed) {
      resolve();
      return;
    }
    if (process.platform === "win32") {
      execFile("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], () => resolve());
      return;
    }
    child.once("exit", resolve);
    child.kill("SIGTERM");
    setTimeout(resolve, 2500);
  });
}

async function setLanguage(language) {
  const current = await fetch(`${apiBaseUrl}/settings/preferences`).then((response) => response.json());
  if (!originalPreferences) {
    originalPreferences = current;
  }
  const next = {
    ...current,
    default_view: "dashboard",
    language,
    density: "standard",
  };
  const response = await fetch(`${apiBaseUrl}/settings/preferences`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(next),
  });
  if (!response.ok) {
    throw new Error(`Failed to set ${language} preferences: HTTP ${response.status}`);
  }
}

async function restoreOriginalPreferences() {
  if (!originalPreferences) {
    return;
  }
  await fetch(`${apiBaseUrl}/settings/preferences`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(originalPreferences),
  });
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function capturePage(page, language, viewport, target) {
  if (target.key !== "dashboard") {
    await page.getByLabel(target.nav).click();
    await page.waitForTimeout(650);
  }

  await page.locator(".workspace").waitFor({ state: "visible", timeout: 15000 });
  const activeTitle = await page.locator(".topbar h2").innerText({ timeout: 10000 });
  const workspaceBox = await page.locator(".workspace").boundingBox();
  const sidebarBox = await page.locator(".sidebar").boundingBox();
  const bodyText = await page.locator("body").innerText();
  const clippedControls = await page.evaluate(() =>
    Array.from(document.querySelectorAll("button, .mini-pill, .delta-pill, .setting-value"))
      .filter((element) => element instanceof HTMLElement && element.offsetParent !== null)
      .filter((element) => element.scrollWidth > element.clientWidth + 3 || element.scrollHeight > element.clientHeight + 3)
      .slice(0, 8)
      .map((element) => element.textContent?.trim() || element.getAttribute("aria-label") || element.className),
  );

  const screenshotName = `${language}-${viewport.name}-${target.key}.png`;
  const screenshotPath = path.join(outputDir, screenshotName);

  if (!workspaceBox || workspaceBox.width < 600 || workspaceBox.height < 500) {
    failures.push(`${language}/${viewport.name}/${target.label}: workspace is too small or missing`);
  }
  if (!sidebarBox || sidebarBox.width < 220) {
    failures.push(`${language}/${viewport.name}/${target.label}: sidebar is too small or missing`);
  }
  if (!activeTitle || activeTitle.length < 2) {
    failures.push(`${language}/${viewport.name}/${target.label}: topbar title did not render`);
  }
  if (/[�]|Ã|Â|锟/.test(bodyText)) {
    failures.push(`${language}/${viewport.name}/${target.label}: visible mojibake marker detected`);
  }
  if (clippedControls.length > 0) {
    failures.push(`${language}/${viewport.name}/${target.label}: clipped controls ${clippedControls.join(" | ")}`);
  }

  await page.screenshot({ path: screenshotPath, fullPage: true });
  screenshots.push({
    language,
    viewport: viewport.name,
    page: target.label,
    file: path.relative(repoRoot, screenshotPath).replaceAll("\\", "/"),
    title: activeTitle,
    workspace_width: Math.round(workspaceBox?.width ?? 0),
    workspace_height: Math.round(workspaceBox?.height ?? 0),
  });
}

async function captureLanguageViewport(browser, language, viewport) {
  await setLanguage(language);
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".app-shell").waitFor({ state: "visible", timeout: 20000 });

  for (const target of pages) {
    await capturePage(page, language, viewport, target);
  }

  await context.close();
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  startProcess("npm", ["run", "backend:dev"], "backend");
  const backendReady = await waitForHttp(backendHealthUrl, "backend");

  startProcess("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(vitePort)], "vite");
  const viteReady = await waitForHttp(appUrl, "vite");

  const browser = await launchBrowser();
  try {
    for (const language of languages) {
      for (const viewport of viewports) {
        await captureLanguageViewport(browser, language, viewport);
      }
    }
  } finally {
    await browser.close();
    await restoreOriginalPreferences();
  }

  const result = {
    generated_at: new Date().toISOString(),
    app_url: appUrl,
    backend_ready_ms: backendReady.elapsedMs,
    vite_ready_ms: viteReady.elapsedMs,
    language_count: languages.length,
    viewport_count: viewports.length,
    page_count: pages.length,
    screenshot_count: screenshots.length,
    screenshots,
    failures,
  };
  await writeFile(path.join(outputDir, "page-polish-smoke-latest.json"), `${JSON.stringify(result, null, 2)}\n`);

  if (failures.length > 0) {
    throw new Error(`Page polish smoke failed: ${failures.join("; ")}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(stopChildren);
