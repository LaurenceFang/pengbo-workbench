import fs from "node:fs";
const dashboard = fs.readFileSync("src/views/dashboard-view.tsx", "utf8");
const routes = fs.readFileSync("src/routes/route-business-pages.tsx", "utf8");
const failures = [];
const expect = (value, message) => { if (!value) failures.push(message); };
for (const key of ["dashboardOverview", "dashboardRuntime"]) {
  expect(dashboard.includes(`\"${key}\"`), `DashboardView missing routeSection ${key}`);
  expect(routes.includes(`routeSection=\"${key}\"`), `route registry missing Dashboard routeSection ${key}`);
}
expect(!dashboard.includes('aria-label="dashboard-ai-control"'), "Dashboard still contains the stacked AI configuration workspace");
expect(dashboard.includes("onOpenAI"), "Dashboard is missing the lightweight AI route entry");
if (failures.length) {
  console.error(`dashboard subpage isolation failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(JSON.stringify({ passed: true, pages: 2, aiConfigMoved: true }, null, 2));
