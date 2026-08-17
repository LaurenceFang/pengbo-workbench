# T105 中文状态系统

状态：实施中（共享状态基础、静态覆盖检查和浏览器壳层冒烟已通过；完整状态矩阵验收仍待完成）

## 范围

T105 只处理前端状态表达，不新增业务路由，不修改 `Pengbo_UI_Rebuild.svg`，不执行 T106 的全路由截图基线。

统一状态为：

`loading`、`empty`、`blocked`、`error`、`locked`、`ready`、
`ai-insufficient-evidence`、`cloud-opt-in`、`recovery`。

## 已实施

- 新增 `src/ui-state-registry.ts`，集中定义中文标签、默认说明、状态色调、恢复能力、解锁要求和 AI 能力边界。
- `StateBlock` 改为使用统一注册表，并通过 `data-ui-state` 暴露机器可读状态。
- `InlineState` 和 `PanelState` 接入统一状态推断和 `data-ui-state`，现有 14 个 ViewKey 页面继续复用这些共享状态面。
- 增加锁定、AI 证据不足、云端授权和恢复状态的语义与样式。
- 保留本地解锁、非 Binance 只读、Binance 默认关闭和 AI 证据边界。
- 新增 `npm.cmd run check:state-system`，检查 9 类状态、共享组件暴露和 14 个页面覆盖。

## 验收要求

除静态检查外，还需验证 ready、loading、empty、error、locked 和 AI 证据不足状态的真实渲染、恢复动作、键盘操作、主题适配和控制台行为。浏览器或接口加载异常只能记录为未验证，不能当作通过。

## 当前证据

```text
npm.cmd run typecheck       PASS
npm.cmd run check:state-system  PASS
npm.cmd run smoke:state-system  PASS（导航壳层、状态数据属性、控制台无错误）
```

T106 截图基线和 SVG 79 帧逐帧验收不属于本文件范围。
