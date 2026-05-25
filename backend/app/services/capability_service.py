from __future__ import annotations

from dataclasses import dataclass

from ..data_seed import AssetCatalogEntry
from ..models import (
    ConnectionsCatalogResponse,
    ConnectorManifest,
    ConnectorManifestResponse,
    ProviderCapability,
    ProviderCapabilityProviderItem,
)
from ..providers.binance import BinanceProvider
from ..providers.filings import FilingsProvider


CAPABILITY_ORDER: tuple[str, ...] = (
    "quotes",
    "history",
    "fundamentals",
    "filings",
    "account",
    "screeners",
    "research",
)

CAPABILITY_LABELS: dict[str, str] = {
    "quotes": "Quotes",
    "history": "History",
    "fundamentals": "Fundamentals",
    "filings": "Filings",
    "account": "Account",
    "screeners": "Screeners",
    "research": "Research",
}


@dataclass(frozen=True, slots=True)
class CapabilityDefinition:
    key: str
    notes: tuple[str, ...] = ()
    endpoint_coverage: tuple[str, ...] = ()
    data_domains: tuple[str, ...] = ()
    asset_coverage: tuple[str, ...] = ()
    regions: tuple[str, ...] = ()
    locales: tuple[str, ...] = ()
    rate_limit_note: str | None = None
    cache_policy: str | None = None
    cache_ttl_seconds: int | None = None
    stale_after_seconds: int | None = None
    refresh_behavior: str | None = None
    offline_behavior: str | None = None
    freshness_label: str | None = None
    expected_lag: str | None = None
    as_of_field: str | None = None
    testable: bool | None = None
    test_mode: str | None = None
    credential_note: str | None = None
    unsupported_reason: str | None = None
    decision_note: str | None = None


@dataclass(frozen=True, slots=True)
class ProviderSourceDefinition:
    provider: str
    label: str
    description: str
    capabilities: tuple[CapabilityDefinition, ...]
    credential_gated_capabilities: tuple[str, ...] = ()
    endpoint_coverage: tuple[str, ...] = ()
    data_domains: tuple[str, ...] = ()
    asset_coverage: tuple[str, ...] = ()
    regions: tuple[str, ...] = ()
    locales: tuple[str, ...] = ()
    credential_note: str | None = None
    rate_limit_note: str | None = None
    cache_policy: str | None = None
    cache_ttl_seconds: int | None = None
    stale_after_seconds: int | None = None
    refresh_behavior: str | None = None
    offline_behavior: str | None = None
    freshness_label: str | None = None
    expected_lag: str | None = None
    as_of_field: str | None = None
    provenance_upstream: str | None = None
    provenance_license_note: str | None = None
    provenance_source_url: str | None = None
    testable: bool = False
    test_mode: str | None = None
    read_only: bool = True
    live_trading: bool = False
    write_status: str = "read_only"
    execution_boundary: str | None = None
    matrix_summary: str | None = None

    @property
    def supported_capability_keys(self) -> set[str]:
        return {capability.key for capability in self.capabilities}

    @property
    def credential_gated_keys(self) -> set[str]:
        return set(self.credential_gated_capabilities)


