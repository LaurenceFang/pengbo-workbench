import { Search, X } from "lucide-react";
import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { Button, type ButtonProps } from "./button";
import { getUiStateDefinition, type UiState } from "../ui-state-registry";

export { DataTable } from "./data-table";
export type { DataTableColumn, DataTableProps, DataTableState } from "./data-table";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export function RoutePageFrame({ children, className = "", ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <section {...props} className={`route-page-frame ${className}`}>{children}</section>;
}

export function PageHeader({ title, description, scope, freshness, actions }: { title: string; description: string; scope?: ReactNode; freshness?: ReactNode; actions?: ReactNode }) {
  return <header className="route-page-header"><div><p className="eyebrow">{scope}</p><h1>{title}</h1><p className="route-page-description">{description}</p></div><div className="route-page-header-meta">{freshness ? <Badge tone="info">{freshness}</Badge> : null}{actions ? <div className="route-page-actions">{actions}</div> : null}</div></header>;
}

export function SubrouteNav({ items, current, onChange }: { items: Array<{ id: string; label: string }>; current: string; onChange?: (id: string) => void }) {
  return <nav aria-label="Subroute navigation" className="ui-subroute-nav">{items.map((item) => <button aria-label={`subroute:${item.id}`} aria-current={item.id === current ? "page" : undefined} className={item.id === current ? "is-active" : ""} key={item.id} onClick={() => onChange?.(item.id)} type="button">{item.label}</button>)}</nav>;
}

export function Badge({ tone = "neutral", children, className = "", ...props }: { tone?: BadgeTone; children: ReactNode; className?: string } & HTMLAttributes<HTMLSpanElement>) { return <span {...props} className={`ui-badge ui-badge-${tone} ${className}`}>{children}</span>; }

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(function IconButton({ label, children, className = "", type = "button", ...props }, ref) {
  return <button {...props} ref={ref} aria-label={label} className={`ui-icon-button ${className}`} type={type}>{children}</button>;
});
IconButton.displayName = "IconButton";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = "", ...props }, ref) { return <input {...props} ref={ref} className={`ui-input ${className}`} />; });
Input.displayName = "Input";

export const SearchField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function SearchField({ className = "", ...props }, ref) { return <label className={`ui-search-field ${className}`}><Search size={16} aria-hidden="true" /><input {...props} ref={ref} aria-label={props["aria-label"] ?? props.placeholder ?? "Search"} /></label>; });
SearchField.displayName = "SearchField";

export function SegmentedControl({ options, value, onChange }: { options: Array<{ value: string; label: string }>; value: string; onChange: (value: string) => void }) { return <div className="ui-segmented-control" role="group">{options.map((option) => <button key={option.value} aria-pressed={option.value === value} className={option.value === value ? "is-selected" : ""} onClick={() => onChange(option.value)} type="button">{option.label}</button>)}</div>; }

export function Sheet({ open, title, closeLabel = "Close", onClose, children }: { open: boolean; title: string; closeLabel?: string; onClose: () => void; children: ReactNode }) {
  const sheetRef = useRef<HTMLElement | null>(null);
  useEffect(() => { if (!open) return; sheetRef.current?.focus(); const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; document.addEventListener("keydown", handleKeyDown); return () => document.removeEventListener("keydown", handleKeyDown); }, [onClose, open]);
  if (!open) return null;
  return <div className="ui-sheet-backdrop" role="presentation" onClick={onClose}><section aria-label={title} aria-modal="true" className="ui-sheet" onClick={(event) => event.stopPropagation()} ref={sheetRef} role="dialog" tabIndex={-1}><header><h2>{title}</h2><IconButton label={closeLabel} onClick={onClose}><X size={18} /></IconButton></header>{children}</section></div>;
}

export type StateBlockState = UiState;

export function StateBlock({ state, title, description, action, className = "" }: { state: StateBlockState; title?: string; description?: string; action?: ReactNode; className?: string }) {
  const definition = getUiStateDefinition(state);
  return <section aria-live={state === "loading" ? "polite" : "assertive"} className={`ui-state-block ui-state-${state} ${className}`} data-ui-state={state}>
    <Badge tone={definition.tone}>{definition.label}</Badge>
    <h3>{title ?? definition.defaultTitle}</h3>
    <p>{description ?? definition.defaultDescription}</p>
    {action ? <div className="ui-state-action">{action}</div> : null}
  </section>;
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) { return <span className="ui-tooltip-wrap"><span className="ui-tooltip-target">{children}</span><span className="ui-tooltip" role="tooltip">{label}</span></span>; }

export function Popover({ open, label, children, className = "" }: { open: boolean; label: string; children: ReactNode; className?: string }) { if (!open) return null; return <div aria-label={label} className={`ui-popover ${className}`} role="dialog">{children}</div>; }

export function AITrigger({ label, ...props }: Omit<ButtonProps, "children"> & { label: string }) { return <Button {...props} className={`ui-ai-trigger ${props.className ?? ""}`} variant={props.variant ?? "ghost"}>{label}</Button>; }

export function HandoffAction({ label, ...props }: Omit<ButtonProps, "children"> & { label: string }) { return <Button {...props} className={`ui-handoff-action ${props.className ?? ""}`} variant={props.variant ?? "text"}>{label}</Button>; }

export function EmptyState({ title, description, actionLabel, onAction, tone = "neutral" }: { title: string; description: string; actionLabel?: string; onAction?: () => void; tone?: BadgeTone }) { return <section className={`ui-empty-state ui-empty-${tone}`}><Badge tone={tone}>{tone === "neutral" ? "State" : tone === "success" ? "Next step" : "Notice"}</Badge><h3>{title}</h3><p>{description}</p>{actionLabel && onAction ? <Button variant="primary" onClick={onAction}>{actionLabel}</Button> : null}</section>; }

