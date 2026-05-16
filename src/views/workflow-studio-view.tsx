import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  GitBranch,
  Play,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InlineState, PanelState, type BackendStatus } from "../components/shared";
import { useAsyncResource } from "../hooks/use-async-resource";
import {
  api,
  type ScreenerUniverseSource,
  type WorkflowActionPolicy,
  type WorkflowArtifactRef,
  type WorkflowRunResponse,
  type WorkflowRunStatus,
  type WorkflowStepStatus,
  type WorkflowTemplateDefinition,
  type WorkflowTemplateKey,
} from "../lib/api";
import { useAppStore } from "../store/app-store";

type WorkflowInputValue = string | number | boolean | null;
type WorkflowInput = Record<string, WorkflowInputValue>;
type FieldType = "text" | "number" | "select";

type FieldConfig = {
  key: string;
  label: string;
  type: FieldType;
  optional?: boolean;
  step?: number;
  options?: Array<{ value: string; label: string }>;
};

type Copy = {
  eyebrow: string;
  title: string;
  intro: string;
  templates: string;
  input: string;
  timeline: string;
  artifacts: string;
  recent: string;
  run: string;
  running: string;
  reload: string;
  emptyRunTitle: string;
  emptyRunCopy: string;
  manualTitle: string;
  manualCopy: string;
  blockedTitle: string;
  noSubmit: string;
  open: string;
  noArtifacts: string;
  audit: string;
  optional: string;
};

const COPY: Record<"zh-CN" | "en-US", Copy> = {
  "zh-CN": {
    eyebrow: "Workflow Studio",
    title: "模板化工作流编排",
    intro: "从一个桌面工作区运行筛选、研究、因子、回测、纸面交易、Binance intent 和证据导出，并保留步骤与审计记录。",
    templates: "模板目录",
    input: "输入参数",
    timeline: "步骤时间线",
    artifacts: "产物与证据",
    recent: "最近运行",
    run: "运行工作流",
    running: "运行中...",
    reload: "刷新",
    emptyRunTitle: "还没有工作流运行",
    emptyRunCopy: "选择一个模板并运行后，这里会显示步骤、阻塞原因、手动确认边界和产物链接。",
    manualTitle: "需要用户确认",
    manualCopy: "工作流已经准备好 Binance intent，但不会提交订单。提交必须在受保护的确认界面由用户显式批准。",
    blockedTitle: "阻塞原因",
    noSubmit: "T43 UI 不会调用 Binance submit、不会改 live mode、不会清除 kill switch、不会代替用户确认风险。",
    open: "打开",
    noArtifacts: "当前运行还没有可跳转产物。",
    audit: "审计事件",
    optional: "可选",
  },
  "en-US": {
    eyebrow: "Workflow Studio",
    title: "Template workflow orchestration",
    intro: "Run screener, research, factor, backtest, paper, Binance intent, and evidence export flows from one desktop workspace with step and audit evidence.",
    templates: "Template catalog",
    input: "Inputs",
    timeline: "Step timeline",
    artifacts: "Artifacts and evidence",
    recent: "Recent runs",
    run: "Run workflow",
    running: "Running...",
    reload: "Refresh",
    emptyRunTitle: "No workflow run yet",
    emptyRunCopy: "Select and run a template to inspect steps, blocked reasons, manual-confirmation boundaries, and artifact links.",
    manualTitle: "User confirmation required",
    manualCopy: "The workflow prepared a Binance intent, but no order is submitted. Submit still requires explicit approval in a protected confirmation surface.",
    blockedTitle: "Blocked reasons",
    noSubmit: "The T43 UI does not call Binance submit, change live mode, clear kill switches, or acknowledge risk for the user.",
    open: "Open",
    noArtifacts: "This run has no navigable artifact yet.",
    audit: "Audit events",
    optional: "Optional",
  },
};

