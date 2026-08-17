# SVG Frame 路由注册表

> 此文件由 `npm.cmd run check:svg-frame-registry` 生成。SVG 是唯一视觉基线，本文件只记录解析结果，不修改设计源。

- SVG：`Pengbo_UI_Rebuild.svg`
- SHA-256：`206E6C79553594070FE7ADE443D97094AC8016E515B19AE8F49B9B3544028CAF`
- Frame：79/79
- route：79/79
- 校验：通过

| Frame | SVG route | Real surface section | Availability | Access / action | Bounds |
| ---: | --- | --- | --- | --- | --- |
| 01 | /dashboard/overview | dashboardOverview | Available | public / read_only | 80, 150, 1440, 900 |
| 02 | /dashboard/runtime | dashboardRuntime | Available | public / read_only | 1660, 150, 1440, 900 |
| 03 | /command-center/actions | commandActions | Available | public / read_only | 80, 1170, 1440, 900 |
| 04 | /command-center/recent | commandRecent | Blocked → T109 | public / read_only | 1660, 1170, 1440, 900 |
| 05 | /command-center/results/:resultId | commandResult | Blocked → T109 | public / read_only | 80, 2190, 1440, 900 |
| 06 | /markets/assets | assetSearch | Available | public / read_only | 1660, 2190, 1440, 900 |
| 07 | /markets/assets/:symbol/overview | assetOverview | Available | public / read_only | 80, 3210, 1440, 900 |
| 08 | /markets/assets/:symbol/price | assetPrice | Available | public / read_only | 1660, 3210, 1440, 900 |
| 09 | /markets/assets/:symbol/fundamentals | assetFundamentals | Available | public / read_only | 80, 4230, 1440, 900 |
| 10 | /markets/assets/:symbol/filings | assetFilings | Available | public / read_only | 1660, 4230, 1440, 900 |
| 11 | /markets/assets/:symbol/data | assetData | Available | public / read_only | 80, 5250, 1440, 900 |
| 12 | /markets/assets/:symbol/research | assetResearch | Available | public / read_only | 1660, 5250, 1440, 900 |
| 13 | /markets/watchlist | watchlistIndex | Available | public / read_only | 80, 6270, 1440, 900 |
| 14 | /markets/watchlist/:listId | watchlistDetail | Blocked → T110 | public / read_only | 1660, 6270, 1440, 900 |
| 15 | /markets/watchlist/:listId/manage | watchlistManage | Blocked → T110 | public / local_write | 80, 7290, 1440, 900 |
| 16 | /markets/data-sources/catalog | dataSourcesCatalog | Available | local_unlock / read_only | 1660, 7290, 1440, 900 |
| 17 | /markets/data-sources/:provider | dataSourceDetail | Available | local_unlock / read_only | 80, 8310, 1440, 900 |
| 18 | /markets/data-sources/:provider/preview | dataSourcePreview | Available | local_unlock / read_only | 1660, 8310, 1440, 900 |
| 19 | /markets/data-sources/:provider/quality | dataSourceQuality | Available | local_unlock / read_only | 80, 9330, 1440, 900 |
| 20 | /markets/data-sources/report | dataSourcesReport | Available | local_unlock / read_only | 1660, 9330, 1440, 900 |
| 21 | /research/inbox | researchInbox | Available | local_unlock / read_only | 80, 10350, 1440, 900 |
| 22 | /research/briefs/:briefId/decision | researchDecision | Available | local_unlock / read_only | 1660, 10350, 1440, 900 |
| 23 | /research/briefs/:briefId/asset-data | researchAssetData | Available | local_unlock / read_only | 80, 11370, 1440, 900 |
| 24 | /research/briefs/:briefId/analysis | researchAnalysis | Available | local_unlock / read_only | 1660, 11370, 1440, 900 |
| 25 | /research/briefs/:briefId/evidence | researchEvidence | Available | local_unlock / read_only | 80, 12390, 1440, 900 |
| 26 | /research/briefs/:briefId/assistant | researchAssistant | Available | local_unlock / read_only | 1660, 12390, 1440, 900 |
| 27 | /research/briefs/:briefId/notes | researchNotes | Available | local_unlock / read_only | 80, 13410, 1440, 900 |
| 28 | /research/briefs/:briefId/export | researchExport | Available | local_unlock / read_only | 1660, 13410, 1440, 900 |
| 29 | /factor-lab/runs/new | factorRunNew | Available | local_unlock / local_write | 80, 14430, 1440, 900 |
| 30 | /factor-lab/runs | factorRuns | Available | local_unlock / read_only | 1660, 14430, 1440, 900 |
| 31 | /factor-lab/runs/:runId/results | factorResults | Available | local_unlock / read_only | 80, 15450, 1440, 900 |
| 32 | /factor-lab/runs/:runId/assets/:symbol | factorAssetExplanation | Available | local_unlock / read_only | 1660, 15450, 1440, 900 |
| 33 | /factor-lab/runs/:runId/quality | factorQuality | Available | local_unlock / read_only | 80, 16470, 1440, 900 |
| 34 | /factor-lab/runs/:runId/handoff | factorHandoff | Available | local_unlock / read_only | 1660, 16470, 1440, 900 |
| 35 | /strategies | strategies | Available | local_unlock / read_only | 80, 17490, 1440, 900 |
| 36 | /strategies/new | strategyNew | Blocked → T155 | local_unlock / local_write | 1660, 17490, 1440, 900 |
| 37 | /strategies/backtests/new | backtestNew | Available | local_unlock / local_write | 80, 18510, 1440, 900 |
| 38 | /strategies/backtests/:backtestId | backtestResult | Available | local_unlock / read_only | 1660, 18510, 1440, 900 |
| 39 | /strategies/paper/:sessionId | paperSession | Available | local_unlock / read_only | 80, 19530, 1440, 900 |
| 40 | /strategies/risk-review/:id | strategyRiskReview | Blocked → T159 | local_unlock / read_only | 1660, 19530, 1440, 900 |
| 41 | /strategies/execution/:id | strategyExecution | Available | local_unlock / explicit_confirmation | 80, 20550, 1440, 900 |
| 42 | /automation/workflows | workflowCatalog | Available | local_unlock / read_only | 1660, 20550, 1440, 900 |
| 43 | /automation/workflows/:templateId | workflowDetail | Available | local_unlock / read_only | 80, 21570, 1440, 900 |
| 44 | /automation/workflows/:templateId/configure | workflowConfigure | Available | local_unlock / local_write | 1660, 21570, 1440, 900 |
| 45 | /automation/workflows/runs | workflowRuns | Available | local_unlock / read_only | 80, 22590, 1440, 900 |
| 46 | /automation/workflows/runs/:runId | workflowRun | Available | local_unlock / read_only | 1660, 22590, 1440, 900 |
| 47 | /automation/workflows/runs/:runId/artifacts | workflowArtifacts | Available | local_unlock / read_only | 80, 23610, 1440, 900 |
| 48 | /automation/workflows/runs/:runId/confirm | workflowConfirm | Blocked → T136 | local_unlock / explicit_confirmation | 1660, 23610, 1440, 900 |
| 49 | /automation/screeners | screenerCatalog | Available | local_unlock / read_only | 80, 24630, 1440, 900 |
| 50 | /automation/screeners/:presetKey/variants/:variantKey | screenerVariant | Available | local_unlock / read_only | 1660, 24630, 1440, 900 |
| 51 | /automation/screeners/:presetKey/variants/:variantKey/tuning | screenerTuning | Available | local_unlock / local_write | 80, 25650, 1440, 900 |
| 52 | /automation/screeners/:presetKey/universe | screenerUniverse | Available | local_unlock / read_only | 1660, 25650, 1440, 900 |
| 53 | /automation/screeners/runs/:runId | screenerRun | Blocked → T137 | local_unlock / read_only | 80, 26670, 1440, 900 |
| 54 | /automation/screeners/runs/:runId/explanations | screenerExplanations | Blocked → T137 | local_unlock / read_only | 1660, 26670, 1440, 900 |
| 55 | /portfolio/overview | portfolioOverview | Available | local_unlock / read_only | 80, 27690, 1440, 900 |
| 56 | /portfolio/holdings | portfolioHoldings | Available | local_unlock / read_only | 1660, 27690, 1440, 900 |
| 57 | /portfolio/allocation | portfolioAllocation | Available | local_unlock / read_only | 80, 28710, 1440, 900 |
| 58 | /portfolio/analytics | portfolioAnalytics | Available | local_unlock / read_only | 1660, 28710, 1440, 900 |
| 59 | /portfolio/risk | portfolioRisk | Available | local_unlock / read_only | 80, 29730, 1440, 900 |
| 60 | /portfolio/transactions | portfolioTransactions | Available | local_unlock / read_only | 1660, 29730, 1440, 900 |
| 61 | /portfolio/transactions/new | portfolioTransactionNew | Available | local_unlock / local_write | 80, 30750, 1440, 900 |
| 62 | /portfolio/handoff/:symbol | portfolioHandoff | Available | local_unlock / read_only | 1660, 30750, 1440, 900 |
| 63 | /settings/connections/providers | connectionsCatalog | Available | local_unlock / read_only | 80, 31770, 1440, 900 |
| 64 | /settings/connections/:provider | connectionDetail | Available | local_unlock / read_only | 1660, 31770, 1440, 900 |
| 65 | /settings/connections/credentials | connectionCredentials | Available | local_unlock / local_write | 80, 32790, 1440, 900 |
| 66 | /settings/connections/health | connectionHealth | Available | local_unlock / read_only | 1660, 32790, 1440, 900 |
| 67 | /settings/preferences | settingsPreferences | Available | local_unlock / read_only | 80, 33810, 1440, 900 |
| 68 | /settings/appearance | settingsAppearance | Available | local_unlock / read_only | 1660, 33810, 1440, 900 |
| 69 | /settings/data | settingsData | Blocked → T170 | local_unlock / read_only | 80, 34830, 1440, 900 |
| 70 | /settings/security | settingsSecurity | Available | local_unlock / read_only | 1660, 34830, 1440, 900 |
| 71 | /settings/ai | settingsAi | Blocked → T117 | local_unlock / read_only | 80, 35850, 1440, 900 |
| 72 | /settings/execution | settingsExecution | Available | local_unlock / explicit_confirmation | 1660, 35850, 1440, 900 |
| 73 | /settings/runtime | settingsRuntime | Available | local_unlock / read_only | 80, 36870, 1440, 900 |
| 74 | /help/manual/getting-started | manualGettingStarted | Available | public / read_only | 1660, 36870, 1440, 900 |
| 75 | /help/manual/research-data | manualResearchData | Available | public / read_only | 80, 37890, 1440, 900 |
| 76 | /help/manual/strategy-workflows | manualStrategyWorkflows | Available | public / read_only | 1660, 37890, 1440, 900 |
| 77 | /help/manual/security-execution | manualSecurityExecution | Available | public / read_only | 80, 38910, 1440, 900 |
| 78 | /help/manual/troubleshooting | manualTroubleshooting | Available | public / read_only | 1660, 38910, 1440, 900 |
| 79 | /ai-assistant | aiAssistant | Available | local_unlock / read_only | 80, 39930, 1440, 900 |
