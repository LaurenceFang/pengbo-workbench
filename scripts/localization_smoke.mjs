import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const checks = [
  {
    name: "backend preferences expose language and density",
    file: "backend/app/models.py",
    patterns: ['LanguagePreference = Literal["zh-CN", "en-US"]', 'DensityPreference = Literal["standard", "compact"]'],
  },
  {
    name: "settings service persists language and density",
    file: "backend/app/services/settings_service.py",
    patterns: ['language="zh-CN"', 'density="standard"', '"language"', '"density"'],
  },
  {
    name: "frontend API contract includes language and density",
    file: "src/lib/api.ts",
    patterns: ['language: "zh-CN" | "en-US"', 'density: "standard" | "compact"'],
  },
  {
    name: "store carries current locale state",
    file: "src/store/app-store.ts",
    patterns: ['language: "zh-CN"', 'density: "standard"', "setLanguage", "setDensity"],
  },
  {
    name: "typed dictionary covers zh-CN and en-US",
    file: "src/i18n/index.ts",
    patterns: ['"zh-CN"', '"en-US"', "viewLabels", "useI18n"],
  },
  {
    name: "AppShell applies persisted density",
    file: "src/components/app-shell.tsx",
    patterns: ['density-${density}'],
  },
  {
    name: "App composition keeps toolbar automation anchors",
    file: "src/App.tsx",
    patterns: ['aria-label="search-asset"', 'aria-label="open-command-palette"'],
  },
  {
    name: "grouped sidebar keeps view automation anchors",
    file: "src/components/app-sidebar.tsx",
    patterns: ['aria-label={`nav-${item.viewKey}`}'],
  },
  {
    name: "settings view exposes language and density controls",
    file: "src/views/settings-view.tsx",
    patterns: ['value={form.language}', 'value={form.density}', 'setLanguage(language)', 'setDensity(density)'],
  },
];

const failures = [];
for (const check of checks) {
  const content = read(check.file);
  for (const pattern of check.patterns) {
    if (!content.includes(pattern)) {
      failures.push(`${check.name}: missing ${pattern} in ${check.file}`);
    }
  }
}

const result = {
  generated_at: new Date().toISOString(),
  check_count: checks.length,
  failures,
};

const logsDir = path.join(root, "logs");
fs.mkdirSync(logsDir, { recursive: true });
fs.writeFileSync(path.join(logsDir, "localization-smoke-latest.json"), JSON.stringify(result, null, 2));

if (failures.length > 0) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
