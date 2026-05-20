import { existsSync, statSync } from "node:fs";
import { basename, normalize } from "node:path";

const requiredArtifacts = [
  "src-tauri/target/release/pengbo-workbench.exe",
  "src-tauri/target/release/bundle/msi/Pengbo Workbench_0.1.0_x64_en-US.msi",
  "src-tauri/target/release/bundle/nsis/Pengbo Workbench_0.1.0_x64-setup.exe",
];

const forbiddenFragments = [
  ".pengbo-runtime",
  "AppData",
  "Stronghold",
  "stronghold",
  "diagnostics",
  "logs",
  "sqlite",
  "duckdb",
  "credential",
  "secret",
  "session",
];

const failures = [];

for (const artifact of requiredArtifacts) {
  const normalized = normalize(artifact);
  if (!existsSync(normalized)) {
    failures.push(`Missing release artifact: ${artifact}`);
    continue;
  }
  const stats = statSync(normalized);
  if (!stats.isFile() || stats.size <= 0) {
    failures.push(`Invalid release artifact: ${artifact}`);
  }
  const name = basename(normalized);
  for (const fragment of forbiddenFragments) {
    if (name.toLowerCase().includes(fragment.toLowerCase())) {
      failures.push(`Release artifact name includes forbidden private-state fragment '${fragment}': ${artifact}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Release artifact check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Release artifact check OK: ${requiredArtifacts.length} approved Windows artifact(s) present`);
