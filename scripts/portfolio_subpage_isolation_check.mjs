import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/views/portfolio-view.tsx", import.meta.url), "utf8");

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const sections = [
  "portfolioOverview",
  "portfolioHoldings",
  "portfolioAllocation",
  "portfolioAnalytics",
  "portfolioRisk",
  "portfolioTransactions",
  "portfolioTransactionNew",
  "portfolioHandoff",
];

expect(source.includes("export type PortfolioRouteSection ="), "PortfolioView must export a typed route-section contract");
expect(source.includes("routeSection?: PortfolioRouteSection"), "PortfolioView must accept an optional typed routeSection prop");
expect(source.includes('data-portfolio-section={routeSection ?? "legacy"}'), "PortfolioView must expose the mounted subpage for runtime assertions");

for (const section of sections) {
  expect(source.includes(`routeSection === "${section}"`), `PortfolioView does not isolate ${section}`);
}

expect(
  source.match(/data-primary-task=\{routeSection\}/g)?.length === 7,
  "Each isolated Portfolio workflow must expose the active route as its primary-task marker",
);

expect(source.includes("summaryEnabled"), "PortfolioView must scope summary loading to summary-backed subpages");
expect(source.includes("holdingsEnabled"), "PortfolioView must scope holdings loading to the holdings subpage");
expect(source.includes("transactionsEnabled"), "PortfolioView must scope transaction loading to transaction history");
expect(
  source.includes('routeSection === "portfolioTransactions" && editing !== null'),
  "Transaction history edits must replace the list with the existing editor instead of becoming an invisible action",
);
expect(
  source.includes('routeSection === "portfolioTransactions" && editing === null'),
  "Transaction history must return after the editor is reset",
);
expect(
  source.includes('routeSection !== "portfolioTransactions"'),
  "An edit selected in transaction history must not leak into new-transaction or handoff routes",
);

console.log(`portfolio-subpage-isolation: ${sections.length}/${sections.length} route sections declared and isolated`);
