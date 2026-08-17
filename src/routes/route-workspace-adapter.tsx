import { useMemo, useState, type ReactNode } from "react";
import { Bot, RefreshCcw, ShieldCheck } from "lucide-react";
import { Button } from "../components/button";
import { LocalUnlockGate } from "../components/local-unlock-gate";
import { Badge, PageHeader, RoutePageFrame, StateBlock, SubrouteNav } from "../components/ui-kit";
import { usePengboNavigation } from "../hooks/use-pengbo-navigation";
import type { LocalSecurityStatus } from "../lib/api";
import type { LanguagePreference } from "../store/app-store";
import type { BackendStatus } from "../components/shared";
import { UI_STATE_REGISTRY, type UiState } from "../ui-state-registry";
import { getFrameRoutesForView } from "./route-registry";
import { useRouteContext } from "./route-context";
import { RouteBusinessPage, type RouteBusinessPageDependencies } from "./route-business-pages";

type VisualState = UiState;

export type RouteWorkspaceAdapterProps = {
  businessDependencies: RouteBusinessPageDependencies;
  backendStatus: BackendStatus;
  localSecurity: LocalSecurityStatus | null;
  securityLoading: boolean;
  securityError: Error | string | null;
  language: LanguagePreference;
  securityBusy: boolean;
  onInitialize: (secret: string) => Promise<void>;
  onUnlock: (secret: string) => Promise<void>;
  onReset: (confirmation: string) => Promise<void>;
  onRetry: () => Promise<void> | void;
};

const visualStateCopy: Record<Exclude<VisualState, "ready">, { title: string; description: string }> = {
  loading: { title: "正在连接本地服务", description: "页面正在等待本地 API 与缓存进入稳定状态。" },
  empty: { title: "当前范围暂无数据", description: "请调整筛选条件，或先导入与当前页面匹配的本地数据。" },
  error: { title: "本地数据暂不可用", description: "恢复本地 sidecar 后重试；系统不会用样例数据伪装成功。" },
  blocked: { title: "当前页面条件不满足", description: "请恢复本地服务、权限或数据前置条件后重试；系统不会用样例数据伪装成功。" },
  locked: { title: "敏感工作区已锁定", description: "解锁前不会请求或展示受保护数据。" },
  "ai-insufficient-evidence": { title: "证据不足，暂不生成", description: "当前上下文没有足够的本地证据支持可靠的 AI 结果。" },
  "cloud-opt-in": { title: "需要明确云端授权", description: "只有明确同意后，内容才可以发送到云端服务。" },
  recovery: { title: "需要恢复操作", description: "请重试、补充配置或恢复本地服务后继续。" },
};

function isVisualState(value: string | null): value is VisualState {
  return value !== null && Object.hasOwn(UI_STATE_REGISTRY, value);
}

/**
 * Route-level adapter for the T1-T101 business views. It intentionally owns no
 * fixture data: available routes render the real view/controller surface,
 * while future routes stop in an explicit planned-task state.
 */
