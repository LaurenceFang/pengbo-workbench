import { mkdir, readFile, writeFile } from "node:fs/promises";

const registry = JSON.parse(await readFile("logs/svg-frame-registry.json", "utf8"));
const visual = JSON.parse(await readFile("logs/visual-acceptance/index.json", "utf8"));
const theme = JSON.parse(await readFile("logs/full-route-theme-smoke.json", "utf8"));
const structure = JSON.parse(await readFile("logs/route-workspace-structure-smoke.json", "utf8"));
const t105StateContract = JSON.parse(await readFile("logs/t105-route-state-matrix.json", "utf8"));
const t105Runtime = JSON.parse(await readFile("logs/t105-route-state-runtime.json", "utf8"));
const t106States = JSON.parse(await readFile("logs/t106-route-state-visual.json", "utf8"));
const evidenceLines = (await readFile("logs/full-route-evidence.jsonl", "utf8"))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const viewportKeys = [...new Set(evidenceLines.map((record) => `${record.viewport.width}x${record.viewport.height}`))];
const screenshotCount = evidenceLines.filter((record) => record.screenshotPath).length;
const failures = [];

if (registry.frameCount !== 79 || registry.routeCount !== 79) failures.push("SVG registry is not 79/79");
if (evidenceLines.length !== 316) failures.push(`expected 316 route/viewport records, found ${evidenceLines.length}`);
if (screenshotCount !== 316) failures.push(`expected 316 screenshots, found ${screenshotCount}`);
if (evidenceLines.some((record) => !record.passed || record.uiState === "loading")) failures.push("one or more route screenshots failed or remained loading");
if (visual.passedCount !== 79 || visual.geometryPassedCount !== 79 || visual.stylePassedCount !== 79 || visual.structurePassedCount !== 79) {
  failures.push("approved SVG automated rule is not 79/79");
}
if (!theme.passed || theme.checkCount !== 632 || theme.screenshotCount !== 632 || theme.failureCount !== 0) {
  failures.push("dual-theme/four-viewport route evidence is not 632/632");
}
if (!structure.passed || structure.checkCount !== 316 || structure.failureCount !== 0) {
  failures.push("direct child workspace structure is not 316/316");
}
if (!t105StateContract.passed || t105StateContract.routeCount !== 79) {
  failures.push("T105 applicable state contract is not 79/79");
}
if (!t105Runtime.passed || t105Runtime.checkCount !== 491 || t105Runtime.failureCount !== 0) {
  failures.push("T105 runtime state matrix is not 491/491");
}
if (!t106States.passed || t106States.checkCount !== 3928 || t106States.screenshotCount !== 3928 || t106States.failureCount !== 0) {
  failures.push("T106 all-state dual-theme/four-viewport evidence is not 3928/3928");
}

const result = {
  baseline: "T106 full-route automated baseline",
  sourceSvg: registry.svgPath,
  sourceSvgSha256: registry.svgSha256,
  frameCount: registry.frameCount,
  routeCount: registry.routeCount,
  viewportCount: viewportKeys.length,
  viewports: viewportKeys,
  evidenceRecordCount: evidenceLines.length,
  screenshotCount,
  dualThemeCheckCount: theme.checkCount,
  dualThemeScreenshotCount: theme.screenshotCount,
  routeStructureCheckCount: structure.checkCount,
  t105ApplicableStateCount: t105Runtime.applicableStateCount,
  t105StateCheckCount: t105Runtime.checkCount,
  t106StateCheckCount: t106States.checkCount,
  t106StateScreenshotCount: t106States.screenshotCount,
  geometryPassedCount: visual.geometryPassedCount,
  stylePassedCount: visual.stylePassedCount,
  structurePassedCount: visual.structurePassedCount,
  legalMaskArtifactCount: visual.legalMaskArtifactCount,
  rawPixelDiagnosticPassedCount: visual.rawPixelDiagnosticPassedCount,
  humanSignoff: visual.humanSignoff,
  automatedPassed: failures.length === 0,
  m1ExitEligible: false,
  blocker: "Automated route/state/theme/viewport gates do not replace per-frame human signoff, current-source packaged regression, or installed MSI/NSIS signoff.",
  failures,
};

await mkdir("logs/t106-route-screenshots", { recursive: true });
await writeFile("logs/t106-route-screenshots/index.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result, null, 2));
if (!result.automatedPassed) process.exitCode = 1;
