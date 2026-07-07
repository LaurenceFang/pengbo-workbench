import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Cable,
  ChartCandlestick,
  ChevronDown,
  Command,
  DatabaseZap,
  FolderCog,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  Search,
  Sparkles,
  Star,
  Workflow,
} from "lucide-react";
import { navigationGroups, type NavGroupKey } from "../navigation";
import type { ViewKey } from "../store/app-store";

const groupIcons: Record<NavGroupKey, typeof LayoutDashboard> = {
  home: LayoutDashboard,
  research: Search,
  markets: ChartCandlestick,
  portfolio: BriefcaseBusiness,
  factorLab: FlaskConical,
  automation: Workflow,
  settings: FolderCog,
};

const viewIcons: Record<ViewKey, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  commandCenter: Command,
  asset: ChartCandlestick,
  watchlist: Star,
  research: Search,
  factorLab: FlaskConical,
  strategyLab: LineChart,
  workflowStudio: Workflow,
  dataSources: DatabaseZap,
  screeners: BarChart3,
  manual: BookOpen,
  portfolio: BriefcaseBusiness,
  connections: Cable,
  settings: FolderCog,
};

type AppSidebarProps = {
  brandEyebrow: string;
  brandName: string;
  navigationLabel: string;
  activeView: ViewKey;
  activeGroup: NavGroupKey;
  expandedGroups: ReadonlySet<NavGroupKey>;
  groupLabel: (key: NavGroupKey) => string;
  viewLabel: (key: ViewKey) => string;
  onGroupClick: (key: NavGroupKey) => void;
  onViewClick: (key: ViewKey) => void;
};

export function AppSidebar(props: AppSidebarProps) {
  return (
    <aside className="sidebar app-shell-sidebar">
      <div className="brand-panel">
        <div className="brand-mark"><Sparkles size={18} /></div>
        <div><p className="eyebrow">{props.brandEyebrow}</p><h1>{props.brandName}</h1></div>
      </div>
      <div className="sidebar-section">
        <span className="section-caption">{props.navigationLabel}</span>
        <nav className="nav-stack" aria-label={props.navigationLabel}>
          {navigationGroups.map((group) => {
            const GroupIcon = groupIcons[group.key];
            const active = props.activeGroup === group.key;
            const hasChildren = group.items.length > 1;
            const expanded = hasChildren && props.expandedGroups.has(group.key);
            const childListId = `nav-group-${group.key}-items`;
            return (
              <div className={`nav-group ${active ? "active" : ""}`} key={group.key}>
                <button
                  aria-controls={hasChildren ? childListId : undefined}
                  aria-expanded={hasChildren ? expanded : undefined}
                  aria-label={hasChildren ? `nav-group-${group.key}` : `nav-${group.defaultView}`}
                  className={`nav-group-trigger ${active ? "active" : ""}`}
                  onClick={() => props.onGroupClick(group.key)}
                  type="button"
                >
                  <span className="nav-icon"><GroupIcon size={18} /></span>
                  <span className="nav-group-label">{props.groupLabel(group.key)}</span>
                  {hasChildren ? <ChevronDown className={`nav-chevron ${expanded ? "expanded" : ""}`} size={15} /> : null}
                </button>
                {hasChildren && expanded ? (
                  <div className="nav-group-children" id={childListId}>
                    {group.items.map((item) => {
                      const ItemIcon = viewIcons[item.viewKey];
                      return (
                        <button
                          aria-label={`nav-${item.viewKey}`}
                          className={`nav-child-item ${props.activeView === item.viewKey ? "active" : ""}`}
                          key={item.viewKey}
                          onClick={() => props.onViewClick(item.viewKey)}
                          type="button"
                        >
                          <ItemIcon size={14} /><span>{props.viewLabel(item.viewKey)}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