export function RouteWorkspaceAdapter(props: RouteWorkspaceAdapterProps) {
  const { route, params } = useRouteContext();
  const { openRoute } = usePengboNavigation();
  const [aiBlockedOpen, setAiBlockedOpen] = useState(false);
  const visualTestMode = import.meta.env.DEV && import.meta.env.VITE_VISUAL_TEST_MODE === "true";
  const requestedVisualState = visualTestMode ? new URLSearchParams(window.location.search).get("__state") : null;
  const forcedState = isVisualState(requestedVisualState) && route.supportedStates.includes(requestedVisualState)
    ? requestedVisualState
    : null;
  const requiresUnlock = route.accessPolicy === "local_unlock";
  const unlocked = props.localSecurity?.initialized === true && props.localSecurity.locked === false;

  const siblingRoutes = useMemo(() => getFrameRoutesForView(route.topLevelView).map((candidate) => ({
    id: candidate.svgRoute,
    label: candidate.label,
  })), [params, route.topLevelView]);
  const currentPath = route.svgRoute;
  const aiPlanned = route.aiPolicy.mode !== "none" && route.aiPolicy.availability.kind === "planned";
  const aiAvailable = route.aiPolicy.mode !== "none" && route.aiPolicy.availability.kind === "available";
  const plannedAiTask = route.aiPolicy.mode !== "none" && route.aiPolicy.availability.kind === "planned"
    ? route.aiPolicy.availability.plannedTask
    : null;

  const frame = (state: VisualState, content: ReactNode) => (
    <RoutePageFrame
      className="route-workspace-adapter"
      data-access-policy={route.accessPolicy}
      data-action-policy={route.actionPolicy}
      data-availability={route.availability.kind}
      data-frame-id={route.frameId}
      data-route-id={route.svgRoute}
      data-route-section={route.surface.section}
      data-ui-state={state}
    >
      {content}
    </RoutePageFrame>
  );

  const contractBar = (state: VisualState) => (
    <div className="route-contract-bar">
      <SubrouteNav current={currentPath} items={siblingRoutes} onChange={(path) => openRoute(path, { params })} />
      <div className="route-contract-actions">
        <Badge tone={route.actionPolicy === "explicit_confirmation" ? "warning" : "info"}>
          {route.actionPolicy === "explicit_confirmation" ? "明确确认" : route.actionPolicy === "local_write" ? "本地写入" : "只读"}
        </Badge>
        {route.availability.kind === "planned" ? <Badge tone="warning">{route.availability.plannedTask}</Badge> : null}
        {route.accessPolicy === "local_unlock" && state === "ready" ? <Badge tone="success"><ShieldCheck size={13} />已解锁</Badge> : null}
        {state === "ready" && aiPlanned ? <Button variant="ghost" onClick={() => setAiBlockedOpen((open) => !open)}><Bot size={15} />上下文 AI</Button> : null}
        {state === "ready" && aiAvailable && route.topLevelView === "research" && route.componentKey !== "researchAssistant" ? (
          <Button variant="ghost" onClick={() => openRoute("/research/briefs/:briefId/assistant", { params })}><Bot size={15} />研究 AI</Button>
        ) : null}
      </div>
    </div>
  );

  const statePage = (content: ReactNode, className = "") => (
    <div data-route-page={route.componentKey}>
      <section className={`route-family-page route-state-page ${className}`.trim()} data-route-section={route.surface.section}>
        <div data-primary-task={route.surface.section}>{content}</div>
      </section>
    </div>
  );

  const workspaceFrame = (state: VisualState, content: ReactNode) => frame(state, <>
    {contractBar(state)}
    <div aria-label="route-business-surface" className="route-child-workspace" data-real-business-surface={route.surface.view} data-surface-state={state}>
      {state === "ready" && aiBlockedOpen && plannedAiTask ? (
        <StateBlock
          className="route-ai-planned-state"
          state="blocked"
          title={`上下文 AI 将由 ${plannedAiTask} 实现`}
          description="M1 只保留真实入口与上下文合同；当前不会伪造模型输出或把按钮当作已完成动作。"
        />
      ) : null}
      {content}
    </div>
  </>);

  if (route.availability.kind === "planned" && forcedState === "recovery") {
    return workspaceFrame("recovery", statePage(<StateBlock
      state="recovery"
      title={`恢复条件 · ${route.availability.plannedTask}`}
      description={`${route.availability.missingCondition}。该能力完成前请返回当前可用功能。`}
      action={<Button variant="ghost" onClick={() => openRoute("/dashboard/overview")}>返回当前可用功能</Button>}
    />, "route-planned-page"));
  }

  if (route.availability.kind === "planned") {
    return workspaceFrame("blocked", statePage(<>
      <PageHeader
        scope={`${route.frameId} / ${route.availability.plannedTask}`}
        title={route.label}
        description={route.svgRoute}
        freshness={<span>Planned</span>}
      />
      <StateBlock
        state="blocked"
        title={`此能力尚未进入 M1 · ${route.availability.plannedTask}`}
        description={`${route.availability.missingCondition}。完成条件以 ${route.availability.plannedTask} 为准。`}
        action={<Button variant="ghost" onClick={() => openRoute("/dashboard/overview")}>返回当前可用功能</Button>}
      />
    </>, "route-planned-page"));
  }

  if (props.backendStatus === "offline") {
    return workspaceFrame("error", statePage(<StateBlock
      state="error"
      title={visualStateCopy.error.title}
      description={visualStateCopy.error.description}
      action={<Button variant="primary" onClick={() => void props.onRetry()}><RefreshCcw size={15} />恢复并重试</Button>}
    />));
  }

  if (requiresUnlock && !props.localSecurity && props.backendStatus === "online" && props.securityLoading) {
    return workspaceFrame("loading", statePage(<StateBlock state="loading" title="正在检查本地解锁状态" description="确认安全状态前不会加载敏感数据。" />));
  }

  if (requiresUnlock && !props.localSecurity) {
    return workspaceFrame("blocked", statePage(<StateBlock
      state="blocked"
      title="无法确认本地解锁状态"
      description={String(props.securityError ?? "请先恢复本地 sidecar，再重试安全状态检查。")}
      action={<Button variant="primary" onClick={() => void props.onRetry()}><RefreshCcw size={15} />重试</Button>}
    />));
  }

  if (requiresUnlock && props.localSecurity && !unlocked) {
    return workspaceFrame("locked", statePage(<>
      <PageHeader scope={`${route.frameId} / LOCAL UNLOCK`} title={route.label} description="解锁前不会请求该路由的敏感数据。" />
      <LocalUnlockGate
        status={props.localSecurity}
        language={props.language}
        viewLabel={route.label}
        busy={props.securityBusy}
        onInitialize={props.onInitialize}
        onUnlock={props.onUnlock}
        onReset={props.onReset}
      />
    </>));
  }

  if (forcedState && forcedState !== "ready") {
    const copy = visualStateCopy[forcedState];
    return workspaceFrame(forcedState, statePage(<StateBlock
      state={forcedState}
      title={`${copy.title}（视觉测试）`}
      description={copy.description}
      action={UI_STATE_REGISTRY[forcedState].recovery ? <Button variant="primary" onClick={() => void props.onRetry()}>恢复并重试</Button> : undefined}
    />));
  }

  if (props.backendStatus === "connecting") {
    return workspaceFrame("loading", statePage(<StateBlock state="loading" title={visualStateCopy.loading.title} description={visualStateCopy.loading.description} />));
  }

  return workspaceFrame("ready", <RouteBusinessPage dependencies={props.businessDependencies} />);
}
