import { spawn, execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "logs", "design-tokens-screenshots");
const port = Number(process.env.PENGBO_T98_PORT ?? 4178);
const appUrl = `http://127.0.0.1:${port}`;
const backendUrl = "http://127.0.0.1:8765/api/v1/health";
const children = [];

const variants = [
  { name: "light-standard", theme: "light", density: "standard" },
  { name: "light-compact", theme: "light", density: "compact" },
  { name: "dark-standard", theme: "dark", density: "standard" },
];

function start(command, args, label) {
  const child = spawn(command, args, {
    cwd: repoRoot,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${label}] ${chunk}`));
  children.push(child);
  return child;
}

async function waitForHttp(url, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return Date.now() - started;
    } catch {
      // The process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${url} did not become ready`);
}

function stopTree(child) {
  return new Promise((resolve) => {
    if (!child.pid || child.exitCode !== null || child.killed) return resolve();
    if (process.platform === "win32") {
      execFile("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], () => resolve());
      return;
    }
    child.once("exit", resolve);
    child.kill("SIGTERM");
    setTimeout(resolve, 2500);
  });
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  start("npm", ["run", "backend:dev"], "backend");
  const backendReadyMs = await waitForHttp(backendUrl);
  start("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], "vite");
  const viteReadyMs = await waitForHttp(appUrl);

  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [];
  try {
    for (const variant of variants) {
      const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
      const page = await context.newPage();
      await page.goto(appUrl, { waitUntil: "domcontentloaded" });
      await page.locator(".app-shell").waitFor({ state: "visible", timeout: 20000 });
      await page.evaluate(({ theme, density }) => {
        document.documentElement.dataset.theme = theme;
        const shell = document.querySelector(".app-shell");
        shell?.classList.remove("density-standard", "density-compact");
        shell?.classList.add(`density-${density}`);
      }, variant);
      await page.waitForTimeout(300);

      const shell = await page.locator(".app-shell").boundingBox();
      const workspace = await page.locator(".workspace").boundingBox();
      if (!shell || !workspace || workspace.width < 700) {
        throw new Error(`${variant.name}: application shell did not render at desktop width`);
      }

      const file = path.join(outputDir, `${variant.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      results.push({
        ...variant,
        file: path.relative(repoRoot, file).replaceAll("\\", "/"),
        shell_width: Math.round(shell.width),
        workspace_width: Math.round(workspace.width),
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  await writeFile(path.join(outputDir, "design-tokens-smoke-latest.json"), `${JSON.stringify({
    generated_at: new Date().toISOString(),
    backend_ready_ms: backendReadyMs,
    vite_ready_ms: viteReadyMs,
    failures: [],
    variants: results,
  }, null, 2)}\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all(children.map(stopTree));
  });

