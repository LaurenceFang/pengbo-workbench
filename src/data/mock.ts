export type MarketPulse = {
  label: string;
  value: string;
  delta: string;
  tone: "up" | "down" | "neutral";
};

export type WatchlistAsset = {
  id: string;
  name: string;
  market: string;
  price: string;
  change: string;
  changePct: string;
  trend: number[];
  summary: string;
};

export type Ratio = {
  label: string;
  value: string;
  note: string;
};

export type Filing = {
  type: string;
  filedAt: string;
  headline: string;
  status: string;
};

export type ScreenerPreset = {
  title: string;
  badge: string;
  description: string;
  filters: string[];
  hitCount: number;
};

export type Holding = {
  symbol: string;
  name: string;
  weight: string;
  pnl: string;
  allocation: number;
};

export type ConnectionStatus = {
  provider: string;
  purpose: string;
  status: string;
  note: string;
};

export type SettingSection = {
  title: string;
  description: string;
  items: Array<{ label: string; value: string; helper: string }>;
};

export const marketPulse: MarketPulse[] = [
  { label: "纳指期货", value: "+1.18%", delta: "风险偏好回暖", tone: "up" },
  { label: "美元指数", value: "104.12", delta: "-0.42", tone: "down" },
  { label: "10Y 美债", value: "4.08%", delta: "-7bp", tone: "up" },
  { label: "BTC Dominance", value: "57.3%", delta: "+0.6%", tone: "neutral" },
];

export const watchlistAssets: WatchlistAsset[] = [
  {
    id: "AAPL",
    name: "Apple",
    market: "NASDAQ",
    price: "$211.42",
    change: "+3.84",
    changePct: "+1.85%",
    trend: [42, 46, 44, 52, 58, 55, 61, 66],
    summary: "大盘科技回暖，现金流稳定，适合作为仪表盘默认深度样本。",
  },
  {
    id: "SPY",
    name: "SPDR S&P 500 ETF",
    market: "NYSE Arca",
    price: "$578.09",
    change: "+2.67",
    changePct: "+0.46%",
    trend: [36, 39, 43, 42, 48, 52, 54, 57],
    summary: "作为全局基准，与组合页联动，承担收益对比和市场节奏提示。",
  },
  {
    id: "BTC/USDT",
    name: "Bitcoin / Tether",
    market: "Binance",
    price: "$84,640",
    change: "+1,920",
    changePct: "+2.32%",
    trend: [28, 30, 31, 35, 38, 37, 41, 44],
    summary: "加密主轴标的，承接 Binance 只读接入与统一图表体验。",
  },
  {
    id: "NVDA",
    name: "NVIDIA",
    market: "NASDAQ",
    price: "$103.21",
    change: "-0.96",
    changePct: "-0.92%",
    trend: [64, 62, 60, 57, 54, 56, 58, 55],
    summary: "高波动成长股，用来验证筛选器、图表和基本面的状态差异。",
  },
];

export const assetRatios: Ratio[] = [
  { label: "市值", value: "$3.17T", note: "超大盘 / 科技龙头" },
  { label: "TTM PE", value: "29.4x", note: "相对自身中枢偏上" },
  { label: "自由现金流率", value: "26.8%", note: "质量稳健" },
  { label: "ROE", value: "154.6%", note: "受回购结构放大" },
  { label: "营收 YoY", value: "+6.3%", note: "回到温和增长" },
  { label: "净利润率", value: "26.2%", note: "利润韧性保持" },
];

export const filings: Filing[] = [
  {
    type: "10-Q",
    filedAt: "2026-02-01",
    headline: "Q1 财报披露：服务业务与回购延续强势",
    status: "已解析",
  },
  {
    type: "8-K",
    filedAt: "2026-01-18",
    headline: "董事会更新资本分配框架",
    status: "已索引",
  },
  {
    type: "10-K",
    filedAt: "2025-10-31",
    headline: "年度报告：硬件周期与生态粘性双重巩固",
    status: "已摘要",
  },
];

