import fs from 'node:fs';

const source = fs.readFileSync('E:/彭博/scripts/generate-penpot-full-route-flow.mjs', 'utf8');
const match = source.match(/const routes = (\[[\s\S]*?\n\]);/);
if (!match) throw new Error('route list not found');
const routes = Function(`return ${match[1]}`)();

const screenW = 1440;
const screenH = 900;
const gapX = 120;
const gapY = 120;
const margin = 80;
const cols = 2;
const rows = Math.ceil(routes.length / cols);
const width = margin * 2 + cols * screenW + (cols - 1) * gapX;
const height = 150 + rows * screenH + (rows - 1) * gapY + margin;
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
svg += `<rect width="100%" height="100%" fill="#DDE7E0"/>`;
svg += `<text x="${margin}" y="58" font-family="IBM Plex Sans, sans-serif" font-size="34" font-weight="700" fill="#13231E">Full-screen route pages · T102–T106</text>`;
svg += `<text x="${margin}" y="96" font-family="IBM Plex Sans, sans-serif" font-size="16" fill="#52645C">每一个 route 都是独立 1440×900 页面 frame；不是卡片、不是摘要、不是缩略图</text>`;

const nav = ['首页', '命令中心', '市场', '研究', '实验室', '自动化', '筛选', '组合', '连接', '设置'];
routes.forEach(([n, route, title, task], index) => {
  const x = margin + (index % cols) * (screenW + gapX);
  const y = 150 + Math.floor(index / cols) * (screenH + gapY);
  const mainX = x + 274;
  const mainW = 820;
  const railX = x + 1124;
  const railW = 260;
  const bodyY = y + 174;
  const variant = index % 4;
  const hasAI = route === '/ai-assistant' || route.startsWith('/research/') || route.startsWith('/factor-lab/') || route.startsWith('/strategies/') || route.startsWith('/automation/workflows/') || route.startsWith('/automation/screeners/') || route.startsWith('/markets/assets');
  svg += `<g><rect x="${x}" y="${y}" width="${screenW}" height="${screenH}" rx="18" fill="#EEF3EF" stroke="#9FB5A8" stroke-width="3"/>`;
  svg += `<rect x="${x}" y="${y}" width="${screenW}" height="58" rx="18" fill="#FFFFFF"/><text x="${x + 26}" y="${y + 36}" font-family="IBM Plex Sans, sans-serif" font-size="15" font-weight="700" fill="#13231E">pengbo</text><text x="${x + 170}" y="${y + 36}" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="#52645C">⌕ 搜索　⌘ 命令　● 本地就绪</text><text x="${x + 1270}" y="${y + 36}" font-family="IBM Plex Mono, monospace" font-size="12" fill="#52645C">${n} / FRAME</text>`;
  svg += `<rect x="${x}" y="${y + 58}" width="238" height="${screenH - 58}" fill="#172821"/><text x="${x + 28}" y="${y + 100}" font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#A9C4B6">LOCAL RESEARCH TERMINAL</text>`;
  if (hasAI) svg += `<rect x="${x + 1010}" y="${y + 12}" width="178" height="34" rx="9" fill="#D8EEE5"/><text x="${x + 1034}" y="${y + 34}" font-family="IBM Plex Sans, sans-serif" font-size="12" font-weight="700" fill="#0D654C">打开 AI 助手 →</text>`;
  nav.forEach((item, navIndex) => { const active = (index + navIndex) % nav.length === 3; const yy = y + 148 + navIndex * 40; if (active) svg += `<rect x="${x + 14}" y="${yy - 24}" width="210" height="32" rx="8" fill="#D8EEE5"/>`; svg += `<text x="${x + 30}" y="${yy}" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="${active ? '#0D654C' : '#E8F2EC'}">${active ? '▣' : '·'} ${item}</text>`; });
  svg += `<text x="${x + 30}" y="${y + 790}" font-family="IBM Plex Sans, sans-serif" font-size="11" fill="#A9C4B6">LOCAL API READY</text><text x="${x + 30}" y="${y + 818}" font-family="IBM Plex Mono, monospace" font-size="11" fill="#65D9AD">● 12:42:08 CST</text>`;
  svg += `<text x="${mainX}" y="${y + 102}" font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#168A68">${esc(route)}</text><text x="${mainX}" y="${y + 142}" font-family="Source Serif 4, serif" font-size="30" font-weight="700" fill="#13231E">${esc(title)}</text><text x="${mainX}" y="${y + 166}" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="#52645C">${esc(task)} · 当前范围 · 更新时间 02m</text>`;
  svg += `<text x="${mainX + 26}" y="${bodyY + 38}" font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#168A68">PRIMARY TASK</text>`;
  if (route === '/ai-assistant') svg += `<rect x="${mainX + 26}" y="${bodyY + 62}" width="${mainW - 52}" height="86" rx="10" fill="#D8EEE5"/><text x="${mainX + 48}" y="${bodyY + 98}" font-family="Source Serif 4, serif" font-size="22" font-weight="700" fill="#13231E">通用 AI 工作区</text><text x="${mainX + 48}" y="${bodyY + 126}" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="#52645C">无研究或实验上下文时，使用模板、模型和通用输入。</text>`;
  if (variant === 0) {
    svg += `<rect x="${mainX + 26}" y="${bodyY + 62}" width="${mainW - 52}" height="78" rx="10" fill="#E7EFEA"/><text x="${mainX + 48}" y="${bodyY + 96}" font-family="IBM Plex Sans, sans-serif" font-size="15" font-weight="700" fill="#13231E">主任务工作区</text><text x="${mainX + 48}" y="${bodyY + 120}" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="#52645C">筛选、范围和页面级动作只在这里出现</text>`;
    svg += `<rect x="${mainX + 26}" y="${bodyY + 164}" width="${mainW - 52}" height="220" rx="12" fill="#F3F7F4"/><polyline points="${mainX + 58},${bodyY + 330} ${mainX + 180},${bodyY + 290} ${mainX + 300},${bodyY + 315} ${mainX + 430},${bodyY + 240} ${mainX + 580},${bodyY + 270} ${mainX + 750},${bodyY + 200}" fill="none" stroke="#168A68" stroke-width="4"/><line x1="${mainX + 58}" y1="${bodyY + 350}" x2="${mainX + 760}" y2="${bodyY + 350}" stroke="#C8D7CF"/><text x="${mainX + 48}" y="${bodyY + 420}" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="#52645C">结果趋势 / 来源 / 时间戳</text>`;
  } else if (variant === 1) {
    svg += `<rect x="${mainX + 26}" y="${bodyY + 62}" width="${mainW - 52}" height="52" rx="9" fill="#E7EFEA"/><text x="${mainX + 48}" y="${bodyY + 95}" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="#52645C">字段 / 状态 / 来源 / 更新时间</text>`;
    for (let row = 0; row < 5; row++) { const yy = bodyY + 132 + row * 58; svg += `<rect x="${mainX + 26}" y="${yy}" width="${mainW - 52}" height="44" rx="7" fill="${row === 2 ? '#D8EEE5' : '#F8FAF8'}"/><text x="${mainX + 48}" y="${yy + 28}" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="#13231E">${row + 1}. 当前记录 / 结果对象</text><text x="${mainX + 550}" y="${yy + 28}" font-family="IBM Plex Mono, monospace" font-size="12" fill="${row === 2 ? '#15805F' : '#52645C'}">${row === 2 ? 'READY' : '02m'}</text>`; }
  } else if (variant === 2) {
    svg += `<rect x="${mainX + 26}" y="${bodyY + 62}" width="${mainW - 52}" height="72" rx="10" fill="#E7EFEA"/><text x="${mainX + 48}" y="${bodyY + 94}" font-family="IBM Plex Sans, sans-serif" font-size="14" font-weight="700" fill="#13231E">配置 / 编辑区域</text><text x="${mainX + 48}" y="${bodyY + 118}" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="#52645C">字段说明、校验、覆盖和阻断原因</text>`;
    for (let row = 0; row < 3; row++) { const yy = bodyY + 156 + row * 72; svg += `<text x="${mainX + 26}" y="${yy + 20}" font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#52645C">字段 ${row + 1}</text><rect x="${mainX + 120}" y="${yy}" width="${mainW - 146}" height="42" rx="8" fill="#FFFFFF" stroke="#C8D7CF"/><text x="${mainX + 142}" y="${yy + 27}" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="#13231E">可编辑值 / 选择项</text>`; }
  } else {
    svg += `<rect x="${mainX + 26}" y="${bodyY + 62}" width="${mainW - 52}" height="250" rx="12" fill="#FFF4DF"/><text x="${mainX + 54}" y="${bodyY + 110}" font-family="IBM Plex Sans, sans-serif" font-size="18" font-weight="700" fill="#A86B16">当前状态：需要处理</text><text x="${mainX + 54}" y="${bodyY + 150}" font-family="IBM Plex Sans, sans-serif" font-size="14" fill="#13231E">这里明确说明空、错误、锁定或阻断原因。</text><text x="${mainX + 54}" y="${bodyY + 182}" font-family="IBM Plex Sans, sans-serif" font-size="14" fill="#52645C">下一步动作必须可见，不能只显示空白。</text><rect x="${mainX + 54}" y="${bodyY + 218}" width="170" height="42" rx="10" fill="#168A68"/><text x="${mainX + 84}" y="${bodyY + 245}" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="#FFFFFF">恢复当前页面 →</text>`;
  }
  svg += `<rect x="${railX}" y="${bodyY}" width="${railW}" height="500" rx="16" fill="#E7EFEA" stroke="#C8D7CF"/><text x="${railX + 22}" y="${bodyY + 38}" font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#168A68">CONTEXT INSPECTOR</text><text x="${railX + 22}" y="${bodyY + 84}" font-family="Source Serif 4, serif" font-size="22" font-weight="700" fill="#13231E">当前对象</text><text x="${railX + 22}" y="${bodyY + 126}" font-family="IBM Plex Sans, sans-serif" font-size="13" fill="#13231E">AAPL · Apple Inc.</text><text x="${railX + 22}" y="${bodyY + 174}" font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#52645C">状态</text><text x="${railX + 150}" y="${bodyY + 174}" font-family="IBM Plex Mono, monospace" font-size="12" fill="#15805F">READY</text><text x="${railX + 22}" y="${bodyY + 210}" font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#52645C">来源</text><text x="${railX + 150}" y="${bodyY + 210}" font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#13231E">EDGAR</text><line x1="${railX + 22}" y1="${bodyY + 244}" x2="${railX + railW - 22}" y2="${bodyY + 244}" stroke="#C8D7CF"/><text x="${railX + 22}" y="${bodyY + 286}" font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#52645C">下一步</text><rect x="${railX + 22}" y="${bodyY + 310}" width="${railW - 44}" height="40" rx="9" fill="#168A68"/><text x="${railX + 48}" y="${bodyY + 336}" font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#FFFFFF">查看来源 →</text>`;
  if (hasAI) svg += `<rect x="${railX + 22}" y="${bodyY + 370}" width="${railW - 44}" height="40" rx="9" fill="#D8EEE5"/><text x="${railX + 48}" y="${bodyY + 396}" font-family="IBM Plex Sans, sans-serif" font-size="12" font-weight="700" fill="#0D654C">AI 上下文已就绪</text>`;
  svg += `</g>`;
});

svg += '</svg>\n';
fs.writeFileSync('E:/彭博/.playwright-mcp/penpot-full-screen-route-flow.svg', svg, 'utf8');
console.log(`generated ${routes.length} full-screen frames`);
