import type { ReactNode } from "react";

type AppToolbarProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
};

export function AppToolbar({ eyebrow, title, children }: AppToolbarProps) {
  return (
    <header className="topbar app-shell-toolbar">
      <div className="app-toolbar-title">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <div className="toolbar">{children}</div>
    </header>
  );
}

