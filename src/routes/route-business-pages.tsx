import type { ComponentProps, ReactNode } from "react";
import { StateBlock } from "../components/ui-kit";
import { AssetView } from "../views/asset-view";
import { AiAssistantView } from "../views/ai-assistant-view";
import { CommandCenterView } from "../views/command-center-view";
import { ConnectionsView } from "../views/connections-view";
import { DashboardView } from "../views/dashboard-view";
import { DataSourcesView } from "../views/data-sources-view";
import { FactorLabView } from "../views/factor-lab-view";
import { ManualView } from "../views/manual-view";
import { PortfolioView } from "../views/portfolio-view";
import { ResearchView } from "../views/research-view";
import { ScreenersView } from "../views/screeners-view";
import { SettingsView } from "../views/settings-view";
import { StrategyLabView } from "../views/strategy-lab-view";
import { WatchlistView } from "../views/watchlist-view";
import { WorkflowStudioView } from "../views/workflow-studio-view";
import { useRouteContext } from "./route-context";

export type RouteBusinessPageDependencies = {
  globalNotice?: ReactNode;
  dashboardPrelude?: ReactNode;
  dashboard: ComponentProps<typeof DashboardView>;
  commandCenter: ComponentProps<typeof CommandCenterView>;
  asset: ComponentProps<typeof AssetView>;
  watchlist: ComponentProps<typeof WatchlistView>;
  research: ComponentProps<typeof ResearchView>;
  factorLab: ComponentProps<typeof FactorLabView>;
  strategyLab: Omit<ComponentProps<typeof StrategyLabView>, "routeSection">;
  workflowStudio: Omit<ComponentProps<typeof WorkflowStudioView>, "routeSection">;
  dataSources: Omit<ComponentProps<typeof DataSourcesView>, "routeSection">;
  screeners: Omit<ComponentProps<typeof ScreenersView>, "routeSection">;
  manual: Record<string, never>;
  portfolio: ComponentProps<typeof PortfolioView>;
  connections: Omit<ComponentProps<typeof ConnectionsView>, "routeSection">;
  settings: Omit<ComponentProps<typeof SettingsView>, "routeSection">;
  aiAssistant: ComponentProps<typeof AiAssistantView>;
};

type RouteBusinessRenderer = (dependencies: RouteBusinessPageDependencies) => ReactNode;

function scoped(section: string, content: ReactNode) {
  return <section className="route-family-page" data-route-section={section}>{content}</section>;
}

