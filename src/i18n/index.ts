import { useMemo } from "react";
import { useAppStore, type LanguagePreference, type ViewKey } from "../store/app-store";

export type TranslationKey =
  | "app.brandEyebrow"
  | "app.brandName"
  | "nav.section"
  | "nav.group.home"
  | "nav.group.research"
  | "nav.group.markets"
  | "nav.group.portfolio"
  | "nav.group.factorLab"
  | "nav.group.automation"
  | "nav.group.settings"
  | "watchlist.title"
  | "topbar.commandPalette"
  | "topbar.searchPlaceholder"
  | "topbar.noMatchingAsset"
  | "runtime.online"
  | "runtime.offline"
  | "runtime.connecting"
  | "runtime.restart"
  | "runtime.restarting"
  | "runtime.exportDiagnostics"
  | "runtime.exporting"
  | "setup.firstRun"
  | "setup.environment"
  | "setup.connectingTitle"
  | "setup.needsSetupTitle"
  | "setup.readyTitle"
  | "setup.sidecarOfflineTitle"
  | "setup.providersNeedSetupTitle"
  | "setup.openConnections"
  | "setup.openSettings"
  | "setup.restartSidecar"
  | "setup.exportDiagnostics"
  | "setup.diagnosticsExported"
  | "dashboard.workspaceEyebrow"
  | "dashboard.workspaceTitle"
  | "dashboard.workspaceCopy"
  | "dashboard.openResearch"
  | "dashboard.marketPulse"
  | "dashboard.marketPulseTitle"
  | "dashboard.focusAsset"
  | "dashboard.noAsset"
  | "dashboard.noAssetCopy"
  | "dashboard.terminalReadiness"
  | "dashboard.terminalReadinessTitle"
  | "dashboard.realtime"
  | "dashboard.cached"
  | "dashboard.live"
  | "dashboard.localBackend"
  | "dashboard.providerStatus"
  | "dashboard.researchReady"
  | "dashboard.signalCount"
  | "dashboard.researchContext"
  | "dashboard.nextDecisionTitle"
  | "dashboard.orient"
  | "dashboard.orientCopy"
  | "dashboard.inspect"
  | "dashboard.inspectCopy"
  | "dashboard.evidence"
  | "dashboard.evidenceCopy"
  | "dashboard.current"
  | "dashboard.next"
  | "dashboard.local"
  | "dashboard.aiControl"
  | "dashboard.aiAssistant"
  | "dashboard.aiEnabled"
  | "dashboard.aiOff"
  | "dashboard.aiLocal"
  | "dashboard.aiCloud"
  | "dashboard.aiEndpoint"
  | "dashboard.aiModel"
  | "dashboard.aiLocalNote"
  | "dashboard.aiProvider"
  | "dashboard.aiBaseUrl"
  | "dashboard.aiApiKey"
  | "dashboard.aiConfigured"
  | "dashboard.aiMissing"
  | "dashboard.aiCloudNote"
  | "dashboard.savingAiSettings"
  | "dashboard.saveAiSettings"
  | "dashboard.loadingTitle"
  | "dashboard.loadingCopy"
  | "dashboard.errorTitle"
  | "dashboard.errorCopy"
  | "common.retry"
  | "common.status"
  | "common.primarySeries"
  | "common.noChartData"
  | "dataSources.eyebrow"
  | "dataSources.title"
  | "dataSources.refresh"
  | "dataSources.waiting"
  | "dataSources.sourceContract"
  | "dataSources.selectSource"
  | "dataSources.domains"
  | "dataSources.coverage"
  | "dataSources.freshness"
  | "dataSources.testing"
  | "dataSources.credentials"
  | "dataSources.cache"
  | "dataSources.stale"
  | "dataSources.required"
  | "dataSources.notRequired"
  | "dataSources.yes"
  | "dataSources.no"
  | "dataSources.setupTitle"
  | "dataSources.setupCopy"
  | "dataSources.registrationGuide"
  | "dataSources.paidPlanSteps"
  | "dataSources.previewEyebrow"
  | "dataSources.previewTitle"
  | "dataSources.macroProvider"
  | "dataSources.series"
  | "dataSources.country"
  | "dataSources.loadingMacro"
  | "dataSources.retryMacro"
  | "dataSources.cryptoContext"
  | "dataSources.credentialRequired"
  | "dataSources.cryptoSampleCopy"
  | "dataSources.cryptoSampleBoundary"
  | "dataSources.loadingCrypto"
  | "dataSources.retryCrypto"
  | "dataSources.eventQuery"
  | "dataSources.loadingNews"
  | "dataSources.retryNews"
  | "dataSources.exportReport"
  | "dataSources.exporting"
  | "dataSources.exported"
  | "dataSources.exportFailed"
  | "dataSources.notFetched"
  | "dataSources.pageCopy"
  | "dataSources.sourceCatalog"
  | "dataSources.sourceCatalogTitle"
  | "asset.loadingTitle"
  | "asset.loadingCopy"
  | "asset.errorTitle"
  | "asset.errorCopy"
  | "asset.detailEyebrow"
  | "asset.fundamentals"
  | "asset.secFilings"
  | "asset.company"
  | "asset.sector"
  | "asset.marketCap"
  | "asset.metadataNote"
  | "asset.overviewNote"
  | "asset.latestProviderNote"
  | "asset.available"
  | "asset.needCredentials"
  | "asset.tempUnavailable"
  | "asset.unsupported"
  | "asset.fundamentalsAvailable"
  | "asset.filingsAvailable"
  | "asset.credentialsRequired"
  | "asset.coverageUnavailable"
  | "asset.coverageUnsupported"
  | "asset.noFundamentals"
  | "asset.noFilings"
  | "asset.pageCopy"
  | "asset.cached"
  | "asset.observed"
  | "asset.openResearchBrief"
  | "asset.createResearchBrief"
  | "asset.researchLoop"
  | "asset.startBrief"
  | "asset.reviewEvidence"
  | "portfolio.asset"
  | "portfolio.assetClass"
  | "portfolio.currency"
  | "portfolio.market"
  | "portfolio.sector"
  | "portfolio.unavailable"
  | "portfolio.cached"
  | "portfolio.live"
  | "portfolio.valuationUnavailable"
  | "portfolio.symbolRequired"
  | "portfolio.deleteConfirm"
  | "portfolio.eyebrow"
  | "portfolio.overviewTitle"
  | "portfolio.emptyStatus"
  | "portfolio.connectingStatus"
  | "portfolio.degradedStatus"
  | "portfolio.connectingTitle"
  | "portfolio.connectingCopy"
  | "portfolio.emptyTitle"
  | "portfolio.emptyCopy"
  | "portfolio.sampleTitle"
  | "portfolio.sampleCopy"
  | "portfolio.sampleBoundary"
  | "portfolio.currentValue"
  | "portfolio.totalPnl"
  | "portfolio.dailyPnl"
  | "portfolio.positionCount"
  | "portfolio.chartUnavailableDegraded"
  | "portfolio.chartUnavailableEmpty"
  | "portfolio.summaryDegradedTitle"
  | "portfolio.summaryDegradedCopy"
  | "portfolio.analyticsTitle"
  | "portfolio.windowReturn"
  | "portfolio.maxDrawdown"
  | "portfolio.annualVolatility"
  | "portfolio.relative"
  | "portfolio.dataStatus"
  | "portfolio.averageCost"
  | "portfolio.realized"
  | "portfolio.unrealized"
  | "portfolio.analyticsEmpty"
  | "portfolio.allocationEyebrow"
  | "portfolio.allocationTitle"
  | "portfolio.allocationEmpty"
  | "portfolio.transactionsEyebrow"
  | "portfolio.addTransactionTitle"
  | "portfolio.editTransactionTitle"
  | "portfolio.reset"
  | "portfolio.symbol"
  | "portfolio.side"
  | "portfolio.buy"
  | "portfolio.sell"
  | "portfolio.quantity"
  | "portfolio.price"
  | "portfolio.fees"
  | "portfolio.tradeDate"
  | "portfolio.notes"
  | "portfolio.saving"
  | "portfolio.saveTransaction"
  | "portfolio.addTransaction"
  | "portfolio.manualSymbol"
  | "portfolio.serviceLocked"
  | "portfolio.holdingsEyebrow"
  | "portfolio.holdingsTitle"
  | "portfolio.holdingsLoading"
  | "portfolio.holdingsEmptyWithTransactions"
  | "portfolio.holdingsEmpty"
  | "portfolio.historyEyebrow"
  | "portfolio.historyTitle"
  | "portfolio.historyLoading"
  | "settings.runtimeEyebrow"
  | "settings.runtimeTitle"
  | "settings.refreshRuntime"
  | "settings.preferencesEyebrow"
  | "settings.preferencesTitle"
  | "settings.defaultView"
  | "settings.quoteTtl"
  | "settings.language"
  | "settings.languageZh"
  | "settings.languageEn"
  | "settings.density"
  | "settings.densityStandard"
  | "settings.densityCompact"
  | "settings.theme"
  | "settings.themeLight"
  | "settings.themeDark"
  | "settings.logCollection"
  | "settings.diagnosticsExport"
  | "settings.savePreferences"
  | "settings.saving"
  | "settings.loadingPreferences"
  | "settings.unableToLoadPreferences"
  | "settings.diagnosticsEyebrow"
  | "settings.diagnosticsTitle"
  | "settings.diagnosticsDisabled"
  | "settings.noDiagnosticsYet"
  | "settings.latestExport"
  | "settings.manifest"
  | "settings.included"
  | "settings.missing"
  | "settings.allIncluded"
  | "settings.runtimeMode"
  | "settings.baseUrl"
  | "settings.dataDirectory"
  | "settings.logDirectory"
  | "settings.diagnosticsDirectory"
  | "settings.sqlitePath"
  | "settings.duckdbPath"
  | "settings.stdoutLog"
  | "settings.stderrLog"
  | "settings.lastErrorLog"
  | "settings.bootstrapLog"
  | "settings.buildSummary"
  | "settings.runtimeModeHelper"
  | "settings.baseUrlHelper"
  | "settings.dataDirectoryHelper"
  | "settings.logDirectoryHelper"
  | "settings.diagnosticsDirectoryHelper"
  | "settings.sqlitePathHelper"
  | "settings.duckdbPathHelper"
  | "settings.stdoutLogHelper"
  | "settings.stderrLogHelper"
  | "settings.lastErrorLogHelper"
  | "settings.bootstrapLogHelper"
  | "settings.buildSummaryHelper"
  | "settings.latestExportHelper"
  | "settings.manifestHelper"
  | "settings.latestRuntimeError"
  | "command.eyebrow"
  | "command.title"
  | "command.placeholder"
  | "command.offline"
  | "command.currentScreener"
  | "command.empty"
  | "command.running"
  | "command.unavailable"
  | "command.assetEntry"
  | "command.assetEntryTitle"
  | "command.recentBriefs"
  | "command.continueBriefs"
  | "command.providers"
  | "command.providerBoundaries"
  | "command.reportExport"
  | "command.localMarkdownPacks"
  | "command.audit"
  | "command.redactedLocalEvents"
  | "command.safeChecks"
  | "command.noSecretReadiness"
  | "research.pageEyebrow"
  | "research.buildBrief"
  | "research.pageCopy"
  | "research.cached"
  | "research.local"
  | "research.ready"
  | "research.refresh"
  | "research.loop"
  | "research.loopTitle"
  | "research.localOnlyOutput";

