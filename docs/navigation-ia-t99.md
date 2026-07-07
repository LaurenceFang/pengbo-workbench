# T99 Navigation IA Collapse

Status: Implemented and validated

## Outcome

The sidebar now exposes seven task-oriented domains while preserving all 14
existing internal workspaces and their stable `ViewKey` values:

| Group | Internal workspaces |
| --- | --- |
| Home | Dashboard, Command Center |
| Research | Research |
| Markets | Asset, Watchlist, Data Sources |
| Portfolio | Portfolio |
| Factor Lab | Factor Lab, Strategy Lab |
| Automation | Workflow Studio, Screeners |
| Settings | Settings, Connections, Manual |

`src/navigation.ts` is the source of truth for group order, default views, and
the one-to-one `ViewKey` mapping. T100 should reuse this contract rather than
reconstructing navigation inside the new shell.

## Interaction Contract

- Single-workspace groups navigate directly.
- Multi-workspace groups use a native button disclosure with `aria-expanded`
  and `aria-controls`.
- Only one multi-workspace group remains expanded at a time.
- Entering a different group opens its default workspace.
- Active group and active child remain visually distinct.
- Existing `nav-<ViewKey>` automation anchors remain reachable.
- Standard and compact density use the T98 token surface.

## Preserved Boundaries

- No `ViewKey` was added, removed, or renamed.
- Command Palette and cross-workspace `setActiveView` destinations are intact.
- Sensitive workspace membership and unlock behavior are unchanged.
- Backend routes, provider behavior, runtime state, and execution boundaries
  are unchanged.
- No hosted account, public API, remote sync, or live-trading scope was added.

## Verification

```powershell
npm audit --audit-level=moderate
npm run check:version
npm run check:public-boundary
npm run check:design-tokens
npm run check:navigation-ia
npm run check:i18n
npm run typecheck
npm run build
npm run smoke:navigation-ia
```

The navigation smoke covers seven visible groups, all 14 reachable automation
anchors, native keyboard focus, one-group disclosure behavior, compact density,
and a source-safe screenshot. Evidence is written to the ignored
`logs/navigation-ia-screenshots/` directory.

## T100 Handoff

T100 may extract stable Sidebar, Toolbar, Workspace, and Context Rail regions,
but it must consume `navigationGroups` from `src/navigation.ts`, preserve
existing view rendering and security gates, and leave full Inspector behavior
to T104.

