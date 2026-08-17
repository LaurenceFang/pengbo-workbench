function resolveApiBaseUrl(webBaseUrl) {
  if (process.env.PENGBO_API_URL) return process.env.PENGBO_API_URL.replace(/\/$/, "");
  const url = new URL(webBaseUrl);
  if (["4190", "4173", "4175", "5173"].includes(url.port)) return `${url.protocol}//${url.hostname}:8765`;
  return webBaseUrl.replace(/\/$/, "");
}

async function apiJson(webBaseUrl, path, init = {}) {
  const response = await fetch(`${resolveApiBaseUrl(webBaseUrl)}/api/v1${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${response.status} ${detail}`);
  }
  return response.json();
}

export async function resolveEvidenceSamples(baseUrl) {
  const samples = {
    briefId: "brief-demo-001",
    factorRunId: "run-demo-001",
    backtestId: "backtest-demo-001",
    paperSessionId: "paper-demo-001",
    workflowRunId: "run-demo-001",
    seeded: false,
  };

  try {
    const security = await apiJson(baseUrl, "/security/local/status");
    if (!security.initialized || security.locked) return samples;

    const briefs = await apiJson(baseUrl, "/research/briefs/recent?limit=1").catch(() => []);
    if (briefs[0]?.brief_id) samples.briefId = briefs[0].brief_id;

    const factorRuns = await apiJson(baseUrl, "/factors/runs/recent?limit=20");
    const reusableFactorRun = factorRuns.find((run) => (run.diagnostics?.ranked_count ?? 0) > 0);
    const factorRun = reusableFactorRun ?? await apiJson(baseUrl, "/factors/runs", {
      method: "POST",
      body: JSON.stringify({ universeSource: "expanded", assetType: "equity", family: "composite" }),
    });
    samples.factorRunId = factorRun.run_id;

    const backtests = await apiJson(baseUrl, "/strategies/backtests/recent?limit=1");
    const backtest = backtests[0] ?? await apiJson(baseUrl, "/strategies/backtests", {
      method: "POST",
      body: JSON.stringify({
        templateKey: "top_n_factor_rotation",
        factorRunId: samples.factorRunId,
        topN: 5,
        rebalanceInterval: "monthly",
        initialCapital: 100000,
        maxPositionWeight: 0.25,
        cashReservePct: 0.05,
        benchmarkSymbol: "SPY",
        transactionCostBps: 5,
        slippageBps: 10,
      }),
    });
    samples.backtestId = backtest.run_id;

    const paperSessions = await apiJson(baseUrl, "/strategies/paper/sessions/recent?limit=1");
    const paperSession = paperSessions[0] ?? await apiJson(baseUrl, "/strategies/paper/sessions", {
      method: "POST",
      body: JSON.stringify({ backtestRunId: samples.backtestId, label: "M1 visual evidence" }),
    });
    samples.paperSessionId = paperSession.session_id;

    const workflowRuns = await apiJson(baseUrl, "/workflows/runs/recent?limit=1");
    const workflowRun = workflowRuns[0] ?? await apiJson(baseUrl, "/workflows/runs", {
      method: "POST",
      body: JSON.stringify({ templateKey: "factor_to_backtest", input: { factorRunId: samples.factorRunId } }),
    });
    samples.workflowRunId = workflowRun.run_id;
    samples.seeded = true;
  } catch (error) {
    samples.seedError = error instanceof Error ? error.message : String(error);
  }
  return samples;
}

export function sampleRoutePath(route, samples) {
  const runId = route.startsWith("/factor-lab/")
    ? samples.factorRunId
    : route.startsWith("/automation/workflows/")
      ? samples.workflowRunId
      : "run-demo-001";
  return route
    .replaceAll(":symbol", "AAPL")
    .replaceAll(":briefId", samples.briefId)
    .replaceAll(":runId", runId)
    .replaceAll(":backtestId", samples.backtestId)
    .replaceAll(":sessionId", samples.paperSessionId)
    .replaceAll(":resultId", "result-demo-001")
    .replaceAll(":listId", "default")
    .replaceAll(":provider", "local")
    .replaceAll(":templateId", "research-template")
    .replaceAll(":presetKey", "quality")
    .replaceAll(":variantKey", "default")
    .replaceAll(":id", "review-demo-001");
}