PROVIDER_REGISTRY: tuple[ProviderSourceDefinition, ...] = (
    ProviderSourceDefinition(
        provider="market",
        label="Public Market Data",
        description="Public Yahoo-style equity/ETF data plus Binance public crypto quotes and history used by assets, screeners, research, and factors.",
        endpoint_coverage=("asset workspace", "price history", "watchlist", "screeners", "research evidence", "factor snapshots"),
        data_domains=("quotes", "price_history"),
        asset_coverage=("US equities", "ETFs", "public crypto pairs in the local catalog"),
        regions=("US", "Global crypto"),
        locales=("en-US",),
        rate_limit_note="Public upstream access can throttle or fail; callers must keep cache-aware degradation.",
        cache_policy="Quotes and history can be cached in DuckDB by the consuming service.",
        cache_ttl_seconds=900,
        stale_after_seconds=3600,
        refresh_behavior="Refresh on asset, watchlist, screener, research, or factor workspace fetch.",
        offline_behavior="Use the latest local quote/history snapshot when live upstream access fails; mark stale after one hour.",
        freshness_label="Latest quote or history timestamp returned by the upstream feed.",
        expected_lag="near realtime to delayed, depending on upstream symbol coverage",
        as_of_field="quote.as_of",
        provenance_upstream="Yahoo-style public market feed and Binance public market endpoints",
        provenance_license_note="Public research use; Binance public endpoints here are not broker account or order-submission feeds.",
        provenance_source_url="https://finance.yahoo.com/",
        capabilities=(
            CapabilityDefinition("quotes", notes=("Public quotes are available without credentials.",), endpoint_coverage=("asset workspace", "watchlist", "dashboard"), testable=False),
            CapabilityDefinition("history", notes=("Recent price history is available without credentials.",), endpoint_coverage=("price history", "charts", "portfolio valuation"), testable=False),
            CapabilityDefinition("screeners", notes=("Screeners run on the controlled local market universe.",), endpoint_coverage=("screeners", "factor lab inputs"), testable=False),
            CapabilityDefinition("research", notes=("Research can use quote and history context from the market feed.",), endpoint_coverage=("research brief", "evidence context"), testable=False),
        ),
        matrix_summary="Default no-key market context for local evaluation and research flows.",
    ),
    ProviderSourceDefinition(
        provider="fundamentals",
        label="Yahoo Fundamentals",
        description="Public company overview and ratio snapshots for supported equities.",
        endpoint_coverage=("asset workspace fundamentals", "research brief fundamentals", "factor missing-data checks"),
        data_domains=("fundamentals", "ratios"),
        asset_coverage=("Supported US equities",),
        regions=("US",),
        locales=("en-US",),
        rate_limit_note="Public upstream availability varies by symbol and session.",
        cache_policy="Fundamental snapshots degrade independently from quote/history data.",
        cache_ttl_seconds=86400,
        stale_after_seconds=604800,
        refresh_behavior="Refresh when the asset workspace is fetched for a supported equity.",
        offline_behavior="Use the latest local fundamentals snapshot when live upstream access fails; mark stale after one day.",
        freshness_label="Latest successful fundamentals snapshot for the asset workspace.",
        expected_lag="snapshot-based; refreshed when the asset workspace is fetched",
        as_of_field="asset.provider",
        provenance_upstream="Yahoo-style public fundamentals feed",
        provenance_license_note="Public research use; unsupported assets must surface explicit unavailable states.",
        provenance_source_url="https://finance.yahoo.com/",
        capabilities=(
            CapabilityDefinition("fundamentals", notes=("Fundamental overview and ratios are limited to supported equities.",), endpoint_coverage=("asset overview", "ratio cards"), testable=False),
            CapabilityDefinition("research", notes=("Research can enrich supported equities with overview and ratio context.",), endpoint_coverage=("research brief", "analysis modules"), testable=False),
        ),
        matrix_summary="Equity-only fundamentals enrichment with explicit unsupported states for crypto and macro assets.",
    ),
    ProviderSourceDefinition(
        provider="edgar",
        label="SEC EDGAR",
        description="SEC filing metadata for supported US equities.",
        credential_gated_capabilities=("filings", "research"),
        endpoint_coverage=("asset filings", "research filing modules", "provider credential probe"),
        data_domains=("filings", "company_events"),
        asset_coverage=("Supported US equities",),
        regions=("US",),
        locales=("en-US",),
        credential_note="Requires EDGAR_IDENTITY or a saved desktop EDGAR identity.",
        rate_limit_note="EDGAR requests must identify the user and should remain polite to SEC infrastructure.",
        cache_policy="Recent filings are cached in DuckDB and can be reused when live EDGAR fails.",
        cache_ttl_seconds=600,
        stale_after_seconds=86400,
        refresh_behavior="Reuse filings fetched in the last ten minutes, then perform a credential-gated refresh.",
        offline_behavior="Use the latest local filing index when EDGAR is unavailable; label credential gaps separately.",
        freshness_label="Latest filings fetch timestamp for the EDGAR probe symbol or requested asset.",
        expected_lag="latest available SEC filing metadata",
        as_of_field="filings.filed_at",
        provenance_upstream="SEC EDGAR",
        provenance_license_note="Official SEC filing metadata; identity is required for live requests.",
        provenance_source_url="https://www.sec.gov/edgar",
        testable=True,
        test_mode="credential_probe",
        capabilities=(
            CapabilityDefinition("filings", notes=("An EDGAR identity is required before live SEC filings can be fetched.",), endpoint_coverage=("asset filings", "filing freshness"), testable=True, test_mode="credential_probe"),
            CapabilityDefinition("research", notes=("Research filing modules depend on the EDGAR identity for live coverage.",), endpoint_coverage=("research brief filings", "export evidence"), testable=True, test_mode="credential_probe"),
        ),
        matrix_summary="Credential-gated official US filing source; unsupported outside eligible US equity coverage.",
    ),
    ProviderSourceDefinition(
        provider="binance",
        label="Binance Account",
        description="Binance private-account readiness and account snapshot source. Order submission remains isolated under execution APIs.",
        credential_gated_capabilities=("account",),
        endpoint_coverage=("account readiness", "private account snapshot", "execution safety checks"),
        data_domains=("account", "balances"),
        asset_coverage=("User-owned Binance account assets",),
        regions=("Global crypto",),
        locales=("en-US",),
        credential_note="Requires PENGBO_BINANCE_API_KEY and PENGBO_BINANCE_SECRET or saved desktop Binance credentials.",
        rate_limit_note="Private account probes depend on Binance API availability and configured key permissions.",
        cache_policy="Account snapshots are cached in DuckDB and marked stale when reused after live failure.",
        cache_ttl_seconds=300,
        stale_after_seconds=1800,
        refresh_behavior="Refresh only from an explicit account readiness or execution safety probe.",
        offline_behavior="Use cached account snapshots only as read-only readiness context; never use them for live submission.",
        freshness_label="Latest successful private-account snapshot timestamp.",
        expected_lag="latest successful account probe",
        as_of_field="account.fetched_at",
        provenance_upstream="Binance API",
        provenance_license_note="Read-only account status here; live order submission is outside this catalog.",
        provenance_source_url="https://www.binance.com/",
        testable=True,
        test_mode="credential_probe",
        execution_boundary="Live order submission is isolated under confirmation-gated execution APIs, not this read-only catalog.",
        capabilities=(
            CapabilityDefinition("account", notes=("Binance private-account data requires API key and secret.",), endpoint_coverage=("connections account snapshot", "execution readiness"), testable=True, test_mode="credential_probe"),
        ),
        matrix_summary="Private-account readiness only; execution stays separate, default-off, audited, and user-confirmed.",
    ),
    ProviderSourceDefinition(
        provider="worldbank",
        label="World Bank Indicators",
        description="Public country and regional economic indicators for macro and China/Asia context.",
        endpoint_coverage=("data-source macro series", "workflow data-source step", "data-source report export"),
        data_domains=("macro", "economics", "country_indicators"),
        asset_coverage=("Global macro", "China/Asia indicators", "Country-level economics"),
        regions=("Global", "China", "Asia"),
        locales=("en-US",),
        rate_limit_note="Public API access can throttle; callers must keep cache-aware fallback.",
        cache_policy="Indicator responses are cached in DuckDB by provider and query.",
        cache_ttl_seconds=86400,
        stale_after_seconds=604800,
        refresh_behavior="Refresh when a macro query, workflow step, or report sample requests the provider/query pair.",
        offline_behavior="Use the cached provider/query response when public API access fails; label stale after one day.",
        freshness_label="Latest successful World Bank indicator response.",
        expected_lag="monthly, quarterly, or annual depending on indicator",
        as_of_field="provenance.fetched_at",
        provenance_upstream="World Bank Indicators API",
        provenance_license_note="Public read-only economic indicators.",
        provenance_source_url="https://api.worldbank.org/v2/",
        testable=True,
        test_mode="public_probe",
        capabilities=(
            CapabilityDefinition("research", notes=("Research can include World Bank macro and regional context.",), endpoint_coverage=("macro series", "research context", "data-source report"), testable=True, test_mode="public_probe"),
        ),
        matrix_summary="Public macro source for global and China/Asia research context.",
    ),
    ProviderSourceDefinition(
        provider="dbnomics",
        label="DBnomics",
        description="Public macroeconomic series from DBnomics-hosted datasets.",
        endpoint_coverage=("data-source macro series", "workflow data-source step", "data-source report export"),
        data_domains=("macro", "economics", "time_series"),
        asset_coverage=("Global macro series", "OECD/IMF-style datasets where available"),
        regions=("Global",),
        locales=("en-US",),
        rate_limit_note="Public API availability depends on the selected dataset and provider.",
        cache_policy="Series responses are cached in DuckDB by provider and query.",
        cache_ttl_seconds=86400,
        stale_after_seconds=604800,
        refresh_behavior="Refresh when a macro query, workflow step, or report sample requests the provider/query pair.",
        offline_behavior="Use the cached provider/query response when DBnomics is unavailable; label stale after one day.",
        freshness_label="Latest successful DBnomics series response.",
        expected_lag="dataset-dependent",
        as_of_field="provenance.fetched_at",
        provenance_upstream="DBnomics API",
        provenance_license_note="Public read-only macro dataset access.",
        provenance_source_url="https://api.db.nomics.world/",
        testable=True,
        test_mode="public_probe",
        capabilities=(
            CapabilityDefinition("research", notes=("Research can include DBnomics macro series context.",), endpoint_coverage=("macro series", "research context", "data-source report"), testable=True, test_mode="public_probe"),
        ),
        matrix_summary="Public macro time-series source for dataset-dependent global coverage.",
    ),
    ProviderSourceDefinition(
        provider="rss_events",
        label="Google News RSS Events",
        description="Public market news and event monitoring through Google News RSS-compatible feeds.",
        endpoint_coverage=("data-source news events", "workflow data-source step", "data-source report export"),
        data_domains=("news", "events", "company_events"),
        asset_coverage=("Market news", "Company/event monitoring"),
        regions=("Global",),
        locales=("en-US", "zh-CN"),
        rate_limit_note="Feed availability and ordering depend on upstream publishers.",
        cache_policy="News/event responses are cached in DuckDB by query.",
        cache_ttl_seconds=3600,
        stale_after_seconds=86400,
        refresh_behavior="Refresh when an event query, workflow step, or report sample requests the feed query.",
        offline_behavior="Use cached event links when RSS access fails; label stale after one hour.",
        freshness_label="Latest successful event feed response.",
        expected_lag="minutes to hours depending on feed",
        as_of_field="event.published_at",
        provenance_upstream="Google News RSS search",
        provenance_license_note="Public read-only event metadata and links.",
        provenance_source_url="https://news.google.com/rss/search",
        testable=True,
        test_mode="public_probe",
        capabilities=(
            CapabilityDefinition("research", notes=("Research can include recent event links and summaries.",), endpoint_coverage=("news/event search", "research context", "data-source report"), testable=True, test_mode="public_probe"),
        ),
        matrix_summary="Public event context source for market and company monitoring.",
    ),
    ProviderSourceDefinition(
        provider="fred",
        label="FRED",
        description="Federal Reserve Economic Data macro series. Free API key required.",
        credential_gated_capabilities=("research",),
        endpoint_coverage=("data-source macro series", "workflow data-source step", "data-source report export"),
        data_domains=("macro", "economics", "time_series"),
        asset_coverage=("US macro series",),
        regions=("US",),
        locales=("en-US",),
        credential_note="Requires PENGBO_FRED_API_KEY or FRED_API_KEY in the local sidecar environment.",
        rate_limit_note="FRED API access depends on a user-owned free API key.",
        cache_policy="Series responses are cached in DuckDB by series id.",
        cache_ttl_seconds=86400,
        stale_after_seconds=604800,
        refresh_behavior="Refresh when a FRED series query or report sample requests the configured series.",
        offline_behavior="Use the cached series after live API failure when a key is configured; missing keys remain credential_required.",
        freshness_label="Latest successful FRED series response.",
        expected_lag="series-dependent",
        as_of_field="observation.date",
        provenance_upstream="FRED API",
        provenance_license_note="Free user-owned key; read-only economic data.",
        provenance_source_url="https://fred.stlouisfed.org/docs/api/fred/",
        testable=True,
        test_mode="credential_probe",
        capabilities=(
            CapabilityDefinition("research", notes=("Research can include FRED macro time series when a key is configured.",), endpoint_coverage=("macro series", "research context", "data-source report"), testable=True, test_mode="credential_probe"),
        ),
        matrix_summary="Credential-gated US macro series source with user-owned free API key.",
    ),
    ProviderSourceDefinition(
        provider="coingecko",
        label="CoinGecko Public Crypto",
        description="Crypto public market context. Demo or Pro keys are user-controlled read-only options.",
        credential_gated_capabilities=("quotes", "research"),
        endpoint_coverage=("data-source crypto markets", "workflow data-source step", "data-source report export"),
        data_domains=("crypto_public", "quotes", "market_context"),
        asset_coverage=("Public crypto assets",),
        regions=("Global crypto",),
        locales=("en-US",),
        credential_note="Requires a demo or pro key via PENGBO_COINGECKO_DEMO_API_KEY or PENGBO_COINGECKO_PRO_API_KEY for read-only market snapshots.",
        rate_limit_note="Demo and Pro plans have separate rate limits; paid signup is user-controlled.",
        cache_policy="Crypto market responses are cached in DuckDB by asset list.",
        cache_ttl_seconds=300,
        stale_after_seconds=3600,
        refresh_behavior="Refresh when a crypto market query, workflow step, or report sample requests the configured asset list.",
        offline_behavior="Use the latest cached crypto market response after live API failure; Binance remains the only execution provider.",
        freshness_label="Latest successful CoinGecko market response.",
        expected_lag="near realtime to delayed by plan",
        as_of_field="market.last_updated",
        provenance_upstream="CoinGecko API",
        provenance_license_note="Read-only public crypto context; Binance remains the only execution provider.",
        provenance_source_url="https://docs.coingecko.com/",
        testable=True,
        test_mode="credential_probe",
        capabilities=(
            CapabilityDefinition("quotes", notes=("CoinGecko crypto market snapshots require a configured demo or pro key.",), endpoint_coverage=("crypto market snapshots", "data-source report"), testable=True, test_mode="credential_probe"),
            CapabilityDefinition("research", notes=("Research can use public crypto market context when a key is configured.",), endpoint_coverage=("crypto research context", "data-source report"), testable=True, test_mode="credential_probe"),
        ),
        matrix_summary="Credential-gated public crypto context; not an execution provider.",
    ),
    ProviderSourceDefinition(
        provider="tushare",
        label="Tushare A-share",
        description="User-token read-only A-share daily market, search, and company profile connector for China-market research.",
        credential_gated_capabilities=("quotes", "history", "fundamentals", "research"),
        endpoint_coverage=(
            "data-source equity search",
            "data-source equity quote",
            "data-source equity profile",
            "workflow data-source step",
            "research context",
            "data-source report export",
        ),
        data_domains=("a_share", "quotes", "company_profile", "eod_market"),
        asset_coverage=("A-share seed equities", "Mainland listed equities where user token permissions allow"),
        regions=("China Mainland",),
        locales=("zh-CN", "en-US"),
        credential_note="Requires PENGBO_TUSHARE_TOKEN or a saved desktop Tushare token.",
        rate_limit_note="Tushare token permissions, points, and endpoint limits vary by user account; blocked permission states stay visible.",
        cache_policy="A-share search, quote, and profile responses are cached by provider/query and reused after refresh failure.",
        cache_ttl_seconds=86400,
        stale_after_seconds=604800,
        refresh_behavior="Refresh on explicit A-share search, quote, profile, workflow, or report sample request.",
        offline_behavior="Use cached A-share snapshots after live refresh failure; missing tokens remain credential_required.",
        freshness_label="Latest successful Tushare response for the requested A-share query.",
        expected_lag="end-of-day or account-permission dependent",
        as_of_field="trade_date",
        provenance_upstream="Tushare Pro HTTP API",
        provenance_license_note="User-owned token with account permission/points limits; redistribution risk remains high for exported market data.",
        provenance_source_url="https://tushare.pro/document/2?doc_id=130",
        testable=True,
        test_mode="credential_or_fixture_probe",
        capabilities=(
            CapabilityDefinition("quotes", notes=("A-share EOD quote/status requires a configured Tushare token.",), endpoint_coverage=("equity quote", "research source context"), testable=True, test_mode="credential_or_fixture_probe"),
            CapabilityDefinition("history", notes=("Daily OHLCV history is read-only and permission dependent.",), endpoint_coverage=("equity quote/status", "report sample"), testable=True, test_mode="fixture_probe"),
            CapabilityDefinition("fundamentals", notes=("Basic company profile fields are available through stock_basic.",), endpoint_coverage=("equity profile", "research evidence"), testable=True, test_mode="credential_or_fixture_probe"),
            CapabilityDefinition("research", notes=("Research can include A-share source quality and listing-venue boundaries.",), endpoint_coverage=("china_market research template", "report export"), testable=True, test_mode="fixture_probe"),
        ),
        matrix_summary="First cautious A-share connector: user-token, read-only, cache-aware, no trading path.",
    ),
    ProviderSourceDefinition(
        provider="hkma",
        label="HKMA Open API",
        description="No-key Hong Kong monetary statistics connector for HK/China regional macro research.",
        endpoint_coverage=("data-source macro series", "workflow data-source step", "research context", "data-source report export"),
        data_domains=("macro", "hong_kong", "monetary_statistics", "rates"),
        asset_coverage=("Hong Kong macro series", "China regional macro context"),
        regions=("Hong Kong", "China"),
        locales=("en-US", "zh-CN"),
        rate_limit_note="HKMA Open API is free and no registration is required, subject to HKMA site terms.",
        cache_policy="HKMA macro responses are cached by series id and query parameters.",
        cache_ttl_seconds=86400,
        stale_after_seconds=604800,
        refresh_behavior="Refresh when HKMA macro series is requested from Data Sources, workflow, or report export.",
        offline_behavior="Use cached HKMA series after live refresh failure; no credentials are required.",
        freshness_label="Latest successful HKMA monetary statistics response.",
        expected_lag="monthly or dataset-dependent",
        as_of_field="end_of_month",
        provenance_upstream="Hong Kong Monetary Authority Open API",
        provenance_license_note="Official no-key open API; reuse remains subject to HKMA and DATA.GOV.HK terms.",
        provenance_source_url="https://apidocs.hkma.gov.hk/abouthkmasapi/",
        testable=True,
        test_mode="public_or_fixture_probe",
        capabilities=(
            CapabilityDefinition("research", notes=("Research can include HKMA macro series with source/licensing boundaries.",), endpoint_coverage=("macro series", "china_market template", "data-source report"), testable=True, test_mode="public_or_fixture_probe"),
        ),
        matrix_summary="No-key official HK macro source for China regional research context.",
    ),
)

