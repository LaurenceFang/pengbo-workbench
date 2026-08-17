# M1 79 路由能力矩阵

> 由 `npm.cmd run check:m1-capability-matrix` 从固定 SVG 注册表生成。Available 路由挂载 T1–T101 的真实业务 View；Planned 路由只显示带任务号的阻断态。

- SVG SHA-256：`206E6C79553594070FE7ADE443D97094AC8016E515B19AE8F49B9B3544028CAF`
- 路由：79/79
- Available：68
- Planned blocked：11
- 校验：通过
- 动态和 packaged 已通过；SVG 像素与逐 Frame 人工签收仍保持 `Acceptance Pending`。

| Frame | URL | 真实组件 / section | 可用性 | Access / action | Applicable states | 验收 |
| ---: | --- | --- | --- | --- | --- | --- |
| 01 | `/dashboard/overview` | DashboardView / dashboardOverview | Available | public / read_only | loading / empty / error / ready / recovery | Acceptance Pending |
| 02 | `/dashboard/runtime` | DashboardView / dashboardRuntime | Available | public / read_only | loading / empty / error / ready / recovery | Acceptance Pending |
| 03 | `/command-center/actions` | CommandCenterView / commandActions | Available | public / read_only | loading / empty / error / ready / recovery | Acceptance Pending |
| 04 | `/command-center/recent` | CommandCenterView / commandRecent | Blocked → T109 | public / read_only | blocked / recovery | Acceptance Pending |
| 05 | `/command-center/results/:resultId` | CommandCenterView / commandResult | Blocked → T109 | public / read_only | blocked / recovery | Acceptance Pending |
| 06 | `/markets/assets` | AssetView / assetSearch | Available | public / read_only | loading / empty / blocked / error / ready / recovery | Acceptance Pending |
| 07 | `/markets/assets/:symbol/overview` | AssetView / assetOverview | Available | public / read_only | loading / empty / blocked / error / ready / recovery | Acceptance Pending |
| 08 | `/markets/assets/:symbol/price` | AssetView / assetPrice | Available | public / read_only | loading / empty / blocked / error / ready / recovery | Acceptance Pending |
| 09 | `/markets/assets/:symbol/fundamentals` | AssetView / assetFundamentals | Available | public / read_only | loading / empty / blocked / error / ready / recovery | Acceptance Pending |
| 10 | `/markets/assets/:symbol/filings` | AssetView / assetFilings | Available | public / read_only | loading / empty / blocked / error / ready / recovery | Acceptance Pending |
| 11 | `/markets/assets/:symbol/data` | AssetView / assetData | Available | public / read_only | loading / empty / blocked / error / ready / recovery | Acceptance Pending |
| 12 | `/markets/assets/:symbol/research` | AssetView / assetResearch | Available | public / read_only | loading / empty / blocked / error / ready / recovery | Acceptance Pending |
| 13 | `/markets/watchlist` | WatchlistView / watchlistIndex | Available | public / read_only | loading / empty / error / ready / recovery | Acceptance Pending |
| 14 | `/markets/watchlist/:listId` | WatchlistView / watchlistDetail | Blocked → T110 | public / read_only | blocked / recovery | Acceptance Pending |
| 15 | `/markets/watchlist/:listId/manage` | WatchlistView / watchlistManage | Blocked → T110 | public / local_write | blocked / recovery | Acceptance Pending |
| 16 | `/markets/data-sources/catalog` | DataSourcesView / dataSourcesCatalog | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 17 | `/markets/data-sources/:provider` | DataSourcesView / dataSourceDetail | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 18 | `/markets/data-sources/:provider/preview` | DataSourcesView / dataSourcePreview | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 19 | `/markets/data-sources/:provider/quality` | DataSourcesView / dataSourceQuality | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 20 | `/markets/data-sources/report` | DataSourcesView / dataSourcesReport | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 21 | `/research/inbox` | ResearchView / researchInbox | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / ai-insufficient-evidence / cloud-opt-in / recovery | Acceptance Pending |
| 22 | `/research/briefs/:briefId/decision` | ResearchView / researchDecision | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / ai-insufficient-evidence / cloud-opt-in / recovery | Acceptance Pending |
| 23 | `/research/briefs/:briefId/asset-data` | ResearchView / researchAssetData | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / ai-insufficient-evidence / cloud-opt-in / recovery | Acceptance Pending |
| 24 | `/research/briefs/:briefId/analysis` | ResearchView / researchAnalysis | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / ai-insufficient-evidence / cloud-opt-in / recovery | Acceptance Pending |
| 25 | `/research/briefs/:briefId/evidence` | ResearchView / researchEvidence | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / ai-insufficient-evidence / cloud-opt-in / recovery | Acceptance Pending |
| 26 | `/research/briefs/:briefId/assistant` | ResearchView / researchAssistant | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / ai-insufficient-evidence / cloud-opt-in / recovery | Acceptance Pending |
| 27 | `/research/briefs/:briefId/notes` | ResearchView / researchNotes | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / ai-insufficient-evidence / cloud-opt-in / recovery | Acceptance Pending |
| 28 | `/research/briefs/:briefId/export` | ResearchView / researchExport | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / ai-insufficient-evidence / cloud-opt-in / recovery | Acceptance Pending |
| 29 | `/factor-lab/runs/new` | FactorLabView / factorRunNew | Available | local_unlock / local_write | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 30 | `/factor-lab/runs` | FactorLabView / factorRuns | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 31 | `/factor-lab/runs/:runId/results` | FactorLabView / factorResults | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 32 | `/factor-lab/runs/:runId/assets/:symbol` | FactorLabView / factorAssetExplanation | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 33 | `/factor-lab/runs/:runId/quality` | FactorLabView / factorQuality | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 34 | `/factor-lab/runs/:runId/handoff` | FactorLabView / factorHandoff | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 35 | `/strategies` | StrategyLabView / strategies | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 36 | `/strategies/new` | StrategyLabView / strategyNew | Blocked → T155 | local_unlock / local_write | blocked / recovery | Acceptance Pending |
| 37 | `/strategies/backtests/new` | StrategyLabView / backtestNew | Available | local_unlock / local_write | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 38 | `/strategies/backtests/:backtestId` | StrategyLabView / backtestResult | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 39 | `/strategies/paper/:sessionId` | StrategyLabView / paperSession | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 40 | `/strategies/risk-review/:id` | StrategyLabView / strategyRiskReview | Blocked → T159 | local_unlock / read_only | blocked / recovery | Acceptance Pending |
| 41 | `/strategies/execution/:id` | StrategyLabView / strategyExecution | Available | local_unlock / explicit_confirmation | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 42 | `/automation/workflows` | WorkflowStudioView / workflowCatalog | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 43 | `/automation/workflows/:templateId` | WorkflowStudioView / workflowDetail | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 44 | `/automation/workflows/:templateId/configure` | WorkflowStudioView / workflowConfigure | Available | local_unlock / local_write | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 45 | `/automation/workflows/runs` | WorkflowStudioView / workflowRuns | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 46 | `/automation/workflows/runs/:runId` | WorkflowStudioView / workflowRun | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 47 | `/automation/workflows/runs/:runId/artifacts` | WorkflowStudioView / workflowArtifacts | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 48 | `/automation/workflows/runs/:runId/confirm` | WorkflowStudioView / workflowConfirm | Blocked → T136 | local_unlock / explicit_confirmation | blocked / recovery | Acceptance Pending |
| 49 | `/automation/screeners` | ScreenersView / screenerCatalog | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 50 | `/automation/screeners/:presetKey/variants/:variantKey` | ScreenersView / screenerVariant | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 51 | `/automation/screeners/:presetKey/variants/:variantKey/tuning` | ScreenersView / screenerTuning | Available | local_unlock / local_write | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 52 | `/automation/screeners/:presetKey/universe` | ScreenersView / screenerUniverse | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 53 | `/automation/screeners/runs/:runId` | ScreenersView / screenerRun | Blocked → T137 | local_unlock / read_only | blocked / recovery | Acceptance Pending |
| 54 | `/automation/screeners/runs/:runId/explanations` | ScreenersView / screenerExplanations | Blocked → T137 | local_unlock / read_only | blocked / recovery | Acceptance Pending |
| 55 | `/portfolio/overview` | PortfolioView / portfolioOverview | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 56 | `/portfolio/holdings` | PortfolioView / portfolioHoldings | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 57 | `/portfolio/allocation` | PortfolioView / portfolioAllocation | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 58 | `/portfolio/analytics` | PortfolioView / portfolioAnalytics | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 59 | `/portfolio/risk` | PortfolioView / portfolioRisk | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 60 | `/portfolio/transactions` | PortfolioView / portfolioTransactions | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 61 | `/portfolio/transactions/new` | PortfolioView / portfolioTransactionNew | Available | local_unlock / local_write | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 62 | `/portfolio/handoff/:symbol` | PortfolioView / portfolioHandoff | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 63 | `/settings/connections/providers` | ConnectionsView / connectionsCatalog | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 64 | `/settings/connections/:provider` | ConnectionsView / connectionDetail | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 65 | `/settings/connections/credentials` | ConnectionsView / connectionCredentials | Available | local_unlock / local_write | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 66 | `/settings/connections/health` | ConnectionsView / connectionHealth | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 67 | `/settings/preferences` | SettingsView / settingsPreferences | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 68 | `/settings/appearance` | SettingsView / settingsAppearance | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 69 | `/settings/data` | SettingsView / settingsData | Blocked → T170 | local_unlock / read_only | blocked / recovery | Acceptance Pending |
| 70 | `/settings/security` | SettingsView / settingsSecurity | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 71 | `/settings/ai` | SettingsView / settingsAi | Blocked → T117 | local_unlock / read_only | blocked / recovery | Acceptance Pending |
| 72 | `/settings/execution` | SettingsView / settingsExecution | Available | local_unlock / explicit_confirmation | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 73 | `/settings/runtime` | SettingsView / settingsRuntime | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / recovery | Acceptance Pending |
| 74 | `/help/manual/getting-started` | ManualView / manualGettingStarted | Available | public / read_only | loading / empty / error / ready / recovery | Acceptance Pending |
| 75 | `/help/manual/research-data` | ManualView / manualResearchData | Available | public / read_only | loading / empty / error / ready / recovery | Acceptance Pending |
| 76 | `/help/manual/strategy-workflows` | ManualView / manualStrategyWorkflows | Available | public / read_only | loading / empty / error / ready / recovery | Acceptance Pending |
| 77 | `/help/manual/security-execution` | ManualView / manualSecurityExecution | Available | public / read_only | loading / empty / error / ready / recovery | Acceptance Pending |
| 78 | `/help/manual/troubleshooting` | ManualView / manualTroubleshooting | Available | public / read_only | loading / empty / error / ready / recovery | Acceptance Pending |
| 79 | `/ai-assistant` | AiAssistantView / aiAssistant | Available | local_unlock / read_only | loading / empty / blocked / error / locked / ready / ai-insufficient-evidence / cloud-opt-in / recovery | Acceptance Pending |

## 数据与状态原则

- Available 页面由真实业务 View 及其 API/cache 状态渲染；生产失败不会回退为 fixture ready。
- Fixture 仅允许 `VITE_DEMO_MODE=true`；视觉状态强制仅允许开发态 `VITE_VISUAL_TEST_MODE=true`。
- `local_unlock` 与 `explicit_confirmation` 可组合；确认型操作不能绕过本地解锁。
- Research AI 使用现有真实 assistant API；其余尚未实现的上下文 AI 显示带后续任务号的阻断态。独立 AI 页面提供本地/云端配置与状态，但不伪造模型输出。
