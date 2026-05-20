# Contributing To Pengbo Workbench

Pengbo Workbench is a Windows-first, local-first desktop financial research
terminal. Contributions should keep the project useful as source software while
respecting the current safety boundary: Pengbo is not a hosted service, public
API, signed binary release channel, or remote trading platform.

## Local Setup

Install JavaScript dependencies:

```powershell
npm install
```

Install Python dependencies in your preferred virtual environment:

```powershell
py -m pip install -r backend/requirements.txt
```

Run the web shell and local sidecar in separate terminals:

```powershell
npm run dev
npm run backend:dev
```

The backend dev command uses repo-local runtime folders under
`.pengbo-runtime/`. Those folders are generated local state and must not be
committed.

## Baseline Checks

Before opening a pull request, run the source-level checks that match CI:

```powershell
npm run check:version
npm run check:public-boundary
npm audit --audit-level=moderate
npm run typecheck
npm run build
py -m pytest backend/tests
```

For no-key demo work, also run:

```powershell
npm run smoke:demo-no-key
```

Packaged desktop checks are local Windows release-readiness checks. They start
and stop the release executable, may use AppData-backed runtime directories, and
should be run serially only when the change touches packaged startup, installers,
desktop WebView behavior, or a packaged smoke surface:

```powershell
npm run smoke:packaged-startup
npm run smoke:installed-startup
npm run smoke:installed-startup:nsis
```

Run only the packaged smoke checks relevant to the files changed in a task.
Documentation-only changes normally do not require packaged smoke validation.

## Safe Contribution Areas

Good first contribution areas include:

- README, docs, changelog, roadmap, and public-boundary clarity.
- No-key demo copy and reviewer guidance.
- Source-level UI copy polish that preserves automation anchors and `aria-label`
  behavior.
- Read-only Data Sources wording, status explanations, and documentation.
- Research-flow notes that identify dead ends or missing handoffs for the next
  product-polish tasks.
- Pure service tests that do not require provider credentials, live trading, or
  machine-local runtime state.

## Sensitive Areas

Treat these areas as sensitive and discuss scope before changing them:

- Stronghold, provider credential handling, `.env*`, local secret injection, or
  any code path that can expose EDGAR, Binance, FRED, CoinGecko, translation, or
  future broker credentials.
- Local unlock, local session permissions, gateway hardening, CORS, bind address
  behavior, route classification, and security audit handling.
- Binance execution config, intent creation, risk gates, kill switch, manual
  submit flow, and execution audit records.
- Release signing, installer publishing, update channels, GitHub Releases, and
  bundled binary redistribution.
- Public network exposure, hosted accounts, OAuth, remote sync, team permissions,
  or public API operation.

Do not commit local runtime data, Stronghold vaults, provider credentials,
`.env*` files, diagnostics, generated smoke logs, packaged desktop bundles,
generated sidecar payloads, installers, EXEs, DLLs, PDBs, or `src-tauri/target/`
build products.

## Pull Request Expectations

Keep changes focused on one task or product surface. In the PR description,
include:

- What changed.
- Which validation commands passed.
- Whether the change touches credentials, local security, gateway behavior,
  Binance execution, packaged runtime behavior, or release artifacts.
- Any follow-up work that belongs in `IMPLEMENTATION_TASKS.md`.

Do not paste secrets, local database contents, Stronghold material, real account
identifiers, private provider responses, or unredacted smoke logs into issues or
pull requests.

## First-Issue Candidates

These candidate tasks are intended to be useful without private keys or live
trading:

- Improve screenshot alt text and product-proof wording in `README.md`.
- Tighten no-key demo guidance around sample data versus credential-required
  surfaces.
- Review Data Sources copy for clear read-only, cache, freshness, and provenance
  language.
- Identify Research workflow dead ends that should feed `T64 - Research Flow
  Definition`.
- Add focused tests for pure formatting, status mapping, or documentation helper
  behavior.
- Clean up visible Chinese or English UI copy while preserving stable automation
  anchors and accessibility labels.
