import fs from 'node:fs';

const routes = [
  ['01', '/dashboard/overview', '首页总览', '系统就绪、市场脉搏、焦点资产、工作区入口'],
  ['02', '/dashboard/runtime', '本地运行状态', 'API、数据库、缓存、恢复动作'],
  ['03', '/command-center/actions', '命令目录', '动作搜索、权限、影响范围'],
  ['04', '/command-center/recent', '最近命令', '最近执行、重复执行、结果入口'],
  ['05', '/command-center/results/:resultId', '命令结果', '成功、失败、阻断、审计摘要'],
  ['06', '/markets/assets', '资产搜索', '搜索、筛选、进入资产上下文'],
  ['07', '/markets/assets/:symbol/overview', '资产概览', '身份、摘要、子页面导航'],
  ['08', '/markets/assets/:symbol/price', '行情与图表', '价格、K线、区间、对比、时间戳'],
  ['09', '/markets/assets/:symbol/fundamentals', '基本面与比率', '估值、质量、成长、风险指标'],
  ['10', '/markets/assets/:symbol/filings', '文件与公告', '文件表、来源、单条详情 Drawer'],
  ['11', '/markets/assets/:symbol/data', '数据覆盖与来源', '覆盖、新鲜度、缺失字段、降级'],
  ['12', '/markets/assets/:symbol/research', '研究交接', '创建简报、打开研究、来源上下文'],
  ['13', '/markets/watchlist', '自选目录', '列表目录、数量、最近更新时间'],
  ['14', '/markets/watchlist/:listId', '自选列表', '排序、筛选、行级选择'],
  ['15', '/markets/watchlist/:listId/manage', '自选管理', '分组、标签、批量添加移除'],
  ['16', '/markets/data-sources/catalog', '数据源目录', '提供方、能力、状态、凭证需求'],
  ['17', '/markets/data-sources/:provider', '来源详情', '协议、覆盖、只读边界、新鲜度'],
  ['18', '/markets/data-sources/:provider/preview', '数据预览', '宏观、股票、Crypto、新闻样本'],
  ['19', '/markets/data-sources/:provider/quality', '数据质量', '缺失、延迟、缓存、质量报告'],
  ['20', '/markets/data-sources/report', '覆盖报告', '来源报告、导出、限制说明'],
  ['21', '/research/inbox', 'Research Inbox', '搜索资产、创建简报、最近简报'],
  ['22', '/research/briefs/:briefId/decision', '决策复核', '论点、证据、反证、风险、结论'],
  ['23', '/research/briefs/:briefId/asset-data', '研究资产数据', '研究上下文中的基本面与文件'],
  ['24', '/research/briefs/:briefId/analysis', '结构化分析', '分析模块列表与单模块解释'],
  ['25', '/research/briefs/:briefId/evidence', '证据链', '筛选、因子、回测、Paper、审计'],
  ['26', '/research/briefs/:briefId/assistant', '研究助手', '上下文、模板、模式、生成草稿'],
  ['27', '/research/briefs/:briefId/notes', '笔记与交接', '笔记、待验证项、Watchlist、Portfolio'],
  ['28', '/research/briefs/:briefId/export', '报告导出', '预览、格式、来源标注、导出确认'],
  ['29', '/factor-lab/runs/new', '因子配置', '因子组合、范围、资产池、覆盖校验'],
  ['30', '/factor-lab/runs', '因子运行记录', '历史运行、状态、时间、质量'],
  ['31', '/factor-lab/runs/:runId/results', '因子结果', '排名、分数、分位数、结果表'],
  ['32', '/factor-lab/runs/:runId/assets/:symbol', '因子解释', '单标的贡献与来源'],
  ['33', '/factor-lab/runs/:runId/quality', '因子数据质量', '缺失、不可比、降级计算'],
  ['34', '/factor-lab/runs/:runId/handoff', '因子交接', '送入 Research、Strategy、Portfolio'],
  ['35', '/strategies', '策略目录', '策略列表、状态、风险级别'],
  ['36', '/strategies/new', '策略定义', '规则、标的池、约束条件'],
  ['37', '/strategies/backtests/new', '回测配置', '时间、基准、调仓、风险参数'],
  ['38', '/strategies/backtests/:backtestId', '回测结果', '收益、回撤、归因、持仓'],
  ['39', '/strategies/paper/:sessionId', 'Paper Trading', '模拟会话、订单状态、记录'],
  ['40', '/strategies/risk-review/:id', '风险复核', '阻断原因、Kill Switch、人工确认'],
  ['41', '/strategies/execution/:id', '执行意图', '受控意图、权限、审计'],
  ['42', '/automation/workflows', '工作流目录', '模板、状态、最近运行'],
  ['43', '/automation/workflows/:templateId', '模板详情', '目标、步骤、输入输出'],
  ['44', '/automation/workflows/:templateId/configure', '工作流配置', '输入、Universe、变体'],
  ['45', '/automation/workflows/runs', '工作流运行记录', '运行历史、状态、错误'],
  ['46', '/automation/workflows/runs/:runId', '运行时间线', '步骤、恢复、运行状态'],
  ['47', '/automation/workflows/runs/:runId/artifacts', '证据与产物', '产物目录、来源、审计'],
  ['48', '/automation/workflows/runs/:runId/confirm', '人工确认', '阻断说明、确认动作'],
  ['49', '/automation/screeners', '筛选器目录', '预设、变体、版本'],
  ['50', '/automation/screeners/:presetKey/variants/:variantKey', '筛选器变体', '变体详情、状态、版本'],
  ['51', '/automation/screeners/:presetKey/variants/:variantKey/tuning', '筛选器调优', '参数、护栏、校验'],
  ['52', '/automation/screeners/:presetKey/universe', '筛选 Universe', '资产池、市场范围、覆盖'],
  ['53', '/automation/screeners/runs/:runId', '筛选结果', '结果表、命中数量、交接'],
  ['54', '/automation/screeners/runs/:runId/explanations', '命中解释', '命中规则、未通过、缺失数据'],
  ['55', '/portfolio/overview', '组合总览', '净值、收益、现金、状态'],
  ['56', '/portfolio/holdings', '组合持仓', '持仓表、选中对象上下文'],
  ['57', '/portfolio/allocation', '组合配置', '行业、资产类型、地区、集中度'],
  ['58', '/portfolio/analytics', '组合分析', '收益曲线、基准、归因'],
  ['59', '/portfolio/risk', '组合风险', '回撤、波动、流动性、异常'],
  ['60', '/portfolio/transactions', '交易记录', '本地账本、模拟订单、来源'],
  ['61', '/portfolio/transactions/new', '新增交易', '交易字段、校验、确认'],
  ['62', '/portfolio/handoff/:symbol', '持仓研究交接', '进入资产研究或因子分析'],
  ['63', '/settings/connections/providers', '连接目录', 'Provider、状态、能力摘要'],
  ['64', '/settings/connections/:provider', '连接详情', '端点、权限、缓存方式'],
  ['65', '/settings/connections/credentials', '凭证管理', 'Profile、解锁、凭证状态'],
  ['66', '/settings/connections/health', '连接健康', '探测、诊断、能力矩阵'],
  ['67', '/settings/preferences', '常规偏好', '语言、密度、默认页、快捷键'],
  ['68', '/settings/appearance', '外观与可读性', '主题、字体、密度、对比度'],
  ['69', '/settings/data', '数据与缓存', '缓存、默认源、刷新、保留'],
  ['70', '/settings/security', '安全与解锁', '本地解锁、会话、审计'],
  ['71', '/settings/ai', 'AI 边界', '本地/云模式、模型、生成权限'],
  ['72', '/settings/execution', '执行边界', '人工确认、风险门槛、Kill Switch'],
  ['73', '/settings/runtime', '运行诊断', '服务、数据库、日志、导出'],
  ['74', '/help/manual/getting-started', '说明书：入门', '工作区、导航、首次运行'],
  ['75', '/help/manual/research-data', '说明书：研究数据', '研究、数据、筛选、证据链'],
  ['76', '/help/manual/strategy-workflows', '说明书：策略流程', '策略、回测、Paper、工作流'],
  ['77', '/help/manual/security-execution', '说明书：安全执行', '解锁、凭证、执行边界、审计'],
  ['78', '/help/manual/troubleshooting', '说明书：故障排除', '离线、缓存、错误、恢复'],
  ['79', '/ai-assistant', 'AI Assistant', '通用 AI 对话、模板、多模型和审计'],
];

