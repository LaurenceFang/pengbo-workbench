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
- Tushare points and frequency table: https://tushare.pro/document/1?doc_id=108
- HKMA API overview: https://apidocs.hkma.gov.hk/abouthkmasapi/
- HKMA market data and statistics docs: https://apidocs.hkma.gov.hk/documentation/market-data-and-statistics/
- DATA.GOV.HK FAQ and terms context: https://data.gov.hk/en/faq
- AKShare project: https://github.com/akfamily/akshare
- AKShare A-share history docs: https://github.com/akfamily/akshare/blob/main/docs/data/stock/stock.md
- BaoStock package: https://pypi.org/project/baostock/
- CNINFO data service: https://webapi.cninfo.com.cn/
- GDELT DOC 2.0 API: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
- SEC EDGAR data APIs: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- Binance Spot market-data endpoints: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints
- CoinGecko API key setup: https://docs.coingecko.com/reference/setting-up-your-api-key
- World Bank API basic call structures: https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures

## Connector Boundaries

- All China-market connectors are read-only.
- No connector exposes live trading, order routing, broker login, or account
  write operations.
- Tushare requires a user-provided token through local environment or the
  desktop Stronghold secret bridge. Tokens are not committed, exported, logged,
  or returned by API responses.
- A valid Tushare token can still be blocked by account points, endpoint
  permissions, or frequency limits. Upstream code `40203` from a Tushare
  endpoint is treated as configured-but-`permission_blocked` provenance, not as
  a missing credential.
- HKMA is no-key and can be used without local unlock.
- Fixture scenarios are available only in test mode or packaged smoke mode:
  configured-key, timeout, malformed response, stale/cache fallback, and
  license-blocked.
- License-blocked fixtures return blocked provenance and do not make live
  network calls.
- Data-source report export includes connector manifest and safety sections so
  downstream Research output preserves source/license boundaries.

## Tushare Expansion Queue

The current connector intentionally ships only `stock_basic` and `daily`.
After the user's token was configured, live validation on 2026-05-31 showed
`daily` can return a read-only quote for `600519.SH`; `stock_basic` and the
expanded endpoints can still return upstream `40203` frequency or permission
blocks even with a valid token. Future Tushare additions therefore need paced
refresh, cache-first reads, endpoint-level permission evidence, and the same
`permission_blocked` provenance boundary before they become product features.

| Priority | `api_name` | Research use | Product stance |
| --- | --- | --- | --- |
| Current V1 | `stock_basic` | Search, name, area, industry, market, listing date | Implemented, but treated as frequency-sensitive and cacheable |
| Current V1 | `daily` | End-of-day quote/status, change, volume, amount | Implemented and live-validated for quote/status |
| High | `daily_basic` | PE/PB, turnover, market value, dividend-style screening inputs | Next valuation/screener candidate after paced validation |
| High | `fina_indicator` | ROE, margin, leverage, liquidity, cash-flow ratio indicators | Next fundamentals candidate after paced validation |
| Medium | `income` | Income statement context | Candidate for Research financial statement panels |
| Medium | `balancesheet` | Balance sheet context | Candidate for Research financial statement panels |
| Medium | `cashflow` | Cash-flow statement context | Candidate for Research financial statement panels |
| Medium | `adj_factor` | Adjusted history support | Candidate for chart/backtest quality, not needed for V1 quote |
| Medium | `trade_cal` | Trading calendar and stale-market checks | Candidate for freshness and holiday handling |
| Low/future | `moneyflow` | Retail/institutional flow context | Defer until methodology and interpretation labels are designed |

Local evidence target: `logs/tushare-expanded-api-validation-latest.json`.
The evidence file records only redacted credential metadata, response codes,
row counts, field names, first-row previews, and read-only/no-live-trading
flags; it does not store the token or request body.

## Additional Source Candidates

| Source | Best fit | Credential model | Cautious stance |
| --- | --- | --- | --- |
| BaoStock | Free A-share daily history and valuation-like fields for fallback research | No user token, Python login/session | Useful fallback candidate, but data server terms, freshness, and redistribution need review before production |
| AKShare | Rapid prototyping across A-share, HK, macro, funds, and web data | Upstream-dependent | Keep candidate-only unless every wrapped upstream source is mapped to provenance, license, and cache rules |
| CNINFO data service | Announcements, filings, company disclosures, and official disclosure context | Service/API terms likely required | Strong Research candidate, but use only through documented APIs or reviewed export terms |
| Exchange-direct feeds | SSE/SZSE/HKEX listing, calendar, announcement, and market references | Source-dependent | Authoritative but license and anti-scrape boundaries must be reviewed per endpoint |
| HKMA/DATA.GOV.HK | HK monetary, banking, FX, and financial-market context | No key for HKMA Open API | Good region macro expansion path with official provenance |
| World Bank, FRED, DB.NOMICS | China/global macro indicators | Existing connector models; FRED key optional | Already fits read-only macro research; extend indicator presets instead of adding new secrets |
| GDELT DOC/API data | Global policy, event, and media-pressure context | No key | Candidate for event context, with clear "news-derived signal" labels and citation hygiene |
| SEC EDGAR | US/HK ADR and cross-listed company filings | No API key, but user-agent identity required | Already credential-prepared for US filings; useful cross-listing complement, not A-share primary data |
| CoinGecko/Binance market data | Crypto and global risk/liquidity context | CoinGecko demo key; Binance keys optional | Keep read-only market-data paths separated from Binance trading/account permissions |

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
