import fs from "node:fs";

const asset = fs.readFileSync("src/views/asset-view.tsx", "utf8");
const factor = fs.readFileSync("src/views/factor-lab-view.tsx", "utf8");
const registry = fs.readFileSync("src/routes/route-business-pages.tsx", "utf8");
const failures = [];
const expect = (value, message) => { if (!value) failures.push(message); };

for (const key of ["assetSearch", "assetOverview", "assetPrice", "assetFundamentals", "assetFilings", "assetData", "assetResearch"]) {
  expect(asset.includes(`\"${key}\"`), `AssetView routeSection is missing ${key}`);
  expect(registry.includes(`routeSection=\"${key}\"`), `route page registry does not pass Asset routeSection ${key}`);
}
expect(asset.includes("routeSection === \"assetPrice\""), "AssetView does not isolate the price page");
expect(asset.includes("routeSection === \"assetFundamentals\""), "AssetView does not isolate the fundamentals page");
expect(asset.includes("routeSection === \"assetFilings\""), "AssetView does not isolate the filings page");

for (const key of ["factorRunNew", "factorRuns", "factorResults", "factorAssetExplanation", "factorQuality", "factorHandoff"]) {
  expect(factor.includes(`\"${key}\"`), `FactorLabView routeSection is missing ${key}`);
  expect(registry.includes(`routeSection=\"${key}\"`), `route page registry does not pass Factor routeSection ${key}`);
}
expect(factor.includes("routeSection === \"factorRunNew\""), "FactorLabView does not isolate the new-run form");
expect(factor.includes("routeSection === \"factorRuns\""), "FactorLabView does not isolate run history");
expect(factor.includes("routeSection === \"factorResults\""), "FactorLabView does not isolate results");

if (failures.length) {
  console.error(`asset/factor subpage isolation failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({ passed: true, assetPages: 7, factorPages: 6 }, null, 2));
