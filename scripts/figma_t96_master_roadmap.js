// Figma use_figma script for T96 - Figma Master Roadmap.
// Execute with fileKey CIunCxsqTaNPGKcQO6wr8y and skillNames "figma-use".

await figma.loadFontAsync({ family: "Inter", style: "Regular" });
await figma.loadFontAsync({ family: "Inter", style: "Medium" });
await figma.loadFontAsync({ family: "Inter", style: "Semi Bold" });

const colors = {
  page: { r: 0.945, g: 0.957, b: 0.965 },
  ink: { r: 0.065, g: 0.082, b: 0.102 },
  muted: { r: 0.294, g: 0.333, b: 0.388 },
  line: { r: 0.816, g: 0.843, b: 0.878 },
  white: { r: 1, g: 1, b: 1 },
  product: { r: 0.055, g: 0.431, b: 0.471 },
  ui: { r: 0.145, g: 0.263, b: 0.522 },
  ai: { r: 0.424, g: 0.196, b: 0.580 },
  data: { r: 0.102, g: 0.486, b: 0.306 },
  quant: { r: 0.659, g: 0.380, b: 0.071 },
  workflows: { r: 0.557, g: 0.251, b: 0.212 },
  release: { r: 0.322, g: 0.392, b: 0.459 },
  safety: { r: 0.694, g: 0.110, b: 0.145 },
  commercial: { r: 0.188, g: 0.455, b: 0.620 },
};

