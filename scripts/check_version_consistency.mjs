import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function matchVersion(relativePath, pattern, label) {
  const text = readText(relativePath);
  const match = text.match(pattern);
  if (!match) {
    throw new Error(`Could not find ${label} in ${relativePath}`);
  }
  return match[1];
}

const packageVersion = readJson("package.json").version;
const versions = {
  "package.json": packageVersion,
  "package-lock.json": readJson("package-lock.json").packages[""].version,
  "src-tauri/tauri.conf.json": readJson("src-tauri/tauri.conf.json").version,
  "src-tauri/Cargo.toml": matchVersion("src-tauri/Cargo.toml", /^version\s*=\s*"([^"]+)"/m, "package version"),
  "backend/app/version.py APP_VERSION": matchVersion(
    "backend/app/version.py",
    /^APP_VERSION\s*=\s*"([^"]+)"/m,
    "APP_VERSION",
  ),
};

const sidecarAlias = readText("backend/app/version.py").match(/^SIDECAR_VERSION\s*=\s*APP_VERSION\s*$/m);
if (!sidecarAlias) {
  throw new Error("SIDECAR_VERSION must alias APP_VERSION in backend/app/version.py");
}
versions["backend/app/version.py SIDECAR_VERSION"] = packageVersion;

const mismatches = Object.entries(versions).filter(([, value]) => value !== packageVersion);

if (mismatches.length > 0) {
  console.error("Version mismatch detected:");
  for (const [source, value] of Object.entries(versions)) {
    console.error(`- ${source}: ${value}`);
  }
  process.exit(1);
}

console.log(`Pengbo version consistency OK: ${packageVersion}`);
