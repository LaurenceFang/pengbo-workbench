import { create } from "zustand";
import type {
  FactorRunResponse,
  ScreenerRunResponse,
  ScreenerUniverseSource,
  StrategyBacktestResponse,
  StrategyPaperSessionResponse,
} from "../lib/api";

export type ViewKey =
  | "dashboard"
  | "commandCenter"
  | "asset"
  | "watchlist"
  | "research"
  | "factorLab"
  | "strategyLab"
  | "workflowStudio"
  | "dataSources"
  | "screeners"
  | "manual"
  | "portfolio"
  | "connections"
  | "settings";

export type LanguagePreference = "zh-CN" | "en-US";
export type DensityPreference = "standard" | "compact";

export type ResearchSourceContext = {
  sourcePresetKey?: string;
  sourceVariantKey?: string;
  sourceUniverseSource?: "catalog" | "expanded";
  factorRunId?: string;
  backtestRunId?: string;
  paperSessionId?: string;
  intentId?: string;
};

export type PortfolioHandoffDraft = {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  fees: number;
  traded_at: string;
  notes?: string | null;
};

export type CommandFeedback = {
  tone: "success" | "error";
  title: string;
  detail?: string | null;
};

type AppState = {
  activeView: ViewKey;
  selectedAssetId: string;
  selectedResearchBriefId: string | null;
  pendingResearchSource: ResearchSourceContext | null;
  portfolioHandoffDraft: PortfolioHandoffDraft | null;
  selectedScreenerPresetKey: string | null;
  selectedScreenerVariantKey: string | null;
  selectedScreenerUniverseSource: ScreenerUniverseSource;
  lastScreenerRunResult: ScreenerRunResponse | null;
  selectedFactorRunId: string | null;
  lastFactorRunResult: FactorRunResponse | null;
  selectedStrategyBacktestId: string | null;
  lastStrategyBacktestResult: StrategyBacktestResponse | null;
  selectedStrategyPaperSessionId: string | null;
  lastStrategyPaperSession: StrategyPaperSessionResponse | null;
  selectedWorkflowRunId: string | null;
  commandPaletteOpen: boolean;
  latestCommandFeedback: CommandFeedback | null;
  language: LanguagePreference;
  density: DensityPreference;
  setActiveView: (view: ViewKey) => void;
  setSelectedAssetId: (assetId: string) => void;
  setSelectedResearchBriefId: (briefId: string | null) => void;
  setPendingResearchSource: (context: ResearchSourceContext | null) => void;
  setPortfolioHandoffDraft: (draft: PortfolioHandoffDraft | null) => void;
  setSelectedScreenerPresetKey: (presetKey: string | null) => void;
  setSelectedScreenerVariantKey: (variantKey: string | null) => void;
  setSelectedScreenerUniverseSource: (source: ScreenerUniverseSource) => void;
  setLastScreenerRunResult: (result: ScreenerRunResponse | null) => void;
  setSelectedFactorRunId: (runId: string | null) => void;
  setLastFactorRunResult: (result: FactorRunResponse | null) => void;
  setSelectedStrategyBacktestId: (runId: string | null) => void;
  setLastStrategyBacktestResult: (result: StrategyBacktestResponse | null) => void;
  setSelectedStrategyPaperSessionId: (sessionId: string | null) => void;
  setLastStrategyPaperSession: (session: StrategyPaperSessionResponse | null) => void;
  setSelectedWorkflowRunId: (runId: string | null) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setLatestCommandFeedback: (feedback: CommandFeedback | null) => void;
  setLanguage: (language: LanguagePreference) => void;
  setDensity: (density: DensityPreference) => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeView: "dashboard",
  selectedAssetId: "AAPL",
  selectedResearchBriefId: null,
  pendingResearchSource: null,
  portfolioHandoffDraft: null,
  selectedScreenerPresetKey: null,
  selectedScreenerVariantKey: null,
  selectedScreenerUniverseSource: "expanded",
  lastScreenerRunResult: null,
  selectedFactorRunId: null,
  lastFactorRunResult: null,
  selectedStrategyBacktestId: null,
  lastStrategyBacktestResult: null,
  selectedStrategyPaperSessionId: null,
  lastStrategyPaperSession: null,
  selectedWorkflowRunId: null,
  commandPaletteOpen: false,
  latestCommandFeedback: null,
  language: "zh-CN",
  density: "standard",
  setActiveView: (activeView) => set({ activeView }),
  setSelectedAssetId: (selectedAssetId) => set({ selectedAssetId }),
  setSelectedResearchBriefId: (selectedResearchBriefId) => set({ selectedResearchBriefId }),
  setPendingResearchSource: (pendingResearchSource) => set({ pendingResearchSource }),
  setPortfolioHandoffDraft: (portfolioHandoffDraft) => set({ portfolioHandoffDraft }),
  setSelectedScreenerPresetKey: (selectedScreenerPresetKey) => set({ selectedScreenerPresetKey }),
  setSelectedScreenerVariantKey: (selectedScreenerVariantKey) => set({ selectedScreenerVariantKey }),
  setSelectedScreenerUniverseSource: (selectedScreenerUniverseSource) => set({ selectedScreenerUniverseSource }),
  setLastScreenerRunResult: (lastScreenerRunResult) => set({ lastScreenerRunResult }),
  setSelectedFactorRunId: (selectedFactorRunId) => set({ selectedFactorRunId }),
  setLastFactorRunResult: (lastFactorRunResult) => set({ lastFactorRunResult }),
  setSelectedStrategyBacktestId: (selectedStrategyBacktestId) => set({ selectedStrategyBacktestId }),
  setLastStrategyBacktestResult: (lastStrategyBacktestResult) => set({ lastStrategyBacktestResult }),
  setSelectedStrategyPaperSessionId: (selectedStrategyPaperSessionId) => set({ selectedStrategyPaperSessionId }),
  setLastStrategyPaperSession: (lastStrategyPaperSession) => set({ lastStrategyPaperSession }),
  setSelectedWorkflowRunId: (selectedWorkflowRunId) => set({ selectedWorkflowRunId }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setLatestCommandFeedback: (latestCommandFeedback) => set({ latestCommandFeedback }),
  setLanguage: (language) => set({ language }),
  setDensity: (density) => set({ density }),
}));
