import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Database, LockKeyhole, RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "../components/button";
import { LocalUnlockGate } from "../components/local-unlock-gate";
import { AITrigger, ContextInspector, DataTable, PageHeader, RoutePageFrame, StateBlock, SubrouteNav } from "../components/ui-kit";
import type { LocalSecurityStatus } from "../lib/api";
import type { LanguagePreference } from "../store/app-store";
import { loadRoutePageData } from "./page-loaders";
import { useRouteContext } from "./route-context";
import { getRouteContent, RouteContentSurface } from "./route-content";

const stateCopy = {
  loading: { title: "正在加载页面数据", description: "正在读取本地数据和页面上下文，请稍候。" },
  empty: { title: "当前范围暂无数据", description: "调整筛选范围或补充本地数据后重试。" },
  error: { title: "页面数据暂时不可用", description: "本地服务或数据请求出现异常，请检查运行状态后重试。" },
  blocked: { title: "当前操作已阻断", description: "完成必要条件或人工确认后才能继续。" },
  locked: { title: "敏感工作区已锁定", description: "解锁本地工作区后才能查看受保护内容。" },
  ready: { title: "页面已就绪", description: "当前页面的主任务和上下文已经准备完成。" },
} as const;

type RouteRow = { item: string; status: string; value: string; source: string };

export type FrameRoutePageProps = {
  localSecurity: LocalSecurityStatus | null;
  securityLoading: boolean;
  securityError: Error | string | null;
  language: LanguagePreference;
  securityBusy: boolean;
  onInitialize: (secret: string) => Promise<void>;
  onUnlock: (secret: string) => Promise<void>;
  onReset: (confirmation: string) => Promise<void>;
};

function surfaceTitle(componentKey: string): string {
  if (componentKey.includes("Price")) return "价格与时间序列";
  if (componentKey.includes("Filings")) return "文件与来源";
  if (componentKey.includes("Data")) return "数据覆盖与新鲜度";
  if (componentKey.includes("Research") || componentKey.includes("research")) return "研究交接与证据";
  if (componentKey.includes("Factor") || componentKey.includes("factor")) return "因子实验与质量";
  if (componentKey.includes("Strategy") || componentKey.includes("strategy") || componentKey.includes("Backtest")) return "策略配置与结果";
  if (componentKey.includes("Workflow") || componentKey.includes("workflow")) return "工作流步骤与运行";
  if (componentKey.includes("Screener") || componentKey.includes("screener")) return "筛选条件与命中";
  if (componentKey.includes("Portfolio") || componentKey.includes("portfolio")) return "组合持仓与风险";
  if (componentKey.includes("Connection") || componentKey.includes("connection")) return "连接状态与权限";
  if (componentKey.includes("Settings") || componentKey.includes("settings")) return "配置与运行边界";
  if (componentKey.includes("Manual") || componentKey.includes("manual")) return "帮助章节与下一步";
  return "页面数据与证据";
}

function surfaceRows(componentKey: string, fixtureKey: string): RouteRow[] {
  const title = surfaceTitle(componentKey);
  return [
    { item: title, status: "ready", value: fixtureKey, source: "local" },
    { item: "证据范围", status: "sample", value: "local snapshot", source: "fixture" },
    { item: "下一步动作", status: "review", value: componentKey, source: "route contract" },
  ];
}

function RouteDataSurface({ route, sourceLabel, state }: { route: ReturnType<typeof useRouteContext>["route"]; sourceLabel: string; state: keyof typeof stateCopy }) {
  if (state !== "ready") return null;
  const rows = surfaceRows(route.componentKey, route.fixtureKey);
  return (
    <section className="route-data-surface" aria-label={surfaceTitle(route.componentKey)}>
      <div className="route-data-surface-heading"><div><p className="eyebrow">DATA / EVIDENCE</p><h2>{surfaceTitle(route.componentKey)}</h2></div><span className="mini-pill">{sourceLabel}</span></div>
      <DataTable<RouteRow>
        ariaLabel={surfaceTitle(route.componentKey)}
        columns={[{ key: "item", label: "项目", sticky: true }, { key: "status", label: "状态" }, { key: "value", label: "值" }, { key: "source", label: "来源" }]}
        rows={rows}
        rowKey={(row) => row.item}
        dataSource={sourceLabel}
        freshness="本地快照"
        labels={{ filter: "筛选", rows: "行", source: "来源", freshness: "新鲜度" }}
      />
    </section>
  );
}

