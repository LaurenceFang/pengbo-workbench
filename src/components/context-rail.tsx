import { ChevronRight, Lock, PanelRightClose, PanelRightOpen } from "lucide-react";

type ContextRailProps = {
  title: string;
  groupLabel: string;
  viewLabel: string;
  selectedAsset?: string;
  backendStatus: "online" | "offline" | "connecting";
  locked: boolean;
  collapsed: boolean;
  labels: {
    collapse: string;
    expand: string;
    workspace: string;
    activeAsset: string;
    runtime: string;
    locked: string;
    noAsset: string;
  };
  onToggle: () => void;
};

export function ContextRail(props: ContextRailProps) {
  return (
    <aside className={`context-rail app-shell-context ${props.collapsed ? "collapsed" : ""}`}>
      <button
        aria-expanded={!props.collapsed}
        aria-label={props.collapsed ? props.labels.expand : props.labels.collapse}
        className="context-rail-toggle"
        onClick={props.onToggle}
        type="button"
      >
        {props.collapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
      </button>
      {!props.collapsed ? (
        <div className="context-rail-content">
          <div className="context-rail-head"><span className="eyebrow">{props.title}</span><ChevronRight size={15} /></div>
          <section><span>{props.labels.workspace}</span><strong>{props.groupLabel}</strong><small>{props.viewLabel}</small></section>
          <section><span>{props.labels.runtime}</span><strong className={`status-${props.backendStatus}`}>{props.backendStatus}</strong></section>
          <section>
            <span>{props.labels.activeAsset}</span>
            {props.locked ? <strong className="context-locked"><Lock size={14} />{props.labels.locked}</strong> : <strong>{props.selectedAsset ?? props.labels.noAsset}</strong>}
          </section>
        </div>
      ) : null}
    </aside>
  );
}
