import { chromium } from "playwright";

const baseUrl = process.env.PENGBO_WEB_URL ?? "http://127.0.0.1:4190/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error" && !/403 \(Forbidden\)/i.test(message.text())) consoleErrors.push(message.text());
});
const failures = [];
try {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.locator(".app-shell, [data-app-shell], main").first().waitFor({ state: "visible", timeout: 10000 });
  const navCount = await page.locator('[data-testid^="nav-"], [id^="nav-"]').count();
  const stateCount = await page.locator("[data-ui-state]").count();
  if (navCount === 0) failures.push("navigation shell was not rendered");
  if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.join(" | ")}`);
  console.log(JSON.stringify({ passed: failures.length === 0, navCount, stateCount, consoleErrors, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await browser.close();
}
