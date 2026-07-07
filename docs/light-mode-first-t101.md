# T101 - Light Mode First

Completed: 2026-07-07

## Outcome

Pengbo now starts in light mode for both new and legacy preference records, while dark mode remains an explicit, persisted user preference. The setting is applied at the T100 `AppShell` root through `data-theme`, so changing theme does not remount or replace the active workspace.

## Contract

- Backend preferences accept only `light | dark`; absent theme data resolves to `light`.
- The frontend store initializes to `light`, hydrates from `/settings/preferences`, and previews a Settings selection immediately.
- Saving preferences persists the selected theme through the existing settings service.
- Restarting the backend and reloading the shell restores the saved theme.
- T98 semantic tokens remain the only theme palette source; T99 navigation and all T100 shell regions consume the same root theme.
- Theme changes do not alter active view, selected asset, disclosure state, local security state, or business data.

## Verification

- `npm audit --audit-level=moderate`
- `npm run check:version`
- `npm run check:public-boundary`
- `npm run check:design-tokens`
- `npm run check:navigation-ia`
- `npm run check:app-shell`
- `npm run check:theme-preference`
- `npm run check:i18n`
- `npm run typecheck`
- `npm run web:build`
- `npm run smoke:localization`
- `npm run smoke:design-tokens`
- `npm run smoke:navigation-ia`
- `npm run smoke:app-shell`
- `npm run smoke:theme-preference`
- `python -m pytest backend/tests`

The dedicated theme smoke covers default light, immediate dark preview, persisted dark restoration after backend restart, and cleanup back to light. Generated screenshots and runtime state remain ignored under `logs/` and `.pengbo-runtime/`.

## Boundary

T101 adds no hosted account, remote sync, public API, new live-trading path, secret, runtime database, diagnostic bundle, installer, or packaged binary to source control.