export const routeBusinessPageRegistry: Record<string, RouteBusinessRenderer> = {
  dashboardOverview: (d) => scoped("dashboardOverview", <>{d.dashboardPrelude}<DashboardView {...d.dashboard} routeSection="dashboardOverview" /></>),
  dashboardRuntime: (d) => scoped("dashboardRuntime", <DashboardView {...d.dashboard} routeSection="dashboardRuntime" />),
  commandActions: (d) => scoped("commandActions", <CommandCenterView {...d.commandCenter} routeSection="commandActions" />),

  assetSearch: (d) => scoped("assetSearch", <AssetView {...d.asset} routeSection="assetSearch" />),
  assetOverview: (d) => scoped("assetOverview", <AssetView {...d.asset} routeSection="assetOverview" />),
  assetPrice: (d) => scoped("assetPrice", <AssetView {...d.asset} routeSection="assetPrice" />),
  assetFundamentals: (d) => scoped("assetFundamentals", <AssetView {...d.asset} routeSection="assetFundamentals" />),
  assetFilings: (d) => scoped("assetFilings", <AssetView {...d.asset} routeSection="assetFilings" />),
  assetData: (d) => scoped("assetData", <AssetView {...d.asset} routeSection="assetData" />),
  assetResearch: (d) => scoped("assetResearch", <AssetView {...d.asset} routeSection="assetResearch" />),

  watchlistIndex: (d) => scoped("watchlistIndex", <WatchlistView {...d.watchlist} routeSection="watchlistIndex" />),

  dataSourcesCatalog: (d) => scoped("dataSourcesCatalog", <DataSourcesView {...d.dataSources} routeSection="dataSourcesCatalog" />),
  dataSourceDetail: (d) => scoped("dataSourceDetail", <DataSourcesView {...d.dataSources} routeSection="dataSourceDetail" />),
  dataSourcePreview: (d) => scoped("dataSourcePreview", <DataSourcesView {...d.dataSources} routeSection="dataSourcePreview" />),
  dataSourceQuality: (d) => scoped("dataSourceQuality", <DataSourcesView {...d.dataSources} routeSection="dataSourceQuality" />),
  dataSourcesReport: (d) => scoped("dataSourcesReport", <DataSourcesView {...d.dataSources} routeSection="dataSourcesReport" />),

  researchInbox: (d) => scoped("researchInbox", <ResearchView {...d.research} routeSection="researchInbox" />),
  researchDecision: (d) => scoped("researchDecision", <ResearchView {...d.research} routeSection="researchDecision" />),
  researchAssetData: (d) => scoped("researchAssetData", <ResearchView {...d.research} routeSection="researchAssetData" />),
  researchAnalysis: (d) => scoped("researchAnalysis", <ResearchView {...d.research} routeSection="researchAnalysis" />),
  researchEvidence: (d) => scoped("researchEvidence", <ResearchView {...d.research} routeSection="researchEvidence" />),
  researchAssistant: (d) => scoped("researchAssistant", <ResearchView {...d.research} routeSection="researchAssistant" />),
  researchNotes: (d) => scoped("researchNotes", <ResearchView {...d.research} routeSection="researchNotes" />),
  researchExport: (d) => scoped("researchExport", <ResearchView {...d.research} routeSection="researchExport" />),

  factorRunNew: (d) => scoped("factorRunNew", <FactorLabView {...d.factorLab} routeSection="factorRunNew" />),
  factorRuns: (d) => scoped("factorRuns", <FactorLabView {...d.factorLab} routeSection="factorRuns" />),
  factorResults: (d) => scoped("factorResults", <FactorLabView {...d.factorLab} routeSection="factorResults" />),
  factorAssetExplanation: (d) => scoped("factorAssetExplanation", <FactorLabView {...d.factorLab} routeSection="factorAssetExplanation" />),
  factorQuality: (d) => scoped("factorQuality", <FactorLabView {...d.factorLab} routeSection="factorQuality" />),
  factorHandoff: (d) => scoped("factorHandoff", <FactorLabView {...d.factorLab} routeSection="factorHandoff" />),

  strategies: (d) => scoped("strategies", <StrategyLabView {...d.strategyLab} routeSection="strategies" />),
  backtestNew: (d) => scoped("backtestNew", <StrategyLabView {...d.strategyLab} routeSection="backtestNew" />),
  backtestResult: (d) => scoped("backtestResult", <StrategyLabView {...d.strategyLab} routeSection="backtestResult" />),
  paperSession: (d) => scoped("paperSession", <StrategyLabView {...d.strategyLab} routeSection="paperSession" />),
  strategyExecution: (d) => scoped("strategyExecution", <StrategyLabView {...d.strategyLab} routeSection="strategyExecution" />),

  workflowCatalog: (d) => scoped("workflowCatalog", <WorkflowStudioView {...d.workflowStudio} routeSection="workflowCatalog" />),
  workflowDetail: (d) => scoped("workflowDetail", <WorkflowStudioView {...d.workflowStudio} routeSection="workflowDetail" />),
  workflowConfigure: (d) => scoped("workflowConfigure", <WorkflowStudioView {...d.workflowStudio} routeSection="workflowConfigure" />),
  workflowRuns: (d) => scoped("workflowRuns", <WorkflowStudioView {...d.workflowStudio} routeSection="workflowRuns" />),
  workflowRun: (d) => scoped("workflowRun", <WorkflowStudioView {...d.workflowStudio} routeSection="workflowRun" />),
  workflowArtifacts: (d) => scoped("workflowArtifacts", <WorkflowStudioView {...d.workflowStudio} routeSection="workflowArtifacts" />),

  screenerCatalog: (d) => scoped("screenerCatalog", <ScreenersView {...d.screeners} routeSection="screenerCatalog" />),
  screenerVariant: (d) => scoped("screenerVariant", <ScreenersView {...d.screeners} routeSection="screenerVariant" />),
  screenerTuning: (d) => scoped("screenerTuning", <ScreenersView {...d.screeners} routeSection="screenerTuning" />),
  screenerUniverse: (d) => scoped("screenerUniverse", <ScreenersView {...d.screeners} routeSection="screenerUniverse" />),

  portfolioOverview: (d) => scoped("portfolioOverview", <PortfolioView {...d.portfolio} routeSection="portfolioOverview" />),
  portfolioHoldings: (d) => scoped("portfolioHoldings", <PortfolioView {...d.portfolio} routeSection="portfolioHoldings" />),
  portfolioAllocation: (d) => scoped("portfolioAllocation", <PortfolioView {...d.portfolio} routeSection="portfolioAllocation" />),
  portfolioAnalytics: (d) => scoped("portfolioAnalytics", <PortfolioView {...d.portfolio} routeSection="portfolioAnalytics" />),
  portfolioRisk: (d) => scoped("portfolioRisk", <PortfolioView {...d.portfolio} routeSection="portfolioRisk" />),
  portfolioTransactions: (d) => scoped("portfolioTransactions", <PortfolioView {...d.portfolio} routeSection="portfolioTransactions" />),
  portfolioTransactionNew: (d) => scoped("portfolioTransactionNew", <PortfolioView {...d.portfolio} routeSection="portfolioTransactionNew" />),
  portfolioHandoff: (d) => scoped("portfolioHandoff", <PortfolioView {...d.portfolio} routeSection="portfolioHandoff" />),

  connectionsCatalog: (d) => scoped("connectionsCatalog", <ConnectionsView {...d.connections} routeSection="connectionsCatalog" />),
  connectionDetail: (d) => scoped("connectionDetail", <ConnectionsView {...d.connections} routeSection="connectionDetail" />),
  connectionCredentials: (d) => scoped("connectionCredentials", <ConnectionsView {...d.connections} routeSection="connectionCredentials" />),
  connectionHealth: (d) => scoped("connectionHealth", <ConnectionsView {...d.connections} routeSection="connectionHealth" />),

  settingsPreferences: (d) => scoped("settingsPreferences", <SettingsView {...d.settings} routeSection="settingsPreferences" />),
  settingsAppearance: (d) => scoped("settingsAppearance", <SettingsView {...d.settings} routeSection="settingsAppearance" />),
  settingsSecurity: (d) => scoped("settingsSecurity", <SettingsView {...d.settings} routeSection="settingsSecurity" />),
  settingsExecution: (d) => scoped("settingsExecution", <SettingsView {...d.settings} routeSection="settingsExecution" />),
  settingsRuntime: (d) => scoped("settingsRuntime", <SettingsView {...d.settings} routeSection="settingsRuntime" />),

  manualGettingStarted: () => scoped("manualGettingStarted", <ManualView routeSection="manualGettingStarted" />),
  manualResearchData: () => scoped("manualResearchData", <ManualView routeSection="manualResearchData" />),
  manualStrategyWorkflows: () => scoped("manualStrategyWorkflows", <ManualView routeSection="manualStrategyWorkflows" />),
  manualSecurityExecution: () => scoped("manualSecurityExecution", <ManualView routeSection="manualSecurityExecution" />),
  manualTroubleshooting: () => scoped("manualTroubleshooting", <ManualView routeSection="manualTroubleshooting" />),

  aiAssistant: (d) => scoped("aiAssistant", <AiAssistantView {...d.aiAssistant} />),
};

export function RouteBusinessPage({ dependencies }: { dependencies: RouteBusinessPageDependencies }) {
  const { route } = useRouteContext();
  const renderer = routeBusinessPageRegistry[route.componentKey];
  if (!renderer) {
    return <StateBlock state="error" title="页面组件未注册" description={`${route.componentKey} 没有对应的独立业务页面。`} />;
  }
  return (
    <div data-route-page={route.componentKey}>
      {dependencies.globalNotice}
      {renderer(dependencies)}
    </div>
  );
}
