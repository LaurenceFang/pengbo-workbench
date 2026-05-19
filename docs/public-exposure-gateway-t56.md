# T56 Public Exposure Gateway And Sidecar Hardening

Status: implemented on 2026-05-19.

Pengbo remains a local-first Tauri desktop app. T56 does not introduce a public
service, hosted identity, remote sync, OAuth, multi-user semantics, or new live
trading path. The sidecar is hardened so a future public deployment review has a
clear gateway boundary instead of inheriting desktop-local assumptions.

## Runtime Boundary

- The sidecar refuses non-loopback bind addresses by default. `127.0.0.1`,
  `localhost`, and `::1` are the only accepted hosts.
- The Tauri launcher still starts the sidecar with `--host 127.0.0.1`.
- Credentialed CORS is limited to the desktop and local development origins:
  `tauri://localhost`, `http://tauri.localhost`, `https://tauri.localhost`,
  `http://127.0.0.1:4173`, and `http://localhost:4173`.
- Requests with any other `Origin` are rejected before route handling.
- Unsupported HTTP methods are rejected at the gateway before route handling.

## Request Logging

Gateway rejections and failed sensitive-route attempts are recorded in the
security audit stream under category `gateway`. The event payload keeps method,
path, origin, rejection reason, and whether a session header was present. It
does not keep raw session IDs, authorization values, cookies, tokens, secrets,
PINs, passwords, or account labels from rejected request bodies.

## CSRF Posture

The current app does not use hosted browser cookies or public account sessions.
The desktop sidecar requires explicit local session headers for sensitive
actions and rejects credentialed CORS from untrusted origins. This is the
accepted T56 posture for the local desktop runtime; any hosted browser mode must
be designed in a later task with its own CSRF model.

## Rate-Limit Hook

The gateway includes an in-process rate-limit hook. Sensitive API prefixes use a
lower request budget than ordinary local API calls. This is intentionally a
desktop hardening guard, not a hosted abuse-control system.

## Exposure Classes

The canonical sensitive-route map is exposed at
`/api/v1/security/route-classification`.

`desktop_local`:

- Local report export routes that write files into the user's runtime
  diagnostics directory.
- Current local-only health, settings, research, data-source, workflow,
  portfolio, screener, factor, and strategy analysis surfaces unless explicitly
  reclassified later.

`account_sensitive`:

- Security audit reads.
- Account-scoped provider profile changes.
- Binance private account reads.
- Binance execution configuration, intent creation, and kill-switch changes.

`never_public`:

- Binance submit routes. They remain local, explicit, audited, kill-switch
  gated, risk-gated, and user-confirmed.
- Any route that would expose raw secrets, unlock material, Stronghold state, or
  unredacted audit payloads.

`future_public_candidate`:

- No route is promoted to this class by T56. A later public-mode task must
  explicitly reclassify candidates after authentication, CSRF, deployment,
  monitoring, and data-governance work exists.

## T53/T54/T55 Reconciliation

- T53 local unlock remains required for sensitive local surfaces such as
  credential and execution settings.
- T54 account-scoped credential metadata remains local; raw credential material
  stays outside SQLite in the existing secret bridge pattern.
- T55 local auth sessions remain the permission boundary for account-sensitive
  routes.
- T56 adds the gateway boundary around those layers without weakening them.

## T57 Open Source Boundary

T57 adds an explicit Apache-2.0 source license and public repository boundary.
That boundary does not reclassify any route as public. Generated runtime data,
credentials, Stronghold state, smoke logs, diagnostics, packaged bundles, and
sidecar binaries remain outside the public source set.
