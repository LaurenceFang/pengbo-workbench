import fs from "node:fs";

const cases = [
  {
    file: "src/views/command-center-view.tsx",
    label: "CommandCenterView",
    typeName: "CommandCenterRouteSection",
    marker: "data-command-section",
    sections: ["commandActions"],
  },
  {
    file: "src/views/watchlist-view.tsx",
    label: "WatchlistView",
    typeName: "WatchlistRouteSection",
    marker: "data-watchlist-section",
    sections: ["watchlistIndex"],
  },
  {
    file: "src/views/manual-view.tsx",
    label: "ManualView",
    typeName: "ManualRouteSection",
    marker: "data-manual-section",
    sections: [
      "manualGettingStarted",
      "manualResearchData",
      "manualStrategyWorkflows",
      "manualSecurityExecution",
      "manualTroubleshooting",
    ],
  },
];

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const testCase of cases) {
  const source = fs.readFileSync(testCase.file, "utf8");
  expect(source.includes(`export type ${testCase.typeName} =`), `${testCase.label} must export ${testCase.typeName}`);
  expect(source.includes(`routeSection?: ${testCase.typeName}`), `${testCase.label} must accept a typed routeSection`);
  expect(source.includes(testCase.marker), `${testCase.label} must expose the mounted route section`);
  expect(source.includes("data-primary-task={routeSection}"), `${testCase.label} must expose exactly one route-scoped primary workflow`);

  for (const section of testCase.sections) {
    expect(source.includes(`"${section}"`), `${testCase.label} is missing route section ${section}`);
  }
}

const manualSource = fs.readFileSync("src/views/manual-view.tsx", "utf8");
expect(!manualSource.includes("useState<ManualSectionKey>"), "ManualView still uses local tab state instead of the URL route section");
expect(!manualSource.includes("manual-tab-list"), "ManualView still mounts sibling manual chapters in a local tab list");
expect(manualSource.includes("enabled: routeSection === \"manualTroubleshooting\""), "Manual translation status must load only on troubleshooting");

if (failures.length) {
  console.error(`support subpage isolation failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  passed: true,
  commandPages: 1,
  watchlistPages: 1,
  manualPages: 5,
}, null, 2));
