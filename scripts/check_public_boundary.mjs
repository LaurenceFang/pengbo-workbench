import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const candidateFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  encoding: "utf8",
})
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);

const forbiddenPathPatterns = [
  /^\.env(?:\.|$)/,
  /^\.pengbo-runtime(?:\/|$)/,
  /^\.playwright-mcp(?:\/|$)/,
  /^\.claude(?:\/|$)/,
  /^logs(?:\/|$)/,
  /^diagnostics(?:\/|$)/,
  /^reports(?:\/|$)/,
  /^dist(?:\/|$)/,
  /^node_modules(?:\/|$)/,
  /^src-tauri\/target(?:\/|$)/,
  /^src-tauri\/binaries(?:\/|$)/,
  /^src-tauri\/gen\/schemas(?:\/|$)/,
  /^credentials(?:\/|$)/,
  /^secrets(?:\/|$)/,
  /^stronghold(?:\/|$)/,
  /(^|\/)local-(?:credentials|secrets)/,
  /\.(?:key|pem|p12|pfx|stronghold|credential|secret|exe|msi|dll|pdb)$/i,
  /(?:^|\/)latest$/,
  /-browser-check\.png$/i,
  /-screenshot\.png$/i,
  /^claude-probe-debug\.log$/i,
];

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".py",
  ".rs",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

const sensitiveContentPatterns = [
  { name: "private key block", pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA |)?PRIVATE KEY-----/ },
  { name: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9_]{30,}/ },
  { name: "OpenAI key", pattern: /sk-[A-Za-z0-9_-]{32,}/ },
  { name: "assigned provider secret", pattern: /\b(?:PENGBO_|BINANCE_|FRED_|COINGECKO_)?(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)\s*=\s*['"][^'"]{8,}['"]/i },
];

const allowContentScanFiles = new Set([
  "docs/REPOSITORY_UPLOAD_READINESS.md",
  "README.md",
  "IMPLEMENTATION_TASKS.md",
]);

function isAllowedTestFixture(normalized, content, patternName) {
  if (!normalized.startsWith("backend/tests/") || patternName !== "assigned provider secret") {
    return false;
  }
  return /(?:fake|dummy|test|demo|sample|fred-key|demo-key)/i.test(content);
}

const failures = [];

for (const file of candidateFiles) {
  const normalized = file.replaceAll("\\", "/");
  for (const pattern of forbiddenPathPatterns) {
    if (pattern.test(normalized)) {
      failures.push(`Forbidden tracked path: ${file}`);
      break;
    }
  }

  const ext = path.extname(normalized).toLowerCase();
  if (!textExtensions.has(ext)) {
    continue;
  }

  const content = fs.readFileSync(path.join(repoRoot, file), "utf8");
  for (const { name, pattern } of sensitiveContentPatterns) {
    if (pattern.test(content)) {
      const allowed =
        (allowContentScanFiles.has(normalized) &&
          name === "assigned provider secret" &&
          /must not be committed|non-committable secret|handled as secrets/i.test(content)) ||
        isAllowedTestFixture(normalized, content, name);
      if (!allowed) {
        failures.push(`Potential ${name} in tracked file: ${file}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error("Public boundary check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Public boundary check OK: ${candidateFiles.length} candidate files scanned`);
