# T100 AppShell Redesign

Status: Implemented and validated

## Outcome

The desktop frame now has four explicit regions:

1. `AppSidebar` owns the T99 navigation contract and brand orientation.
2. `AppToolbar` owns the active-workspace title and global action slot.
3. `AppShell` owns the central workspace and its single scroll boundary.
4. `ContextRail` provides a collapsible, source-safe global context summary.

`App.tsx` remains the orchestration layer for runtime data, security state,
page selection, and business-view rendering. The shell components only own
layout and presentation boundaries.

## T99 Reuse

`AppSidebar` imports `navigationGroups` from `src/navigation.ts`. It does not
duplicate group order, default views, or internal `ViewKey` membership. All 14
stable navigation anchors remain reachable.

## Context Safety

The Context Rail currently exposes only:

- active navigation group and workspace label;
- local runtime status;
- selected asset when the active surface is not locked.

When a sensitive workspace is locked, the selected asset is replaced by an
explicit locked-context message. Full evidence, AI context, exports, and
parameters remain out of scope until T104.

## Responsive Contract

- At 1280px and wider, Sidebar, Workspace, and a 280px Context Rail are visible.
- A collapsed Context Rail uses a 44px column.
- At 1180px and below, the Context Rail is hidden and the existing two-region
  responsive layout remains available.
- At 960px and below, the shell falls back to one column.

## Verification

```powershell
npm run check:navigation-ia
npm run check:app-shell
npm run check:i18n
npm run typecheck
npm run build
npm run smoke:navigation-ia
npm run smoke:app-shell
```

The AppShell smoke verifies four visible regions, a workspace wider than
600px, a Context Rail at least 240px wide, collapse/expand accessibility,
Command Palette entry, 1600x1000 standard density, and 1280x820 compact density.
Evidence is stored in the ignored `logs/app-shell-screenshots/` directory.

## T101 Handoff

T101 should bind persisted `light | dark` preference state to the AppShell root
without changing the four-region structure. The T98 token maps already exist;
T101 must add preference compatibility, Settings controls, restart restoration,
and cleanup of any remaining theme-specific hardcoded styles.