type Dictionary = Record<LanguagePreference, Record<TranslationKey, string>>;

const dictionary: Dictionary = {
  "zh-CN": {
    "app.brandEyebrow": "彭博",
    "app.brandName": "彭博工作台",
    "nav.section": "导航",
    "nav.group.home": "首页",
    "nav.group.research": "研究",
    "nav.group.markets": "市场",
    "nav.group.portfolio": "投资组合",
    "nav.group.factorLab": "因子实验室",
    "nav.group.automation": "自动化",
    "nav.group.settings": "设置",
    "watchlist.title": "自选列表",
    "topbar.commandPalette": "命令面板",
    "topbar.searchPlaceholder": "搜索 AAPL / SPY / BTC/USDT",
    "topbar.noMatchingAsset": "没有匹配的资产。",
    "runtime.online": "本地服务在线",
    "runtime.offline": "本地服务离线",
    "runtime.connecting": "连接中",
    "runtime.restart": "重启",
    "runtime.restarting": "重启中...",
    "runtime.exportDiagnostics": "导出诊断",
    "runtime.exporting": "导出中...",
    "setup.firstRun": "首次运行",
    "setup.environment": "环境",
    "setup.connectingTitle": "正在连接桌面运行时",
    "setup.needsSetupTitle": "还差一步完成设置",
    "setup.readyTitle": "运行时已就绪",
    "setup.sidecarOfflineTitle": "本地服务离线",
    "setup.providersNeedSetupTitle": "部分数据源仍需设置",
    "setup.openConnections": "打开连接",
    "setup.openSettings": "打开设置",
    "setup.restartSidecar": "重启本地服务",
    "setup.exportDiagnostics": "导出诊断",
    "setup.diagnosticsExported": "诊断已导出到：",
    "dashboard.workspaceEyebrow": "工作区",
    "dashboard.workspaceTitle": "终端工作区已按单一主视图组织",
    "dashboard.workspaceCopy": "左侧保留导航和自选资产，顶部保留全局搜索、运行时状态和命令入口。后续 Workflow Studio 与 Data Sources 会接入同一套工作区骨架。",
    "dashboard.openResearch": "打开研究",
    "dashboard.marketPulse": "市场脉搏",
    "dashboard.marketPulseTitle": "风险偏好、宏观压力与基准走势",
    "dashboard.focusAsset": "焦点资产",
    "dashboard.noAsset": "未选择",
    "dashboard.noAssetCopy": "从左侧自选列表选择一个资产，或通过顶部搜索打开资产工作区。",
    "dashboard.terminalReadiness": "终端就绪度",
    "dashboard.terminalReadinessTitle": "当前产品面与后续扩展入口",
    "dashboard.realtime": "实时服务",
    "dashboard.cached": "缓存回退",
    "dashboard.live": "实时",
    "dashboard.localBackend": "本地 API、资产、研究与组合页面已接入真实运行时。",
    "dashboard.providerStatus": "连接页可检查 EDGAR、Binance 与能力矩阵。",
    "dashboard.researchReady": "研究、因子、策略与证据报告已形成可追踪链路。",
    "dashboard.loadingTitle": "正在加载仪表盘",
    "dashboard.loadingCopy": "正在从本地服务获取市场脉搏、自选列表和运行状态。",
    "dashboard.errorTitle": "仪表盘加载失败",
    "dashboard.errorCopy": "本地服务没有返回仪表盘数据。",
    "common.retry": "重试",
    "common.status": "状态",
    "common.primarySeries": "主序列",
    "common.noChartData": "暂无图表数据。",
    "dataSources.eyebrow": "数据源",
    "dataSources.title": "只读数据覆盖、缓存与新鲜度",
    "dataSources.refresh": "刷新",
    "dataSources.waiting": "Data Sources 正在等待本地 sidecar。",
    "dataSources.sourceContract": "来源契约",
    "dataSources.selectSource": "选择数据源",
    "dataSources.domains": "领域",
    "dataSources.coverage": "覆盖",
    "dataSources.freshness": "新鲜度",
    "dataSources.testing": "测试",
    "dataSources.credentials": "凭证",
    "dataSources.cache": "缓存",
    "dataSources.stale": "过期",
    "dataSources.required": "需要",
    "dataSources.notRequired": "不需要",
    "dataSources.yes": "是",
    "dataSources.no": "否",
    "dataSources.setupTitle": "付费与账号型来源设置",
    "dataSources.setupCopy": "FRED 和 CoinGecko key 可在桌面版保存到 Stronghold，也可从本地 sidecar 环境变量读取。免费或 demo key 可直接启用；CoinGecko 付费方案由用户自行开启，不会自动激活。",
    "dataSources.registrationGuide": "注册指南",
    "dataSources.paidPlanSteps": "付费方案步骤",
    "dataSources.previewEyebrow": "实时预览",
    "dataSources.previewTitle": "宏观、加密与事件样本",
    "dataSources.macroProvider": "宏观来源",
    "dataSources.series": "序列",
    "dataSources.country": "国家/地区",
    "dataSources.loadingMacro": "正在加载宏观序列...",
    "dataSources.retryMacro": "重试宏观",
    "dataSources.cryptoContext": "CoinGecko 市场上下文",
    "dataSources.credentialRequired": "需要凭证",
    "dataSources.cryptoSampleCopy": "No-key demo sample: BTC, ETH, and SOL remain visible as simulated context so reviewers can inspect the layout before adding a CoinGecko key.",
    "dataSources.cryptoSampleBoundary": "Sample only; the real CoinGecko preview stays credential-gated.",
    "dataSources.loadingCrypto": "正在加载加密市场上下文...",
    "dataSources.retryCrypto": "重试加密",
    "dataSources.eventQuery": "事件查询",
    "dataSources.loadingNews": "正在加载事件流...",
    "dataSources.retryNews": "重试新闻",
    "dataSources.exportReport": "导出来源报告",
    "dataSources.exporting": "导出中...",
    "dataSources.exported": "已导出到",
    "dataSources.exportFailed": "导出数据源报告失败",
    "dataSources.notFetched": "尚未获取",
    "asset.loadingTitle": "正在加载资产工作区",
    "asset.loadingCopy": "正在获取报价、历史走势、基本面和公告数据。",
    "asset.errorTitle": "资产工作区加载失败",
    "asset.errorCopy": "没有返回资产工作区数据。",
    "asset.detailEyebrow": "资产详情",
    "asset.fundamentals": "基本面",
    "asset.secFilings": "SEC 公告",
    "asset.company": "公司",
    "asset.sector": "行业",
    "asset.marketCap": "市值",
    "asset.metadataNote": "当前资产元数据与最新 provider 快照。",
    "asset.overviewNote": "最新可用的上游概览数据。",
    "asset.latestProviderNote": "最新 provider 快照。",
    "asset.available": "可用",
    "asset.needCredentials": "需凭证",
    "asset.tempUnavailable": "暂不可用",
    "asset.unsupported": "不支持",
    "asset.fundamentalsAvailable": "概览和指标可用",
    "asset.filingsAvailable": "EDGAR 公告可用",
    "asset.credentialsRequired": "加载此覆盖范围前需要凭证",
    "asset.coverageUnavailable": "该覆盖范围受支持，但当前暂不可用",
    "asset.coverageUnsupported": "当前资产不支持该覆盖范围",
    "asset.noFundamentals": "当前没有可用的基本面数据。",
    "asset.noFilings": "当前没有可用的公告数据。",
    "portfolio.asset": "资产",
    "portfolio.assetClass": "类别",
    "portfolio.currency": "币种",
    "portfolio.market": "市场",
    "portfolio.sector": "行业",
    "portfolio.unavailable": "不可用",
    "portfolio.cached": "缓存",
    "portfolio.live": "实时",
    "portfolio.valuationUnavailable": "估值暂不可用",
    "portfolio.symbolRequired": "请输入资产代码。",
    "portfolio.deleteConfirm": "确定删除这条交易记录吗？",
    "portfolio.eyebrow": "投资组合",
    "portfolio.overviewTitle": "组合表现、风险与配置",
    "portfolio.emptyStatus": "空",
    "portfolio.connectingStatus": "连接中",
    "portfolio.degradedStatus": "降级",
    "portfolio.connectingTitle": "正在等待本地服务",
    "portfolio.connectingCopy": "运行时健康检查完成后，桌面端会自动加载投资组合数据。",
    "portfolio.emptyTitle": "还没有投资组合交易",
    "portfolio.emptyCopy": "保存第一条手动交易后，这里会显示持仓、收益、风险和配置。",
    "portfolio.sampleTitle": "Sample portfolio preview",
    "portfolio.sampleCopy": "Use the sample asset mix to understand holdings, allocation, and risk before saving real local transactions.",
    "portfolio.sampleBoundary": "Sample only; no private account state, provider credentials, or live orders are used.",
    "portfolio.currentValue": "当前市值",
    "portfolio.totalPnl": "总盈亏",
    "portfolio.dailyPnl": "当日盈亏",
    "portfolio.positionCount": "持仓数",
    "portfolio.chartUnavailableDegraded": "当前无法生成组合表现曲线，但交易和持仓仍可继续使用。",
    "portfolio.chartUnavailableEmpty": "第一段可定价时间线生成后，这里会显示组合表现。",
    "portfolio.summaryDegradedTitle": "投资组合汇总已降级",
    "portfolio.summaryDegradedCopy": "当前无法渲染汇总，但你仍然可以在下方编辑交易。",
    "portfolio.analyticsTitle": "窗口指标",
    "portfolio.windowReturn": "窗口收益",
    "portfolio.maxDrawdown": "最大回撤",
    "portfolio.annualVolatility": "年化波动",
    "portfolio.relative": "相对",
    "portfolio.dataStatus": "数据状态",
    "portfolio.averageCost": "平均成本法",
    "portfolio.realized": "已实现",
    "portfolio.unrealized": "未实现",
    "portfolio.analyticsEmpty": "组合 analytics 会在汇总可用后显示。",
    "portfolio.allocationEyebrow": "配置",
    "portfolio.allocationTitle": "资产拆分",
    "portfolio.allocationEmpty": "暂无可定价持仓用于配置拆分。",
    "portfolio.transactionsEyebrow": "交易",
    "portfolio.addTransactionTitle": "新增投资组合交易",
    "portfolio.editTransactionTitle": "编辑投资组合交易",
    "portfolio.reset": "重置",
    "portfolio.symbol": "代码",
    "portfolio.side": "方向",
    "portfolio.buy": "买入",
    "portfolio.sell": "卖出",
    "portfolio.quantity": "数量",
    "portfolio.price": "价格",
    "portfolio.fees": "费用",
    "portfolio.tradeDate": "交易日期",
    "portfolio.notes": "备注",
    "portfolio.saving": "保存中...",
    "portfolio.saveTransaction": "保存交易",
    "portfolio.addTransaction": "新增交易",
    "portfolio.manualSymbol": "当前没有可选自选资产，已启用手动输入代码；代码仍需存在于资产目录中。",
    "portfolio.serviceLocked": "本地服务就绪后，交易操作会自动解锁。",
    "portfolio.holdingsEyebrow": "持仓",
    "portfolio.holdingsTitle": "当前持仓",
    "portfolio.holdingsLoading": "本地运行时就绪后会加载持仓。",
    "portfolio.holdingsEmptyWithTransactions": "当前没有未平仓持仓。",
    "portfolio.holdingsEmpty": "保存第一条投资组合交易后，这里会出现持仓。",
    "portfolio.historyEyebrow": "历史",
    "portfolio.historyTitle": "已持久化交易记录",
    "portfolio.historyLoading": "本地运行时就绪后会加载交易历史。",
    "settings.runtimeEyebrow": "运行时",
    "settings.runtimeTitle": "检查真实桌面运行时路径",
    "settings.refreshRuntime": "刷新运行时",
    "settings.preferencesEyebrow": "偏好",
    "settings.preferencesTitle": "保存重启后仍应保留的桌面行为",
    "settings.defaultView": "默认视图",
    "settings.quoteTtl": "行情 TTL（分钟）",
    "settings.language": "语言",
    "settings.languageZh": "中文",
    "settings.languageEn": "English",
    "settings.density": "界面密度",
    "settings.densityStandard": "标准",
    "settings.densityCompact": "紧凑",
    "settings.theme": "界面主题",
    "settings.themeLight": "浅色",
    "settings.themeDark": "深色",
    "settings.logCollection": "保持运行日志采集开启",
    "settings.diagnosticsExport": "启用桌面诊断导出",
    "settings.savePreferences": "保存偏好",
    "settings.saving": "保存中...",
    "settings.loadingPreferences": "正在加载偏好...",
    "settings.unableToLoadPreferences": "无法加载偏好。",
    "settings.diagnosticsEyebrow": "诊断",
    "settings.diagnosticsTitle": "导出包含运行上下文和日志的支持包",
    "settings.diagnosticsDisabled": "诊断导出已在偏好中关闭。",
    "settings.noDiagnosticsYet": "本会话尚未导出诊断包。",
    "settings.latestExport": "最近导出",
    "settings.manifest": "清单",
    "settings.included": "已包含",
    "settings.missing": "缺失",
    "settings.allIncluded": "所有预期诊断文件均已包含。",
    "settings.runtimeMode": "运行模式",
    "settings.baseUrl": "Base URL",
    "settings.dataDirectory": "数据目录",
    "settings.logDirectory": "日志目录",
    "settings.diagnosticsDirectory": "诊断目录",
    "settings.sqlitePath": "SQLite 路径",
    "settings.duckdbPath": "DuckDB 路径",
    "settings.stdoutLog": "Stdout 日志",
    "settings.stderrLog": "Stderr 日志",
    "settings.lastErrorLog": "最近错误日志",
    "settings.bootstrapLog": "启动日志",
    "settings.buildSummary": "构建摘要",
    "settings.runtimeModeHelper": "sidecar 当前报告的运行模式。",
    "settings.baseUrlHelper": "桌面应用使用的 API base URL。",
    "settings.dataDirectoryHelper": "SQLite 和 DuckDB 都位于此根目录下。",
    "settings.logDirectoryHelper": "桌面和 sidecar 日志写入此处。",
    "settings.diagnosticsDirectoryHelper": "诊断包和导出报告写入此处。",
    "settings.sqlitePathHelper": "偏好、自选、研究简报和交易记录持久化于此。",
    "settings.duckdbPathHelper": "报价、历史、公告和 provider 快照缓存于此。",
    "settings.stdoutLogHelper": "本地 sidecar 的标准输出。",
    "settings.stderrLogHelper": "本地 sidecar 的错误输出。",
    "settings.lastErrorLogHelper": "最近一次 sidecar 启动或运行失败。",
    "settings.bootstrapLogHelper": "启动健康状态和引导追踪。",
    "settings.buildSummaryHelper": "可用时显示最近 packaged sidecar 构建摘要。",
    "settings.latestExportHelper": "本会话最近生成的诊断包。",
    "settings.manifestHelper": "描述已复制和缺失文件的清单。",
    "settings.latestRuntimeError": "最近运行时错误：",
    "command.eyebrow": "命令面板",
    "command.title": "从一个入口执行跨工作区操作",
    "command.placeholder": "搜索资产、简报、筛选器、provider 或导出",
    "command.offline": "本地服务离线。运行时恢复前，数据操作保持禁用。",
    "command.currentScreener": "当前筛选上下文",
    "command.empty": "没有命令匹配当前查询。",
    "command.running": "运行中",
    "command.unavailable": "不可用",
    "dashboard.signalCount": "个信号",
    "dashboard.researchContext": "研究上下文",
    "dashboard.nextDecisionTitle": "让下一步决策保持可见",
    "dashboard.orient": "定位",
    "dashboard.orientCopy": "市场脉搏和选中资产均已呈现。",
    "dashboard.inspect": "检查",
    "dashboard.inspectCopy": "打开资产或命令中心，选择研究目标。",
    "dashboard.evidence": "证据",
    "dashboard.evidenceCopy": "研究会保留新鲜度、来源和限制说明。",
    "dashboard.current": "当前",
    "dashboard.next": "下一步",
    "dashboard.local": "本地",
    "dashboard.aiControl": "AI 控制",
    "dashboard.aiAssistant": "本地 AI 研究助手",
    "dashboard.aiEnabled": "已启用",
    "dashboard.aiOff": "关闭",
    "dashboard.aiLocal": "本地",
    "dashboard.aiCloud": "云端",
    "dashboard.aiEndpoint": "接口",
    "dashboard.aiModel": "模型",
    "dashboard.aiLocalNote": "本地模式走 Ollama，不会把研究上下文发到云端。",
    "dashboard.aiProvider": "供应商",
    "dashboard.aiBaseUrl": "Base URL",
    "dashboard.aiApiKey": "API key",
    "dashboard.aiConfigured": "已配置",
    "dashboard.aiMissing": "缺失",
    "dashboard.aiCloudNote": "云端模式只会在研究页逐次确认后发送已脱敏的证据上下文。",
    "dashboard.savingAiSettings": "保存中...",
    "dashboard.saveAiSettings": "保存 AI 设置",
    "dataSources.pageCopy": "在创建研究前，先检查数据源覆盖范围、新鲜度、缓存状态和只读边界。",
    "dataSources.sourceCatalog": "来源目录",
    "dataSources.sourceCatalogTitle": "选择数据源以检查其契约",
    "asset.pageCopy": "在交接到研究前，将行情、覆盖范围和来源上下文集中展示。",
    "asset.cached": "缓存",
    "asset.observed": "已观测",
    "asset.openResearchBrief": "打开研究简报",
    "asset.createResearchBrief": "创建研究简报",
    "asset.researchLoop": "研究流程",
    "asset.startBrief": "从该资产开始简报",
    "asset.reviewEvidence": "查看证据",
    "command.assetEntry": "资产入口",
    "command.assetEntryTitle": "搜索标的并进入研究流",
    "command.recentBriefs": "最近研究",
    "command.continueBriefs": "继续已有简报",
    "command.providers": "数据源",
    "command.providerBoundaries": "刷新与凭证边界",
    "command.reportExport": "报告导出",
    "command.localMarkdownPacks": "本地 Markdown 证据包",
    "command.audit": "审计",
    "command.redactedLocalEvents": "脱敏本地事件",
    "command.safeChecks": "安全检查",
    "command.noSecretReadiness": "无密钥本地就绪检查",
    "research.pageEyebrow": "研究",
    "research.buildBrief": "构建本地证据简报",
    "research.pageCopy": "搜索、复核、批注并导出有来源意识的研究产品，同时不越过本地安全边界。",
    "research.cached": "缓存",
    "research.local": "本地",
    "research.ready": "就绪",
    "research.refresh": "刷新",
    "research.loop": "研究流程",
    "research.loopTitle": "目标、证据与下一步行动",
    "research.localOnlyOutput": "仅本地输出",
  },
  "en-US": {
    "app.brandEyebrow": "Pengbo",
    "app.brandName": "Pengbo Workbench",
    "nav.section": "Navigation",
    "nav.group.home": "Home",
    "nav.group.research": "Research",
    "nav.group.markets": "Markets",
    "nav.group.portfolio": "Portfolio",
    "nav.group.factorLab": "Factor Lab",
    "nav.group.automation": "Automation",
    "nav.group.settings": "Settings",
    "watchlist.title": "Watchlist",
    "topbar.commandPalette": "Command Palette",
    "topbar.searchPlaceholder": "Search AAPL / SPY / BTC/USDT",
    "topbar.noMatchingAsset": "No matching asset.",
    "runtime.online": "Local service online",
    "runtime.offline": "Local service offline",
    "runtime.connecting": "Connecting",
    "runtime.restart": "Restart",
    "runtime.restarting": "Restarting...",
    "runtime.exportDiagnostics": "Export diagnostics",
    "runtime.exporting": "Exporting...",
    "setup.firstRun": "First run",
    "setup.environment": "Environment",
    "setup.connectingTitle": "Connecting the desktop runtime",
    "setup.needsSetupTitle": "One more step to finish setup",
    "setup.readyTitle": "Runtime ready",
    "setup.sidecarOfflineTitle": "Local sidecar offline",
    "setup.providersNeedSetupTitle": "Some providers still need setup",
    "setup.openConnections": "Open connections",
    "setup.openSettings": "Open settings",
    "setup.restartSidecar": "Restart sidecar",
    "setup.exportDiagnostics": "Export diagnostics",
    "setup.diagnosticsExported": "Diagnostics exported to:",
    "dashboard.workspaceEyebrow": "Workspace",
    "dashboard.workspaceTitle": "The terminal workspace is organized around one active view",
    "dashboard.workspaceCopy": "Navigation and watchlist stay on the left; search, runtime status, and commands stay global. Workflow Studio and Data Sources can later join this same workspace frame.",
    "dashboard.openResearch": "Open research",
    "dashboard.marketPulse": "Market Pulse",
    "dashboard.marketPulseTitle": "Risk appetite, macro pressure, and benchmark drift",
    "dashboard.focusAsset": "Focus Asset",
    "dashboard.noAsset": "Not selected",
    "dashboard.noAssetCopy": "Choose an asset from the watchlist or use top search to open the asset workspace.",
    "dashboard.terminalReadiness": "Terminal Readiness",
    "dashboard.terminalReadinessTitle": "Current product surface and expansion path",
    "dashboard.realtime": "Realtime service",
    "dashboard.cached": "Cached fallback",
    "dashboard.live": "Live",
    "dashboard.localBackend": "Local API, asset, research, and portfolio surfaces use the real runtime.",
    "dashboard.providerStatus": "Connections exposes EDGAR, Binance, and capability matrix health.",
    "dashboard.researchReady": "Research, factor, strategy, and evidence reports form a traceable chain.",
    "dashboard.signalCount": "signals",
    "dashboard.researchContext": "Research context",
    "dashboard.nextDecisionTitle": "Keep the next decision visible",
    "dashboard.orient": "Orient",
    "dashboard.orientCopy": "Market pulse and the selected asset stay visible.",
    "dashboard.inspect": "Inspect",
    "dashboard.inspectCopy": "Open Asset or Command Center to choose a research target.",
    "dashboard.evidence": "Evidence",
    "dashboard.evidenceCopy": "Research keeps freshness, sources, and limitations visible.",
    "dashboard.current": "Current",
    "dashboard.next": "Next",
    "dashboard.local": "Local",
    "dashboard.aiControl": "AI control",
    "dashboard.aiAssistant": "Local AI research assistant",
    "dashboard.aiEnabled": "Enabled",
    "dashboard.aiOff": "Off",
    "dashboard.aiLocal": "Local",
    "dashboard.aiCloud": "Cloud",
    "dashboard.aiEndpoint": "Endpoint",
    "dashboard.aiModel": "Model",
    "dashboard.aiLocalNote": "Local mode uses Ollama and does not send research context to the cloud.",
    "dashboard.aiProvider": "Provider",
    "dashboard.aiBaseUrl": "Base URL",
    "dashboard.aiApiKey": "API key",
    "dashboard.aiConfigured": "Configured",
    "dashboard.aiMissing": "Missing",
    "dashboard.aiCloudNote": "Cloud mode sends redacted evidence context only after per-research confirmation.",
    "dashboard.savingAiSettings": "Saving...",
    "dashboard.saveAiSettings": "Save AI settings",
    "dashboard.loadingTitle": "Loading dashboard",
    "dashboard.loadingCopy": "Fetching market pulse, watchlist, and runtime state from the local service.",
    "dashboard.errorTitle": "Dashboard failed to load",
    "dashboard.errorCopy": "The local service did not return dashboard data.",
    "common.retry": "Retry",
    "common.status": "Status",
    "common.primarySeries": "Primary series",
    "common.noChartData": "No chart data yet.",
    "dataSources.eyebrow": "Data Sources",
    "dataSources.title": "Read-only source coverage and freshness",
    "dataSources.refresh": "Refresh",
    "dataSources.waiting": "Data Sources is waiting for the local sidecar.",
    "dataSources.sourceContract": "Source Contract",
    "dataSources.selectSource": "Select a source",
    "dataSources.domains": "Domains",
    "dataSources.coverage": "Coverage",
    "dataSources.freshness": "Freshness",
    "dataSources.testing": "Testing",
    "dataSources.credentials": "Credentials",
    "dataSources.cache": "Cache",
    "dataSources.stale": "Stale",
    "dataSources.required": "required",
    "dataSources.notRequired": "not required",
    "dataSources.yes": "yes",
    "dataSources.no": "no",
    "dataSources.setupTitle": "Paid and account-gated setup",
    "dataSources.setupCopy": "FRED and CoinGecko keys can be saved to Stronghold in the desktop app or read from local sidecar environment variables. Free/demo keys can be enabled without code changes; paid CoinGecko remains a user-controlled upgrade and is not activated automatically.",
    "dataSources.registrationGuide": "Registration guide",
    "dataSources.paidPlanSteps": "Paid plan steps",
    "dataSources.previewEyebrow": "Live Preview",
    "dataSources.previewTitle": "Macro, crypto, and event samples",
    "dataSources.macroProvider": "Macro provider",
    "dataSources.series": "Series",
    "dataSources.country": "Country",
    "dataSources.loadingMacro": "Loading macro series...",
    "dataSources.retryMacro": "Retry macro",
    "dataSources.cryptoContext": "CoinGecko market context",
    "dataSources.credentialRequired": "credential required",
    "dataSources.cryptoSampleCopy": "No-key demo sample: BTC, ETH, and SOL remain visible as simulated context so reviewers can inspect the layout before adding a CoinGecko key.",
    "dataSources.cryptoSampleBoundary": "Sample only; the real CoinGecko preview stays credential-gated.",
    "dataSources.loadingCrypto": "Loading crypto context...",
    "dataSources.retryCrypto": "Retry crypto",
    "dataSources.eventQuery": "Event query",
    "dataSources.loadingNews": "Loading event feed...",
    "dataSources.retryNews": "Retry news",
    "dataSources.exportReport": "Export source report",
    "dataSources.exporting": "Exporting...",
    "dataSources.exported": "Exported to",
    "dataSources.exportFailed": "Failed to export data source report",
    "dataSources.notFetched": "not fetched",
    "dataSources.pageCopy": "Check coverage, freshness, cache state, and read-only boundaries before starting research.",
    "dataSources.sourceCatalog": "Source catalog",
    "dataSources.sourceCatalogTitle": "Select a source to inspect its contract",
    "asset.loadingTitle": "Loading asset workspace",
    "asset.loadingCopy": "Fetching quotes, history, fundamentals, and filings.",
    "asset.errorTitle": "Asset workspace failed to load",
    "asset.errorCopy": "No asset payload returned.",
    "asset.detailEyebrow": "Asset Detail",
    "asset.fundamentals": "Fundamentals",
    "asset.secFilings": "SEC Filings",
    "asset.company": "Company",
    "asset.sector": "Sector",
    "asset.marketCap": "Market cap",
    "asset.metadataNote": "Current asset metadata plus the latest provider snapshot.",
    "asset.overviewNote": "Latest available upstream overview data.",
    "asset.latestProviderNote": "Latest provider snapshot.",
    "asset.available": "Available",
    "asset.needCredentials": "Need creds",
    "asset.tempUnavailable": "Temp unavailable",
    "asset.unsupported": "Unsupported",
    "asset.fundamentalsAvailable": "Overview and ratios are available",
    "asset.filingsAvailable": "Live EDGAR filings are available",
    "asset.credentialsRequired": "Credentials are required before this coverage can load",
    "asset.coverageUnavailable": "Coverage is supported but temporarily unavailable",
    "asset.coverageUnsupported": "This coverage is unsupported for the current asset",
    "asset.noFundamentals": "No fundamentals are currently available.",
    "asset.noFilings": "No filings are currently available.",
    "asset.pageCopy": "Bring quote coverage and source context together before handing off to research.",
    "asset.cached": "Cached",
    "asset.observed": "Observed",
    "asset.openResearchBrief": "Open research brief",
    "asset.createResearchBrief": "Create research brief",
    "asset.researchLoop": "Research loop",
    "asset.startBrief": "Start a brief from this asset",
    "asset.reviewEvidence": "Review evidence",
    "portfolio.asset": "Asset",
    "portfolio.assetClass": "Class",
    "portfolio.currency": "Currency",
    "portfolio.market": "Market",
    "portfolio.sector": "Sector",
    "portfolio.unavailable": "Unavailable",
    "portfolio.cached": "Cached",
    "portfolio.live": "Live",
    "portfolio.valuationUnavailable": "Valuation unavailable",
    "portfolio.symbolRequired": "Enter an asset symbol.",
    "portfolio.deleteConfirm": "Delete this transaction?",
    "portfolio.eyebrow": "Portfolio",
    "portfolio.overviewTitle": "Performance, risk, and allocation",
    "portfolio.emptyStatus": "Empty",
    "portfolio.connectingStatus": "Connecting",
    "portfolio.degradedStatus": "Degraded",
    "portfolio.connectingTitle": "Waiting for local service",
    "portfolio.connectingCopy": "Portfolio data will load automatically after the runtime health check completes.",
    "portfolio.emptyTitle": "No portfolio transactions yet",
    "portfolio.emptyCopy": "Save the first manual transaction to unlock holdings, returns, risk, and allocation.",
    "portfolio.sampleTitle": "Sample portfolio preview",
    "portfolio.sampleCopy": "Use the sample asset mix to understand holdings, allocation, and risk before saving real local transactions.",
    "portfolio.sampleBoundary": "Sample only; no private account state, provider credentials, or live orders are used.",
    "portfolio.currentValue": "Current value",
    "portfolio.totalPnl": "Total PnL",
    "portfolio.dailyPnl": "Daily PnL",
    "portfolio.positionCount": "Positions",
    "portfolio.chartUnavailableDegraded": "The performance curve is unavailable right now, but transactions and holdings remain usable.",
    "portfolio.chartUnavailableEmpty": "The performance curve will appear after the first priceable timeline is available.",
    "portfolio.summaryDegradedTitle": "Portfolio summary degraded",
    "portfolio.summaryDegradedCopy": "The summary cannot render right now, but transactions can still be edited below.",
    "portfolio.analyticsTitle": "Window metrics",
    "portfolio.windowReturn": "Window return",
    "portfolio.maxDrawdown": "Max drawdown",
    "portfolio.annualVolatility": "Annualized volatility",
    "portfolio.relative": "Relative",
    "portfolio.dataStatus": "Data status",
    "portfolio.averageCost": "Average-cost method",
    "portfolio.realized": "Realized",
    "portfolio.unrealized": "Unrealized",
    "portfolio.analyticsEmpty": "Portfolio analytics will appear after the summary is available.",
    "portfolio.allocationEyebrow": "Allocation",
    "portfolio.allocationTitle": "Asset breakdown",
    "portfolio.allocationEmpty": "No priceable holdings are available for allocation breakdown.",
    "portfolio.transactionsEyebrow": "Transactions",
    "portfolio.addTransactionTitle": "Add portfolio transaction",
    "portfolio.editTransactionTitle": "Edit portfolio transaction",
    "portfolio.reset": "Reset",
    "portfolio.symbol": "Symbol",
    "portfolio.side": "Side",
    "portfolio.buy": "Buy",
    "portfolio.sell": "Sell",
    "portfolio.quantity": "Quantity",
    "portfolio.price": "Price",
    "portfolio.fees": "Fees",
    "portfolio.tradeDate": "Trade date",
    "portfolio.notes": "Notes",
    "portfolio.saving": "Saving...",
    "portfolio.saveTransaction": "Save transaction",
    "portfolio.addTransaction": "Add transaction",
    "portfolio.manualSymbol": "No watchlist assets are available, so manual symbol entry is enabled; the symbol must still exist in the asset catalog.",
    "portfolio.serviceLocked": "Transaction actions unlock automatically after the local service is ready.",
    "portfolio.holdingsEyebrow": "Holdings",
    "portfolio.holdingsTitle": "Current holdings",
    "portfolio.holdingsLoading": "Holdings will load after the local runtime is ready.",
    "portfolio.holdingsEmptyWithTransactions": "There are no open holdings right now.",
    "portfolio.holdingsEmpty": "Holdings will appear after the first portfolio transaction is saved.",
    "portfolio.historyEyebrow": "History",
    "portfolio.historyTitle": "Persisted transaction records",
    "portfolio.historyLoading": "Transaction history will load after the local runtime is ready.",
    "settings.runtimeEyebrow": "Runtime",
    "settings.runtimeTitle": "Inspect real desktop runtime paths",
    "settings.refreshRuntime": "Refresh runtime",
    "settings.preferencesEyebrow": "Preferences",
    "settings.preferencesTitle": "Save desktop behavior that should persist across restarts",
    "settings.defaultView": "Default view",
    "settings.quoteTtl": "Quote TTL (minutes)",
    "settings.language": "Language",
    "settings.languageZh": "中文",
    "settings.languageEn": "English",
    "settings.density": "Density",
    "settings.densityStandard": "Standard",
    "settings.densityCompact": "Compact",
    "settings.theme": "Theme",
    "settings.themeLight": "Light",
    "settings.themeDark": "Dark",
    "settings.logCollection": "Keep runtime log collection enabled",
    "settings.diagnosticsExport": "Enable desktop diagnostics export",
    "settings.savePreferences": "Save preferences",
    "settings.saving": "Saving...",
    "settings.loadingPreferences": "Loading preferences...",
    "settings.unableToLoadPreferences": "Unable to load preferences.",
    "settings.diagnosticsEyebrow": "Diagnostics",
    "settings.diagnosticsTitle": "Export a support bundle with runtime context and logs",
    "settings.diagnosticsDisabled": "Diagnostics export is currently disabled in preferences.",
    "settings.noDiagnosticsYet": "No diagnostics bundle has been exported in this session yet.",
    "settings.latestExport": "Latest export",
    "settings.manifest": "Manifest",
    "settings.included": "Included",
    "settings.missing": "Missing",
    "settings.allIncluded": "All expected diagnostics artifacts were included.",
    "settings.runtimeMode": "Runtime mode",
    "settings.baseUrl": "Base URL",
    "settings.dataDirectory": "Data directory",
    "settings.logDirectory": "Log directory",
    "settings.diagnosticsDirectory": "Diagnostics directory",
    "settings.sqlitePath": "SQLite path",
    "settings.duckdbPath": "DuckDB path",
    "settings.stdoutLog": "Stdout log",
    "settings.stderrLog": "Stderr log",
    "settings.lastErrorLog": "Last error log",
    "settings.bootstrapLog": "Bootstrap log",
    "settings.buildSummary": "Build summary",
    "settings.runtimeModeHelper": "Current runtime mode reported by the sidecar.",
    "settings.baseUrlHelper": "API base URL used by the desktop app.",
    "settings.dataDirectoryHelper": "SQLite and DuckDB both live under this root.",
    "settings.logDirectoryHelper": "Desktop and sidecar logs are written here.",
    "settings.diagnosticsDirectoryHelper": "Diagnostics bundles and exported reports land here.",
    "settings.sqlitePathHelper": "Preferences, watchlists, research briefs, and transactions persist here.",
    "settings.duckdbPathHelper": "Cached quotes, history, filings, and provider snapshots persist here.",
    "settings.stdoutLogHelper": "Captured standard output from the local sidecar.",
    "settings.stderrLogHelper": "Captured error output from the local sidecar.",
    "settings.lastErrorLogHelper": "Most recent sidecar startup or runtime failure.",
    "settings.bootstrapLogHelper": "Bootstrap health and startup tracing.",
    "settings.buildSummaryHelper": "Latest packaged sidecar build summary when available.",
    "settings.latestExportHelper": "Most recent diagnostics bundle generated in this session.",
    "settings.manifestHelper": "Manifest file describing copied and missing artifacts.",
    "settings.latestRuntimeError": "Latest runtime error:",
    "command.eyebrow": "Command Palette",
    "command.title": "Run cross-workspace actions from one place",
    "command.placeholder": "Search asset, brief, screener, provider, or export",
    "command.offline": "The local sidecar is offline. Data actions stay disabled until runtime health recovers.",
    "command.currentScreener": "Current screener context",
    "command.empty": "No command matches the current query.",
    "command.running": "Running",
    "command.unavailable": "Unavailable",
    "command.assetEntry": "Asset entry",
    "command.assetEntryTitle": "Search a symbol and enter the research loop",
    "command.recentBriefs": "Recent research",
    "command.continueBriefs": "Continue existing briefs",
    "command.providers": "Data sources",
    "command.providerBoundaries": "Refresh and credential boundaries",
    "command.reportExport": "Report export",
    "command.localMarkdownPacks": "Local Markdown evidence packs",
    "command.audit": "Audit",
    "command.redactedLocalEvents": "Redacted local events",
    "command.safeChecks": "Safety checks",
    "command.noSecretReadiness": "No-key local readiness check",
    "research.pageEyebrow": "Research",
    "research.buildBrief": "Build a local evidence brief",
    "research.pageCopy": "Search, review, annotate, and export a source-aware research product without crossing the local security boundary.",
    "research.cached": "Cached",
    "research.local": "Local",
    "research.ready": "Ready",
    "research.refresh": "Refresh",
    "research.loop": "Research loop",
    "research.loopTitle": "Target, evidence, and next action",
    "research.localOnlyOutput": "Local-only output",
  },
};

