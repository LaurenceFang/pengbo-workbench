import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";

const excludedPrefixes = [
  ".pengbo-",
  ".pengbo-runtime/",
  ".pyinstaller/",
  "dist/",
  "docs/",
  "logs/",
  "node_modules/",
  "src-tauri/target/",
];
const excludedFiles = new Set([
  "CHANGELOG.md",
  "IMPLEMENTATION_TASKS.md",
  "PLAN.md",
]);
const artifactPaths = [
  "src-tauri/binaries/pengbo-sidecar-x86_64-pc-windows-msvc.exe",
  "src-tauri/target/release/pengbo-workbench.exe",
  "src-tauri/target/release/bundle/msi/Pengbo Workbench_0.1.0_x64_en-US.msi",
  "src-tauri/target/release/bundle/nsis/Pengbo Workbench_0.1.0_x64-setup.exe",
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

const listed = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"])
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .map((path) => path.replaceAll("\\", "/"))
  .filter((path) => !excludedFiles.has(path))
  .filter((path) => !excludedPrefixes.some((prefix) => path.startsWith(prefix)))
  .sort();

const sourceFiles = [];
for (const path of listed) {
  const contents = await readFile(path);
  sourceFiles.push({ path, sizeBytes: contents.length, sha256: sha256(contents) });
}
const sourceManifestSha256 = sha256(Buffer.from(sourceFiles.map((file) => `${file.path}\0${file.sha256}`).join("\n")));

const artifacts = [];
for (const path of artifactPaths) {
  const [contents, metadata] = await Promise.all([readFile(path), stat(path)]);
  artifacts.push({ path, sizeBytes: contents.length, modifiedAt: metadata.mtime.toISOString(), sha256: sha256(contents) });
}

const result = {
  generatedAt: new Date().toISOString(),
  gitSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceDirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0,
  sourceScope: "runtime-and-build-files; planning docs and generated evidence excluded",
  sourceFileCount: sourceFiles.length,
  sourceManifestSha256,
  sourceFiles,
  artifacts,
};
await writeFile("logs/m1-release-manifest.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  sourceFileCount: result.sourceFileCount,
  sourceManifestSha256: result.sourceManifestSha256,
  artifacts: result.artifacts,
}, null, 2));
