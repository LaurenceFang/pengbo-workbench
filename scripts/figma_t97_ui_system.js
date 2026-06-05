import fs from "node:fs";

const outputPath = "docs/t97-ui-system-board.svg";

const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function t(x, y, text, cls = "body", extra = "") {
  return `<text x="${x}" y="${y}" class="${cls}" ${extra}>${esc(text)}</text>`;
}

function line(x1, y1, x2, y2) {
  return `<line class="line" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
}

function pill(x, y, w, text, tone = "neutral") {
  return `<rect x="${x}" y="${y}" width="${w}" height="46" rx="8" class="pill ${tone}"/>${t(x + 18, y + 31, text, "small")}`;
}

function frame(x, eyebrow, title, body, inner) {
  return `<g transform="translate(${x} 70)">
    <rect class="frame" width="1440" height="900" rx="18"/>
    ${t(70, 90, eyebrow, "eyebrow")}
    ${t(70, 160, title, "h1")}
    ${body.map((item, index) => t(70, 210 + index * 42, item, "small")).join("\n")}
    ${inner}
  </g>`;
}

const frames = [
  frame(
    80,
    "00 T97 UI SYSTEM",
    "Pengbo Workbench UI Foundation",
    [
      "Apple/macOS-style desktop system for shell, navigation, screens, components, states, and React mapping.",
      "Design-only artifact for T98-T106. No hosted accounts, public APIs, remote sync, or new live-trading scope.",
    ],
    `${pill(70, 340, 360, "T98 Design Tokens", "info")}
     ${pill(460, 340, 390, "T99 Navigation IA", "teal")}
     ${pill(880, 340, 380, "T100 AppShell", "green")}
     ${pill(70, 420, 390, "T102 Components", "purple")}
     ${pill(490, 420, 360, "T103 DataTable", "amber")}
     ${pill(880, 420, 360, "T104 Inspector", "slate")}
     <rect x="70" y="570" width="1170" height="120" rx="10" class="warning"/>
     ${t(105, 620, "Boundary", "h2 red")}
     ${t(105, 665, "Local-first desktop remains the product boundary; design assets stay source-safe.", "small red")}`
  ),
  frame(
    1620,
    "01 PRODUCT SHELL",
    "Stable Desktop Regions",
    ["The shell owns navigation, command entry, runtime status, workspace scroll, and cross-page context."],
    `<rect x="70" y="280" width="1240" height="520" rx="12" fill="#eef3f7" stroke="#cbd5e1" stroke-width="2"/>
     <rect x="95" y="305" width="190" height="470" rx="8" fill="#111827"/>
     ${t(125, 355, "Pengbo", "small white")}
     ${["Home","Research","Markets","Portfolio","Factor Lab","Automation","Settings"].map((n,i)=>`<rect x="120" y="${395+i*48}" width="130" height="32" rx="6" fill="${i===1 ? "#0e6f78" : "#1f2937"}"/>${t(135, 417+i*48, n, "tiny white")}`).join("\n")}
     <rect x="315" y="305" width="960" height="72" rx="8" fill="#ffffff" stroke="#d7e0e8" stroke-width="2"/>
     ${t(345, 350, "Global search / command", "small")}
     ${pill(820, 320, 160, "Local online", "green")}
     ${pill(1000, 320, 210, "Provider partial", "amber")}
     <rect x="315" y="405" width="630" height="370" rx="8" fill="#ffffff" stroke="#d7e0e8" stroke-width="2"/>
     ${t(350, 465, "Main workspace", "h2")}
     ${t(350, 515, "One primary workflow at a time", "small")}
     <rect x="970" y="405" width="305" height="370" rx="8" fill="#ffffff" stroke="#d7e0e8" stroke-width="2"/>
     ${t(1000, 465, "Inspector", "h2")}
     ${t(1000, 515, "Evidence", "small")}
     ${t(1000, 560, "AI context", "small")}
     ${t(1000, 605, "Provider health", "small")}
     ${t(1000, 650, "Exports", "small")}`
  ),
  frame(
    3160,
    "02 NAVIGATION IA",
    "Collapsed Workspace Model",
    ["T99 should collapse many current routes into seven user-facing groups while preserving internal views."],
    `<g transform="translate(90 300)">
      ${["Home = dashboard + command center","Research = research canvas + evidence","Markets = asset + watchlist + data sources","Portfolio = holdings + offline states","Factor Lab = factor projects + diagnostics","Automation = workflow studio + screeners","Settings = runtime + connections + manual"].map((n,i)=>`<rect class="row" x="0" y="${i*70}" width="1220" height="52" rx="8"/><text class="body" x="24" y="${i*70+36}">${esc(n)}</text>`).join("\n")}
    </g>
    ${t(90, 820, "Rule: navigation is a global workspace switcher, not page-local tabs.", "small")}`
  ),
  frame(
    4700,
    "03 SCREEN TEMPLATES",
    "Core Workspace Skeletons",
    ["Five templates define layout ownership before page-level polish starts."],
    `<g transform="translate(80 300)">
      ${["Dashboard","Asset Cockpit","Research Canvas","Data Sources","Settings"].map((n,i)=>`<g transform="translate(${(i%3)*410} ${Math.floor(i/3)*230})"><rect class="mini-screen" width="360" height="190" rx="10"/><rect x="18" y="20" width="92" height="18" rx="4" fill="#0e6f78"/><rect x="18" y="56" width="160" height="18" rx="4" fill="#cbd5e1"/><rect x="18" y="94" width="138" height="58" rx="6" fill="#ffffff" stroke="#d7e0e8"/><rect x="178" y="94" width="150" height="58" rx="6" fill="#ffffff" stroke="#d7e0e8"/><text class="h2" x="18" y="180">${esc(n)}</text></g>`).join("\n")}
    </g>
    ${pill(90, 790, 420, "Stable regions before visuals", "info")}
    ${pill(540, 790, 390, "Chinese-first copy budgets", "teal")}
    ${pill(960, 790, 330, "No behavior drift", "red")}`
  ),
  frame(
    6240,
    "04 COMPONENT SYSTEM",
    "Reusable Primitives",
    ["T102 extracts the common controls. T97 defines what belongs in the first component library."],
    `<g transform="translate(90 295)">
      ${pill(0, 0, 210, "Primary button", "green")}
      ${pill(240, 0, 210, "Ghost button", "slate")}
      ${pill(480, 0, 210, "Icon button", "info")}
      ${pill(720, 0, 240, "Search field", "teal")}
      ${pill(990, 0, 230, "Segmented", "purple")}
      ${pill(0, 85, 210, "Tabs", "slate")}
      ${pill(240, 85, 210, "Badge", "green")}
      ${pill(480, 85, 240, "Evidence chip", "teal")}
      ${pill(750, 85, 250, "Provider status", "amber")}
      ${pill(1030, 85, 190, "Tooltip", "info")}
      <rect class="card" x="0" y="205" width="370" height="210" rx="10"/>
      ${t(30, 260, "Panel header", "h2")}
      ${t(30, 310, "Eyebrow, title, actions", "small")}
      ${t(30, 355, "Body copy remains compact.", "small")}
      <rect class="card" x="430" y="205" width="370" height="210" rx="10"/>
      ${t(460, 260, "Sheet / popover", "h2")}
      ${t(460, 310, "Use for focused setup.", "small")}
      ${t(460, 355, "Never hide safety state.", "small")}
      <rect class="card" x="860" y="205" width="370" height="210" rx="10"/>
      ${t(890, 260, "Metric card", "h2")}
      ${t(890, 310, "Tone: up/down/neutral.", "small")}
      ${t(890, 355, "Stable size, no jumping.", "small")}
    </g>`
  ),
  frame(
    7780,
    "05 TABLE AND INSPECTOR",
    "Dense Financial Work Surface",
    ["T103 and T104 should share table, status, evidence, and inspector rules."],
    `<g transform="translate(80 295)">
      <rect class="card" x="0" y="0" width="810" height="500" rx="10"/>
      ${t(30, 58, "DataTable rules", "h2")}
      ${["Fixed symbol/name/status columns","Sortable numeric columns","Filter chips above table","Row height: 44 standard / 36 compact","Horizontal overflow for deep datasets","Source and freshness always visible"].map((n,i)=>t(45, 120+i*55, n, "small")).join("\n")}
      ${line(35, 400, 760, 400)}
      ${t(45, 455, "No column resize jump from hover, badges, or loading text.", "small")}
      <rect class="card" x="860" y="0" width="430" height="500" rx="10"/>
      ${t(895, 58, "Inspector slots", "h2")}
      ${["Evidence","AI context","Provider health","Parameters","Exports","Audit trail"].map((n,i)=>pill(895, 95+i*60, 260, n, i===0?"teal":i===1?"purple":i===2?"amber":"slate")).join("\n")}
    </g>`
  ),
  frame(
    9320,
    "06 STATE SYSTEM",
    "Operational States",
    ["Every blocked or partial state must explain what is known, what is unavailable, and what the next action is."],
    `<g transform="translate(90 300)">
      ${[
        ["Loading","正在加载本地数据","info"],
        ["Empty","暂无研究简报，先选择标的","slate"],
        ["Offline","本地 sidecar 离线","amber"],
        ["Cached","显示缓存数据和时间戳","teal"],
        ["Limited","AI 仅能使用已脱敏证据","purple"],
        ["Blocked","需要本地解锁后继续","red"],
        ["Permission blocked","数据源权限不足","red"],
        ["Audited","操作已记录在本地审计","green"],
      ].map((item,i)=>`<rect class="state-card" x="${(i%2)*620}" y="${Math.floor(i/2)*112}" width="560" height="78" rx="10"/><text class="h2" x="${(i%2)*620+28}" y="${Math.floor(i/2)*112+36}" fill="#111827">${esc(item[0])}</text><text class="small" x="${(i%2)*620+220}" y="${Math.floor(i/2)*112+36}" fill="#475569">${esc(item[1])}</text><rect x="${(i%2)*620+28}" y="${Math.floor(i/2)*112+52}" width="130" height="8" rx="4" class="${item[2]}-bar"/>`).join("\n")}
    </g>`
  ),
  frame(
    10860,
    "07 REACT MAPPING",
    "From Figma To Code",
    ["This frame is the T97 handoff contract. It names where follow-up tasks should land."],
    `<g transform="translate(80 290)">
      ${["Design tokens -> src/styles.css variables -> T98","Navigation model -> src/App.tsx navigation map -> T99","Shell regions -> AppShell extraction -> T100","Controls -> src/components/shared.tsx + new UI primitives -> T102","Financial table -> DataTable extraction -> T103","Right context -> InspectorPanel extraction -> T104","Chinese states -> i18n dictionaries + PanelState -> T105","Screenshots -> desktop visual baseline -> T106"].map((n,i)=>`<rect class="row" x="0" y="${i*62}" width="1260" height="46" rx="8"/><text class="body" x="24" y="${i*62+32}">${esc(n)}</text>`).join("\n")}
    </g>
    ${t(90, 820, "Completion rule: design guides implementation but does not change runtime behavior in T97.", "small red")}`
  ),
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12380" height="1040" viewBox="0 0 12380 1040">
<defs>
  <style>
    .bg{fill:#edf3f7}.frame{fill:#fff;stroke:#cbd5e1;stroke-width:2}.line{stroke:#d7e0e8;stroke-width:2}
    .eyebrow{font-family:Inter,Arial,sans-serif;font-weight:800;font-size:28px;fill:#0e6f78}
    .h1{font-family:Inter,Arial,sans-serif;font-weight:850;font-size:54px;fill:#111827}
    .h2{font-family:Inter,Arial,sans-serif;font-weight:800;font-size:30px;fill:#111827}
    .body{font-family:Inter,Arial,sans-serif;font-size:28px;fill:#243447}.small{font-family:Inter,Arial,sans-serif;font-size:24px;fill:#475569}
    .tiny{font-family:Inter,Arial,sans-serif;font-size:20px;fill:#f8fafc}.white{fill:#f8fafc}.red{fill:#b91c1c}
    .pill{fill:#f8fafc;stroke:#cbd5e1;stroke-width:2}.pill.info{fill:#eff6ff}.pill.teal{fill:#ecfeff}.pill.green{fill:#f0fdf4}.pill.amber{fill:#fffbeb}.pill.purple{fill:#faf5ff}.pill.red{fill:#fff5f5}.pill.slate{fill:#f8fafc}
    .card,.row,.mini-screen,.state-card{fill:#f8fafc;stroke:#d7e0e8;stroke-width:2}.warning{fill:#fff5f5;stroke:#fecaca;stroke-width:2}
    .info-bar{fill:#2563eb}.teal-bar{fill:#0e6f78}.green-bar{fill:#16a34a}.amber-bar{fill:#b45309}.purple-bar{fill:#7e22ce}.red-bar{fill:#b91c1c}.slate-bar{fill:#475569}
  </style>
</defs>
<rect class="bg" width="12380" height="1040"/>
${frames.join("\n")}
</svg>
`;

fs.writeFileSync(outputPath, svg, "utf8");
console.log(`Wrote ${outputPath}`);