const TEMPLATE_INPUTS: Record<WorkflowTemplateKey, WorkflowInput> = {
  screener_to_research: {
    preset: "quality-equities",
    universeSource: "expanded",
    assetType: "equity",
    symbol: "AAPL",
    variantKey: "",
  },
  data_sources_to_research: {
    dataSourceKind: "macro",
    dataSourceProvider: "worldbank",
    seriesId: "NY.GDP.MKTP.CD",
    country: "CN",
    symbol: "AAPL",
    query: "AAPL",
    cryptoIds: "bitcoin,ethereum",
    limit: 5,
  },
  research_to_factor: {
    symbol: "AAPL",
    universeSource: "expanded",
    assetType: "equity",
    family: "composite",
  },
  factor_to_backtest: {
    factorRunId: "",
    universeSource: "expanded",
    assetType: "equity",
    family: "composite",
    topN: 5,
    benchmarkSymbol: "SPY",
  },
  backtest_to_paper: {
    backtestRunId: "",
    factorRunId: "",
    topN: 5,
    paperLabel: "Workflow paper session",
  },
  paper_to_binance_intent: {
    paperSessionId: "",
    backtestRunId: "",
    symbol: "BTC/USDT",
    side: "buy",
    quantity: 0.01,
    orderType: "market",
    clientOrderId: "",
  },
  evidence_report_export: {
    artifactId: "",
    artifactType: "paper_session",
  },
};

const FIELD_CONFIG: Record<WorkflowTemplateKey, FieldConfig[]> = {
  screener_to_research: [
    { key: "preset", label: "Preset", type: "text" },
    { key: "universeSource", label: "Universe", type: "select", options: universeOptions() },
    { key: "assetType", label: "Asset type", type: "select", options: assetTypeOptions() },
    { key: "symbol", label: "Selected symbol", type: "text", optional: true },
    { key: "variantKey", label: "Variant key", type: "text", optional: true },
  ],
  data_sources_to_research: [
    { key: "dataSourceKind", label: "Source kind", type: "select", options: dataSourceKindOptions() },
    { key: "dataSourceProvider", label: "Provider", type: "select", options: dataSourceProviderOptions() },
    { key: "seriesId", label: "Macro series", type: "text", optional: true },
    { key: "country", label: "Country", type: "text", optional: true },
    { key: "query", label: "News query", type: "text", optional: true },
    { key: "cryptoIds", label: "Crypto ids", type: "text", optional: true },
    { key: "symbol", label: "Research symbol", type: "text" },
    { key: "limit", label: "Sample limit", type: "number", step: 1 },
  ],
  research_to_factor: [
    { key: "symbol", label: "Symbol", type: "text" },
    { key: "universeSource", label: "Universe", type: "select", options: universeOptions() },
    { key: "assetType", label: "Asset type", type: "select", options: assetTypeOptions() },
    { key: "family", label: "Factor family", type: "select", options: factorFamilyOptions() },
  ],
  factor_to_backtest: [
    { key: "factorRunId", label: "Existing factor run", type: "text", optional: true },
    { key: "universeSource", label: "Universe", type: "select", options: universeOptions() },
    { key: "assetType", label: "Asset type", type: "select", options: assetTypeOptions() },
    { key: "family", label: "Factor family", type: "select", options: factorFamilyOptions() },
    { key: "topN", label: "Top N", type: "number", step: 1 },
    { key: "benchmarkSymbol", label: "Benchmark", type: "text" },
  ],
  backtest_to_paper: [
    { key: "backtestRunId", label: "Existing backtest", type: "text", optional: true },
    { key: "factorRunId", label: "Existing factor run", type: "text", optional: true },
    { key: "topN", label: "Top N", type: "number", step: 1 },
    { key: "paperLabel", label: "Paper label", type: "text", optional: true },
  ],
  paper_to_binance_intent: [
    { key: "paperSessionId", label: "Existing paper session", type: "text", optional: true },
    { key: "backtestRunId", label: "Existing backtest", type: "text", optional: true },
    { key: "symbol", label: "Binance symbol", type: "text" },
    { key: "side", label: "Side", type: "select", options: sideOptions() },
    { key: "quantity", label: "Quantity", type: "number", step: 0.0001 },
    { key: "orderType", label: "Order type", type: "select", options: orderTypeOptions() },
    { key: "clientOrderId", label: "Client order id", type: "text", optional: true },
  ],
  evidence_report_export: [
    { key: "artifactId", label: "Artifact id", type: "text", optional: true },
    { key: "artifactType", label: "Artifact type", type: "select", options: artifactTypeOptions() },
  ],
};

function universeOptions() {
  return [
    { value: "expanded", label: "expanded" },
    { value: "catalog", label: "catalog" },
  ];
}

