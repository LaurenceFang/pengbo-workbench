import { writeFile } from "node:fs/promises";
import { frameRouteRegistry } from "../src/routes/route-registry.ts";

const orderedStates = [
  "loading",
  "empty",
  "blocked",
  "error",
  "locked",
  "ready",
  "ai-insufficient-evidence",
  "cloud-opt-in",
  "recovery",
];

function expectedStatesFor(route) {
  if (route.availability.kind === "planned") {
    return ["blocked", "recovery"];
  }

  const expected = new Set(["loading", "empty", "error", "ready", "recovery"]);
  if (route.accessPolicy === "local_unlock") {
    expected.add("blocked");
    expected.add("locked");
  }
  if (route.aiPolicy.mode !== "none") {
    if (route.aiPolicy.availability.kind === "available") {
      expected.add("ai-insufficient-evidence");
      expected.add("cloud-opt-in");
    }
  }
  return orderedStates.filter((state) => expected.has(state));
}

const records = frameRouteRegistry.map((route) => {
  const expectedStates = expectedStatesFor(route);
  const supportedStates = [...route.supportedStates];
  const failures = [];
  if (new Set(supportedStates).size !== supportedStates.length) failures.push("duplicate supported state");
  if (supportedStates.join("|") !== expectedStates.join("|")) {
    failures.push(`expected ${expectedStates.join(" / ")}, found ${supportedStates.join(" / ")}`);
  }
  if (route.accessPolicy === "public" && supportedStates.includes("locked")) failures.push("public route advertises locked");
  if (route.availability.kind === "planned" && supportedStates.includes("ready")) failures.push("planned route advertises ready");
  if (route.actionPolicy === "explicit_confirmation" && route.accessPolicy !== "local_unlock") {
    failures.push("explicit confirmation route does not require local unlock");
  }
  return {
    frameNo: route.frameNo,
    frameId: route.frameId,
    route: route.svgRoute,
    availability: route.availability,
    accessPolicy: route.accessPolicy,
    actionPolicy: route.actionPolicy,
    aiPolicy: route.aiPolicy,
    supportedStates,
    expectedStates,
    failures,
    passed: failures.length === 0,
  };
});

const failures = records.flatMap((record) => record.failures.map((failure) => `${record.frameId} ${record.route}: ${failure}`));
const result = {
  generatedAt: new Date().toISOString(),
  routeCount: records.length,
  passedCount: records.filter((record) => record.passed).length,
  failureCount: failures.length,
  failures,
  records,
  passed: records.length === 79 && failures.length === 0,
};

await writeFile("logs/t105-route-state-matrix.json", `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  routeCount: result.routeCount,
  passedCount: result.passedCount,
  failureCount: result.failureCount,
  failures: result.failures.slice(0, 12),
  passed: result.passed,
}, null, 2));
if (!result.passed) process.exitCode = 1;