export type InspectorTone = BadgeTone;

export type InspectorPermissionState = "read_only" | "unlocked" | "confirmation_required" | "blocked" | "locked";
export type InspectorAIState = "available" | "disabled" | "insufficient_evidence" | "cloud_opt_in_required" | "blocked";

export type InspectorContext = {
  routeId: string;
  objectType: string;
  objectId?: string;
  assetId?: string;
  researchBriefId?: string;
  runId?: string;
  evidenceScope?: string[];
  source?: ReactNode;
  freshness?: ReactNode;
  permissionState?: InspectorPermissionState;
  aiState?: InspectorAIState;
};

export type InspectorRow = {
  id: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
};

export type InspectorSection = {
  id: string;
  title: string;
  tone?: InspectorTone;
  rows?: InspectorRow[];
  content?: ReactNode;
};

export type InspectorAction = {
  id: string;
  label: string;
  kind?: "primary" | "secondary" | "text" | "ai" | "handoff";
  disabled?: boolean;
  onClick: () => void;
};

export type ContextInspectorProps = {
  context?: InspectorContext;
  objectType: string;
  objectId?: string;
  title: string;
  subtitle?: ReactNode;
  status?: ReactNode;
  sections: InspectorSection[];
  actions?: InspectorAction[];
  customActions?: ReactNode;
  locked?: boolean;
  lockedLabel?: string;
  lockedDescription?: string;
  onClose?: () => void;
  className?: string;
};

function inspectorActionVariant(kind: InspectorAction["kind"]): ButtonProps["variant"] {
  if (kind === "primary") return "primary";
  if (kind === "secondary") return "ghost";
  if (kind === "ai") return "ghost";
  if (kind === "handoff") return "text";
  return "text";
}

export function ContextInspector({ context, objectType, objectId, title, subtitle, status, sections, actions, customActions, locked = false, lockedLabel = "内容已锁定", lockedDescription = "解锁后才能查看当前上下文。", onClose, className = "" }: ContextInspectorProps) {
  const resolvedContext = context ?? { routeId: "legacy", objectType, objectId };
  const titleId = `context-inspector-title-${objectType}-${objectId ?? "current"}`;
  const contextRows: InspectorRow[] = [
    resolvedContext.source ? { id: "context-source", label: "来源", value: resolvedContext.source } : null,
    resolvedContext.freshness ? { id: "context-freshness", label: "新鲜度", value: resolvedContext.freshness } : null,
    resolvedContext.permissionState ? { id: "context-permission", label: "权限", value: resolvedContext.permissionState } : null,
    resolvedContext.aiState ? { id: "context-ai", label: "AI 状态", value: resolvedContext.aiState } : null,
  ].filter(Boolean) as InspectorRow[];
  const allSections = [
    ...sections,
    resolvedContext.evidenceScope?.length ? { id: "context-evidence", title: "证据范围", rows: [{ id: "context-evidence-scope", label: "范围", value: resolvedContext.evidenceScope.join("、") }] } : null,
    contextRows.length ? { id: "context-contract", title: "上下文合同", rows: contextRows } : null,
  ].filter((section): section is InspectorSection => section !== null);
  return (
    <aside
      aria-labelledby={titleId}
      className={`ui-inspector-panel ui-context-inspector ${className}`}
      data-inspector-ai-state={resolvedContext.aiState}
      data-inspector-evidence-scope={resolvedContext.evidenceScope?.join("|")}
      data-inspector-object-type={resolvedContext.objectType}
      data-inspector-object-id={resolvedContext.objectId}
      data-inspector-permission-state={resolvedContext.permissionState}
      data-inspector-route-id={resolvedContext.routeId}
    >
      <div className="ui-inspector-heading">
        <div>
          <span className="eyebrow">Context</span>
          <h2 id={titleId}>{title}</h2>
          {subtitle ? <p className="ui-inspector-subtitle">{subtitle}</p> : null}
        </div>
        {status}
      </div>
      {locked ? (
        <section className="ui-inspector-locked" aria-live="polite">
          <Badge tone="danger">locked</Badge>
          <strong>{lockedLabel}</strong>
          <p>{lockedDescription}</p>
        </section>
      ) : (
        <div className="ui-inspector-sections">
          {allSections.map((section) => (
            <section className={`ui-inspector-section ui-inspector-section-${section.tone ?? "neutral"}`} key={section.id}>
              <h3>{section.title}</h3>
              {section.rows?.length ? <div className="ui-inspector-rows">{section.rows.map((row) => <div className="ui-inspector-row" key={row.id}><span>{row.label}</span><div><strong>{row.value}</strong>{row.hint ? <small>{row.hint}</small> : null}</div></div>)}</div> : null}
              {section.content}
            </section>
          ))}
        </div>
      )}
      {actions?.length || customActions ? <footer className="ui-inspector-actions">{actions?.map((action) => <Button key={action.id} disabled={action.disabled} onClick={action.onClick} variant={inspectorActionVariant(action.kind)}>{action.label}</Button>)}{customActions}</footer> : null}
      {onClose ? <footer className="ui-inspector-close"><Button onClick={onClose} variant="text">关闭</Button></footer> : null}
    </aside>
  );
}

export function InspectorPanel({ context, title, status, rows, actions }: { context?: InspectorContext; title: string; status?: ReactNode; rows: Array<{ label: string; value: ReactNode }>; actions?: ReactNode }) {
  return <ContextInspector context={context} objectType={context?.objectType ?? "legacy"} objectId={context?.objectId} title={title} status={status} customActions={actions} sections={[{ id: "summary", title: "摘要", rows: rows.map((row, index) => ({ id: `${row.label}-${index}`, label: row.label, value: row.value })) }]} />;
}
