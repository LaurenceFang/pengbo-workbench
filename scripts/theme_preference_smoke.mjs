import { spawn, execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "logs", "theme-preference-screenshots");
const runtimeRoot = path.join(repoRoot, ".pengbo-runtime", "t101-theme-smoke");
const port = Number(process.env.PENGBO_T101_PORT ?? 4175);
const appUrl = `http://127.0.0.1:${port}`;
const apiUrl = "http://127.0.0.1:8765/api/v1";
const children = [];
const failures = [];

function spawnProcess(command, args, label) {
  const child = spawn(command, args, { cwd: repoRoot, shell: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  children.push(child);
  return child;
}

function startBackend() {
  return spawnProcess("py", ["-m", "backend.app.cli", "--host", "127.0.0.1", "--port", "8765", "--runtime-mode", "web-dev", "--data-dir", path.join(runtimeRoot, "data"), "--log-dir", path.join(runtimeRoot, "logs")], "backend");
}

async function waitForHttp(url, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if ((await fetch(url)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${url} did not become ready`);
}

function stopTree(child) {
  return new Promise((resolve) => {
    if (!child.pid || child.exitCode !== null || child.killed) return resolve();
    if (process.platform === "win32") return execFile("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], () => resolve());
    child.once("exit", resolve); child.kill("SIGTERM"); setTimeout(resolve, 2000);
  });
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await rm(runtimeRoot, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  let backend = startBackend();
  await waitForHttp(`${apiUrl}/health`);
  await fetch(`${apiUrl}/security/local/initialize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unlock_secret: "2468" }) });
  await fetch(`${apiUrl}/security/local/unlock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unlock_secret: "2468" }) });
  spawnProcess("npm.cmd", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], "vite");
  await waitForHttp(appUrl);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.locator('.app-shell[data-theme="light"]').waitFor({ state: "visible", timeout: 20000 });
    await page.screenshot({ path: path.join(outputDir, "light-default.png"), fullPage: true });

    await page.goto(`${appUrl}/settings/appearance`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-route-page="settingsAppearance"]').waitFor({ state: "visible", timeout: 20000 });
    const themeSelect = page.locator('[aria-label="settings-theme"]');
    await themeSelect.waitFor({ state: "visible", timeout: 20000 });
    await themeSelect.selectOption("dark");
    await page.locator('.app-shell[data-theme="dark"]').waitFor({ state: "visible" });
    await page.screenshot({ path: path.join(outputDir, "dark-preview.png"), fullPage: true });
    await page.getByRole("button", { name: /保存偏好|Save preferences/ }).click();
    await page.waitForTimeout(800);

    const saved = await (await fetch(`${apiUrl}/settings/preferences`)).json();
    if (saved.theme !== "dark") failures.push(`saved theme expected dark, got ${saved.theme}`);

    await stopTree(backend);
    backend = startBackend();
    await waitForHttp(`${apiUrl}/health`);
    await fetch(`${apiUrl}/security/local/unlock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unlock_secret: "2468" }) });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('.app-shell[data-theme="dark"]').waitFor({ state: "visible", timeout: 20000 });
    await page.screenshot({ path: path.join(outputDir, "dark-restored-after-backend-restart.png"), fullPage: true });

    const restored = await (await fetch(`${apiUrl}/settings/preferences`)).json();
    if (restored.theme !== "dark") failures.push(`restored theme expected dark, got ${restored.theme}`);
    const reset = { ...restored, theme: "light" };
    const resetResponse = await fetch(`${apiUrl}/settings/preferences`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(reset) });
    if (!resetResponse.ok) failures.push(`failed to restore light preference: HTTP ${resetResponse.status}`);
    const resetSaved = await (await fetch(`${apiUrl}/settings/preferences`)).json();
    if (resetSaved.theme !== "light") failures.push(`reset theme expected light, got ${resetSaved.theme}`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('.app-shell[data-theme="light"]').waitFor({ state: "visible", timeout: 20000 });
    await page.screenshot({ path: path.join(outputDir, "light-reset.png"), fullPage: true });
  } finally { await browser.close(); }

  await writeFile(path.join(outputDir, "theme-preference-smoke-latest.json"), `${JSON.stringify({ generated_at: new Date().toISOString(), failures, scenarios: ["light-default", "dark-preview", "dark-restored-after-backend-restart", "light-reset"] }, null, 2)}\n`);
  if (failures.length) throw new Error(failures.join("; "));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => Promise.all(children.map(stopTree)));
