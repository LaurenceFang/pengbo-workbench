import { spawn, execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "logs", "app-shell-screenshots");
const port = Number(process.env.PENGBO_T100_PORT ?? 4180);
const appUrl = `http://127.0.0.1:${port}`;
const children = [];
const failures = [];

function start() {
  const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], { cwd: repoRoot, shell: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BROWSER: "none" } });
  child.stdout.on("data", (chunk) => process.stdout.write(`[vite] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[vite] ${chunk}`));
  children.push(child);
}

async function waitForHttp() {
  for (let attempt = 0; attempt < 75; attempt += 1) {
    try { if ((await fetch(appUrl)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("T100 Vite server did not become ready");
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
  await mkdir(outputDir, { recursive: true });
  start();
  await waitForHttp();
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const evidence = [];
  try {
    for (const variant of [
      { name: "wide-standard", width: 1600, height: 1000, compact: false },
      { name: "minimum-compact", width: 1280, height: 820, compact: true },
    ]) {
      const page = await browser.newPage({ viewport: { width: variant.width, height: variant.height } });
      await page.goto(appUrl, { waitUntil: "domcontentloaded" });
      await page.locator(".app-shell").waitFor({ state: "visible" });
      if (variant.compact) await page.evaluate(() => { const shell = document.querySelector(".app-shell"); shell?.classList.remove("density-standard"); shell?.classList.add("density-compact"); });

      const selectors = [".app-shell-sidebar", ".app-shell-toolbar", ".app-shell-workspace", ".app-shell-context"];
      const boxes = {};
      for (const selector of selectors) {
        const box = await page.locator(selector).boundingBox();
        boxes[selector] = box;
        if (!box || box.width < 40 || box.height < 30) failures.push(`${variant.name}: ${selector} is missing or collapsed unexpectedly`);
      }
      if ((boxes[".app-shell-workspace"]?.width ?? 0) < 600) failures.push(`${variant.name}: workspace is narrower than 600px`);
      if ((boxes[".app-shell-context"]?.width ?? 0) < 240) failures.push(`${variant.name}: context rail is narrower than 240px`);

      const toggle = page.locator(".context-rail-toggle");
      await toggle.click();
      if ((await toggle.getAttribute("aria-expanded")) !== "false") failures.push(`${variant.name}: context rail did not collapse`);
      await toggle.click();
      if ((await toggle.getAttribute("aria-expanded")) !== "true") failures.push(`${variant.name}: context rail did not expand`);

      await page.locator('[aria-label="open-command-palette"]').click();
      if (!(await page.locator(".command-palette").isVisible())) failures.push(`${variant.name}: command palette did not open from toolbar`);
      await page.keyboard.press("Escape");

      const file = path.join(outputDir, `${variant.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      evidence.push({ variant: variant.name, file: path.relative(repoRoot, file).replaceAll("\\", "/"), workspace_width: Math.round(boxes[".app-shell-workspace"]?.width ?? 0) });
      await page.close();
    }
  } finally { await browser.close(); }

  await writeFile(path.join(outputDir, "app-shell-smoke-latest.json"), `${JSON.stringify({ generated_at: new Date().toISOString(), failures, evidence }, null, 2)}\n`);
  if (failures.length) throw new Error(failures.join("; "));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => Promise.all(children.map(stopTree)));
