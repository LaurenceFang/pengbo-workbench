import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "logs");
const files = [
  "src/i18n/index.ts",
  "src/App.tsx",
  "src/views/asset-view.tsx",
  "src/views/factor-lab-view.tsx",
  "src/views/manual-view.tsx",
  "src/views/research-view.tsx",
  "src/views/screeners-view.tsx",
  "src/views/strategy-lab-view.tsx",
  "src/views/workflow-studio-view.tsx",
];

function extractBlock(source, language) {
  const marker = `"${language}": {`;
  const start = source.indexOf(marker);
  if (start === -1) return "";
  let depth = 0;
  for (let index = start + marker.length - 1; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return "";
}

async function main() {
  const failures = [];
  const warnings = [];
  const i18nSource = await readFile(path.join(repoRoot, "src/i18n/index.ts"), "utf8");
  const zhKeys = [...extractBlock(i18nSource, "zh-CN").matchAll(/"([^"]+)":/g)]
    .map((match) => match[1])
    .filter((key) => !["zh-CN", "en-US"].includes(key))
    .sort();
  const enKeys = [...extractBlock(i18nSource, "en-US").matchAll(/"([^"]+)":/g)]
    .map((match) => match[1])
    .filter((key) => !["zh-CN", "en-US"].includes(key))
    .sort();
  const missingZh = enKeys.filter((key) => !zhKeys.includes(key));
  const missingEn = zhKeys.filter((key) => !enKeys.includes(key));
  if (missingZh.length || missingEn.length) {
    failures.push(`Translation dictionary mismatch: missingZh=${missingZh.join(",")} missingEn=${missingEn.join(",")}`);
  }

  const scanned = [];
  for (const relative of files) {
    const fullPath = path.join(repoRoot, relative);
    const source = await readFile(fullPath, "utf8");
    if (/[�]|Ã|Â|锟/.test(source)) {
      failures.push(`${relative}: mojibake marker detected`);
    }
    const englishStrings = [...source.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)]
      .map((match) => match[1].trim())
      .filter((value) => value.length > 8 && !/^[A-Z0-9_/\-\s.]+$/.test(value));
    if (englishStrings.length) {
      warnings.push({ file: relative, count: englishStrings.length, samples: englishStrings.slice(0, 5) });
    }
    scanned.push(relative);
  }

  await mkdir(outputDir, { recursive: true });
  const result = {
    generated_at: new Date().toISOString(),
    dictionary_key_count: zhKeys.length,
    scanned,
    fixed_english_candidates: warnings,
    failures,
  };
  await writeFile(path.join(outputDir, "i18n-check-latest.json"), `${JSON.stringify(result, null, 2)}\n`);
  if (failures.length) {
    throw new Error(failures.join("; "));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
