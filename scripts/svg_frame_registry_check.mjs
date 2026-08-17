import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const svgPath = path.join(root, "Pengbo_UI_Rebuild.svg");
const registryPath = path.join(root, "src", "routes", "route-registry.ts");
const jsonPath = path.join(root, "logs", "svg-frame-registry.json");
const docPath = path.join(root, "docs", "svg-frame-route-registry.md");

const [svg, registrySource] = await Promise.all([
  readFile(svgPath, "utf8"),
  readFile(registryPath, "utf8"),
]);

const markerMatches = [...svg.matchAll(/(?<frameNo>\d{2})\s*\/\s*FRAME/g)];
const lockedViews = new Set(["research", "factorLab", "strategyLab", "workflowStudio", "dataSources", "screeners", "portfolio", "connections", "settings", "aiAssistant"]);
const sourceRoutes = [...registrySource.matchAll(/route\((?<frameNo>\d+),\s*"(?<route>[^"]+)",\s*"(?<topLevelView>[^"]+)",\s*"(?<pageKind>[^"]+)",\s*"(?<componentKey>[^"]+)",\s*"(?<fixtureKey>[^"]+)",\s*"(?<label>[^"]+)"(?<options>[^\n]*)/g)].map((match) => {
  const plannedTask = match.groups.options.match(/availability:\s*\{\s*kind:\s*"planned",\s*plannedTask:\s*"(T\d+)"/)?.[1] ?? null;
  const topLevelView = match.groups.topLevelView;
  return {
    frameNo: Number(match.groups.frameNo),
    route: match.groups.route,
    topLevelView,
    pageKind: match.groups.pageKind,
    componentKey: match.groups.componentKey,
    fixtureKey: match.groups.fixtureKey,
    label: match.groups.label,
    surface: { view: topLevelView, section: match.groups.componentKey },
    availability: plannedTask ? { kind: "planned", plannedTask } : { kind: "available" },
    aiPolicy: match.groups.options.includes("standaloneAi") ? "standalone" : match.groups.options.includes("contextualAi") ? "contextual" : "none",
    accessPolicy: match.groups.options.includes('accessPolicy: "public"') ? "public" : match.groups.options.includes('accessPolicy: "local_unlock"') || lockedViews.has(topLevelView) ? "local_unlock" : "public",
    actionPolicy: match.groups.options.includes('actionPolicy: "explicit_confirmation"') ? "explicit_confirmation" : match.groups.pageKind === "config" ? "local_write" : "read_only",
  };
});

function frameBounds(frameNo) {
  const column = (frameNo - 1) % 2;
  const row = Math.floor((frameNo - 1) / 2);
  return { x: column * 1580 + 80, y: row * 1020 + 150, width: 1440, height: 900 };
}

function routeFromSvgChunk(chunk) {
  const texts = [...chunk.matchAll(/>([^<>]*\/[^<>]*)</g)].map((match) => match[1].trim());
  return texts.find((text) => text.startsWith("/")) ?? null;
}

const svgRoutes = markerMatches.map((marker, index) => {
  const start = marker.index + marker[0].length;
  const end = index + 1 < markerMatches.length ? markerMatches[index + 1].index : svg.length;
  return {
    frameNo: Number(marker.groups.frameNo),
    svgRoute: routeFromSvgChunk(svg.slice(start, end)),
    svgBounds: frameBounds(Number(marker.groups.frameNo)),
  };
});

const failures = [];
if (markerMatches.length !== 79) failures.push(`SVG frame count is ${markerMatches.length}, expected 79`);
if (sourceRoutes.length !== 79) failures.push(`source route count is ${sourceRoutes.length}, expected 79`);
if (new Set(sourceRoutes.map((item) => item.route)).size !== sourceRoutes.length) failures.push("source routes are not unique");
if (sourceRoutes.some((item, index) => item.frameNo !== index + 1)) failures.push("source frame numbers are not contiguous");
if (svgRoutes.some((item) => item.svgRoute === null)) failures.push("one or more SVG frames have no route text");
if (sourceRoutes.some((item) => item.actionPolicy === "explicit_confirmation" && item.accessPolicy !== "local_unlock")) failures.push("explicit confirmation route without local unlock");

const sourceByFrame = new Map(sourceRoutes.map((item) => [item.frameNo, item]));
for (const frame of svgRoutes) {
  const sourceRoute = sourceByFrame.get(frame.frameNo)?.route;
  if (sourceRoute !== frame.svgRoute) failures.push(`frame ${frame.frameNo}: SVG route ${frame.svgRoute ?? "<missing>"} != source route ${sourceRoute ?? "<missing>"}`);
}

const registry = {
  generatedAt: new Date().toISOString(),
  svgPath: "Pengbo_UI_Rebuild.svg",
  svgSha256: createHash("sha256").update(svg).digest("hex").toUpperCase(),
  frameCount: svgRoutes.length,
  routeCount: sourceRoutes.length,
  frames: svgRoutes.map((frame) => ({
    ...frame,
    ...(sourceByFrame.get(frame.frameNo) ?? { route: null }),
  })),
  failures,
};

await mkdir(path.dirname(jsonPath), { recursive: true });
await mkdir(path.dirname(docPath), { recursive: true });
await writeFile(jsonPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

const rows = registry.frames.map((frame) => `| ${String(frame.frameNo).padStart(2, "0")} | ${frame.svgRoute ?? "—"} | ${frame.componentKey ?? "—"} | ${frame.availability?.kind === "planned" ? `Blocked → ${frame.availability.plannedTask}` : "Available"} | ${frame.accessPolicy ?? "—"} / ${frame.actionPolicy ?? "—"} | ${frame.svgBounds.x}, ${frame.svgBounds.y}, ${frame.svgBounds.width}, ${frame.svgBounds.height} |`);
const markdown = [
  "# SVG Frame 路由注册表",
  "",
  "> 此文件由 `npm.cmd run check:svg-frame-registry` 生成。SVG 是唯一视觉基线，本文件只记录解析结果，不修改设计源。",
  "",
  `- SVG：\`${registry.svgPath}\``,
  `- SHA-256：\`${registry.svgSha256}\``,
  `- Frame：${registry.frameCount}/79`,
  `- route：${registry.routeCount}/79`,
  `- 校验：${failures.length === 0 ? "通过" : "失败"}`,
  "",
  "| Frame | SVG route | Real surface section | Availability | Access / action | Bounds |",
  "| ---: | --- | --- | --- | --- | --- |",
  ...rows,
  "",
].join("\n");
await writeFile(docPath, markdown, "utf8");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`SVG registry check passed: ${registry.frameCount} frames, ${registry.routeCount} routes`);
}
