import { Command, FileSearch, RefreshCcw, ScrollText, ShieldAlert, Wallet, Workflow } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import {
 api,
 type AssetSearchResult,
 type ResearchBriefListItem,
 type ScreenerPreset,
 type ScreenerPresetVariant,
 type WorkflowRunResponse,
} from "../lib/api";
import { useAppStore } from "../store/app-store";

type CommandPaletteProps = {
 sidecarReady: boolean;
 onGlobalRefresh: () => Promise<void>;
};

type CommandItem = {
 key: string;
 label: string;
 description: string;
 keywords: string;
 icon: typeof Command;
 badge?: string;
 disabled?: boolean;
 run: () => Promise<void>;
};

function toSearchKey(value: string): string {
 return value.trim().toLowerCase();
}

export function CommandPalette({ sidecarReady, onGlobalRefresh }: CommandPaletteProps) {
 const i18n = useI18n();
 const activeView = useAppStore((state) => state.activeView);
 const selectedAssetId = useAppStore((state) => state.selectedAssetId);
 const selectedResearchBriefId = useAppStore((state) => state.selectedResearchBriefId);
 const selectedScreenerPresetKey = useAppStore((state) => state.selectedScreenerPresetKey);
 const selectedScreenerVariantKey = useAppStore((state) => state.selectedScreenerVariantKey);
 const selectedScreenerUniverseSource = useAppStore((state) => state.selectedScreenerUniverseSource);
 const selectedFactorRunId = useAppStore((state) => state.selectedFactorRunId);
 const selectedStrategyBacktestId = useAppStore((state) => state.selectedStrategyBacktestId);
 const selectedStrategyPaperSessionId = useAppStore((state) => state.selectedStrategyPaperSessionId);
 const open = useAppStore((state) => state.commandPaletteOpen);
 const setOpen = useAppStore((state) => state.setCommandPaletteOpen);
 const setActiveView = useAppStore((state) => state.setActiveView);
 const setSelectedAssetId = useAppStore((state) => state.setSelectedAssetId);
 const setSelectedResearchBriefId = useAppStore((state) => state.setSelectedResearchBriefId);
 const setPortfolioHandoffDraft = useAppStore((state) => state.setPortfolioHandoffDraft);
 const setSelectedScreenerPresetKey = useAppStore((state) => state.setSelectedScreenerPresetKey);
 const setSelectedScreenerVariantKey = useAppStore((state) => state.setSelectedScreenerVariantKey);
 const setLastScreenerRunResult = useAppStore((state) => state.setLastScreenerRunResult);
 const setSelectedWorkflowRunId = useAppStore((state) => state.setSelectedWorkflowRunId);
 const setLatestCommandFeedback = useAppStore((state) => state.setLatestCommandFeedback);

 const [query, setQuery] = useState("");
 const [busyKey, setBusyKey] = useState<string | null>(null);
 const [paletteError, setPaletteError] = useState<string | null>(null);
 const [assetResults, setAssetResults] = useState<AssetSearchResult[]>([]);
 const [recentBriefs, setRecentBriefs] = useState<ResearchBriefListItem[]>([]);
 const [screenerPresets, setScreenerPresets] = useState<ScreenerPreset[]>([]);
 const [screenerVariants, setScreenerVariants] = useState<Record<string, ScreenerPresetVariant[]>>({});
 const [recentWorkflowRuns, setRecentWorkflowRuns] = useState<WorkflowRunResponse[]>([]);
 const [selectedIndex, setSelectedIndex] = useState(0);
 const deferredQuery = useDeferredValue(query);
 const inputRef = useRef<HTMLInputElement | null>(null);

 useEffect(() => {
  function handleGlobalKeydown(event: KeyboardEvent) {
   if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    setOpen(!open);
    return;
   }

   if (event.key === "Escape" && open) {
    event.preventDefault();
    setOpen(false);
   }
  }

  window.addEventListener("keydown", handleGlobalKeydown);
  return () => window.removeEventListener("keydown", handleGlobalKeydown);
 }, [open, setOpen]);

 useEffect(() => {
  if (!open) {
   setQuery("");
   setPaletteError(null);
   setBusyKey(null);
   return;
  }

  window.setTimeout(() => inputRef.current?.focus(), 0);
 }, [open]);

 useEffect(() => {
  if (!open || !sidecarReady) {
   return;
  }

  let cancelled = false;
  void Promise.all([api.getRecentResearchBriefs(8), api.getScreenerPresets(), api.getRecentWorkflowRuns(5)])
   .then(async ([briefs, presets, workflows]) => {
    if (cancelled) {
     return;
    }

    setRecentBriefs(briefs);
    setScreenerPresets(presets);
    setRecentWorkflowRuns(workflows);

    const entries = await Promise.all(
     presets.map(async (preset) => [preset.key, await api.getScreenerPresetVariants(preset.key)] as const),
    );
    if (!cancelled) {
     setScreenerVariants(Object.fromEntries(entries));
    }
   })
   .catch((error: unknown) => {
    if (!cancelled) {
     setPaletteError(error instanceof Error ? error.message : "Failed to load command palette data.");
    }
   });

  return () => {
   cancelled = true;
  };
 }, [open, sidecarReady]);

 useEffect(() => {
  if (!open || !sidecarReady) {
   setAssetResults([]);
   return;
  }

  const trimmed = deferredQuery.trim();
  if (trimmed.length < 2) {
   setAssetResults([]);
   return;
  }

  let cancelled = false;
  const timeoutId = window.setTimeout(() => {
   void api
    .searchAssets(trimmed)
    .then((results) => {
     if (!cancelled) {
      setAssetResults(results.slice(0, 6));
     }
    })
    .catch((error: unknown) => {
     if (!cancelled) {
      setPaletteError(error instanceof Error ? error.message : "Asset search failed.");
      setAssetResults([]);
     }
    });
  }, 180);

  return () => {
   cancelled = true;
   window.clearTimeout(timeoutId);
  };
 }, [deferredQuery, open, sidecarReady]);

 async function openOrCreateBrief(symbol: string, options?: { sourcePresetKey?: string; sourceVariantKey?: string }) {
  const normalized = symbol.trim().toUpperCase();
  const existing = recentBriefs.find((item) => item.symbol === normalized);
  if (existing) {
   setSelectedAssetId(existing.symbol);
   setSelectedResearchBriefId(existing.brief_id);
   setActiveView("research");
   return existing.brief_id;
  }

  const created = await api.createResearchBrief({
   symbol: normalized,
   sourcePresetKey: options?.sourcePresetKey,
   sourceVariantKey: options?.sourceVariantKey,
   sourceUniverseSource: selectedScreenerUniverseSource,
  });
  setSelectedAssetId(normalized);
  setSelectedResearchBriefId(created.brief_id);
  setActiveView("research");
  return created.brief_id;
 }

 async function runCommand(item: CommandItem) {
  if (item.disabled || busyKey !== null) {
   return;
  }

  setBusyKey(item.key);
  setPaletteError(null);
  try {
   await item.run();
   setOpen(false);
  } catch (error) {
   const message = error instanceof Error ? error.message : "Command failed.";
   setPaletteError(message);
   setLatestCommandFeedback({
    tone: "error",
    title: item.label,
    detail: message,
   });
  } finally {
   setBusyKey(null);
  }
 }

 const normalizedQuery = toSearchKey(deferredQuery);
 const currentPreset = screenerPresets.find((item) => item.key === selectedScreenerPresetKey) ?? screenerPresets[0] ?? null;
 const currentSymbol = selectedAssetId?.trim().toUpperCase() || "";

 const commandItems = useMemo<CommandItem[]>(() => {
  const items: CommandItem[] = [];

  if (assetResults.length > 0) {
   assetResults.forEach((asset) => {
    items.push({
     key: `asset:${asset.symbol}`,
     label: `Open asset ${asset.symbol}`,
     description: `${asset.name} · ${asset.market}`,
     keywords: `${asset.symbol} ${asset.name} asset workspace quote chart`,
     icon: FileSearch,
     badge: "Asset",
     run: async () => {
      setSelectedAssetId(asset.symbol);
      setSelectedResearchBriefId(null);
      setActiveView("asset");
      setLatestCommandFeedback({
       tone: "success",
       title: `Opened asset ${asset.symbol}`,
       detail: `${asset.name} is now active in the asset workspace.`,
      });
     },
    });

    items.push({
     key: `research:${asset.symbol}`,
     label: `Open research brief for ${asset.symbol}`,
     description: `${asset.name} · create or reuse a saved brief`,
     keywords: `${asset.symbol} ${asset.name} research brief note export`,
     icon: ScrollText,
     badge: "Research",
     run: async () => {
      const briefId = await openOrCreateBrief(asset.symbol);
      setLatestCommandFeedback({
       tone: "success",
       title: `Opened research brief for ${asset.symbol}`,
       detail: `Brief ${briefId} is ready in the research workspace.`,
      });
     },
    });
   });
  }

  recentBriefs.forEach((brief) => {
   items.push({
    key: `recent-brief:${brief.brief_id}`,
    label: `Open recent brief ${brief.symbol}`,
    description: brief.title,
    keywords: `${brief.symbol} ${brief.title} recent research brief`,
    icon: ScrollText,
    badge: "Recent",
    run: async () => {
     setSelectedAssetId(brief.symbol);
     setSelectedResearchBriefId(brief.brief_id);
     setActiveView("research");
     setLatestCommandFeedback({
      tone: "success",
      title: `Opened recent brief ${brief.symbol}`,
      detail: brief.title,
     });
    },
   });
  });

  screenerPresets.forEach((preset) => {
   (screenerVariants[preset.key] ?? []).forEach((variant) => {
    items.push({
     key: `screener:${preset.key}:${variant.variant_key}`,
     label: `Run screener ${preset.title} / ${variant.name}`,
     description: `${preset.badge} · ${selectedScreenerUniverseSource === "expanded" ? "expanded" : "catalog"} universe`,
     keywords: `${preset.title} ${preset.key} ${variant.name} ${variant.variant_key} screener run`,
     icon: RefreshCcw,
     badge: "Screener",
     run: async () => {
      const result = await api.runScreener({
       preset: preset.key,
       asset_type: preset.asset_type,
       universeSource: selectedScreenerUniverseSource,
       variantKey: variant.variant_key,
      });
      setSelectedScreenerPresetKey(preset.key);
      setSelectedScreenerVariantKey(variant.variant_key);
      setLastScreenerRunResult(result);
      setActiveView("screeners");
      await onGlobalRefresh();
      setLatestCommandFeedback({
       tone: "success",
       title: `Ran ${preset.title}`,
       detail: `${result.hit_count} hits from ${result.evaluated_count} evaluated symbols.`,
      });
     },
    });
   });
  });

  items.push({
   key: "workflow:studio",
   label: "Open Workflow Studio",
   description: "Run template workflows and inspect step evidence",
   keywords: "workflow studio automation templates run steps artifacts evidence",
   icon: Workflow,
   badge: "Workflow",
   disabled: !sidecarReady,
   run: async () => {
    setActiveView("workflowStudio");
    setLatestCommandFeedback({
     tone: "success",
     title: "Opened Workflow Studio",
     detail: "Workflow runs remain template-driven and confirmation-gated.",
    });
   },
  });

  recentWorkflowRuns.forEach((run) => {
   items.push({
    key: `workflow:${run.run_id}`,
    label: `Open workflow ${run.template_key}`,
    description: `${run.status} · ${run.run_id}`,
    keywords: `${run.template_key} ${run.run_id} workflow steps artifacts ${run.status}`,
    icon: Workflow,
    badge: "Workflow",
    disabled: !sidecarReady,
    run: async () => {
     setSelectedWorkflowRunId(run.run_id);
     setActiveView("workflowStudio");
     setLatestCommandFeedback({
      tone: run.status === "failed" ? "error" : "success",
      title: `Opened workflow ${run.template_key}`,
      detail: run.run_id,
     });
    },
   });
  });

  items.push({
   key: "research:evidence-current",
   label: currentSymbol ? `Open evidence chain for ${currentSymbol}` : "Open current evidence chain",
   description: "Create a research brief linked to the current factor, backtest, paper, and audit context",
   keywords: `${currentSymbol} factor screener backtest paper binance audit evidence research`,
   icon: ScrollText,
   badge: "Evidence",
   disabled: !sidecarReady || currentSymbol.length === 0,
   run: async () => {
    const evidence = await api.getResearchEvidence(currentSymbol, {
     factorRunId: selectedFactorRunId ?? undefined,
     backtestRunId: selectedStrategyBacktestId ?? undefined,
     paperSessionId: selectedStrategyPaperSessionId ?? undefined,
    });
    const created = await api.createResearchBrief({
     symbol: currentSymbol,
     sourcePresetKey: selectedScreenerPresetKey ?? undefined,
     sourceVariantKey: selectedScreenerVariantKey ?? undefined,
     sourceUniverseSource: selectedScreenerUniverseSource,
     factorRunId: evidence.factor?.run_id ?? selectedFactorRunId ?? undefined,
     backtestRunId: evidence.backtest?.run_id ?? selectedStrategyBacktestId ?? undefined,
     paperSessionId: evidence.paper_session?.session_id ?? selectedStrategyPaperSessionId ?? undefined,
     intentId: evidence.execution?.intent_id ?? undefined,
    });
    setSelectedAssetId(currentSymbol);
    setSelectedResearchBriefId(created.brief_id);
    setActiveView("research");
    setLatestCommandFeedback({
     tone: "success",
     title: `Opened evidence chain for ${currentSymbol}`,
     detail: `${evidence.data_quality_notes.length} data-quality notes recorded.`,
    });
   },
  });

  items.push({
   key: "portfolio:draft",
   label: currentSymbol ? `Open portfolio draft for ${currentSymbol}` : "Open portfolio draft",
   description: "Prefill a buy draft from the current asset or research context",
   keywords: `${currentSymbol} portfolio trade draft buy transaction`,
   icon: Wallet,
   badge: "Portfolio",
   disabled: !sidecarReady || currentSymbol.length === 0,
   run: async () => {
    let symbol = currentSymbol;
    let price = 1;

    if (selectedResearchBriefId) {
     const brief = await api.getResearchBrief(selectedResearchBriefId);
     symbol = brief.symbol;
     price = brief.asset_snapshot.quote.price || 1;
    } else if (symbol) {
     const workspace = await api.getAssetWorkspace(symbol);
     price = workspace.quote.price || 1;
    }

    setPortfolioHandoffDraft({
     symbol,
     side: "buy",
     quantity: 1,
     price,
     fees: 0,
     traded_at: new Date().toISOString().slice(0, 10),
     notes: `Draft created from ${activeView}.`,
    });
    setActiveView("portfolio");
    setLatestCommandFeedback({
     tone: "success",
     title: `Opened portfolio draft for ${symbol}`,
     detail: `The transaction form is prefilled with quantity 1 at price ${price.toFixed(2)}.`,
    });
   },
  });

  items.push({
   key: "provider:edgar",
   label: "Test EDGAR",
   description: "Run the shared EDGAR connection test and refresh provider state",
   keywords: "edgar provider connection filings test credentials",
   icon: RefreshCcw,
   badge: "Provider",
   disabled: !sidecarReady,
   run: async () => {
    const result = await api.testConnection("edgar");
    setActiveView("connections");
    await onGlobalRefresh();
    setLatestCommandFeedback({
     tone: result.status === "ok" ? "success" : "error",
     title: "EDGAR test completed",
     detail: result.message,
    });
   },
  });

  items.push({
   key: "provider:binance",
   label: "Test Binance",
   description: "Run the shared Binance connection test and refresh provider state",
   keywords: "binance provider connection account test credentials",
   icon: RefreshCcw,
   badge: "Provider",
   disabled: !sidecarReady,
   run: async () => {
    const result = await api.testConnection("binance");
    setActiveView("connections");
    await onGlobalRefresh();
    setLatestCommandFeedback({
     tone: result.status === "ok" ? "success" : "error",
     title: "Binance test completed",
     detail: result.message,
    });
   },
  });

  items.push({
   key: "execution:binance-status",
   label: "Open Binance execution status",
   description: "Open Strategy Lab live execution controls and risk evidence",
   keywords: "binance execution live status risk audit intent strategy lab kill switch",
   icon: ShieldAlert,
   badge: "Execution",
   disabled: !sidecarReady,
   run: async () => {
    const config = await api.getBinanceExecutionConfig();
    setActiveView("strategyLab");
    setLatestCommandFeedback({
     tone: "success",
     title: "Opened Binance execution status",
     detail: config.live_enabled ? "Live mode is explicitly enabled." : "Live mode is default-off.",
    });
   },
  });

  items.push({
   key: "execution:binance-audit",
   label: "Open Binance execution audit",
   description: "Load the latest execution audit events in Strategy Lab",
   keywords: "binance execution audit trail events risk blocked submit",
   icon: ScrollText,
   badge: "Audit",
   disabled: !sidecarReady,
   run: async () => {
    const events = await api.getBinanceExecutionAudit(10);
    setActiveView("strategyLab");
    setLatestCommandFeedback({
     tone: "success",
     title: "Opened Binance execution audit",
     detail: `${events.length} recent audit events loaded.`,
    });
   },
  });

  items.push({
   key: "research:export-current",
   label: currentSymbol ? `Export current brief ${currentSymbol}` : "Export current research brief",
   description: "Export the active research brief to Markdown",
   keywords: `${currentSymbol} research brief export markdown report`,
   icon: ScrollText,
   badge: "Export",
   disabled: !sidecarReady || selectedResearchBriefId === null,
   run: async () => {
    if (!selectedResearchBriefId) {
     throw new Error("No active research brief is selected.");
    }
    const result = await api.exportResearchBrief(selectedResearchBriefId);
    setActiveView("research");
    await onGlobalRefresh();
    setLatestCommandFeedback({
     tone: "success",
     title: "Research brief exported",
     detail: result.export_path,
    });
   },
  });

  items.push({
   key: "research:export-evidence-current",
   label: currentSymbol ? `Export evidence-backed report ${currentSymbol}` : "Export evidence-backed report",
   description: "Create a fresh evidence-backed research brief and export it to Markdown",
   keywords: `${currentSymbol} evidence backed report export factor backtest paper audit`,
   icon: ScrollText,
   badge: "Evidence",
   disabled: !sidecarReady || currentSymbol.length === 0,
   run: async () => {
    const evidence = await api.getResearchEvidence(currentSymbol, {
     factorRunId: selectedFactorRunId ?? undefined,
     backtestRunId: selectedStrategyBacktestId ?? undefined,
     paperSessionId: selectedStrategyPaperSessionId ?? undefined,
    });
    const created = await api.createResearchBrief({
     symbol: currentSymbol,
     sourcePresetKey: selectedScreenerPresetKey ?? undefined,
     sourceVariantKey: selectedScreenerVariantKey ?? undefined,
     sourceUniverseSource: selectedScreenerUniverseSource,
     factorRunId: evidence.factor?.run_id ?? selectedFactorRunId ?? undefined,
     backtestRunId: evidence.backtest?.run_id ?? selectedStrategyBacktestId ?? undefined,
     paperSessionId: evidence.paper_session?.session_id ?? selectedStrategyPaperSessionId ?? undefined,
     intentId: evidence.execution?.intent_id ?? undefined,
    });
    const result = await api.exportResearchBrief(created.brief_id);
    setSelectedAssetId(currentSymbol);
    setSelectedResearchBriefId(created.brief_id);
    setActiveView("research");
    await onGlobalRefresh();
    setLatestCommandFeedback({
     tone: "success",
     title: "Evidence-backed report exported",
     detail: result.export_path,
    });
   },
  });

  return items;
 }, [
  activeView,
  assetResults,
  currentSymbol,
  onGlobalRefresh,
  recentBriefs,
  recentWorkflowRuns,
  screenerPresets,
  screenerVariants,
  selectedResearchBriefId,
  selectedFactorRunId,
  selectedScreenerPresetKey,
  selectedScreenerVariantKey,
  selectedScreenerUniverseSource,
  selectedStrategyBacktestId,
  selectedStrategyPaperSessionId,
  setActiveView,
  setLastScreenerRunResult,
  setLatestCommandFeedback,
  setPortfolioHandoffDraft,
  setSelectedAssetId,
  setSelectedResearchBriefId,
  setSelectedScreenerPresetKey,
  setSelectedScreenerVariantKey,
  setSelectedWorkflowRunId,
  sidecarReady,
 ]);

 const filteredItems = useMemo(() => {
  const ranked = commandItems.filter((item) => {
   if (!normalizedQuery) {
    return true;
   }
   return toSearchKey(`${item.label} ${item.description} ${item.keywords}`).includes(normalizedQuery);
  });

  return ranked.slice(0, 14);
 }, [commandItems, normalizedQuery]);

 useEffect(() => {
  setSelectedIndex(0);
 }, [normalizedQuery, open]);

 useEffect(() => {
  if (selectedIndex < filteredItems.length) {
   return;
  }
  setSelectedIndex(filteredItems.length > 0 ? filteredItems.length - 1 : 0);
 }, [filteredItems.length, selectedIndex]);

 if (!open) {
  return null;
 }

 const activeItem = filteredItems[selectedIndex] ?? null;

 return (
  <div
   aria-label="command-palette-overlay"
   className="command-palette-backdrop"
   onClick={() => setOpen(false)}
   role="presentation"
  >
   <section
    aria-label="command-palette"
    className="command-palette"
    onClick={(event) => event.stopPropagation()}
   >
    <div className="command-palette-head">
     <div>
      <p className="eyebrow">{i18n.t("command.eyebrow")}</p>
      <h3>{i18n.t("command.title")}</h3>
     </div>
     <span className="mini-pill">Ctrl/Cmd + K</span>
    </div>

    <div className="command-palette-search">
     <Command size={16} />
     <input
      ref={inputRef}
      aria-label="command-palette-input"
      placeholder={i18n.t("command.placeholder")}
      value={query}
      onChange={(event) => {
       setQuery(event.target.value);
       setPaletteError(null);
      }}
      onKeyDown={(event) => {
       if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(current + 1, Math.max(filteredItems.length - 1, 0)));
       } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(current - 1, 0));
       } else if (event.key === "Enter" && activeItem) {
        event.preventDefault();
        void runCommand(activeItem);
       }
      }}
     />
    </div>

    {paletteError ? <p className="command-palette-error">{paletteError}</p> : null}
    {!sidecarReady ? (
     <p className="command-palette-note">{i18n.t("command.offline")}</p>
    ) : null}
    {currentPreset ? (
     <p className="command-palette-note">
      {i18n.t("command.currentScreener")}: {currentPreset.title} / {selectedScreenerUniverseSource}
     </p>
    ) : null}

    <div className="command-list" role="listbox">
     {filteredItems.length === 0 ? (
      <div className="command-empty">{i18n.t("command.empty")}</div>
     ) : null}
     {filteredItems.map((item, index) => {
      const Icon = item.icon;
      const selected = index === selectedIndex;
      return (
       <button
        aria-selected={selected}
        className={`command-item ${selected ? "selected" : ""}`}
        disabled={item.disabled || busyKey !== null}
        key={item.key}
        onMouseEnter={() => setSelectedIndex(index)}
        onClick={() => void runCommand(item)}
        type="button"
       >
        <span className="command-item-icon">
         <Icon size={16} />
        </span>
        <span className="command-item-copy">
         <strong>{item.label}</strong>
         <span>{item.description}</span>
        </span>
        <span className="command-item-meta">
         {item.badge ? <span className="mini-pill">{item.badge}</span> : null}
         {busyKey === item.key ? <span className="mini-pill accent">{i18n.t("command.running")}</span> : null}
         {item.disabled ? <span className="mini-pill">{i18n.t("command.unavailable")}</span> : null}
        </span>
       </button>
      );
     })}
    </div>
   </section>
  </div>
 );
}
