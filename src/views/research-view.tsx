import { Download, FileSearch, FolderPlus, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnalysisModuleList } from "../components/analysis-cards";
import {
  DataStatusStrip,
  InlineState,
  MetricCard,
  PanelState,
  formatPercent,
  formatPrice,
  type BackendStatus,
  type DataStatusItem,
} from "../components/shared";
import { useAsyncResource } from "../hooks/use-async-resource";
import {
  api,
  type AssetSearchResult,
  type ResearchBrief,
  type AIAssistantGenerateResponse,
  type AIContextPreviewResponse,
  type ResearchBriefEvidenceItem,
  type ResearchBriefListItem,
  type ResearchEvidenceContext,
  type PortfolioProvenanceItem,
} from "../lib/api";
import { useAppStore } from "../store/app-store";

type BriefPanelKey = "summary" | "fundamentals" | "filings";

export function ResearchView({
  onGlobalRefresh,
  backendStatus,
}: {
  onGlobalRefresh: () => Promise<void>;
  backendStatus: BackendStatus;
}) {
  const sidecarReady = backendStatus === "online";
  const activeView = useAppStore((state) => state.activeView);
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const selectedResearchBriefId = useAppStore((state) => state.selectedResearchBriefId);
  const pendingResearchSource = useAppStore((state) => state.pendingResearchSource);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const setSelectedAssetId = useAppStore((state) => state.setSelectedAssetId);
  const setSelectedResearchBriefId = useAppStore((state) => state.setSelectedResearchBriefId);
  const setPendingResearchSource = useAppStore((state) => state.setPendingResearchSource);
  const setPortfolioHandoffDraft = useAppStore((state) => state.setPortfolioHandoffDraft);

  const recents = useAsyncResource<ResearchBriefListItem[]>(async () => api.getRecentResearchBriefs(30), [], {
    enabled: sidecarReady,
  });
  const brief = useAsyncResource<ResearchBrief | null>(
    async () => (selectedResearchBriefId ? api.getResearchBrief(selectedResearchBriefId) : null),
    [selectedResearchBriefId],
    { enabled: sidecarReady && selectedResearchBriefId !== null },
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([]);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesBusy, setNotesBusy] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [assistantPreview, setAssistantPreview] = useState<AIContextPreviewResponse | null>(null);
  const [assistantOutput, setAssistantOutput] = useState<AIAssistantGenerateResponse | null>(null);
  const [assistantBusy, setAssistantBusy] = useState<"preview" | "generate" | "notes" | null>(null);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [briefPanel, setBriefPanel] = useState<BriefPanelKey>("summary");
  const autoOpeningRef = useRef<string | null>(null);

  useEffect(() => {
    if (brief.data) {
      setNotesDraft(brief.data.notes.markdown);
      setAssistantPreview(null);
      setAssistantOutput(null);
      setAssistantError(null);
    }
  }, [brief.data?.brief_id, brief.data?.notes.markdown]);

  async function reloadResearch() {
    recents.reload();
    brief.reload();
    await onGlobalRefresh();
  }

  async function refreshActiveBrief() {
    if (!brief.data) {
      await reloadResearch();
      return;
    }
    setActionError(null);
    setActionMessage(null);
    try {
      await api.refreshResearchBrief(brief.data.brief_id);
      setActionMessage("Research brief refreshed from current provider state.");
      await reloadResearch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to refresh research brief");
    }
  }

  async function openOrCreateBrief(
    symbol: string,
    options?: {
      forceCreate?: boolean;
      sourcePresetKey?: string;
      sourceVariantKey?: string;
      sourceUniverseSource?: "catalog" | "expanded";
    },
  ) {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized || !sidecarReady) {
      return;
    }

    setActionError(null);
    setActionMessage(null);
    setSelectedAssetId(normalized);

    const shouldForceCreate = options?.forceCreate ?? false;
    const existing = !shouldForceCreate
      ? (recents.data ?? []).find((item) => item.symbol === normalized)
      : undefined;
    if (existing) {
      setSelectedResearchBriefId(existing.brief_id);
      return;
    }

    const created = await api.createResearchBrief({
      symbol: normalized,
      sourcePresetKey: options?.sourcePresetKey,
      sourceVariantKey: options?.sourceVariantKey,
      sourceUniverseSource: options?.sourceUniverseSource,
      factorRunId: pendingResearchSource?.factorRunId,
      backtestRunId: pendingResearchSource?.backtestRunId,
      paperSessionId: pendingResearchSource?.paperSessionId,
      intentId: pendingResearchSource?.intentId,
    });
    setSelectedResearchBriefId(created.brief_id);
    recents.reload();
  }

  useEffect(() => {
    if (!sidecarReady || activeView !== "research" || !selectedAssetId || recents.loading) {
      return;
    }
    if (autoOpeningRef.current === selectedAssetId) {
      return;
    }

    autoOpeningRef.current = selectedAssetId;
    void openOrCreateBrief(selectedAssetId, {
      forceCreate: pendingResearchSource !== null,
      sourcePresetKey: pendingResearchSource?.sourcePresetKey,
      sourceVariantKey: pendingResearchSource?.sourceVariantKey,
      sourceUniverseSource: pendingResearchSource?.sourceUniverseSource,
    }).finally(() => {
      setPendingResearchSource(null);
      autoOpeningRef.current = null;
    });
  }, [
    activeView,
    pendingResearchSource,
    recents.data,
    recents.loading,
    selectedAssetId,
    setPendingResearchSource,
    sidecarReady,
  ]);

  async function runSearch() {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchBusy(true);
    setSearchError(null);
    try {
      const results = await api.searchAssets(searchTerm.trim());
      setSearchResults(results.slice(0, 8));
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Search failed");
    } finally {
      setSearchBusy(false);
    }
  }

  async function handleSaveNotes() {
    if (!brief.data) {
      return;
    }
    setNotesBusy(true);
    setActionError(null);
    try {
      await api.updateResearchBriefNotes(brief.data.brief_id, notesDraft);
      setActionMessage("Research notes saved.");
      await reloadResearch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save notes");
    } finally {
      setNotesBusy(false);
    }
  }

  async function handleAddToWatchlist() {
    if (!brief.data) {
      return;
    }
    setWatchlistBusy(true);
    setActionError(null);
    try {
      const current = await api.getDefaultWatchlist();
      const symbols = Array.from(new Set([...current.symbols, brief.data.symbol]));
      await api.updateDefaultWatchlist(symbols);
      setActionMessage(`${brief.data.symbol} added to the default watchlist.`);
      await onGlobalRefresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update watchlist");
    } finally {
      setWatchlistBusy(false);
    }
  }

  function handlePortfolioHandoff() {
    if (!brief.data) {
      return;
    }
    setPortfolioHandoffDraft(brief.data.portfolio_context.handoff_draft);
    setActiveView("portfolio");
  }

  async function handleExport() {
    if (!brief.data) {
      return;
    }
    setExportBusy(true);
    setActionError(null);
    try {
      const result = await api.exportResearchBrief(brief.data.brief_id);
      setActionMessage(`Exported to ${result.export_path}`);
      await reloadResearch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to export research brief");
    } finally {
      setExportBusy(false);
    }
  }

  async function handleAssistantPreview() {
    if (!brief.data) {
      return;
    }
    setAssistantBusy("preview");
    setAssistantError(null);
    try {
      const preview = await api.getResearchAssistantContextPreview(brief.data.brief_id);
      setAssistantPreview(preview);
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : "Failed to preview assistant context");
    } finally {
      setAssistantBusy(null);
    }
  }

  async function handleAssistantGenerate() {
    if (!brief.data) {
      return;
    }
    setAssistantBusy("generate");
    setAssistantError(null);
    try {
      if (!assistantPreview) {
        const preview = await api.getResearchAssistantContextPreview(brief.data.brief_id);
        setAssistantPreview(preview);
      }
      const result = await api.generateResearchAssistantResponse(brief.data.brief_id);
      setAssistantOutput(result);
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : "Failed to generate assistant draft");
    } finally {
      setAssistantBusy(null);
    }
  }

  async function handleSaveAssistantToNotes() {
    if (!brief.data || !assistantOutput || assistantOutput.status !== "completed") {
      return;
    }
    setAssistantBusy("notes");
    setAssistantError(null);
    try {
      const nextNotes = [notesDraft.trim(), assistantOutput.output_markdown.trim()].filter(Boolean).join("\n\n");
      await api.updateResearchBriefNotes(brief.data.brief_id, nextNotes);
      setNotesDraft(nextNotes);
      setActionMessage("Assistant draft saved to research notes.");
      await reloadResearch();
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : "Failed to save assistant draft");
    } finally {
      setAssistantBusy(null);
    }
  }

  const activeBrief = brief.data;
  const matchedSummaries = useMemo(
    () => activeBrief?.screener_context.summaries.filter((item) => item.matched) ?? [],
    [activeBrief?.screener_context.summaries],
  );

  if (!sidecarReady) {
    return (
      <PanelState
        title="Research workspace is waiting for the local sidecar"
        copy="Once the desktop runtime is healthy again, recent briefs, notes, and exports will become available."
      />
    );
  }

  return (
    <div className="stack-layout">
      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Research</p>
            <h3>Single-symbol workspace with saved notes, screener context, and export</h3>
          </div>
          <button aria-label="research-refresh" className="ghost-button" onClick={() => void refreshActiveBrief()} type="button">
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>

        <div className="research-workspace">
          <div className="research-column">
            <div className="research-panel">
              <div className="screeners-column-head">
                <div>
                  <p className="eyebrow">Search</p>
                  <strong>Open or create a brief</strong>
                </div>
              </div>
              <div className="search-box research-search-box">
                <FileSearch size={16} />
                <input
                  aria-label="research-search"
                  placeholder="Search AAPL / BTC/USDT / NVDA"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void runSearch();
                    }
                  }}
                />
                <button className="ghost-button" onClick={() => void runSearch()} type="button">
                  Search
                </button>
              </div>
              {searchBusy ? <InlineState label="Searching assets..." /> : null}
              {searchError ? <InlineState label={searchError} /> : null}
              <div className="research-list">
                {searchResults.map((item) => (
                  <button
                    aria-label={`research-search-result symbol=${item.symbol} market=${item.market}`}
                    key={`${item.symbol}-${item.market}`}
                    className="variant-card"
                    onClick={() => void openOrCreateBrief(item.symbol)}
                    type="button"
                  >
                    <div className="variant-card-head">
                      <strong>{item.symbol}</strong>
                      <span className="mini-pill">{item.market}</span>
                    </div>
                    <p>{item.name}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="research-panel">
              <div className="screeners-column-head">
                <div>
                  <p className="eyebrow">Recent</p>
                  <strong>Saved briefs</strong>
                </div>
                <span className="mini-pill">{recents.data?.length ?? 0}</span>
              </div>
              {recents.loading && !recents.data ? <InlineState label="Loading recent briefs..." /> : null}
              {recents.error ? <InlineState label={recents.error} actionLabel="Retry" onAction={recents.reload} /> : null}
              <div className="research-list">
                {(recents.data ?? []).map((item) => (
                  <button
                    aria-label={`research-brief-item id=${item.brief_id} symbol=${item.symbol}`}
                    key={item.brief_id}
                    className={`variant-card ${item.brief_id === selectedResearchBriefId ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedAssetId(item.symbol);
                      setSelectedResearchBriefId(item.brief_id);
                    }}
                    type="button"
                  >
                    <div className="variant-card-head">
                      <strong>{item.symbol}</strong>
                      <span className="mini-pill">{item.stale ? "cached" : "live"}</span>
                    </div>
                    <p>{item.title}</p>
                    <small>{new Date(item.updated_at).toLocaleString()}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="research-column">
            {activeBrief ? (
              <>
                <section
                  className="research-panel"
                  aria-label={`research-brief id=${activeBrief.brief_id} symbol=${activeBrief.symbol} fundamentals=${activeBrief.asset_snapshot.capabilities.fundamentals_status} filings=${activeBrief.asset_snapshot.capabilities.filings_status}`}
                >
                  <div className="card-header">
                    <div>
                      <p className="eyebrow">Brief</p>
                      <h3>
                        {activeBrief.asset_snapshot.asset.name}
                        <span className="inline-symbol">{activeBrief.symbol}</span>
                      </h3>
                    </div>
                    <span className="mini-pill accent">{activeBrief.stale ? "cached" : "live"}</span>
                  </div>
                  <DataStatusStrip
                    ariaLabel={`research-data-status brief=${activeBrief.brief_id} symbol=${activeBrief.symbol} stale=${String(activeBrief.stale)} fundamentals=${activeBrief.asset_snapshot.capabilities.fundamentals_status} filings=${activeBrief.asset_snapshot.capabilities.filings_status}`}
                    items={researchStatusItems(activeBrief)}
                    note="Research evidence stays local; credential-gated fields remain visibly marked and live execution stays behind explicit Binance gates."
                  />
                  <DecisionReviewPanel brief={activeBrief} />
                  <div className="metric-grid">
                    <MetricCard
                      label="Price"
                      value={formatPrice(
                        activeBrief.asset_snapshot.quote.price,
                        activeBrief.asset_snapshot.quote.currency,
                        activeBrief.asset_snapshot.asset.asset_class,
                      )}
                    />
                    <MetricCard
                      label="Change"
                      value={formatPercent(activeBrief.asset_snapshot.quote.change_pct)}
                      tone={activeBrief.asset_snapshot.quote.change_pct >= 0 ? "up" : "down"}
                    />
                    <MetricCard label="Matched presets" value={String(matchedSummaries.length)} />
                    <MetricCard
                      label="Portfolio"
                      value={activeBrief.portfolio_context.in_portfolio ? "Held" : "Not held"}
                    />
                  </div>
                  <div className="segmented-control research-brief-tabs" aria-label="research-brief-subwindows">
                    {[
                      { key: "summary" as const, label: "Summary" },
                      { key: "fundamentals" as const, label: "Fundamentals" },
                      { key: "filings" as const, label: "Filings" },
                    ].map((item) => (
                      <button
                        className={briefPanel === item.key ? "active" : ""}
                        key={item.key}
                        onClick={() => setBriefPanel(item.key)}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="research-brief-subwindow">
                    {briefPanel === "summary" ? (
                      activeBrief.asset_snapshot.overview ? (
                        <div className="research-copy research-scroll-copy">
                          <p>{activeBrief.asset_snapshot.overview.summary}</p>
                        </div>
                      ) : activeBrief.asset_snapshot.capabilities.fundamentals_message ? (
                        <InlineState label={activeBrief.asset_snapshot.capabilities.fundamentals_message} />
                      ) : null
                    ) : null}
                    {briefPanel === "fundamentals" ? (
                      <>
                        <p
                          aria-label={`research-capability brief=${activeBrief.brief_id} symbol=${activeBrief.symbol} capability=fundamentals status=${activeBrief.asset_snapshot.capabilities.fundamentals_status}`}
                          className="panel-note"
                        >
                          Fundamentals: {formatResearchCapabilityStatus(activeBrief.asset_snapshot.capabilities.fundamentals_status)}
                        </p>
                        <div className="table-list">
                          {activeBrief.asset_snapshot.ratios.map((ratio) => (
                            <div className="table-row" key={ratio.label}>
                              <div className="table-main">
                                <strong>{ratio.label}</strong>
                                <span>{ratio.note}</span>
                              </div>
                              <div className="table-meta">
                                <span>{ratio.value}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : null}
                    {briefPanel === "filings" ? (
                      <>
                        <p
                          aria-label={`research-capability brief=${activeBrief.brief_id} symbol=${activeBrief.symbol} capability=filings status=${activeBrief.asset_snapshot.capabilities.filings_status}`}
                          className="panel-note"
                        >
                          Filings: {formatResearchCapabilityStatus(activeBrief.asset_snapshot.capabilities.filings_status)}
                        </p>
                        {activeBrief.asset_snapshot.filings.length ? (
                          <div className="table-list">
                            {activeBrief.asset_snapshot.filings.slice(0, 6).map((filing) => (
                              <div className="table-row" key={`${filing.type}-${filing.filed_at}`}>
                                <div className="table-main">
                                  <strong>{filing.type}</strong>
                                  <span>{filing.headline}</span>
                                </div>
                                <div className="table-meta">
                                  <span>{filing.filed_at}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <InlineState label={activeBrief.asset_snapshot.capabilities.filings_message ?? "No filings available."} />
                        )}
                      </>
                    ) : null}
                  </div>
                </section>

                <section className="research-panel">
                  <div className="card-header">
                    <div>
                      <p className="eyebrow">Analysis</p>
                      <h3>Structured research modules</h3>
                    </div>
                  </div>
                  <AnalysisModuleList modules={activeBrief.analysis_modules} />
                </section>

                {activeBrief.evidence_context ? (
                  <EvidenceChainPanel evidence={activeBrief.evidence_context} briefId={activeBrief.brief_id} />
                ) : null}
              </>
            ) : (
              <PanelState
                title="No research brief is open yet"
                copy="Search for a symbol or open one of the recent briefs to start the workspace."
              />
            )}
          </div>

          <div className="research-column">
            {activeBrief ? (
              <>
                <AssistantPanel
                  brief={activeBrief}
                  busy={assistantBusy}
                  error={assistantError}
                  output={assistantOutput}
                  preview={assistantPreview}
                  onGenerate={() => void handleAssistantGenerate()}
                  onPreview={() => void handleAssistantPreview()}
                  onSaveToNotes={() => void handleSaveAssistantToNotes()}
                />
                <section className="research-panel">
                  <div className="card-header">
                    <div>
                      <p className="eyebrow">Actions</p>
                      <h3>Notes, watchlist, portfolio handoff, export</h3>
                    </div>
                  </div>
                  <div className="form-grid">
                    <label className="field">
                      <span>Notes</span>
                      <textarea
                        aria-label={`research-notes brief=${activeBrief.brief_id}`}
                        rows={12}
                        value={notesDraft}
                        onChange={(event) => setNotesDraft(event.target.value)}
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button
                      aria-label={`research-save-notes brief=${activeBrief.brief_id}`}
                      className="primary-button"
                      disabled={notesBusy}
                      onClick={() => void handleSaveNotes()}
                      type="button"
                    >
                      {notesBusy ? "Saving..." : "Save notes"}
                    </button>
                    <button
                      aria-label={`research-watchlist symbol=${activeBrief.symbol}`}
                      className="ghost-button"
                      disabled={watchlistBusy}
                      onClick={() => void handleAddToWatchlist()}
                      type="button"
                    >
                      <FolderPlus size={16} />
                      {watchlistBusy ? "Adding..." : "Add to watchlist"}
                    </button>
                    <button
                      aria-label={`research-handoff symbol=${activeBrief.symbol}`}
                      className="ghost-button"
                      onClick={handlePortfolioHandoff}
                      type="button"
                    >
                      Open portfolio handoff
                    </button>
                    <button
                      aria-label={`research-export brief=${activeBrief.brief_id} symbol=${activeBrief.symbol} fundamentals=${activeBrief.asset_snapshot.capabilities.fundamentals_status} filings=${activeBrief.asset_snapshot.capabilities.filings_status}`}
                      className="ghost-button"
                      disabled={exportBusy}
                      onClick={() => void handleExport()}
                      type="button"
                    >
                      <Download size={16} />
                      {exportBusy ? "Exporting..." : "Export Markdown"}
                    </button>
                  </div>
                  {activeBrief.export_info.last_export_path ? (
                    <p aria-label={`research-export-path brief=${activeBrief.brief_id}`} className="panel-note">
                      Last export: {activeBrief.export_info.last_export_path}
                    </p>
                  ) : null}
                  {actionMessage ? <InlineState label={actionMessage} /> : null}
                  {actionError ? <InlineState label={actionError} /> : null}
                </section>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function AssistantPanel({
  brief,
  busy,
  error,
  output,
  preview,
  onGenerate,
  onPreview,
  onSaveToNotes,
}: {
  brief: ResearchBrief;
  busy: "preview" | "generate" | "notes" | null;
  error: string | null;
  output: AIAssistantGenerateResponse | null;
  preview: AIContextPreviewResponse | null;
  onGenerate: () => void;
  onPreview: () => void;
  onSaveToNotes: () => void;
}) {
  return (
    <section
      className="research-panel"
      aria-label={`research-assistant brief=${brief.brief_id} symbol=${brief.symbol} status=${output?.status ?? "idle"}`}
    >
      <div className="card-header">
        <div>
          <p className="eyebrow">Assistant</p>
          <h3>Evidence-grounded local research draft</h3>
        </div>
        <span className={`mini-pill ${output?.status === "completed" ? "accent" : ""}`}>
          {output?.provider ?? "local"}
        </span>
      </div>
      <p className="panel-note">
        Uses the Research brief, data quality, provenance, and notes after redaction. Cloud transmission remains blocked here.
      </p>
      <div className="form-actions">
        <button
          aria-label={`research-assistant-preview brief=${brief.brief_id}`}
          className="ghost-button"
          disabled={busy !== null}
          onClick={onPreview}
          type="button"
        >
          {busy === "preview" ? "Previewing..." : "Preview context"}
        </button>
        <button
          aria-label={`research-assistant-generate brief=${brief.brief_id}`}
          className="primary-button"
          disabled={busy !== null}
          onClick={onGenerate}
          type="button"
        >
          {busy === "generate" ? "Generating..." : "Generate draft"}
        </button>
      </div>
      {error ? <InlineState label={error} /> : null}
      {preview ? (
        <div className="assistant-preview" aria-label={`research-assistant-context brief=${brief.brief_id}`}>
          <div className="metric-grid">
            <MetricCard label="Context chars" value={String(preview.estimated_input_chars)} />
            <MetricCard label="Citations" value={String(preview.citations.length)} />
            <MetricCard label="Quality" value={preview.data_quality ?? "unknown"} />
            <MetricCard label="Cloud" value={preview.cloud_transmission_allowed ? "allowed" : "blocked"} />
          </div>
          <p className="research-copy">{preview.prompt_context_preview}</p>
          <div className="task-list">
            {preview.blocked_sections.map((item) => (
              <InlineState label={`Blocked: ${item}`} key={item} />
            ))}
          </div>
        </div>
      ) : null}
      {output ? (
        <div className="assistant-output" aria-label={`research-assistant-output brief=${brief.brief_id} status=${output.status}`}>
          <div className="variant-card-head">
            <strong>{output.status === "completed" ? "Grounded draft" : "Generation blocked"}</strong>
            <span className="mini-pill">{output.grounded ? "grounded" : "review"}</span>
          </div>
          <p>{output.summary}</p>
          {output.blocked_reasons.length ? (
            <div className="task-list">
              {output.blocked_reasons.map((item) => (
                <InlineState label={`Blocked: ${item}`} key={item} />
              ))}
            </div>
          ) : null}
          {output.status === "completed" ? (
            <>
              <DecisionList title="Questions" items={output.questions} />
              <DecisionList title="Risks" items={output.risks} />
              <DecisionList title="Limitations" items={output.limitations} />
              <div className="table-list">
                {output.citations.slice(0, 5).map((item) => (
                  <div className="table-row" key={`${item.source_type}-${item.source_id}-${item.label}`}>
                    <div className="table-main">
                      <strong>{item.label}</strong>
                      <span>{item.summary}</span>
                    </div>
                    <div className="table-meta">
                      <span>{item.status}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                aria-label={`research-assistant-save-notes brief=${brief.brief_id}`}
                className="ghost-button"
                disabled={busy !== null}
                onClick={onSaveToNotes}
                type="button"
              >
                {busy === "notes" ? "Saving..." : "Save draft to notes"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function EvidenceChainPanel({
  evidence,
  briefId,
}: {
  evidence: ResearchEvidenceContext;
  briefId: string;
}) {
  const matched = evidence.screener?.summaries.filter((item) => item.matched).length ?? 0;
  return (
    <section
      aria-label={`research-evidence-chain brief=${briefId} factor=${evidence.factor?.run_id ?? "none"} backtest=${evidence.backtest?.run_id ?? "none"} paper=${evidence.paper_session?.session_id ?? "none"} intent=${evidence.execution?.intent_id ?? "none"}`}
      className="research-panel"
    >
      <div className="card-header">
        <div>
          <p className="eyebrow">Evidence Chain</p>
          <h3>Factor, screening, simulation, paper, and execution audit</h3>
        </div>
        <span className="mini-pill">{evidence.data_quality_notes.length} notes</span>
      </div>
      <div className="metric-grid">
        <MetricCard label="Factor" value={evidence.factor?.composite_score?.toFixed(1) ?? "n/a"} />
        <MetricCard label="Screener matches" value={String(matched)} />
        <MetricCard label="Backtest" value={evidence.backtest?.total_return_pct !== null && evidence.backtest ? formatPercent(evidence.backtest.total_return_pct) : "n/a"} />
        <MetricCard label="Execution" value={evidence.execution?.status ?? "none"} />
      </div>
      <div className="table-list">
        {evidence.factor ? (
          <div className="table-row">
            <div className="table-main">
              <strong>Factor {evidence.factor.run_id}</strong>
              <span>
                Rank {evidence.factor.rank ?? "n/a"} / bucket {evidence.factor.bucket}
              </span>
            </div>
            <div className="table-meta">
              <span>{evidence.factor.family}</span>
            </div>
          </div>
        ) : null}
        {evidence.backtest ? (
          <div className="table-row">
            <div className="table-main">
              <strong>Backtest {evidence.backtest.run_id}</strong>
              <span>
                {evidence.backtest.trade_count} trades / max drawdown{" "}
                {evidence.backtest.max_drawdown_pct !== null ? formatPercent(evidence.backtest.max_drawdown_pct) : "n/a"}
              </span>
            </div>
            <div className="table-meta">
              <span>{evidence.backtest.no_live_orders ? "simulated" : "live-linked"}</span>
            </div>
          </div>
        ) : null}
        {evidence.paper_session ? (
          <div className="table-row">
            <div className="table-main">
              <strong>Paper {evidence.paper_session.session_id}</strong>
              <span>
                {evidence.paper_session.order_count} orders / {evidence.paper_session.ledger_count} ledger entries
              </span>
            </div>
            <div className="table-meta">
              <span>{evidence.paper_session.no_live_orders ? "no live orders" : "review"}</span>
            </div>
          </div>
        ) : null}
        {evidence.execution ? (
          <div className="table-row">
            <div className="table-main">
              <strong>Binance {evidence.execution.intent_id ?? "intent"}</strong>
              <span>
                Blocks {evidence.execution.blocked_checks.join(", ") || "none"} / live order{" "}
                {evidence.execution.live_order_recorded ? "recorded" : "not recorded"}
              </span>
            </div>
            <div className="table-meta">
              <span>{evidence.execution.status ?? "none"}</span>
            </div>
          </div>
        ) : null}
        {evidence.audit ? (
          <div className="table-row">
            <div className="table-main">
              <strong>Audit events</strong>
              <span>{evidence.audit.event_types.join(", ") || "none"}</span>
              {evidence.audit.event_ids.length ? (
                <span className="mono">IDs {evidence.audit.event_ids.join(", ")}</span>
              ) : null}
            </div>
            <div className="table-meta">
              <span>{evidence.audit.event_count}</span>
            </div>
          </div>
        ) : null}
      </div>
      {evidence.data_quality_notes.length ? (
        <div className="task-list">
          {evidence.data_quality_notes.map((note) => (
            <InlineState label={note} key={note} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function DecisionReviewPanel({ brief }: { brief: ResearchBrief }) {
  const review = brief.decision_review;

  return (
    <section
      aria-label={`research-decision-review brief=${brief.brief_id} template=${review.template_key}`}
      className="decision-review-panel"
    >
      <div className="decision-review-head">
        <div>
          <p className="eyebrow">Decision review</p>
          <strong>{review.template_key} template</strong>
        </div>
        <span className="mini-pill accent">audited shape</span>
      </div>
      <p className="research-copy">{review.thesis}</p>
      <DecisionList title="Assumptions" items={review.assumptions} />
      <DecisionEvidenceList title="Supporting evidence" items={review.supporting_evidence} />
      <DecisionEvidenceList title="Counter-evidence" items={review.counter_evidence} />
      <DecisionList title="Risks" items={review.risks} />
      <DecisionList title="Watch items" items={review.watch_items} />
      <div className="decision-provenance-grid">
        {review.provenance.map((item) => (
          <div className="decision-provenance-item" key={`${item.label}-${item.status}`}>
            <span className={`mini-pill status-${item.status}`}>{item.status}</span>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
      <PortfolioProvenanceGrid items={brief.portfolio_context.provenance} />
      <p className="decision-conclusion">{review.conclusion}</p>
    </section>
  );
}

function PortfolioProvenanceGrid({ items }: { items: PortfolioProvenanceItem[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="portfolio-provenance-grid" aria-label={`portfolio-provenance references=${items.length}`}>
      {items.map((item) => (
        <div className="portfolio-provenance-item" key={`${item.label}-${item.source_id ?? item.detail}`}>
          <span className={`mini-pill status-${item.status}`}>{item.status}</span>
          <strong>{item.label}</strong>
          <p>{item.detail}</p>
          <small>
            {item.provider ?? "local"} {item.source_id ? `/ ${item.source_id}` : ""}
          </small>
        </div>
      ))}
    </div>
  );
}

function DecisionList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="decision-list">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function DecisionEvidenceList({
  title,
  items,
}: {
  title: string;
  items: ResearchBriefEvidenceItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="decision-list">
      <strong>{title}</strong>
      <div className="decision-evidence-list">
        {items.map((item) => (
          <article className="decision-evidence-item" key={`${item.label}-${item.status}`}>
            <span className={`mini-pill status-${item.status}`}>{item.status}</span>
            <div>
              <strong>{item.label}</strong>
              <p>{item.summary}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function formatResearchCapabilityStatus(status: ResearchBrief["asset_snapshot"]["capabilities"]["fundamentals_status"]): string {
  switch (status) {
    case "available":
      return "Available";
    case "credential_required":
      return "Need creds";
    case "temporarily_unavailable":
      return "Temp unavailable";
    default:
      return "Unsupported";
  }
}

function researchStatusItems(brief: ResearchBrief): DataStatusItem[] {
  const capabilities = brief.asset_snapshot.capabilities;
  const credentialRequired =
    capabilities.fundamentals_status === "credential_required" ||
    capabilities.filings_status === "credential_required";
  const degraded =
    brief.stale ||
    capabilities.fundamentals_status === "temporarily_unavailable" ||
    capabilities.filings_status === "temporarily_unavailable";
  return [
    {
      label: "Provider",
      value: brief.asset_snapshot.asset.provider,
      detail: brief.stale ? "cached brief snapshot" : "observed brief snapshot",
      tone: brief.stale ? "cached" : "observed",
    },
    {
      label: "Credentials",
      value: credentialRequired ? "credential_required" : "not required",
      detail: credentialRequired ? "Refresh may need local provider credentials." : "Current snapshot can be reviewed without secrets.",
      tone: credentialRequired ? "credential_required" : "observed",
    },
    {
      label: "Coverage",
      value: degraded ? "degraded" : "observed",
      detail: `Fundamentals ${capabilities.fundamentals_status}; filings ${capabilities.filings_status}.`,
      tone: degraded ? "degraded" : "observed",
    },
    {
      label: "Evidence",
      value: brief.evidence_context ? "audited" : "pending",
      detail: brief.evidence_context
        ? `${brief.evidence_context.data_quality_notes.length} data-quality note(s) attached.`
        : "Evidence chain appears after linked artifacts are available.",
      tone: brief.evidence_context ? "audited" : "blocked",
    },
    {
      label: "Quality",
      value: brief.data_quality?.overall ?? "unknown",
      detail: brief.data_quality
        ? `${brief.data_quality.completeness.level} completeness; ${brief.data_quality.timeliness.level} timeliness.`
        : "Structured quality contract is not attached to this brief yet.",
      tone:
        brief.data_quality?.overall === "complete"
          ? "observed"
          : brief.data_quality?.overall === "blocked"
            ? "blocked"
            : brief.data_quality?.overall === "unknown"
              ? "audited"
              : "degraded",
    },
  ];
}
