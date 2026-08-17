import { readFile } from "node:fs/promises";

const checks = {
  "src/components/ui-kit.tsx": ["RoutePageFrame", "PageHeader", "SubrouteNav", "Button", "IconButton", "Input", "SearchField", "SegmentedControl", "Sheet", "Popover", "Tooltip", "Badge", "StateBlock", "AITrigger", "HandoffAction", "ContextInspector", "InspectorContext"],
  "src/components/shared.tsx": ["EmptyState"],
  "src/styles.css": [".ui-data-table", ".ui-inspector-panel", ".ui-empty-state"],
};
const missing = [];
for (const [file, required] of Object.entries(checks)) {
  const source = await readFile(file, "utf8");
  for (const marker of required) if (!source.includes(marker)) missing.push(`${file}: ${marker}`);
}
const files = Object.keys(checks);
const result = { scope: "T102-T106", files, missing, passed: missing.length === 0 };
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
