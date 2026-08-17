import { ChevronRight, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Badge, ContextInspector, IconButton, type InspectorAIState, type InspectorPermissionState } from "./ui-kit";

type ContextRailProps = {
  title: string;
  groupLabel: string;
  viewLabel: string;
  selectedAsset?: string;
  backendStatus: "online" | "offline" | "connecting";
  locked: boolean;
  collapsed: boolean;
  drawerOpen?: boolean;
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
  routeId?: string;
  objectType?: string;
  objectId?: string;
  source?: string;
  freshness?: string;
  evidenceScope?: string[];
  permissionState?: InspectorPermissionState;
  aiState?: InspectorAIState;
};

export function ContextRail(props: ContextRailProps) {
  return (
    <aside className={`context-rail app-shell-context ${props.collapsed ? "collapsed" : ""} ${props.drawerOpen ? "drawer-open" : ""}`} id="pengbo-context-inspector">
      <IconButton
        aria-expanded={!props.collapsed}
        label={props.collapsed ? props.labels.expand : props.labels.collapse}
        className="context-rail-toggle"
        onClick={props.onToggle}
      >
        {props.collapsed ? <PanelRightOpen size={17} /> : <PanelRightClose size={17} />}
      </IconButton>
      {!props.collapsed ? (
        <div className="context-rail-content">
          <div className="context-rail-head"><span className="eyebrow">{props.title}</span><ChevronRight size={15} /></div>
          <ContextInspector
            context={{
              routeId: props.routeId ?? `shell/${props.viewLabel}`,
              objectType: props.objectType ?? "app-shell-context",
              objectId: props.objectId ?? props.selectedAsset,
              assetId: props.selectedAsset,
              source: props.source ?? "local shell state",
              freshness: props.freshness,
              evidenceScope: props.evidenceScope,
              permissionState: props.permissionState ?? (props.locked ? "locked" : "read_only"),
              aiState: props.aiState ?? "available",
            }}
            objectType={props.objectType ?? "app-shell-context"}
            objectId={props.objectId ?? props.selectedAsset}
            title={props.selectedAsset ?? props.labels.noAsset}
            status={<Badge tone={props.backendStatus === "online" ? "success" : props.backendStatus === "offline" ? "danger" : "info"}>{props.backendStatus}</Badge>}
            locked={props.locked}
            lockedLabel={props.labels.locked}
            lockedDescription={props.labels.locked}
            sections={[
              {
                id: "workspace",
                title: props.labels.workspace,
                rows: [{ id: "workspace-view", label: props.labels.workspace, value: <><strong>{props.groupLabel}</strong><small>{props.viewLabel}</small></> }],
              },
              {
                id: "runtime",
                title: props.labels.runtime,
                rows: [{ id: "runtime-status", label: props.labels.runtime, value: props.backendStatus }],
              },
              {
                id: "asset",
                title: props.labels.activeAsset,
                rows: [{ id: "active-asset", label: props.labels.activeAsset, value: props.selectedAsset ?? props.labels.noAsset }],
              },
            ]}
          />
        </div>
      ) : null}
    </aside>
  );
}