export function FrameRoutePage({ localSecurity, securityLoading, securityError, language, securityBusy, onInitialize, onUnlock, onReset }: FrameRoutePageProps) {
  const { route, params, inspector } = useRouteContext();
  const [previewState, setPreviewState] = useState<keyof typeof stateCopy | null>(null);
  const routeContent = getRouteContent(route, params);
  const requiresUnlock = route.accessPolicy === "local_unlock";
  const securityReady = !requiresUnlock || (localSecurity?.initialized === true && localSecurity.locked === false);
  const pageQuery = useQuery({
    queryKey: ["frame-route", route.svgRoute, params],
    queryFn: () => loadRoutePageData(route, params),
    retry: false,
    staleTime: 30_000,
    enabled: securityReady,
  });
  const securityState: keyof typeof stateCopy | null = requiresUnlock && securityLoading && !localSecurity
    ? "loading"
    : requiresUnlock && !securityLoading && !localSecurity
      ? "blocked"
      : null;
  const baseState: keyof typeof stateCopy = securityState ?? (pageQuery.isPending ? "loading" : pageQuery.data?.locked ? "locked" : "ready");
  const state = previewState ?? baseState;
  const stateText = stateCopy[state];
  const isAssistant = route.aiPolicy.mode === "standalone";
  const supportsAi = route.aiPolicy.mode !== "none";
  const sourceLabel = pageQuery.data?.source === "api" ? "local API" : pageQuery.data?.source === "security" ? "local security" : "deterministic fixture";
  const effectiveInspector = pageQuery.data?.locked
    ? { ...inspector, permissionState: "locked" as const, aiState: "blocked" as const }
    : inspector;

  if (requiresUnlock && securityLoading && !localSecurity) {
    return (
      <RoutePageFrame className="route-frame-page" data-route-id={route.svgRoute} data-frame-id={route.frameId} data-ui-state="loading">
        <PageHeader scope={`${route.frameId} / ${route.topLevelView}`} title={route.label} description={route.svgRoute} freshness={<span>本地安全状态</span>} />
        <StateBlock state="loading" title="正在检查本地解锁状态" description="安全状态确认前不会加载敏感页面数据。" />
      </RoutePageFrame>
    );
  }

  if (requiresUnlock && !securityLoading && !localSecurity) {
    return (
      <RoutePageFrame className="route-frame-page" data-route-id={route.svgRoute} data-frame-id={route.frameId} data-ui-state="blocked">
        <PageHeader scope={`${route.frameId} / ${route.topLevelView}`} title={route.label} description={route.svgRoute} freshness={<span>本地安全服务不可用</span>} />
        <StateBlock state="blocked" title="无法确认本地解锁状态" description={String(securityError ?? "请先启动本地 sidecar，再输入 PIN 或口令。")} />
      </RoutePageFrame>
    );
  }

  if (requiresUnlock && localSecurity && (!localSecurity.initialized || localSecurity.locked)) {
    return (
      <RoutePageFrame className="route-frame-page" data-route-id={route.svgRoute} data-frame-id={route.frameId} data-ui-state="locked">
        <PageHeader scope={`${route.frameId} / ${route.topLevelView}`} title={route.label} description={route.svgRoute} freshness={<span>本地安全状态</span>} />
        <LocalUnlockGate status={localSecurity} language={language} viewLabel={route.label} busy={securityBusy} onInitialize={onInitialize} onUnlock={onUnlock} onReset={onReset} />
      </RoutePageFrame>
    );
  }

  return (
    <RoutePageFrame className="route-frame-page" data-route-id={route.svgRoute} data-frame-id={route.frameId} data-ui-state={state}>
      <PageHeader
        scope={`${route.frameId} / ${route.topLevelView}`}
        title={route.label}
        description={routeContent.taskDescription}
        freshness={<span data-route-freshness="local">{sourceLabel}</span>}
        actions={(
          <>
            {supportsAi ? <AITrigger label={isAssistant ? "开始 AI 工作" : "打开 AI 助手"} onClick={() => setPreviewState("ready")} /> : null}
            <Button variant="ghost" onClick={() => { setPreviewState(null); void pageQuery.refetch(); }}><RefreshCcw size={15} />刷新</Button>
          </>
        )}
      />
      <SubrouteNav current={route.svgRoute} items={[{ id: route.svgRoute, label: route.label }, { id: `${route.svgRoute}#state`, label: "状态与证据" }]} />
      <div className="route-frame-content">
        <main className="route-frame-main">
          <section className="route-primary-task" aria-label="主要任务">
            <div className="route-primary-task-header"><div><p className="eyebrow">{routeContent.eyebrow}</p><h2>{state === "ready" ? routeContent.taskTitle : stateText.title}</h2></div><span className="mini-pill accent">{route.pageKind}</span></div>
            <p className="body-copy">{state === "ready" ? routeContent.taskDescription : stateText.description}</p>
            {state === "ready" ? (
              <div className="route-ready-summary">
                <div><CheckCircle2 size={18} /><strong>本地上下文已连接</strong><span>{pageQuery.data?.fixtureKey ?? route.fixtureKey}</span></div>
                <div><Database size={18} /><strong>来源已标注</strong><span>{sourceLabel}</span></div>
              </div>
            ) : (
              <StateBlock
                state={state}
                title={stateText.title}
                description={stateText.description}
                action={state === "locked" ? <Button variant="primary" onClick={() => setPreviewState("ready")}><LockKeyhole size={15} />模拟解锁</Button> : <Button variant="primary" onClick={() => setPreviewState("ready")}><ArrowRight size={15} />恢复页面</Button>}
              />
            )}
          </section>
          <RouteContentSurface route={route} params={params} state={state} onAction={() => setPreviewState("ready")} />
          <section className="route-state-controls" aria-label="状态预览">
            <p className="eyebrow">STATE PREVIEW</p>
            <div className="route-state-buttons">{(route.supportedStates as Array<keyof typeof stateCopy>).filter((item): item is keyof typeof stateCopy => item in stateCopy).map((item) => <Button key={item} variant={state === item ? "primary" : "ghost"} onClick={() => setPreviewState(item)}>{stateCopy[item].title}</Button>)}</div>
          </section>
        </main>
        <ContextInspector
          context={effectiveInspector}
          objectType={effectiveInspector.objectType}
          objectId={effectiveInspector.objectId}
          title="当前页面上下文"
          subtitle={route.svgRoute}
          status={<span className="mini-pill accent">{stateText.title}</span>}
          sections={[{ id: "route-contract", title: "路由契约", rows: [{ id: "frame", label: "Frame", value: route.frameId }, { id: "source", label: "来源", value: sourceLabel }, { id: "freshness", label: "新鲜度", value: effectiveInspector.freshness }] }]}
          actions={supportsAi ? [{ id: "ai", label: isAssistant ? "运行 AI" : "打开 AI 助手", kind: "ai", onClick: () => setPreviewState("ready") }] : undefined}
        />
      </div>
      <div className="route-frame-footer"><Sparkles size={15} /><span>本页面由 SVG Frame 注册表驱动；状态、来源、权限和下一步动作均可检查。</span></div>
    </RoutePageFrame>
  );
}