PROVIDER_REGISTRY_BY_KEY: dict[str, ProviderSourceDefinition] = {
    definition.provider: definition for definition in PROVIDER_REGISTRY
}


@dataclass(frozen=True, slots=True)
class AssetCapabilityAssessment:
    key: str
    status: str
    message: str


class CapabilityService:
    def __init__(
        self,
        filings_provider: FilingsProvider,
        binance_provider: BinanceProvider,
        *,
        fred_configured: bool = False,
        coingecko_configured: bool = False,
        tushare_configured: bool = False,
    ) -> None:
        self.filings_provider = filings_provider
        self.binance_provider = binance_provider
        self.fred_configured = fred_configured
        self.coingecko_configured = coingecko_configured
        self.tushare_configured = tushare_configured

    def _provider_is_configured(self, provider: str) -> bool:
        if provider == "edgar":
            return self.filings_provider.is_configured
        if provider == "binance":
            return self.binance_provider.is_configured
        if provider == "fred":
            return self.fred_configured
        if provider == "coingecko":
            return self.coingecko_configured
        if provider == "tushare":
            return self.tushare_configured
        return True

    def get_source_definition(self, provider: str) -> ProviderSourceDefinition | None:
        return PROVIDER_REGISTRY_BY_KEY.get(provider)

    def source_definitions(self) -> tuple[ProviderSourceDefinition, ...]:
        return PROVIDER_REGISTRY

    def _freshness_payload(
        self,
        definition: ProviderSourceDefinition,
        capability: CapabilityDefinition | None = None,
    ) -> dict[str, object | None]:
        return {
            "label": (capability.freshness_label if capability and capability.freshness_label else definition.freshness_label)
            or "No freshness contract is registered for this provider.",
            "expected_lag": capability.expected_lag if capability and capability.expected_lag else definition.expected_lag,
            "as_of_field": capability.as_of_field if capability and capability.as_of_field else definition.as_of_field,
            "cache_ttl_seconds": (
                capability.cache_ttl_seconds
                if capability and capability.cache_ttl_seconds is not None
                else definition.cache_ttl_seconds
            ),
            "stale_after_seconds": (
                capability.stale_after_seconds
                if capability and capability.stale_after_seconds is not None
                else definition.stale_after_seconds
            ),
            "refresh_behavior": (
                capability.refresh_behavior
                if capability and capability.refresh_behavior
                else definition.refresh_behavior
            ),
            "offline_behavior": (
                capability.offline_behavior
                if capability and capability.offline_behavior
                else definition.offline_behavior
            ),
        }

    def _provider_capability(self, definition: ProviderSourceDefinition, capability_key: str) -> ProviderCapability:
        capability = next((item for item in definition.capabilities if item.key == capability_key), None)
        supported = capability is not None
        requires_credentials = capability_key in definition.credential_gated_keys
        status_hint = "unsupported"
        if supported:
            status_hint = (
                "available"
                if not requires_credentials or self._provider_is_configured(definition.provider)
                else "credential_required"
            )
        notes = tuple() if capability is None else capability.notes
        unsupported_reason = None
        if not supported:
            unsupported_reason = (
                capability.unsupported_reason
                if capability and capability.unsupported_reason
                else f"{definition.label} does not provide {CAPABILITY_LABELS[capability_key].lower()} in the current desktop contract."
            )
        return ProviderCapability(
            key=capability_key,
            label=CAPABILITY_LABELS[capability_key],
            supported=supported,
            requires_credentials=requires_credentials,
            status_hint=status_hint,
            notes=list(notes),
            endpoint_coverage=list((capability.endpoint_coverage if capability and capability.endpoint_coverage else definition.endpoint_coverage)),
            data_domains=list((capability.data_domains if capability and capability.data_domains else definition.data_domains)),
            asset_coverage=list((capability.asset_coverage if capability and capability.asset_coverage else definition.asset_coverage)),
            regions=list((capability.regions if capability and capability.regions else definition.regions)),
            locales=list((capability.locales if capability and capability.locales else definition.locales)),
            rate_limit_note=(capability.rate_limit_note if capability and capability.rate_limit_note else definition.rate_limit_note),
            cache_policy=(capability.cache_policy if capability and capability.cache_policy else definition.cache_policy),
            freshness=self._freshness_payload(definition, capability),
            provenance={
                "provider": definition.label,
                "upstream": definition.provenance_upstream,
                "license_note": definition.provenance_license_note,
                "source_url": definition.provenance_source_url,
            },
            testable=definition.testable if capability is None or capability.testable is None else capability.testable,
            test_mode=(capability.test_mode if capability and capability.test_mode else definition.test_mode),
            read_only=definition.read_only,
            credential_note=(capability.credential_note if capability and capability.credential_note else definition.credential_note),
            unsupported_reason=unsupported_reason,
            decision_note=(capability.decision_note if capability else None) or definition.matrix_summary,
        )

    def get_connections_catalog(self) -> ConnectionsCatalogResponse:
        return ConnectionsCatalogResponse(
            providers=[
                ProviderCapabilityProviderItem(
                    provider=definition.provider,
                    label=definition.label,
                    description=definition.description,
                    endpoint_coverage=list(definition.endpoint_coverage),
                    data_domains=list(definition.data_domains),
                    asset_coverage=list(definition.asset_coverage),
                    regions=list(definition.regions),
                    locales=list(definition.locales),
                    credential_note=definition.credential_note,
                    rate_limit_note=definition.rate_limit_note,
                    cache_policy=definition.cache_policy,
                    freshness=self._freshness_payload(definition),
                    provenance={
                        "provider": definition.label,
                        "upstream": definition.provenance_upstream,
                        "license_note": definition.provenance_license_note,
                        "source_url": definition.provenance_source_url,
                    },
                    testable=definition.testable,
                    test_mode=definition.test_mode,
                    read_only=definition.read_only,
                    live_trading=definition.live_trading,
                    write_status=definition.write_status,
                    execution_boundary=definition.execution_boundary,
                    matrix_summary=definition.matrix_summary,
                    capabilities=[self._provider_capability(definition, capability_key) for capability_key in CAPABILITY_ORDER],
                )
                for definition in PROVIDER_REGISTRY
            ]
        )

    def get_connector_manifests(self) -> ConnectorManifestResponse:
        manifests: list[ConnectorManifest] = []
        for definition in PROVIDER_REGISTRY:
            family = "china_market" if definition.provider in {"tushare", "hkma"} else "core"
            credential_model = "user_token" if definition.credential_note else "none"
            if definition.provider in {"fred", "coingecko"}:
                credential_model = "user_api_key"
            if definition.provider == "binance":
                credential_model = "user_account_key"
            if definition.provider == "edgar":
                credential_model = "user_identity"
            redistribution_risk = "high" if definition.provider == "tushare" else "low"
            if definition.provider in {"market", "fundamentals", "rss_events", "coingecko"}:
                redistribution_risk = "medium"
            manifests.append(
                ConnectorManifest(
                    provider_key=definition.provider,
                    label=definition.label,
                    family=family,
                    regions=list(definition.regions),
                    asset_classes=list(definition.asset_coverage),
                    capabilities=[capability.key for capability in definition.capabilities],
                    credential_model=credential_model,
                    freshness=self._freshness_payload(definition),
                    rate_limits=definition.rate_limit_note,
                    license_note=definition.provenance_license_note,
                    license_status="approved_cautious_v1" if definition.provider in {"tushare", "hkma"} else "catalog_reviewed",
                    redistribution_risk=redistribution_risk,
                    read_only=definition.read_only,
                    live_trading=definition.live_trading,
                    write_status=definition.write_status,
                    test_modes=[definition.test_mode] if definition.test_mode else [],
                    source_url=definition.provenance_source_url,
                )
            )
        return ConnectorManifestResponse(manifests=manifests)

    def assess_fundamentals(
        self,
        entry: AssetCatalogEntry,
        *,
        data_available: bool,
        temporarily_unavailable: bool,
    ) -> AssetCapabilityAssessment:
        if not entry.is_us_equity:
            return AssetCapabilityAssessment(
                key="fundamentals",
                status="unsupported",
                message="Fundamentals are not supported for this asset class in the current desktop contract.",
            )
        if temporarily_unavailable and not data_available:
            return AssetCapabilityAssessment(
                key="fundamentals",
                status="temporarily_unavailable",
                message="Fundamentals are supported for this symbol, but the upstream snapshot is temporarily unavailable.",
            )
        return AssetCapabilityAssessment(
            key="fundamentals",
            status="available",
            message="Fundamentals coverage is enabled for this symbol.",
        )

    def assess_filings(
        self,
        entry: AssetCatalogEntry,
        *,
        data_available: bool,
        temporarily_unavailable: bool,
    ) -> AssetCapabilityAssessment:
        if not entry.is_us_equity:
            return AssetCapabilityAssessment(
                key="filings",
                status="unsupported",
                message="SEC filings are not supported for this asset class in the current desktop contract.",
            )
        if not self.filings_provider.is_configured:
            return AssetCapabilityAssessment(
                key="filings",
                status="credential_required",
                message="Add an EDGAR identity in Connections to enable live SEC filings for this symbol.",
            )
        if temporarily_unavailable and not data_available:
            return AssetCapabilityAssessment(
                key="filings",
                status="temporarily_unavailable",
                message="SEC filings are supported for this symbol, but the live feed is temporarily unavailable.",
            )
        return AssetCapabilityAssessment(
            key="filings",
            status="available",
            message="SEC filings coverage is enabled for this symbol.",
        )
