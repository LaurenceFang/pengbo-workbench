import { readFile } from "node:fs/promises";

const [configSource, rustSource] = await Promise.all([
  readFile("src-tauri/tauri.conf.json", "utf8"),
  readFile("src-tauri/src/lib.rs", "utf8"),
]);
const config = JSON.parse(configSource);
const mainWindow = config.app?.windows?.find((window) => window.label === "main");
const failures = [];

if (mainWindow?.visible !== false) failures.push("main Tauri window must be created with visible=false to prevent first-frame flash");
if (!rustSource.includes("PENGBO_AUTOMATION_WINDOW_MODE")) failures.push("Rust runtime does not read PENGBO_AUTOMATION_WINDOW_MODE");
if (!rustSource.includes("AutomationWindowMode::Hidden")) failures.push("Rust runtime has no hidden automation mode");
if (!rustSource.includes("AutomationWindowMode::Minimized")) failures.push("Rust runtime has no minimized automation mode");
if (!rustSource.includes("apply_initial_window_mode")) failures.push("setup does not apply the initial window mode");
if (!rustSource.includes("apply_single_instance_window_mode")) failures.push("single-instance handling is not window-mode aware");

const result = { passed: failures.length === 0, failures };
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
