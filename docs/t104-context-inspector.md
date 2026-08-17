# T104 Context Inspector Contract

Status: Implemented as the M1 context contract; full M1 acceptance remains
dependent on the listed validation commands and independent rendered review.

## Scope

T104 closes the T96-T104 UI foundation by making the Context Inspector a
route-aware context contract shared by the AppShell, Asset, Data Sources,
Research, Screeners, and Factor Lab surfaces. It never replaces a full-screen
route or turns route content into a summary card.

The locked visual source is `E:\彭博\Pengbo_UI_Rebuild.svg`, registered with
SHA-256 `1A72F37E204367BC6664AC8443B3A876CB03786C19626B54E925661CEAA53A33`.
The editable design source remains the Penpot page `FINAL - All Pengbo Pages`.

## Context contract

`InspectorContext` carries:

- `routeId`
- `objectType` and optional `objectId`
- optional asset, research brief, and run identifiers
- evidence scope
- source and freshness
- permission state: read-only, unlocked, confirmation-required, blocked, locked
- AI state: available, disabled, insufficient-evidence, cloud-opt-in-required,
  or blocked

`ContextInspector` renders the current object, route context, evidence scope,
data status, permissions, AI state, and next actions through typed sections.
The legacy `InspectorPanel` remains a compatibility wrapper while callers are
migrated.

## Safety boundaries

- No provider secrets, session tokens, Stronghold values, or execution payloads
  enter the component contract.
- Non-Binance providers remain read-only.
- Binance execution remains default-off, risk-gated, kill-switch-gated,
  audited, and explicitly user-confirmed.
- No API, database, hosted account, remote sync, public exposure, or new
  execution path is introduced by T104.
- T105 Chinese State System and T106 full-route screenshot baseline are not
  part of this task.

## Consumers

- `src/components/context-rail.tsx`: shell route/runtime/asset context.
- `src/views/screeners-view.tsx`: selected screener result and evidence scope.
- `src/views/factor-lab-view.tsx`: selected factor row context metadata.
- `src/views/asset-view.tsx`: route-level Asset context anchor.
- `src/views/data-sources-view.tsx`: route-level source context anchor.
- `src/views/research-view.tsx`: inbox/brief route context anchor.

## Validation

The source contract is checked by:

```powershell
npm.cmd run check:context-inspector
npm.cmd run check:data-table
npm.cmd run check:t102-106
```

Rendered validation records viewport, theme, density, language, runtime/data
mode, expected security blocks, console errors, and screenshot paths. The
2026-07-13 smoke reached the locked state, verified the unlock gate and
Context Inspector `locked` state, recorded expected protected-route 403
blocks, and reported zero console errors.

The follow-up unlock fix keeps `/security/local/*` operations independent from
the ordinary session bootstrap. This preserves the 403 boundary for protected
data while allowing the user to unlock or reset the local security factor.
The active loopback web-dev origin is also explicitly registered with the
gateway, and concurrent session bootstrap is deduplicated in the frontend.