function assetTypeOptions() {
  return [
    { value: "equity", label: "equity" },
    { value: "crypto", label: "crypto" },
  ];
}

function dataSourceKindOptions() {
  return [
    { value: "macro", label: "macro" },
    { value: "news", label: "news" },
    { value: "crypto", label: "crypto" },
  ];
}

function dataSourceProviderOptions() {
  return [
    { value: "worldbank", label: "worldbank" },
    { value: "dbnomics", label: "dbnomics" },
    { value: "rss_events", label: "rss_events" },
    { value: "fred", label: "fred" },
    { value: "coingecko", label: "coingecko" },
  ];
}

function sideOptions() {
  return [
    { value: "buy", label: "buy" },
    { value: "sell", label: "sell" },
  ];
}

function orderTypeOptions() {
  return [
    { value: "market", label: "market" },
    { value: "limit", label: "limit" },
  ];
}

function artifactTypeOptions() {
  return [
    { value: "paper_session", label: "paper_session" },
    { value: "backtest", label: "backtest" },
    { value: "research_brief", label: "research_brief" },
  ];
}

function factorFamilyOptions() {
  return [
    { value: "composite", label: "composite" },
    { value: "momentum_12_1", label: "momentum_12_1" },
    { value: "value", label: "value" },
    { value: "quality_profitability", label: "quality_profitability" },
    { value: "conservative_growth", label: "conservative_growth" },
    { value: "low_volatility_risk", label: "low_volatility_risk" },
  ];
}

function policyLabel(policy: WorkflowActionPolicy): string {
  return policy.replaceAll("_", " ");
}

function statusTone(status: WorkflowRunStatus | WorkflowStepStatus): string {
  if (status === "completed") {
    return "status-ok";
  }
  if (status === "blocked" || status === "manual_required") {
    return "status-cached";
  }
  if (status === "failed") {
    return "status-error";
  }
  return "status-planned";
}

function valueToString(value: WorkflowInputValue): string {
  if (value === null) {
    return "";
  }
  return String(value);
}

function cleanInput(input: WorkflowInput): WorkflowInput {
  return Object.fromEntries(
    Object.entries(input)
      .filter(([, value]) => value !== "" && value !== null)
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]),
  );
}