export const viewLabels: Record<LanguagePreference, Record<string, string>> = {
  "zh-CN": {
    dashboard: "仪表盘",
    commandCenter: "命令中心",
    asset: "资产",
    research: "研究",
    factorLab: "因子实验室",
    strategyLab: "策略实验室",
    workflowStudio: "工作流",
    dataSources: "数据源",
    screeners: "筛选器",
    manual: "说明书",
    portfolio: "投资组合",
    connections: "连接",
    settings: "设置",
  },
  "en-US": {
    dashboard: "Dashboard",
    commandCenter: "Command Center",
    asset: "Asset",
    research: "Research",
    factorLab: "Factor Lab",
    strategyLab: "Strategy Lab",
    workflowStudio: "Workflow",
    dataSources: "Data Sources",
    screeners: "Screeners",
    manual: "Manual",
    portfolio: "Portfolio",
    connections: "Connections",
    settings: "Settings",
  },
};

export const viewEyebrows: Record<LanguagePreference, Record<string, string>> = viewLabels;

export const viewTitles: Record<LanguagePreference, Record<string, string>> = {
  "zh-CN": {
    dashboard: "市场与运行时总览",
    commandCenter: "常用研究与审核动作",
    asset: "单资产工作区",
    research: "研究工作区与笔记",
    factorLab: "本地因子研究实验室",
    strategyLab: "回测与纸面交易",
    workflowStudio: "工作流编排与证据",
    dataSources: "数据源覆盖、缓存与凭证",
    screeners: "预设筛选与调参",
    manual: "工作流、分析与交易说明",
    portfolio: "持仓、交易与绩效",
    connections: "数据源与凭证",
    settings: "运行时与偏好",
  },
  "en-US": {
    dashboard: "Market and runtime overview",
    commandCenter: "Frequent research and review actions",
    asset: "Single-asset workspace",
    research: "Research workspace and notes",
    factorLab: "Local factor research lab",
    strategyLab: "Backtests and paper trading",
    workflowStudio: "Workflow orchestration and evidence",
    dataSources: "Data source coverage, cache, and credentials",
    screeners: "Preset screeners and tuning",
    manual: "Workflows, analysis, and trading guide",
    portfolio: "Holdings, transactions, and performance",
    connections: "Providers and credentials",
    settings: "Runtime and preferences",
  },
};

