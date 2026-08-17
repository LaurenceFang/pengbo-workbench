import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/views/research-view.tsx", import.meta.url), "utf8");

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const sections = [
  "researchInbox",
  "researchDecision",
  "researchAssetData",
  "researchAnalysis",
  "researchEvidence",
  "researchAssistant",
  "researchNotes",
  "researchExport",
];

expect(source.includes("export type ResearchRouteSection ="), "ResearchView must export a typed route-section contract");
expect(source.includes("routeSection?: ResearchRouteSection"), "ResearchView must accept an optional typed routeSection prop");
expect(source.includes("data-research-section={routeSection ?? \"legacy\"}"), "ResearchView must expose the mounted subpage for runtime assertions");
expect(!source.includes("BriefPanelKey"), "Research subpages must not use the old in-page brief tab state");
expect(!source.includes("briefPanel"), "Research subpages must not use the old in-page brief tab state");
expect(
  source.includes('const activeBrief = routeSection === "researchInbox" ? null : brief.data;'),
  "The inbox must not retain a previously selected brief surface",
);
expect(
  source.includes('if (routeSection === "researchInbox")'),
  "Inbox refresh must reload the directory instead of refreshing a stale selected brief",
);

for (const section of sections) {
  expect(source.includes(`routeSection === "${section}"`), `ResearchView does not isolate ${section}`);
  expect(source.includes(`data-primary-task="${section}"`), `${section} does not expose a unique primary-task marker`);
}

console.log(`research-subpage-isolation: ${sections.length}/${sections.length} route sections declared and isolated`);