const milestones = [
  {
    key: "M1",
    title: "UI Foundation",
    range: "T96-T106",
    lane: "UI",
    color: colors.ui,
    tasks: [
      ["T96", "Figma Master Roadmap"],
      ["T97", "Figma UI System"],
      ["T98", "Design Tokens v1"],
      ["T99", "Navigation IA Collapse"],
      ["T100", "AppShell Redesign"],
      ["T101", "Light Mode First"],
      ["T102", "Component Library Base"],
      ["T103", "DataTable Component"],
      ["T104", "Inspector Panel"],
      ["T105", "Chinese Empty States"],
      ["T106", "Screenshot Baseline"],
    ],
  },
  {
    key: "M2",
    title: "First Useful Loop",
    range: "T107-T115",
    lane: "Product",
    color: colors.product,
    tasks: [
      ["T107", "First Run Demo Flow"],
      ["T108", "Home Dashboard Simplification"],
      ["T109", "Global Command Center"],
      ["T110", "Asset Cockpit v1"],
      ["T111", "Research Canvas v1"],
      ["T112", "Evidence Timeline"],
      ["T113", "One Click Research Brief"],
      ["T114", "Export Report Polish"],
      ["T115", "10 Minute Success Test"],
    ],
  },
  {
    key: "M3",
    title: "AI Router",
    range: "T116-T125",
    lane: "AI",
    color: colors.ai,
    tasks: [
      ["T116", "AI Provider Router Spec"],
      ["T117", "AI Control Redesign"],
      ["T118", "Local Model Runtime Probe v2"],
      ["T119", "Cloud Opt-in Sheet"],
      ["T120", "AI Evidence Contract"],
      ["T121", "Multi-model Advisor Mode"],
      ["T122", "AI Cost Budget Guard"],
      ["T123", "Prompt Template Library"],
      ["T124", "AI Eval Fixtures"],
      ["T125", "AI Audit Trail"],
    ],
  },
  {
    key: "M4",
    title: "Data Depth",
    range: "T126-T135",
    lane: "Data",
    color: colors.data,
    tasks: [
      ["T126", "Data Sources Center Redesign"],
      ["T127", "China Equity Provider v2"],
      ["T128", "HK Market Data Expansion"],
      ["T129", "Macro Data Explorer"],
      ["T130", "News And Events Lane"],
      ["T131", "Provider Freshness UI"],
      ["T132", "DuckDB Performance Pass"],
      ["T133", "Local File Import v1"],
      ["T134", "Data Quality Score"],
      ["T135", "Data Source Report Export"],
    ],
  },
  {
    key: "M5",
    title: "Research Workflows",
    range: "T136-T145",
    lane: "Workflows",
    color: colors.workflows,
    tasks: [
      ["T136", "Workflow Recipe Gallery"],
      ["T137", "Screener To Research v2"],
      ["T138", "Data Sources To Research v2"],
      ["T139", "Public Equity Memo Template"],
      ["T140", "Investment Banking One-pager"],
      ["T141", "Peer Comparison Workflow"],
      ["T142", "Due Diligence Checklist"],
      ["T143", "Batch Research Queue"],
      ["T144", "Research Review Mode"],
      ["T145", "Report Template Manager"],
    ],
  },
  {
    key: "M6",
    title: "Quant Factor Lab",
    range: "T146-T165",
    lane: "Quant",
    color: colors.quant,
    tasks: [
      ["T146", "Factor Lab IA And UI"],
      ["T147", "Factor Project Model"],
      ["T148", "Factor Definition Schema"],
      ["T149", "Built-in Factor Library"],
      ["T150", "Factor Formula Parser"],
      ["T151", "Equity Universe Selector"],
      ["T152", "Factor Data Pipeline"],
      ["T153", "IC And Rank IC Engine"],
      ["T154", "Quantile Return Analysis"],
      ["T155", "Single Factor Backtest"],
      ["T156", "Multi-factor Score Model"],
      ["T157", "Transaction Cost Model"],
      ["T158", "Exposure Diagnostics"],
      ["T159", "Overfitting Checks"],
      ["T160", "Factor Report Export"],
      ["T161", "AI Factor Hypothesis Assistant"],
      ["T162", "Research To Factor Handoff"],
      ["T163", "Factor To Backtest Handoff"],
      ["T164", "Backtest To Paper Intent"],
      ["T165", "Factor Lab Screenshot Tests"],
    ],
  },
  {
    key: "M7",
    title: "Release Hardening",
    range: "T166-T175",
    lane: "Release",
    color: colors.release,
    tasks: [
      ["T166", "Tauri Packaging Audit"],
      ["T167", "Code Signing Plan"],
      ["T168", "Auto-update Channel Design"],
      ["T169", "Performance Budget"],
      ["T170", "Error Boundary And Recovery"],
      ["T171", "Local Runtime Diagnostics"],
      ["T172", "CI Expansion"],
      ["T173", "Release Checklist v2"],
      ["T174", "Documentation Sync"],
      ["T175", "Packaged Smoke Test v2"],
    ],
  },
  {
    key: "M8",
    title: "Security And Compliance",
    range: "T176-T185",
    lane: "Safety",
    color: colors.safety,
    tasks: [
      ["T176", "Secret Storage Review"],
      ["T177", "Cloud Context Redaction"],
      ["T178", "Audit Event Viewer"],
      ["T179", "Public Exposure Guard"],
      ["T180", "License And Redistribution Matrix"],
      ["T181", "Financial Advice Boundary Copy"],
      ["T182", "Screenshot Secret Scan"],
      ["T183", "Binance Safety UI"],
      ["T184", "Security Smoke Evidence"],
      ["T185", "Private Deployment Boundary"],
    ],
  },
  {
    key: "M9",
    title: "Commercial Proof",
    range: "T186-T195",
    lane: "Commercial",
    color: colors.commercial,
    tasks: [
      ["T186", "User Segment Definition"],
      ["T187", "Pricing Hypothesis"],
      ["T188", "Template Marketplace Seed"],
      ["T189", "Private Deployment Playbook"],
      ["T190", "Demo Video Script"],
      ["T191", "README Product Proof"],
      ["T192", "Landing Page Later"],
      ["T193", "Feedback Capture Loop"],
      ["T194", "Early User Trial Plan"],
      ["T195", "Commercial Risk Review"],
    ],
  },
];

const principles = [
  "Local-first desktop remains the default product boundary.",
  "Research output must stay evidence-backed, provenance-aware, and limitation-aware.",
  "Chinese-first interface copy with English support for professional finance workflows.",
  "AI output must cite allowed evidence or enter a limited or blocked state.",
  "No secrets, Stronghold material, runtime databases, private paths, or generated diagnostics in design assets.",
  "Binance execution remains default-off, risk-gated, audited, and user-confirmed.",
];

function paint(color) {
  return [{ type: "SOLID", color }];
}

function textNode(name, characters, x, y, width, fontSize, style, color) {
  const node = figma.createText();
  node.name = name;
  node.fontName = { family: "Inter", style };
  node.characters = characters;
  node.fontSize = fontSize;
  node.lineHeight = { unit: "PERCENT", value: 130 };
  node.letterSpacing = { unit: "PIXELS", value: 0 };
  node.fills = paint(color);
  node.x = x;
  node.y = y;
  node.resize(width, Math.max(fontSize * 1.6, 24));
  return node;
}

