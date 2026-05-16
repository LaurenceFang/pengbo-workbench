import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "logs", "workflow-studio-smoke");
const vitePort = Number(process.env.PENGBO_WORKFLOW_STUDIO_PORT ?? 4176);
const apiBaseUrl = "http://127.0.0.1:8765/api/v1";
const appUrl = `http://127.0.0.1:${vitePort}`;
const backendHealthUrl = `${apiBaseUrl}/health`;

const children = [];
const failures = [];
const evidence = {};

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

async function stopChildren() {
  await Promise.all(children.map((child) => stopProcessTree(child)));
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

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function runSmoke() {
  await mkdir(outputDir, { recursive: true });
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
    const consoleIssues = [];
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleIssues.push(`${message.type()}: ${message.text()}`);
      }
    });

    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".app-shell").waitFor({ state: "visible", timeout: 20000 });
    await page.locator(".topbar h2").waitFor({ state: "visible", timeout: 20000 });
    await page.waitForTimeout(1600);
    await page.getByLabel("nav-workflowStudio").click();
    await page.getByLabel(/workflow-studio-view/).waitFor({ state: "visible", timeout: 20000 });
    await page.waitForFunction(
      () => document.querySelectorAll("button.workflow-template-card").length >= 6,
      undefined,
      { timeout: 30000 },
    );
    const paperTemplate = page.locator("button[aria-label*='workflow-template key=paper_to_binance_intent']");
    evidence.title = await page.locator(".topbar h2").innerText();

    const templateCount = await page.locator("button.workflow-template-card").count();
    if (templateCount < 6) {
      failures.push(`expected at least 6 workflow templates, got ${templateCount}`);
    }
    evidence.template_count = templateCount;

    await paperTemplate.click({ timeout: 15000 });
    await page.getByLabel("workflow-input symbol").fill("BTC/USDT");
    await page.getByLabel("workflow-input quantity").fill("0.01");
    await page.getByLabel("workflow-run-submit template=paper_to_binance_intent").click();

    const runLocator = page.getByLabel(/workflow-studio-view template=paper_to_binance_intent run=workflow-/);
    await runLocator.waitFor({ state: "visible", timeout: 90000 });
    const runLabel = await runLocator.getAttribute("aria-label");
    evidence.run_label = runLabel;
    if (!runLabel?.includes("status=blocked")) {
      failures.push(`expected paper_to_binance_intent run to stop at blocked/manual boundary, got ${runLabel}`);
    }

    await page.getByLabel(/workflow-step key=await_user_confirmation status=manual_required/).waitFor({
      state: "visible",
      timeout: 15000,
    });
    await page.getByLabel(/workflow-manual-boundary run=workflow-.*policy=user_confirmed_binance_submit/).waitFor({
      state: "visible",
      timeout: 15000,
    });
    const intentArtifacts = await page.locator("button[aria-label*='workflow-artifact type=binance_intent']").count();
    if (intentArtifacts < 1) {
      failures.push("expected a binance_intent artifact link");
    }
    evidence.binance_intent_artifact_count = intentArtifacts;

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".app-shell").waitFor({ state: "visible", timeout: 20000 });
    await page.locator(".topbar h2").waitFor({ state: "visible", timeout: 20000 });
    await page.waitForTimeout(1600);
    await page.getByLabel("nav-workflowStudio").click();
    await page.locator("button[aria-label*='workflow-recent-run id=workflow-']").first().waitFor({
      state: "visible",
      timeout: 20000,
    });
    const recentCount = await page.locator("button[aria-label*='workflow-recent-run id=workflow-']").count();
    if (recentCount < 1) {
      failures.push("expected at least one recent workflow run after reload");
    }
    evidence.recent_run_count_after_reload = recentCount;

    const screenshotPath = path.join(outputDir, "workflow-studio-smoke.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    evidence.screenshot = path.relative(repoRoot, screenshotPath).replaceAll("\\", "/");

    const relevantConsoleIssues = consoleIssues.filter((line) => !line.includes("Download the React DevTools"));
    if (relevantConsoleIssues.length > 0) {
      failures.push(`console issues: ${relevantConsoleIssues.slice(0, 5).join(" | ")}`);
    }
    evidence.console_issue_count = relevantConsoleIssues.length;
  } finally {
    await browser.close();
  }
}

async function main() {
  startProcess("npm", ["run", "backend:dev"], "backend");
  const backendReady = await waitForHttp(backendHealthUrl, "backend");
  startProcess("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(vitePort)], "vite");
  const viteReady = await waitForHttp(appUrl, "vite");

  try {
    await runSmoke();
  } finally {
    await stopChildren();
  }

  const result = {
    generated_at: new Date().toISOString(),
    app_url: appUrl,
    backend_ready_ms: backendReady.elapsedMs,
    vite_ready_ms: viteReady.elapsedMs,
    ...evidence,
    failures,
  };
  await writeFile(path.join(outputDir, "workflow-studio-smoke-latest.json"), `${JSON.stringify(result, null, 2)}\n`);
  if (failures.length > 0) {
    throw new Error(`Workflow Studio smoke failed: ${failures.join("; ")}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