export function translate(language: LanguagePreference, key: TranslationKey): string {
  return dictionary[language][key];
}

export function formatNumber(value: number, language: LanguagePreference): string {
  return value.toLocaleString(language);
}

export function formatCurrency(value: number, currency: string, language: LanguagePreference): string {
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency: currency === "USDT" ? "USD" : currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercentLocale(value: number, language: LanguagePreference): string {
  const signDisplay = value === 0 ? "auto" : "exceptZero";
  return new Intl.NumberFormat(language, {
    style: "percent",
    signDisplay,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function useI18n() {
  const language = useAppStore((state) => state.language);
  return useMemo(
    () => ({
      language,
      t: (key: TranslationKey) => translate(language, key),
      viewLabel: (key: ViewKey) =>
        viewLabels[language][key] ??
        (key === "watchlist" ? (language === "zh-CN" ? "自选列表" : "Watchlist") : key === "dataSources" ? "Data Sources" : key),
      viewEyebrow: (key: ViewKey) =>
        viewEyebrows[language][key] ??
        (key === "watchlist" ? (language === "zh-CN" ? "自选列表" : "Watchlist") : key === "dataSources" ? "Data Sources" : key),
      viewTitle: (key: ViewKey) =>
        viewTitles[language][key] ??
        (key === "watchlist"
          ? language === "zh-CN"
            ? "自选资产管理"
            : "Watchlist management"
          : key === "dataSources"
            ? "Data source coverage, cache, and credentials"
            : key),
      formatNumber: (value: number) => formatNumber(value, language),
      formatCurrency: (value: number, currency: string) => formatCurrency(value, currency, language),
      formatPercent: (value: number) => formatPercentLocale(value, language),
    }),
    [language],
  );
}