function roundedRect(name, x, y, w, h, fill, stroke) {
  const node = figma.createFrame();
  node.name = name;
  node.x = x;
  node.y = y;
  node.resize(w, h);
  node.cornerRadius = 8;
  node.fills = paint(fill);
  if (stroke) {
    node.strokes = paint(stroke);
    node.strokeWeight = 1;
  }
  return node;
}

function addFrameTitle(frame, label, subtitle) {
  frame.appendChild(textNode("Frame title", label, 56, 44, 1200, 34, "Semi Bold", colors.ink));
  frame.appendChild(textNode("Frame subtitle", subtitle, 56, 96, 1200, 16, "Regular", colors.muted));
}

function createRoadmapFrame(name, x, y, w, h) {
  const frame = figma.createFrame();
  frame.name = name;
  frame.x = x;
  frame.y = y;
  frame.resize(w, h);
  frame.fills = paint(colors.page);
  return frame;
}

function addMilestoneCard(parent, milestone, x, y, w, h, compact) {
  const card = roundedRect(`${milestone.key} ${milestone.title}`, x, y, w, h, colors.white, colors.line);
  const swatch = roundedRect("Lane color", 0, 0, 8, h, milestone.color, null);
  swatch.cornerRadius = 8;
  card.appendChild(swatch);
  card.appendChild(textNode("Milestone", `${milestone.key} - ${milestone.title}`, 20, 18, w - 36, 18, "Semi Bold", colors.ink));
  card.appendChild(textNode("Range lane", `${milestone.range} | ${milestone.lane}`, 20, 44, w - 36, 12, "Medium", milestone.color));
  const taskText = compact
    ? milestone.tasks.map((t) => `${t[0]} ${t[1]}`).join("  /  ")
    : milestone.tasks.map((t) => `${t[0]} - ${t[1]}`).join("\n");
  const body = textNode("Task list", taskText, 20, 72, w - 36, compact ? 10 : 11, "Regular", colors.muted);
  body.resize(w - 36, h - 88);
  card.appendChild(body);
  parent.appendChild(card);
  return card;
}

let page = figma.root.children.find((p) => p.name === "T96 Master Roadmap");
if (!page) page = figma.createPage();
page.name = "T96 Master Roadmap";
await figma.setCurrentPageAsync(page);
for (const child of [...page.children]) child.remove();

const createdNodeIds = [];

const cover = createRoadmapFrame("00 Cover - Pengbo v0.1 to v1.0", 120, 120, 1440, 900);
cover.appendChild(textNode("Eyebrow", "T96 - Figma Master Roadmap", 72, 72, 600, 18, "Medium", colors.product));
cover.appendChild(textNode("Title", "Pengbo Workbench v0.1 -> v1.0", 72, 122, 1100, 56, "Semi Bold", colors.ink));
cover.appendChild(textNode("Subtitle", "A local-first financial research desktop roadmap across product, UI, AI, data, quant, workflows, release, safety, and commercial proof.", 72, 210, 1040, 22, "Regular", colors.muted));
cover.appendChild(textNode("Boundary", "T96 is a design-planning artifact only. It does not add hosted accounts, public APIs, remote sync, or new live-trading scope.", 72, 320, 980, 20, "Semi Bold", colors.safety));
milestones.slice(0, 5).forEach((m, index) => addMilestoneCard(cover, m, 72 + index * 260, 500, 235, 230, true));
page.appendChild(cover);
createdNodeIds.push(cover.id);

