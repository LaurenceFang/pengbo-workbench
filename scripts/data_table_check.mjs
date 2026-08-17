import { readFile } from "node:fs/promises";

const source = await readFile("src/components/data-table.tsx", "utf8").catch(() => "");
const required = [
  "DataTableColumn",
  "sortValue",
  "filterValue",
  "selectedRowKey",
  "onSelectRow",
  "onOpenInspector",
  "onOpenAI",
  "inspectorContext",
  "data-inspector-route-id",
  "virtualized",
  "aria-sort",
  "aria-selected",
  "loading",
  "locked",
  "degraded",
  "blocked",
  "onRetry",
  "dataSource",
  "freshness",
  "aria-label={ariaLabel",
];
const missing = required.filter((marker) => !source.includes(marker));
const result = { scope: "T103", source: "src/components/data-table.tsx", missing, passed: missing.length === 0 };
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
