# 79 路由页面内容修复记录

更新时间：2026-07-15

## 结论

本轮修复解决了“路由存在但页面主体只有通用占位内容、公开页面可能长期停留 loading”的问题。现在每条 Frame route 都由页面职责驱动的内容模型渲染主任务、指标、图表/表格/配置/时间线/检查清单、来源和新鲜度信息。

当前状态仍为“整改中”，不能据此宣称 79 个 Frame 已达到 SVG 的逐像素一致。SVG 仍是唯一视觉基线。

## 代码变更

- `src/routes/route-content.tsx`
  - 为 Dashboard、Command Center、Asset、Watchlist、Data Sources、Research、Factor Lab、Strategy Lab、Workflow Studio、Screeners、Portfolio、Connections、Settings、Manual 和 AI Assistant 提供确定性页面内容模型。
  - 内容包含中文优先的页面职责、KPI、趋势图、数据表、配置字段、运行时间线、质量检查和安全边界。
  - 所有数据明确标记 `local API`、`fixture`、`cached` 或 `simulated` 语义。
- `src/routes/route-pages.tsx`
  - 使用 route content 模型替换原来的三行通用占位表。
  - PageHeader、PRIMARY TASK 和主体区域现在使用当前 Frame 的真实页面职责和 URL 参数。
- `src/routes/page-loaders.ts`
  - API 优先保持不变；新增 1500ms 有限超时，超时后进入确定性 fixture，避免公开页面永久停留 loading。
  - 敏感路由仍然先检查本地解锁，未解锁前不加载页面数据。
- `src/styles.css`
  - 新增与 SVG 页面结构对应的 KPI、趋势图、表格、配置、检查清单和时间线样式，并保留 1180/900/560 宽度下的响应式布局。

## 验证证据

- `npm.cmd run typecheck`：通过。
- `npm.cmd run web:build`：通过；仅保留既有的单 bundle 体积警告。
- `npm.cmd run smoke:all-route-states`：11/11 通过。
- `npm.cmd run check:route-registry`：79/79 route 通过。
- `npm.cmd run check:context-inspector`：通过。
- `git diff --check`：通过，仅有 Windows 换行提示。
- `npm.cmd run smoke:all-routes-render`：79/79 Frame、316/316 记录、316/316 截图结构检查通过。
- 浏览器 `http://127.0.0.1:4190/dashboard/overview`：最终 `data-ui-state=ready`，存在“系统就绪与市场脉搏”、KPI、趋势图和数据表；控制台 error 为 0。
- 锁定状态下 `http://127.0.0.1:4190/research/inbox`：仍显示 `local-unlock-secret` 输入框，且敏感数据未加载。

## 未完成项

- 79 个 Frame 仍需逐页面按照 SVG 的精确几何、文案、表格列、图表和交互进行截图对照。
- API fixture 当前用于稳定渲染和离线降级，不代表所有页面后端业务数据已经逐字段接通。
- 完整视觉验收仍需在解锁后的敏感页面上完成，并同步 console/network/security 证据。
