# Pengbo Security Architecture

Updated: 2026-05-19

## Scope

Pengbo Workbench is currently a local-first desktop terminal. The expected runtime is:

- Tauri desktop shell.
- Local FastAPI sidecar bound to `127.0.0.1`.
- Local SQLite and DuckDB stores under the user runtime directory.
- Local secret handling through the desktop credential bridge and process environment injection.

This document treats public network exposure, multi-account access, and hosted operation as future work. T53 through T56 established local unlock, local credential scoping, local session permissions, and sidecar gateway hardening, but those layers do not turn Pengbo into a hosted service or public API.

## Security Goals

- Keep provider secrets out of SQLite, DuckDB, logs, screenshots, diagnostics, and API responses.
- Keep all live trading paths explicit, Binance-only, default-off, risk-gated, kill-switch gated, and user-confirmed.
- Make security-relevant state changes auditable from one global trail.
- Preserve local development speed while making future account and public exposure boundaries visible early.

## Data Classification

### Public Or Cache Data

Examples: market quotes, historical bars, provider catalog metadata, screener outputs, factor snapshots, workflow artifacts, and generated reports.

Allowed storage:

- SQLite or DuckDB.
- Exported local reports when the user requests them.

Constraints:

- Mark stale, cached, unavailable, and simulated state explicitly.
- Do not mix provider secrets into cached payloads or exported reports.

### Sensitive User Data

Examples: EDGAR identity, Binance API key and secret, FRED key, CoinGecko key, future broker credentials, and account-specific credential metadata.

Allowed storage:

- Desktop secret bridge / Stronghold-backed storage where available.
- Environment variables injected into the sidecar at startup as a compatibility fallback.

Constraints:

- Do not persist raw secrets in SQLite or DuckDB.
- Do not return secrets through `/api/v1/...`.
- Do not include secrets in logs, diagnostics, audit payloads, smoke artifacts, screenshots, or exports.
- Credential status payloads may expose configured/missing/stale states and non-secret summaries only.

### Trading Actions

Examples: Binance execution config updates, intent creation, risk blocks, manual submit, broker response summaries, fills, and kill switch changes.

Allowed storage:

- Structured execution records in SQLite.
- Binance-specific execution audit trail.
- Global security audit trail.

Constraints:

- Live mode remains default-off.
- Binance is the only live execution provider in the current architecture.
- Every submit path must pass explicit risk checks and a user-owned confirmation boundary.
- Blocked intents must record that no Binance order request was made.
- Broker responses must be filtered to non-secret fields before storage.

## Current Protection Layers

### Local Sidecar Boundary

The sidecar is intended to bind to `127.0.0.1` and serve only the desktop shell. It is not a public API gateway. CORS and public network posture must be revisited before any hosted or LAN-exposed mode.

### Credential Bridge

The desktop layer stores provider secrets outside the normal application databases and injects only the required environment variables into the sidecar process. The backend models and connection APIs expose status and credential summaries, not secret values.

### Execution Gates

The execution service uses:

- Default-off live mode.
- Risk acknowledgement.
- Symbol allowlist.
- Maximum order notional.
- Maximum daily turnover.
- Maximum position weight.
- Stale quote checks.
- Paper-session requirement.
- Global and scoped kill switch.
- Binance provider readiness checks before order placement.

### Diagnostics Boundary

Diagnostics and smoke artifacts should prove behavior without copying secrets. Evidence should use status, configured/missing flags, redacted payloads, and explicit no-secret markers.

## Global Security Audit

Pengbo now has a global security audit layer for security-relevant events across modules.

Storage:

- SQLite table: `security_audit_events`.

API:

- `GET /api/v1/security/audit`
- Optional category filter: `GET /api/v1/security/audit?category=execution`

Event fields:

- `event_id`
- `created_at`
- `category`
- `event_type`
- `actor`
- `surface`
- `subject`
- `summary`
- `payload`

Current categories:

- `credential`: connection tests and cleared credential profiles.
- `execution`: Binance config, intent, block, submit, and kill switch events.
- `local_security`: local unlock, lockout, idle relock, and sensitive-surface checks.
- `session`: local desktop session creation, expiry, revocation, and permission failures.
- `gateway`: sidecar gateway rejections and failed sensitive-route attempts.

Redaction:

- Audit payloads redact keys containing terms such as `api_key`, `secret`, `password`, `token`, `private_key`, and `identity`.

This does not replace domain-specific audit tables. For example, Binance execution still keeps its specialized execution audit trail, while the global table provides one place to inspect security posture across modules.

## Fincept Terminal Lessons Applied

The local Fincept Terminal checkout is useful as an architecture reference:

- Separate credential metadata from credential material.
- Use a security service layer instead of scattering secret handling across UI code.
- Add a durable security event log early.
- Add local unlock and inactivity lock as a first-class feature when user accounts or sensitive workspaces grow.
- Treat machine-derived encryption as defense against casual file inspection, not as protection from same-user malware.

Pengbo should borrow these boundaries and product patterns without migrating stacks or copying Qt/C++ implementation details.

## Implemented Local Security Layers

The following local-only layers are now implemented and validated through the task board evidence:

- T53 local unlock PIN and idle lock for sensitive desktop surfaces.
- T54 account-scoped provider credential metadata while keeping raw secret material outside SQLite.
- T55 local desktop auth sessions and route-level permission checks.
- T56 sidecar gateway hardening with loopback-only binding, trusted local origins, method checks, rate-limit hooks, and redacted gateway audit events.

These layers are local accountability controls. They are not OAuth, hosted identity, remote sync, team permissions, or internet-facing access control.

## Still Deferred Before Public Or Hosted Mode

Before any hosted, LAN-exposed, remote-account, team, or public API mode is attempted, Pengbo still needs a separate public-mode design covering authentication, CSRF, deployment topology, monitoring, secret rotation, abuse controls, data governance, release signing, and dependency/license review.

Until that future work is explicitly implemented and validated, Pengbo should remain a local-first desktop application and should not be exposed as an internet-facing service.
