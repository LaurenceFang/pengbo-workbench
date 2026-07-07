import type { ReactNode } from "react";

type AppShellProps = {
  density: "standard" | "compact";
  contextRailCollapsed: boolean;
  sidebar: ReactNode;
  toolbar: ReactNode;
  contextRail: ReactNode;
  children: ReactNode;
};

export function AppShell({ density, contextRailCollapsed, sidebar, toolbar, contextRail, children }: AppShellProps) {
  return (
    <div className={`app-shell density-${density} ${contextRailCollapsed ? "context-collapsed" : ""}`}>
      <div className="backdrop-orb orb-left" />
      <div className="backdrop-orb orb-right" />
      {sidebar}
      <main className="workspace app-shell-main">
        {toolbar}
        <div className="workspace-scroll app-shell-workspace">{children}</div>
      </main>
      {contextRail}
    </div>
  );
}
