import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "logs");
const vitePort = Number(process.env.PENGBO_ONBOARDING_SMOKE_PORT ?? 4173);
const apiBaseUrl = "http://127.0.0.1:8765/api/v1";
const appUrl = `http://127.0.0.1:${vitePort}`;
const children = [];
const failures = [];

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
        return Date.now() - started;
      }
      lastError = new Error(`${label} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(`${label} did not become ready: ${lastError?.message ?? "timeout"}`);
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

async function apiJson(pathname, init) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, init);
  if (!response.ok) {
    throw new Error(`${pathname} returned HTTP ${response.status}`);
  }
  return response.json();
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  startProcess("npm", ["run", "backend:dev"], "backend");
  const backendReadyMs = await waitForHttp(`${apiBaseUrl}/health`, "backend");
  startProcess("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(vitePort)], "vite");
  const viteReadyMs = await waitForHttp(appUrl, "vite");

  const reset = await apiJson("/settings/onboarding/reset", { method: "POST" });
  await apiJson("/security/local/reset", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirmation: "RESET LOCAL UNLOCK" }),
  });
  if (reset.onboarding_seen_at !== null || reset.checklist.some((item) => item.completed_at !== null)) {
    failures.push("reset did not clear onboarding state");
  }

  const browser = await launchBrowser();
  let progressText = "";
  let resetMessage = "";
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".app-shell").waitFor({ state: "visible", timeout: 20000 });
    await page.getByLabel("first-run-onboarding").waitFor({ state: "visible", timeout: 15000 });

    await page.getByLabel("onboarding-step-toggle key=demo_mode state=pending").click();
    await page.waitForTimeout(350);
    await page.getByLabel("onboarding-step-toggle key=provider_setup state=pending").click();
    await page.waitForTimeout(350);
    progressText = await page.getByLabel(/onboarding-progress/).innerText();

    const updated = await apiJson("/settings/onboarding");
    const completedCount = updated.checklist.filter((item) => item.completed_at !== null).length;
    if (completedCount < 2) {
      failures.push(`expected at least two completed onboarding items, got ${completedCount}`);
    }

    await page.getByLabel("nav-settings").click();
    const unlockGate = page.getByLabel("local-unlock-gate");
    if (await unlockGate.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.getByLabel("local-unlock-secret").fill("0000");
      await page.getByLabel("local-unlock-confirm").fill("0000");
      await page.getByLabel("local-unlock-initialize").click();
      await page.getByLabel("settings-onboarding-reset").waitFor({ state: "visible", timeout: 15000 });
    }
    await page.getByLabel("settings-reset-onboarding").click();
    await page.waitForTimeout(700);
    resetMessage = await page.getByLabel("settings-onboarding-reset").innerText();

    const afterReset = await apiJson("/settings/onboarding");
    if (afterReset.onboarding_seen_at !== null || afterReset.checklist.some((item) => item.completed_at !== null)) {
      failures.push("settings reset did not clear onboarding state");
    }
    if (!resetMessage.includes("新手导览已重置") && !resetMessage.includes("First-run onboarding reset")) {
      failures.push("settings reset confirmation was not visible");
    }
  } finally {
    await browser.close();
  }

  const result = {
    generated_at: new Date().toISOString(),
    app_url: appUrl,
    backend_ready_ms: backendReadyMs,
    vite_ready_ms: viteReadyMs,
    progress_text: progressText,
    reset_message: resetMessage,
    failures,
  };
  await writeFile(path.join(outputDir, "onboarding-smoke-latest.json"), `${JSON.stringify(result, null, 2)}\n`);

  if (failures.length > 0) {
    throw new Error(`Onboarding smoke failed: ${failures.join("; ")}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(stopChildren);
