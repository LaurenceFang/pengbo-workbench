# T98 Design Tokens v1

Status: Implemented

## Direction

Pengbo uses a calm, dense, evidence-oriented desktop-terminal language. The
primary canvas is light and neutral, the sidebar remains dark for stable
orientation, and color is reserved for actions, provenance, freshness, risk,
and financial movement. The system avoids decorative gradients, oversized
marketing surfaces, and single-hue status language.

T98 is a visual-foundation task. It does not change navigation, shell regions,
routes, provider behavior, API contracts, security boundaries, or execution
behavior. Persisted theme selection remains owned by T101.

## Token Layers

`src/styles.css` exposes four layers:

1. Primitive scales: local font stacks, type sizes, 4px spacing rhythm,
   radii, motion, and easing.
2. Semantic surfaces: canvas, sidebar, panel, elevated, control, muted, and
   selected surfaces plus text and border hierarchy.
3. Operational semantics: foreground, background, and border triplets for
   observed, online, connecting, offline, cached, degraded,
   credential-required, blocked, audited, gain, loss, and neutral states.
4. Density semantics: standard and compact values for shell gaps, rows,
   toolbars, cards, and future inspector panels.

Components should use semantic variables. Primitive values should not be
referenced directly outside the token declaration layer.

## Theme Contract

- `:root` is the light-first token mapping.
- `html[data-theme="dark"]` contains the complete dark mapping.
- T98 validates both mappings without adding a user preference or changing the
  settings API.
- T101 may attach persisted theme state to the existing mapping without
  renaming component tokens.

## Typography

- UI: `Aptos`, `Microsoft YaHei UI`, `Noto Sans SC`, then `sans-serif`.
- Financial data: `Cascadia Mono`, `IBM Plex Mono`, `Consolas`, then
  `monospace`.
- No runtime web-font request is required, preserving offline startup.
- Data columns, timestamps, identifiers, and numeric comparisons should use
  `--font-data`; prose and controls should use `--font-ui`.

## Density Contract

| Surface | Standard | Compact |
| --- | ---: | ---: |
| Shell gap | 16px | 12px |
| Data row | 46px | 36px |
| Toolbar/control | 42px | 34px |
| Card padding | 16px | 12px |
| Inspector padding | 16px | 12px |

Compact mode reduces whitespace but does not remove labels, status copy, focus
rings, or safety boundaries.

## State Contract

Every supported state defines `--status-<state>-fg`,
`--status-<state>-bg`, and `--status-<state>-border`. Text or icons must remain
present because color alone is not sufficient to communicate state.

- Blue: observed and connecting evidence.
- Green: online, gain, and ready states.
- Amber: cached, degraded, and credential-required states.
- Red: blocked, error, loss, and risk states.
- Olive: audited evidence.
- Slate: neutral, unsupported, planned, and offline states.

## Component Usage

- Shared cards and panels use `--surface-panel` or `--surface-elevated`.
- Inputs use `--surface-control` and semantic border tokens.
- Selected and hover rows use `--surface-selected`.
- Focus uses `--focus-ring`; focus outlines must not be removed.
- Financial up/down values use gain/loss tokens rather than generic accent
  colors.
- Motion uses `--motion-fast`, `--motion-standard`, and
  `--ease-standard`; reduced-motion users receive near-instant transitions.

## Verification

Run:

```powershell
npm run check:design-tokens
npm run typecheck
npm run web:build
npm run smoke:design-tokens
```

The static contract check confirms required token coverage, light/dark theme
maps, density maps, offline font behavior, and reduced-motion support. The
visual smoke captures the real application in light/standard, light/compact,
and dark/standard combinations.

## Safety Boundary

T98 introduces no secrets, runtime databases, generated diagnostics, packaged
binaries, hosted accounts, public API, remote sync, or new live-trading path.

