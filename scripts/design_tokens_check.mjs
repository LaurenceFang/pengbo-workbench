import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const stylesPath = path.join(repoRoot, "src", "styles.css");

const requiredTokens = [
  "--font-ui",
  "--font-data",
  "--surface-canvas",
  "--surface-sidebar",
  "--surface-panel",
  "--surface-elevated",
  "--surface-control",
  "--surface-selected",
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--text-disabled",
  "--border-subtle",
  "--border-default",
  "--border-strong",
  "--focus-ring",
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-5",
  "--space-6",
  "--radius-panel",
  "--radius-control",
  "--shadow-panel",
  "--motion-fast",
  "--motion-standard",
  "--density-shell-gap",
  "--density-row-height",
  "--density-toolbar-height",
  "--density-card-pad",
  "--density-inspector-pad",
];

const requiredStates = [
  "observed",
  "online",
  "connecting",
  "offline",
  "cached",
  "degraded",
  "credential-required",
  "blocked",
  "audited",
  "gain",
  "loss",
  "neutral",
];

function blockFor(source, selector) {
  const start = source.indexOf(selector);
  if (start === -1) return "";
  const open = source.indexOf("{", start);
  if (open === -1) return "";
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return "";
}

function findMissing(source, tokens) {
  return tokens.filter((token) => !source.includes(`${token}:`));
}

async function main() {
  const source = await readFile(stylesPath, "utf8");
  const failures = [];
  const root = blockFor(source, ":root");
  const dark = blockFor(source, 'html[data-theme="dark"]');
  const standard = blockFor(source, ".density-standard");
  const compact = blockFor(source, ".density-compact");

  const missingTokens = findMissing(source, requiredTokens);
  if (missingTokens.length) failures.push(`missing tokens: ${missingTokens.join(", ")}`);

  for (const state of requiredStates) {
    const missing = findMissing(source, [
      `--status-${state}-fg`,
      `--status-${state}-bg`,
      `--status-${state}-border`,
    ]);
    if (missing.length) failures.push(`state ${state}: ${missing.join(", ")}`);
  }

  if (!root.includes("color-scheme: light")) failures.push(":root must be light-mode-first");
  if (!dark.includes("color-scheme: dark")) failures.push("dark theme selector is missing or incomplete");

  for (const [name, block] of [["standard", standard], ["compact", compact]]) {
    const missing = findMissing(block, [
      "--density-shell-gap",
      "--density-row-height",
      "--density-toolbar-height",
      "--density-card-pad",
      "--density-inspector-pad",
    ]);
    if (missing.length) failures.push(`${name} density: ${missing.join(", ")}`);
  }

  if (/fonts\.googleapis\.com/i.test(source)) failures.push("runtime Google Fonts import must be removed");
  if (!source.includes("@media (prefers-reduced-motion: reduce)")) failures.push("reduced-motion fallback is missing");

  if (failures.length) {
    throw new Error(`T98 design token contract failed:\n- ${failures.join("\n- ")}`);
  }

  console.log(`T98 design token contract passed (${requiredTokens.length} core tokens, ${requiredStates.length} states).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