const overview = createRoadmapFrame("01 Roadmap Overview - T96 to T195", 1620, 120, 1800, 1160);
addFrameTitle(overview, "Roadmap Overview", "Every T96-T195 task is mapped to a milestone and lane. The first two milestones form the first useful research loop.");
const laneY = { UI: 180, Product: 300, AI: 420, Data: 540, Workflows: 660, Quant: 780, Release: 900, Safety: 1020, Commercial: 1140 };
Object.entries(laneY).forEach(([lane, y]) => {
  overview.appendChild(textNode(`Lane ${lane}`, lane, 56, y - 6, 120, 14, "Semi Bold", colors.ink));
  const line = figma.createLine();
  line.name = `${lane} lane guide`;
  line.x = 190;
  line.y = y + 10;
  line.resize(1500, 0);
  line.strokes = paint(colors.line);
  overview.appendChild(line);
});
milestones.forEach((m, index) => {
  const x = 210 + index * 165;
  const y = laneY[m.lane] - 44;
  const card = roundedRect(`${m.key} lane marker`, x, y, 145, 88, colors.white, colors.line);
  card.appendChild(textNode("Key", m.key, 14, 12, 42, 18, "Semi Bold", m.color));
  card.appendChild(textNode("Title", m.title, 14, 36, 116, 12, "Medium", colors.ink));
  card.appendChild(textNode("Range", m.range, 14, 62, 100, 11, "Regular", colors.muted));
  overview.appendChild(card);
});
page.appendChild(overview);
createdNodeIds.push(overview.id);

const execution = createRoadmapFrame("02 Execution Order", 120, 1060, 1440, 900);
addFrameTitle(execution, "Execution Order", "Promote tasks in batches so design foundations and first-use proof land before deeper AI, data, quant, and commercial work.");
[
  ["1", "T96-T115", "Redesign foundation and first useful research loop"],
  ["2", "T116-T135", "AI router and data depth"],
  ["3", "T146-T165", "Factor Lab as the second core product engine"],
  ["4", "T136-T145 + T166-T175", "Professional workflows and release hardening"],
  ["5", "T176-T195", "Safety, compliance, commercialization, and external proof"],
].forEach((batch, index) => {
  const card = roundedRect(`Batch ${batch[0]}`, 80, 180 + index * 120, 1220, 84, colors.white, colors.line);
  card.appendChild(textNode("Batch number", batch[0], 24, 20, 40, 26, "Semi Bold", colors.product));
  card.appendChild(textNode("Task range", batch[1], 90, 20, 260, 18, "Semi Bold", colors.ink));
  card.appendChild(textNode("Intent", batch[2], 370, 22, 760, 16, "Regular", colors.muted));
  execution.appendChild(card);
});
page.appendChild(execution);
createdNodeIds.push(execution.id);

const firstBatch = createRoadmapFrame("03 First Batch Detail - T96 to T115", 1620, 1340, 1800, 1160);
addFrameTitle(firstBatch, "First Batch Detail", "T96 should leave enough visual structure for T97 UI System, T98 tokens, T99 navigation, T100 shell redesign, and T107-T115 first-use validation.");
[milestones[0], milestones[1]].forEach((m, col) => {
  firstBatch.appendChild(textNode(`${m.key} heading`, `${m.key} ${m.title}`, 80 + col * 850, 170, 720, 24, "Semi Bold", m.color));
  m.tasks.forEach((task, index) => {
    const x = 80 + col * 850;
    const y = 230 + index * 76;
    const card = roundedRect(`${task[0]} card`, x, y, 750, 58, colors.white, colors.line);
    card.appendChild(textNode("Task id", task[0], 18, 16, 62, 16, "Semi Bold", m.color));
    card.appendChild(textNode("Task title", task[1], 96, 16, 560, 15, "Medium", colors.ink));
    firstBatch.appendChild(card);
  });
});
page.appendChild(firstBatch);
createdNodeIds.push(firstBatch.id);

const principlesFrame = createRoadmapFrame("04 Design Principles And Boundaries", 120, 2020, 1440, 900);
addFrameTitle(principlesFrame, "Design Principles And Boundaries", "These rules keep the roadmap aligned with the current local-first product posture while leaving room for future implementation tasks.");
principles.forEach((principle, index) => {
  const card = roundedRect(`Principle ${index + 1}`, 80, 180 + index * 94, 1180, 62, colors.white, colors.line);
  card.appendChild(textNode("Number", `${index + 1}`, 22, 18, 38, 16, "Semi Bold", colors.product));
  card.appendChild(textNode("Principle text", principle, 74, 18, 960, 15, "Regular", colors.ink));
  principlesFrame.appendChild(card);
});
page.appendChild(principlesFrame);
createdNodeIds.push(principlesFrame.id);

figma.viewport.scrollAndZoomIntoView([cover, overview, execution, firstBatch, principlesFrame]);

return {
  createdNodeIds,
  pageId: page.id,
  frameCount: createdNodeIds.length,
  taskCoverage: "T96-T195",
  fileName: figma.root.name,
};
