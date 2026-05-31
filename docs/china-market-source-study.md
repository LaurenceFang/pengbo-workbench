# China Market Source Study

Status: implemented cautious-v1 for T85-T91.

This study intentionally chooses a small first connector pack instead of a broad
China-market scrape layer. The implementation favors sources with documented
interfaces, explicit provenance, fixture-backed tests, visible credential state,
and no trading/write path.

## Recommended V1 Pack

| Need | V1 source | Credential model | Why first | Risk stance |
| --- | --- | --- | --- | --- |
| A-share search, quote/status, basic profile | Tushare Pro HTTP API | User token | Stable documented POST API, clear `stock_basic` and `daily` endpoints, good fit for user-owned read-only research | High redistribution risk; token permissions, points, and account terms vary by user |
| HK/China regional macro context | HKMA Open API | None | Official HKMA Open API, no registration required, useful monetary and rate series for regional context | Low technical friction; reuse still subject to HKMA/DATA.GOV.HK terms |
| Public-source candidate review | AKShare | None or upstream-dependent | Useful Python ecosystem for later prototyping | Candidate-only for now because upstream provenance and redistribution terms vary by wrapped source |

Sources checked:

- Tushare HTTP API: https://tushare.pro/document/2?doc_id=130
- HKMA API overview: https://apidocs.hkma.gov.hk/abouthkmasapi/
- HKMA market data and statistics docs: https://apidocs.hkma.gov.hk/documentation/market-data-and-statistics/
- DATA.GOV.HK FAQ and terms context: https://data.gov.hk/en/faq
- AKShare project: https://github.com/akfamily/akshare

## Connector Boundaries

- All China-market connectors are read-only.
- No connector exposes live trading, order routing, broker login, or account
  write operations.
- Tushare requires a user-provided token through local environment or the
  desktop Stronghold secret bridge. Tokens are not committed, exported, logged,
  or returned by API responses.
- A valid Tushare token can still be blocked by account points or endpoint
  permissions. Upstream code `40203` from `stock_basic` or `daily` is treated
  as configured-but-`permission_blocked` provenance, not as a missing credential.
- HKMA is no-key and can be used without local unlock.
- Fixture scenarios are available only in test mode or packaged smoke mode:
  configured-key, timeout, malformed response, stale/cache fallback, and
  license-blocked.
- License-blocked fixtures return blocked provenance and do not make live
  network calls.
- Data-source report export includes connector manifest and safety sections so
  downstream Research output preserves source/license boundaries.

## Deferred Sources

- Exchange-direct A-share/HK data: potentially authoritative, but license,
  redistribution, and access models require a separate review.
- Paid institutional feeds such as Wind, Choice, Refinitiv, Bloomberg, or
  exchange commercial feeds: not suitable for the first no-secret desktop
  connector pack.
- News and policy sources: deferred until terms and reliable RSS/API contracts
  can be reviewed source by source.
- AKShare wrappers: deferred from production connector status until each
  upstream source can be mapped to provenance, terms, and cache behavior.

## Implemented Artifacts

- Connector manifest endpoint: `GET /api/v1/data-sources/manifests`
- Tushare A-share endpoints:
  - `GET /api/v1/data-sources/equities/search`
  - `GET /api/v1/data-sources/equities/quote`
  - `GET /api/v1/data-sources/equities/profile`
- HKMA macro endpoint via existing macro route:
  - `GET /api/v1/data-sources/macro/series?provider=hkma`
- China-market Research template:
  - `china_market`
- Packaged release smoke:
  - `npm run smoke:china-connectors:packaged`
  - evidence file: `logs/china-connectors-packaged-smoke-latest.json`