export const screenerPresets: ScreenerPreset[] = [
  {
    title: "美股高质量现金流",
    badge: "股票",
    description: "优先锁定盈利稳定、现金流强、估值不过热的核心资产。",
    filters: ["市值 > 100B", "FCF Margin > 15%", "ROE > 18%", "负债率 < 60%"],
    hitCount: 14,
  },
  {
    title: "成长回撤修复",
    badge: "股票",
    description: "寻找景气赛道中跌深反弹、但基本面未破坏的品种。",
    filters: ["52W 回撤 > 20%", "营收增长 > 18%", "毛利率 > 45%", "成交额提升"],
    hitCount: 22,
  },
  {
    title: "高流动性趋势加密",
    badge: "加密",
    description: "偏短中线交易观察，强调流动性、成交量与趋势延续。",
    filters: ["Binance 可交易", "24H Volume > 150M", "7D Change > 8%", "波动率 < 65%"],
    hitCount: 9,
  },
  {
    title: "强势主流币观察",
    badge: "加密",
    description: "聚焦市值靠前、叙事清晰、具备主流资金承接的币种。",
    filters: ["市值 Top 25", "资金费率平稳", "周线新高附近", "现货深度良好"],
    hitCount: 7,
  },
];

export const holdings: Holding[] = [
  { symbol: "AAPL", name: "Apple", weight: "31.8%", pnl: "+12.6%", allocation: 32 },
  { symbol: "MSFT", name: "Microsoft", weight: "19.4%", pnl: "+8.1%", allocation: 19 },
  { symbol: "BTC", name: "Bitcoin", weight: "17.2%", pnl: "+24.9%", allocation: 17 },
  { symbol: "SPY", name: "S&P 500 ETF", weight: "14.8%", pnl: "+5.3%", allocation: 15 },
  { symbol: "现金", name: "Cash Buffer", weight: "16.8%", pnl: "0.0%", allocation: 17 },
];

export const connectionStatuses: ConnectionStatus[] = [
  {
    provider: "OpenBB",
    purpose: "统一搜索 / 股票 / ETF / 宏观 / 部分加密",
    status: "待接入",
    note: "本轮先对齐 API 外形，下一轮替换真实 provider。",
  },
  {
    provider: "FinanceToolkit",
    purpose: "基本面比率 / 财务分析",
    status: "待接入",
    note: "已预留 overview / ratios 端点。",
  },
  {
    provider: "EdgarTools",
    purpose: "SEC filings / XBRL 摘要",
    status: "待接入",
    note: "已预留 filings 列表与摘要卡位。",
  },
  {
    provider: "CCXT / Binance",
    purpose: "只读账户 / 持仓 / 交易历史",
    status: "占位完成",
    note: "接口已规划，默认不开启写操作。",
  },
];

export const settingSections: SettingSection[] = [
  {
    title: "缓存与数据目录",
    description: "围绕 SQLite / DuckDB 的本地体验做统一设置。",
    items: [
      { label: "行情缓存 TTL", value: "15 分钟", helper: "股票与加密的默认快照生命周期。" },
      { label: "历史数据目录", value: "E:\\彭博\\data\\duckdb", helper: "为后续分析快照预留固定目录。" },
      { label: "诊断导出", value: "关闭", helper: "产品化阶段再补完整导出流程。" },
    ],
  },
  {
    title: "桌面体验",
    description: "优先为 Windows-first 桌面工作流服务。",
    items: [
      { label: "默认首页", value: "Dashboard", helper: "启动后直接回到最近工作上下文。" },
      { label: "主题方向", value: "Aurora Slate", helper: "当前先做深色高对比视觉体系。" },
      { label: "日志采集", value: "已开启", helper: "执行过程与后续诊断都记录到本地文件。" },
    ],
  },
];

export const portfolioCurve = [42, 47, 46, 55, 59, 64, 69, 72, 75, 82, 87, 92];
export const benchmarkCurve = [40, 42, 43, 47, 48, 52, 56, 58, 62, 66, 68, 70];