const cols = 3;
const cardW = 680;
const cardH = 330;
const gapX = 40;
const gapY = 36;
const top = 170;
const left = 64;
const rows = Math.ceil(routes.length / cols);
const height = top + rows * (cardH + gapY) + 80;
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${left * 2 + cols * cardW + (cols - 1) * gapX}" height="${height}" viewBox="0 0 ${left * 2 + cols * cardW + (cols - 1) * gapX} ${height}">`;
svg += `<rect width="100%" height="100%" fill="#EEF3EF"/>`;
svg += `<text x="${left}" y="68" font-family="IBM Plex Sans, sans-serif" font-size="32" font-weight="700" fill="#13231E">Full Route Flow / T102–T106</text>`;
svg += `<text x="${left}" y="106" font-family="IBM Plex Sans, sans-serif" font-size="16" fill="#52645C">78 independent routes · continuous page sequence · every route owns its task and state boundary</text>`;

routes.forEach(([n, route, title, task], index) => {
  const x = left + (index % cols) * (cardW + gapX);
  const y = top + Math.floor(index / cols) * (cardH + gapY);
  svg += `<g><rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="18" fill="#FFFFFF" stroke="#C8D7CF"/>`;
  svg += `<rect x="${x}" y="${y}" width="${cardW}" height="48" rx="18" fill="#172821"/>`;
  svg += `<text x="${x + 22}" y="${y + 31}" font-family="IBM Plex Mono, monospace" font-size="14" fill="#65D9AD">${n} / ROUTE FRAME</text>`;
  svg += `<text x="${x + 22}" y="${y + 86}" font-family="Source Serif 4, serif" font-size="24" font-weight="700" fill="#13231E">${esc(title)}</text>`;
  svg += `<text x="${x + 22}" y="${y + 114}" font-family="IBM Plex Mono, monospace" font-size="12" fill="#168A68">${esc(route)}</text>`;
  svg += `<text x="${x + 22}" y="${y + 152}" font-family="IBM Plex Sans, sans-serif" font-size="14" fill="#52645C">${esc(task)}</text>`;
  svg += `<rect x="${x + 22}" y="${y + 178}" width="${cardW - 44}" height="54" rx="10" fill="#E7EFEA"/>`;
  svg += `<text x="${x + 42}" y="${y + 211}" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="#13231E">主任务区　·　来源/新鲜度　·　Context Inspector</text>`;
  svg += `<rect x="${x + 22}" y="${y + 252}" width="112" height="34" rx="17" fill="#E7F5EF"/><text x="${x + 40}" y="${y + 274}" font-family="IBM Plex Sans, sans-serif" font-size="11" fill="#15805F">READY</text>`;
  svg += `<rect x="${x + 146}" y="${y + 252}" width="112" height="34" rx="17" fill="#F3F7F4"/><text x="${x + 164}" y="${y + 274}" font-family="IBM Plex Sans, sans-serif" font-size="11" fill="#52645C">EMPTY</text>`;
  svg += `<rect x="${x + 270}" y="${y + 252}" width="112" height="34" rx="17" fill="#FFF4DF"/><text x="${x + 288}" y="${y + 274}" font-family="IBM Plex Sans, sans-serif" font-size="11" fill="#A86B16">BLOCKED</text>`;
  svg += `<rect x="${x + 394}" y="${y + 252}" width="112" height="34" rx="17" fill="#FFF0F0"/><text x="${x + 412}" y="${y + 274}" font-family="IBM Plex Sans, sans-serif" font-size="11" fill="#B54A4A">ERROR</text>`;
  svg += `<rect x="${x + 518}" y="${y + 252}" width="118" height="34" rx="17" fill="#F3F4F2"/><text x="${x + 536}" y="${y + 274}" font-family="IBM Plex Sans, sans-serif" font-size="11" fill="#52645C">LOCKED</text></g>`;
});

svg += '</svg>\n';
fs.writeFileSync('E:/彭博/.playwright-mcp/penpot-full-route-flow.svg', svg, 'utf8');
console.log(`generated ${routes.length} route frames`);
