import fs from "node:fs";

const cases = [
  {
    file: "src/views/strategy-lab-view.tsx",
    label: "StrategyLabView",
    typeName: "StrategyRouteSection",
    marker: "data-strategy-section",
    loadingFlags: ["needsStrategyTemplates", "needsFactorRuns", "needsBacktests", "needsPaperSessions", "needsExecution"],
    sections: ["strategies", "backtestNew", "backtestResult", "paperSession", "strategyExecution"],
  },
  {
    file: "src/views/workflow-studio-view.tsx",
    label: "WorkflowStudioView",
    typeName: "WorkflowRouteSection",
    marker: "data-workflow-section",
    loadingFlags: ["needsWorkflowTemplates", "needsWorkflowRuns"],
    sections: ["workflowCatalog", "workflowDetail", "workflowConfigure", "workflowRuns", "workflowRun", "workflowArtifacts"],
  },
  {
    file: "src/views/screeners-view.tsx",
    label: "ScreenersView",
    typeName: "ScreenerRouteSection",
    marker: "data-screener-section",
    loadingFlags: ["needsScreenerPresets", "needsScreenerVariants"],
    sections: ["screenerCatalog", "screenerVariant", "screenerTuning", "screenerUniverse"],
  },
];

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const testCase of cases) {
  const source = fs.readFileSync(testCase.file, "utf8");
  expect(source.includes(`export type ${testCase.typeName} =`), `${testCase.label} must export ${testCase.typeName}`);
  expect(source.includes(`routeSection?: ${testCase.typeName}`), `${testCase.label} must accept typed routeSection`);
  expect(source.includes(testCase.marker), `${testCase.label} must expose its mounted route section`);

  for (const section of testCase.sections) {
    expect(source.includes(`routeSection === "${section}"`), `${testCase.label} does not isolate ${section}`);
    expect(source.includes(`data-primary-task="${section}"`), `${testCase.label} is missing primary-task marker ${section}`);
  }

  for (const flag of testCase.loadingFlags) {
    expect(source.includes(`const ${flag} =`), `${testCase.label} is missing scoped loader flag ${flag}`);
    expect(source.includes(`enabled: sidecarReady && ${flag}`) || source.includes(`enabled: ${flag}`), `${testCase.label} does not use ${flag} to scope a loader`);
  }
}

const screenerSource = fs.readFileSync("src/views/screeners-view.tsx", "utf8");
expect(screenerSource.includes("function navigateToScreenerVariant"), "ScreenersView must keep create/delete actions URL-synchronized");
expect(screenerSource.includes("navigateToScreenerVariant(copied.variant_key)"), "created variants must open their own route");
expect(screenerSource.includes("navigateToScreenerVariant(\"default\")"), "deleted variants must recover to the system default route");

const strategySource = fs.readFileSync("src/views/strategy-lab-view.tsx", "utf8");
expect(!/const needsBacktests =[^\n]*backtestResult/.test(strategySource), "backtest result must load only its requested run, not the recent-run catalog");

if (failures.length) {
  console.error(`automation subpage isolation failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  passed: true,
  strategyPages: cases[0].sections.length,
  workflowPages: cases[1].sections.length,
  screenerPages: cases[2].sections.length,
}, null, 2));
