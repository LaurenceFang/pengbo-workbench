import type { ReactNode } from "react";

type AppToolbarProps = {
  brandEyebrow: string;
  brandName: string;
  eyebrow: string;
  title: string;
  frameLabel?: string;
  children: ReactNode;
};

export function AppToolbar({ brandEyebrow, brandName, eyebrow, title, frameLabel, children }: AppToolbarProps) {
  return (
    <header className="topbar app-shell-toolbar">
      <div className="app-toolbar-brand" aria-label={`${brandEyebrow} ${brandName}`}>
        <strong className="app-toolbar-wordmark">pengbo</strong>
      </div>
      <div className="app-toolbar-title">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <div className="toolbar">{children}</div>
      {frameLabel ? <span className="app-toolbar-frame">{frameLabel}</span> : null}
    </header>
  );
}