export function WorkflowStudioView({ backendStatus }: { backendStatus: BackendStatus }) {
  const sidecarReady = backendStatus === "online";
  const language = useAppStore((state) => state.language);
  const copy = COPY[language];
  const selectedWorkflowRunId = useAppStore((state) => state.selectedWorkflowRunId);
  const setSelectedWorkflowRunId = useAppStore((state) => state.setSelectedWorkflowRunId);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const setSelectedResearchBriefId = useAppStore((state) => state.setSelectedResearchBriefId);
  const setSelectedFactorRunId = useAppStore((state) => state.setSelectedFactorRunId);
  const setLastFactorRunResult = useAppStore((state) => state.setLastFactorRunResult);
  const setSelectedStrategyBacktestId = useAppStore((state) => state.setSelectedStrategyBacktestId);
  const setLastStrategyBacktestResult = useAppStore((state) => state.setLastStrategyBacktestResult);
  const setSelectedStrategyPaperSessionId = useAppStore((state) => state.setSelectedStrategyPaperSessionId);
  const setLastStrategyPaperSession = useAppStore((state) => state.setLastStrategyPaperSession);
  const setLatestCommandFeedback = useAppStore((state) => state.setLatestCommandFeedback);
  const templates = useAsyncResource<WorkflowTemplateDefinition[]>(async () => api.getWorkflowTemplates(), [], {
    enabled: sidecarReady,
  });
  const recentRuns = useAsyncResource<WorkflowRunResponse[]>(async () => api.getRecentWorkflowRuns(12), [], {
    enabled: sidecarReady,
  });
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<WorkflowTemplateKey>("screener_to_research");
  const [input, setInput] = useState<WorkflowInput>(TEMPLATE_INPUTS.screener_to_research);
  const [activeRun, setActiveRun] = useState<WorkflowRunResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.data?.find((item) => item.template_key === selectedTemplateKey) ?? templates.data?.[0] ?? null,
    [selectedTemplateKey, templates.data],
  );

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }
    if (selectedTemplate.template_key !== selectedTemplateKey) {
      setSelectedTemplateKey(selectedTemplate.template_key);
      setInput(TEMPLATE_INPUTS[selectedTemplate.template_key]);
    }
  }, [selectedTemplate, selectedTemplateKey]);

  useEffect(() => {
    if (!selectedWorkflowRunId || activeRun?.run_id === selectedWorkflowRunId || !sidecarReady) {
      return;
    }
    let cancelled = false;
    void api
      .getWorkflowRun(selectedWorkflowRunId)
      .then((run) => {
        if (!cancelled) {
          setActiveRun(run);
          setSelectedTemplateKey(run.template_key);
          setInput({ ...TEMPLATE_INPUTS[run.template_key], ...run.input } as WorkflowInput);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeRun?.run_id, selectedWorkflowRunId, sidecarReady]);

  function selectTemplate(templateKey: WorkflowTemplateKey) {
    setSelectedTemplateKey(templateKey);
    setInput(TEMPLATE_INPUTS[templateKey]);
    setActionError(null);
  }

  function updateInput(field: FieldConfig, rawValue: string) {
    setInput((current) => ({
      ...current,
      [field.key]: field.type === "number" ? Number(rawValue) : rawValue,
    }));
  }

  async function runWorkflow() {
    if (!selectedTemplate) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const run = await api.createWorkflowRun({
        templateKey: selectedTemplate.template_key,
        input: cleanInput(input),
      });
      setActiveRun(run);
      setSelectedWorkflowRunId(run.run_id);
      recentRuns.reload();
      setLatestCommandFeedback({
        tone: run.status === "failed" ? "error" : "success",
        title: `Workflow ${run.status}`,
        detail: run.run_id,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Workflow run failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openRecentRun(runId: string) {
    setBusy(true);
    setActionError(null);
    try {
      const run = await api.getWorkflowRun(runId);
      setActiveRun(run);
      setSelectedWorkflowRunId(run.run_id);
      setSelectedTemplateKey(run.template_key);
      setInput({ ...TEMPLATE_INPUTS[run.template_key], ...run.input } as WorkflowInput);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to open workflow run.");
    } finally {
      setBusy(false);
    }
  }

  async function openArtifact(ref: WorkflowArtifactRef) {
    setBusy(true);
    setActionError(null);
    try {
      if (ref.artifact_type === "research_brief") {
        setSelectedResearchBriefId(ref.artifact_id);
        setActiveView("research");
      } else if (ref.artifact_type === "factor_run") {
        const run = await api.getFactorRun(ref.artifact_id);
        setSelectedFactorRunId(run.run_id);
        setLastFactorRunResult(run);
        setActiveView("factorLab");
      } else if (ref.artifact_type === "strategy_backtest") {
        const run = await api.getStrategyBacktest(ref.artifact_id);
        setSelectedStrategyBacktestId(run.run_id);
        setLastStrategyBacktestResult(run);
        setActiveView("strategyLab");
      } else if (ref.artifact_type === "paper_session") {
        const session = await api.getStrategyPaperSession(ref.artifact_id);
        setSelectedStrategyPaperSessionId(session.session_id);
        setLastStrategyPaperSession(session);
        setActiveView("strategyLab");
      } else if (ref.artifact_type === "binance_intent") {
        setActiveView("strategyLab");
        setLatestCommandFeedback({
          tone: "success",
          title: "Opened Binance intent context",
          detail: `${ref.artifact_id} remains confirmation-gated; no submit was called.`,
        });
      } else {
        setLatestCommandFeedback({
          tone: "success",
          title: "Workflow artifact",
          detail: `${ref.label}: ${ref.artifact_id}`,
        });
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to open workflow artifact.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      aria-label={`workflow-studio-view template=${selectedTemplateKey} run=${activeRun?.run_id ?? "none"} status=${activeRun?.status ?? "empty"}`}
      className="stack-layout"
    >
      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h3>{copy.title}</h3>
          </div>
          <button className="ghost-button" disabled={!sidecarReady} onClick={recentRuns.reload} type="button">
            <RefreshCcw size={16} />
            {copy.reload}
          </button>
        </div>
        <p className="body-copy">{copy.intro}</p>
        {!sidecarReady ? <InlineState label="Workflow Studio is waiting for the local sidecar." /> : null}
      </section>

      <section className="workflow-studio-grid">
        <div className="workflow-column">
          <PanelHeader title={copy.templates} count={templates.data?.length ?? 0} />
          {templates.loading && !templates.data ? <InlineState label="Loading workflow templates..." /> : null}
          {templates.error ? <InlineState label={templates.error} actionLabel={copy.reload} onAction={templates.reload} /> : null}
          <div className="workflow-template-list">
            {(templates.data ?? []).map((template) => (
              <button
                aria-label={`workflow-template key=${template.template_key} selected=${String(template.template_key === selectedTemplateKey)}`}
                className={`variant-card workflow-template-card ${template.template_key === selectedTemplateKey ? "selected" : ""}`}
                key={template.template_key}
                onClick={() => selectTemplate(template.template_key)}
                type="button"
              >
                <div className="variant-card-head">
                  <strong>{template.title}</strong>
                  <span className="mini-pill">{template.steps.length}</span>
                </div>
                <p>{template.description}</p>
                <div className="analysis-card-pills">
                  {template.steps.map((step) => (
                    <span className="mini-pill" key={step.step_key}>
                      {policyLabel(step.policy)}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="workflow-column">
          <PanelHeader title={copy.input} count={FIELD_CONFIG[selectedTemplateKey].length} />
          <div className="research-panel">
            {selectedTemplate ? (
              <>
                <div className="screeners-column-head">
                  <div>
                    <p className="eyebrow">{selectedTemplate.template_key}</p>
                    <strong>{selectedTemplate.title}</strong>
                  </div>
                  <span className="mini-pill">{selectedTemplate.steps.length} steps</span>
                </div>
                <div className="form-grid two-up workflow-input-grid">
                  {FIELD_CONFIG[selectedTemplate.template_key].map((field) => (
                    <label className="field" key={field.key}>
                      <span>
                        {field.label} {field.optional ? <small className="field-note">({copy.optional})</small> : null}
                      </span>
                      {field.type === "select" ? (
                        <select
                          aria-label={`workflow-input ${field.key}`}
                          value={valueToString(input[field.key])}
                          onChange={(event) => updateInput(field, event.target.value)}
                        >
                          {(field.options ?? []).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          aria-label={`workflow-input ${field.key}`}
                          min={field.type === "number" ? 0 : undefined}
                          step={field.step}
                          type={field.type}
                          value={valueToString(input[field.key])}
                          onChange={(event) => updateInput(field, event.target.value)}
                        />
                      )}
                    </label>
                  ))}
                </div>
                <div className="form-actions">
                  <button
                    aria-label={`workflow-run-submit template=${selectedTemplate.template_key}`}
                    className="primary-button"
                    disabled={busy || !sidecarReady}
                    onClick={runWorkflow}
                    type="button"
                  >
                    <Play size={16} />
                    {busy ? copy.running : copy.run}
                  </button>
                </div>
                {actionError ? <InlineState label={actionError} /> : null}
              </>
            ) : (
              <InlineState label="No workflow templates are available." />
            )}
          </div>
        </div>

        <div className="workflow-column">
          <PanelHeader title={copy.recent} count={recentRuns.data?.length ?? 0} />
          {recentRuns.loading && !recentRuns.data ? <InlineState label="Loading recent workflow runs..." /> : null}
          {recentRuns.error ? <InlineState label={recentRuns.error} actionLabel={copy.reload} onAction={recentRuns.reload} /> : null}
          <div className="research-list">
            {(recentRuns.data ?? []).map((run) => (
              <button
                aria-label={`workflow-recent-run id=${run.run_id} status=${run.status}`}
                className={`variant-card workflow-recent-card ${run.run_id === (activeRun?.run_id ?? selectedWorkflowRunId) ? "selected" : ""}`}
                key={run.run_id}
                onClick={() => void openRecentRun(run.run_id)}
                type="button"
              >
                <div className="variant-card-head">
                  <strong>{run.template_key}</strong>
                  <span className={`mini-pill ${statusTone(run.status)}`}>{run.status}</span>
                </div>
                <p>{run.run_id}</p>
                <small>{new Date(run.updated_at).toLocaleString(language)}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      {activeRun ? (
        <section className="workflow-run-grid">
          <div className="research-panel">
            <PanelHeader title={copy.timeline} count={activeRun.steps.length} />
            <div className="workflow-step-list">
              {activeRun.steps.map((step, index) => (
                <article
                  aria-label={`workflow-step key=${step.step_key} status=${step.status} policy=${step.policy}`}
                  className="analysis-card workflow-step-card"
                  key={`${step.step_key}-${index}`}
                >
                  <div className="analysis-card-head">
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.step_key}</p>
                    </div>
                    <span className={`mini-pill ${statusTone(step.status)}`}>{step.status}</span>
                  </div>
                  <div className="analysis-card-pills">
                    <span className="mini-pill">{policyLabel(step.policy)}</span>
                    {step.completed_at ? <span className="mini-pill">{new Date(step.completed_at).toLocaleTimeString(language)}</span> : null}
                    {step.artifact_refs.length > 0 ? <span className="mini-pill">{step.artifact_refs.length} artifacts</span> : null}
                  </div>
                  {step.blocked_reasons.length > 0 ? (
                    <div className="task-list">
                      {step.blocked_reasons.map((reason) => (
                        <div className="task-item" key={reason}>
                          <AlertTriangle size={16} />
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {step.error ? <InlineState label={step.error} /> : null}
                </article>
              ))}
            </div>
          </div>

          <div className="workflow-side-rail">
            <section className="research-panel">
              <PanelHeader title={copy.artifacts} count={activeRun.artifact_refs.length} />
              {activeRun.artifact_refs.length === 0 ? <InlineState label={copy.noArtifacts} /> : null}
              <div className="research-list">
                {activeRun.artifact_refs.map((ref) => (
                  <button
                    aria-label={`workflow-artifact type=${ref.artifact_type} id=${ref.artifact_id}`}
                    className="variant-card workflow-artifact-card"
                    key={`${ref.artifact_type}-${ref.artifact_id}-${ref.source_step_key ?? "run"}`}
                    onClick={() => void openArtifact(ref)}
                    type="button"
                  >
                    <div className="variant-card-head">
                      <strong>{ref.label}</strong>
                      <ExternalLink size={16} />
                    </div>
                    <p>{ref.artifact_id}</p>
                    <span className="mini-pill">{ref.artifact_type}</span>
                  </button>
                ))}
              </div>
            </section>

            {activeRun.manual_confirmation_required ? (
              <section
                aria-label={`workflow-manual-boundary run=${activeRun.run_id} policy=${activeRun.manual_confirmation_policy ?? "none"}`}
                className="research-panel workflow-manual-panel"
              >
                <div className="screeners-column-head">
                  <div>
                    <p className="eyebrow">Manual boundary</p>
                    <strong>{copy.manualTitle}</strong>
                  </div>
                  <ShieldAlert size={20} />
                </div>
                <p className="panel-note">{copy.manualCopy}</p>
                <div className="task-item">
                  <CheckCircle2 size={16} />
                  <span>{copy.noSubmit}</span>
                </div>
              </section>
            ) : null}

            {activeRun.blocked_reasons.length > 0 ? (
              <section className="research-panel">
                <PanelHeader title={copy.blockedTitle} count={activeRun.blocked_reasons.length} />
                <div className="task-list">
                  {activeRun.blocked_reasons.map((reason) => (
                    <div className="task-item" key={reason}>
                      <AlertTriangle size={16} />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="research-panel">
              <PanelHeader title={copy.audit} count={activeRun.audit_events.length} />
              <div className="research-list">
                {activeRun.audit_events.slice(0, 8).map((event) => (
                  <article className="analysis-card" key={event.event_id}>
                    <div className="analysis-card-head">
                      <strong>{event.event_type}</strong>
                      <span className="mini-pill">{new Date(event.created_at).toLocaleTimeString(language)}</span>
                    </div>
                    <p>{event.summary}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      ) : (
        <section className="card">
          <PanelState title={copy.emptyRunTitle} copy={copy.emptyRunCopy} />
        </section>
      )}
    </div>
  );
}

function PanelHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="screeners-column-head">
      <div>
        <p className="eyebrow">Studio</p>
        <strong>{title}</strong>
      </div>
      <span className="mini-pill">{count}</span>
    </div>
  );
}
