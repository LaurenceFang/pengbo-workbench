export type UiState =
  | "loading"
  | "empty"
  | "blocked"
  | "error"
  | "locked"
  | "ready"
  | "ai-insufficient-evidence"
  | "cloud-opt-in"
  | "recovery";

export type UiStateDefinition = {
  label: string;
  defaultTitle: string;
  defaultDescription: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  recovery: boolean;
  requiresUnlock: boolean;
  allowsAi: boolean;
};

export const UI_STATE_REGISTRY: Record<UiState, UiStateDefinition> = {
  loading: { label: "加载中", defaultTitle: "正在加载", defaultDescription: "正在读取本地数据，请稍候。", tone: "info", recovery: false, requiresUnlock: false, allowsAi: false },
  empty: { label: "暂无数据", defaultTitle: "暂无数据", defaultDescription: "当前范围内没有可显示的内容。", tone: "neutral", recovery: true, requiresUnlock: false, allowsAi: false },
  blocked: { label: "已阻断", defaultTitle: "当前操作已阻断", defaultDescription: "完成必要条件后才能继续。", tone: "danger", recovery: true, requiresUnlock: false, allowsAi: false },
  error: { label: "发生错误", defaultTitle: "暂时无法完成", defaultDescription: "本地服务或数据请求出现问题，请重试。", tone: "danger", recovery: true, requiresUnlock: false, allowsAi: false },
  locked: { label: "已锁定", defaultTitle: "敏感工作区已锁定", defaultDescription: "解锁本地工作区后才能查看受保护内容。", tone: "danger", recovery: true, requiresUnlock: true, allowsAi: false },
  ready: { label: "已就绪", defaultTitle: "已就绪", defaultDescription: "当前内容可以继续操作。", tone: "success", recovery: false, requiresUnlock: false, allowsAi: true },
  "ai-insufficient-evidence": { label: "证据不足", defaultTitle: "证据不足，暂不生成", defaultDescription: "当前上下文没有足够的本地证据支持可靠的 AI 结果。", tone: "warning", recovery: true, requiresUnlock: false, allowsAi: false },
  "cloud-opt-in": { label: "等待云端授权", defaultTitle: "需要明确授权", defaultDescription: "只有在你明确同意后，内容才能发送到云端服务。", tone: "warning", recovery: true, requiresUnlock: false, allowsAi: false },
  recovery: { label: "需要恢复", defaultTitle: "需要恢复操作", defaultDescription: "请重试、补充配置或恢复本地服务。", tone: "warning", recovery: true, requiresUnlock: false, allowsAi: false },
};

export function getUiStateDefinition(state: UiState): UiStateDefinition {
  return UI_STATE_REGISTRY[state];
}

export function inferUiState(text: string): UiState {
  const value = text.toLowerCase();
  if (/loading|加载|正在/.test(value)) return "loading";
  if (/locked|lock|解锁|锁定|403|401|423/.test(value)) return "locked";
  if (/insufficient|evidence|证据不足/.test(value)) return "ai-insufficient-evidence";
  if (/cloud|云端|授权/.test(value)) return "cloud-opt-in";
  if (/blocked|阻断|禁止|不支持/.test(value)) return "blocked";
  if (/error|failed|failure|错误|失败|异常|拒绝/.test(value)) return "error";
  if (/recover|恢复|retry|重试|补充/.test(value)) return "recovery";
  if (/empty|暂无|没有|还没有|未找到|no /.test(value)) return "empty";
  return "ready";
}
