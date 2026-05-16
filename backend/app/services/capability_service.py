from __future__ import annotations

from dataclasses import dataclass

from ..data_seed import AssetCatalogEntry
from ..models import ConnectionsCatalogResponse, ProviderCapability, ProviderCapabilityProviderItem
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
    data_domains: tuple[str, ...] = ()
    asset_coverage: tuple[str, ...] = ()
    regions: tuple[str, ...] = ()
    locales: tuple[str, ...] = ()
    rate_limit_note: str | None = None
    cache_policy: str | None = None
    freshness_label: str | None = None
    expected_lag: str | None = None
    as_of_field: str | None = None
    testable: bool | None = None
    test_mode: str | None = None
    credential_note: str | None = None


@dataclass(frozen=True, slots=True)
class ProviderSourceDefinition:
    provider: str
    label: str
    description: str
    capabilities: tuple[CapabilityDefinition, ...]
    credential_gated_capabilities: tuple[str, ...] = ()
    data_domains: tuple[str, ...] = ()
    asset_coverage: tuple[str, ...] = ()
    regions: tuple[str, ...] = ()
    locales: tuple[str, ...] = ()
    credential_note: str | None = None
    rate_limit_note: str | None = None
    cache_policy: str | None = None
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

    @property
    def supported_capability_keys(self) -> set[str]:
        return {capability.key for capability in self.capabilities}

    @property
    def credential_gated_keys(self) -> set[str]:
        return set(self.credential_gated_capabilities)


PROVIDER_REGISTRY: tuple[ProviderSourceDefinition, ...] = (
    ProviderSourceDefinition(
        provider="market",
        label="Yahoo Market Data",
        description="Public market quotes and recent price history used by assets, screeners, research, and factors.",
        data_domains=("quotes", "price_history"),
        asset_coverage=("US equities", "ETFs", "public crypto pairs in the local catalog"),
        regions=("US", "Global crypto"),
        locales=("en-US",),
        rate_limit_note="Public upstream access can throttle or fail; callers must keep cache-aware degradation.",
        cache_policy="Quotes and history can be cached in DuckDB by the consuming service.",
        freshness_label="Latest quote or history timestamp returned by the upstream feed.",
        expected_lag="near realtime to delayed, depending on upstream symbol coverage",
        as_of_field="quote.as_of",
        provenance_upstream="Yahoo-style public market feed",
        provenance_license_note="Public research use; not a broker or exchange execution feed.",
        provenance_source_url="https://finance.yahoo.com/",
        capabilities=(
            CapabilityDefinition("quotes", notes=("Public quotes are available without credentials.",), testable=False),
            CapabilityDefinition("history", notes=("Recent price history is available without credentials.",), testable=False),
            CapabilityDefinition("screeners", notes=("Screeners run on the controlled local market universe.",), testable=False),
            CapabilityDefinition("research", notes=("Research can use quote and history context from the market feed.",), testable=False),
        ),
    ),
    ProviderSourceDefinition(
        provider="fundamentals",
        label="Yahoo Fundamentals",
        description="Public company overview and ratio snapshots for supported equities.",
        data_domains=("fundamentals", "ratios"),
        asset_coverage=("Supported US equities",),
        regions=("US",),
        locales=("en-US",),
        rate_limit_note="Public upstream availability varies by symbol and session.",
        cache_policy="Fundamental snapshots degrade independently from quote/history data.",
        freshness_label="Latest successful fundamentals snapshot for the asset workspace.",
        expected_lag="snapshot-based; refreshed when the asset workspace is fetched",
        as_of_field="asset.provider",
        provenance_upstream="Yahoo-style public fundamentals feed",
        provenance_license_note="Public research use; unsupported assets must surface explicit unavailable states.",
        provenance_source_url="https://finance.yahoo.com/",
        capabilities=(
            CapabilityDefinition("fundamentals", notes=("Fundamental overview and ratios are limited to supported equities.",), testable=False),
            CapabilityDefinition("research", notes=("Research can enrich supported equities with overview and ratio context.",), testable=False),
        ),
    ),
    ProviderSourceDefinition(
        provider="edgar",
        label="SEC EDGAR",
        description="SEC filing metadata for supported US equities.",
        credential_gated_capabilities=("filings", "research"),
        data_domains=("filings", "company_events"),
        asset_coverage=("Supported US equities",),
        regions=("US",),
        locales=("en-US",),
        credential_note="Requires EDGAR_IDENTITY or a saved desktop EDGAR identity.",
        rate_limit_note="EDGAR requests must identify the user and should remain polite to SEC infrastructure.",
        cache_policy="Recent filings are cached in DuckDB and can be reused when live EDGAR fails.",
        freshness_label="Latest filings fetch timestamp for the EDGAR probe symbol or requested asset.",
        expected_lag="latest available SEC filing metadata",
        as_of_field="filings.filed_at",
        provenance_upstream="SEC EDGAR",
        provenance_license_note="Official SEC filing metadata; identity is required for live requests.",
        provenance_source_url="https://www.sec.gov/edgar",
        testable=True,
        test_mode="credential_probe",
        capabilities=(
            CapabilityDefinition("filings", notes=("An EDGAR identity is required before live SEC filings can be fetched.",), testable=True, test_mode="credential_probe"),
            CapabilityDefinition("research", notes=("Research filing modules depend on the EDGAR identity for live coverage.",), testable=True, test_mode="credential_probe"),
        ),
    ),
    ProviderSourceDefinition(
        provider="binance",
        label="Binance Account",
        description="Binance private-account readiness and account snapshot source. Order submission remains isolated under execution APIs.",
        credential_gated_capabilities=("account",),
        data_domains=("account", "balances"),
        asset_coverage=("User-owned Binance account assets",),
        regions=("Global crypto",),
        locales=("en-US",),
        credential_note="Requires PENGBO_BINANCE_API_KEY and PENGBO_BINANCE_SECRET or saved desktop Binance credentials.",
        rate_limit_note="Private account probes depend on Binance API availability and configured key permissions.",
        cache_policy="Account snapshots are cached in DuckDB and marked stale when reused after live failure.",
        freshness_label="Latest successful private-account snapshot timestamp.",
        expected_lag="latest successful account probe",
        as_of_field="account.fetched_at",
        provenance_upstream="Binance API",
        provenance_license_note="Read-only account status here; live order submission is outside this catalog.",
        provenance_source_url="https://www.binance.com/",
        testable=True,
        test_mode="credential_probe",
        capabilities=(
            CapabilityDefinition("account", notes=("Binance private-account data requires API key and secret.",), testable=True, test_mode="credential_probe"),
        ),
    ),
    ProviderSourceDefinition(
        provider="worldbank",
        label="World Bank Indicators",
        description="Public country and regional economic indicators for macro and China/Asia context.",
        data_domains=("macro", "economics", "country_indicators"),
        asset_coverage=("Global macro", "China/Asia indicators", "Country-level economics"),
        regions=("Global", "China", "Asia"),
        locales=("en-US",),
        rate_limit_note="Public API access can throttle; callers must keep cache-aware fallback.",
        cache_policy="Indicator responses are cached in DuckDB by provider and query.",
        freshness_label="Latest successful World Bank indicator response.",
        expected_lag="monthly, quarterly, or annual depending on indicator",
        as_of_field="provenance.fetched_at",
        provenance_upstream="World Bank Indicators API",
        provenance_license_note="Public read-only economic indicators.",
        provenance_source_url="https://api.worldbank.org/v2/",
        testable=True,
        test_mode="public_probe",
        capabilities=(
            CapabilityDefinition("research", notes=("Research can include World Bank macro and regional context.",), testable=True, test_mode="public_probe"),
        ),
    ),
    ProviderSourceDefinition(
        provider="dbnomics",
        label="DBnomics",
        description="Public macroeconomic series from DBnomics-hosted datasets.",
        data_domains=("macro", "economics", "time_series"),
        asset_coverage=("Global macro series", "OECD/IMF-style datasets where available"),
        regions=("Global",),
        locales=("en-US",),
        rate_limit_note="Public API availability depends on the selected dataset and provider.",
        cache_policy="Series responses are cached in DuckDB by provider and query.",
        freshness_label="Latest successful DBnomics series response.",
        expected_lag="dataset-dependent",
        as_of_field="provenance.fetched_at",
        provenance_upstream="DBnomics API",
        provenance_license_note="Public read-only macro dataset access.",
        provenance_source_url="https://api.db.nomics.world/",
        testable=True,
        test_mode="public_probe",
        capabilities=(
            CapabilityDefinition("research", notes=("Research can include DBnomics macro series context.",), testable=True, test_mode="public_probe"),
        ),
    ),
    ProviderSourceDefinition(
        provider="rss_events",
        label="RSS / GDELT Events",
        description="Public market news and event monitoring through RSS-compatible feeds.",
        data_domains=("news", "events", "company_events"),
        asset_coverage=("Market news", "Company/event monitoring"),
        regions=("Global",),
        locales=("en-US", "zh-CN"),
        rate_limit_note="Feed availability and ordering depend on upstream publishers.",
        cache_policy="News/event responses are cached in DuckDB by query.",
        freshness_label="Latest successful event feed response.",
        expected_lag="minutes to hours depending on feed",
        as_of_field="event.published_at",
        provenance_upstream="Public RSS/GDELT-compatible feeds",
        provenance_license_note="Public read-only event metadata and links.",
        provenance_source_url="https://www.gdeltproject.org/",
        testable=True,
        test_mode="public_probe",
        capabilities=(
            CapabilityDefinition("research", notes=("Research can include recent event links and summaries.",), testable=True, test_mode="public_probe"),
        ),
    ),
    ProviderSourceDefinition(
        provider="fred",
        label="FRED",
        description="Federal Reserve Economic Data macro series. Free API key required.",
        credential_gated_capabilities=("research",),
        data_domains=("macro", "economics", "time_series"),
        asset_coverage=("US macro series",),
        regions=("US",),
        locales=("en-US",),
        credential_note="Requires PENGBO_FRED_API_KEY or FRED_API_KEY in the local sidecar environment.",
        rate_limit_note="FRED API access depends on a user-owned free API key.",
        cache_policy="Series responses are cached in DuckDB by series id.",
        freshness_label="Latest successful FRED series response.",
        expected_lag="series-dependent",
        as_of_field="observation.date",
        provenance_upstream="FRED API",
        provenance_license_note="Free user-owned key; read-only economic data.",
        provenance_source_url="https://fred.stlouisfed.org/docs/api/fred/",
        testable=True,
        test_mode="credential_probe",
        capabilities=(
            CapabilityDefinition("research", notes=("Research can include FRED macro time series when a key is configured.",), testable=True, test_mode="credential_probe"),
        ),
    ),
    ProviderSourceDefinition(
        provider="coingecko",
        label="CoinGecko Public Crypto",
        description="Crypto public market context. Demo key preferred; Pro remains a user-enabled paid option.",
        credential_gated_capabilities=("quotes", "history", "research"),
        data_domains=("crypto_public", "quotes", "market_context"),
        asset_coverage=("Public crypto assets",),
        regions=("Global crypto",),
        locales=("en-US",),
        credential_note="Requires PENGBO_COINGECKO_DEMO_API_KEY for enabled demo access; Pro key setup is documented but not activated automatically.",
        rate_limit_note="Demo and Pro plans have separate rate limits; paid signup is user-controlled.",
        cache_policy="Crypto market responses are cached in DuckDB by asset list.",
        freshness_label="Latest successful CoinGecko market response.",
        expected_lag="near realtime to delayed by plan",
        as_of_field="market.last_updated",
        provenance_upstream="CoinGecko API",
        provenance_license_note="Read-only public crypto context; Binance remains the only execution provider.",
        provenance_source_url="https://docs.coingecko.com/",
        testable=True,
        test_mode="credential_probe",
        capabilities=(
            CapabilityDefinition("quotes", notes=("CoinGecko crypto market snapshots require a configured demo key.",), testable=True, test_mode="credential_probe"),
            CapabilityDefinition("history", notes=("Historical public crypto context is planned after demo-key market snapshots.",), testable=True, test_mode="credential_probe"),
            CapabilityDefinition("research", notes=("Research can use public crypto market context when a key is configured.",), testable=True, test_mode="credential_probe"),
        ),
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
    ) -> None:
        self.filings_provider = filings_provider
        self.binance_provider = binance_provider
        self.fred_configured = fred_configured
        self.coingecko_configured = coingecko_configured

    def _provider_is_configured(self, provider: str) -> bool:
        if provider == "edgar":
            return self.filings_provider.is_configured
        if provider == "binance":
            return self.binance_provider.is_configured
        if provider == "fred":
            return self.fred_configured
        if provider == "coingecko":
            return self.coingecko_configured
        return True

    def get_source_definition(self, provider: str) -> ProviderSourceDefinition | None:
        return PROVIDER_REGISTRY_BY_KEY.get(provider)

    def source_definitions(self) -> tuple[ProviderSourceDefinition, ...]:
        return PROVIDER_REGISTRY

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
        freshness_label = (capability.freshness_label if capability else None) or definition.freshness_label
        return ProviderCapability(
            key=capability_key,
            label=CAPABILITY_LABELS[capability_key],
            supported=supported,
            requires_credentials=requires_credentials,
            status_hint=status_hint,
            notes=list(notes),
            data_domains=list((capability.data_domains if capability and capability.data_domains else definition.data_domains)),
            asset_coverage=list((capability.asset_coverage if capability and capability.asset_coverage else definition.asset_coverage)),
            regions=list((capability.regions if capability and capability.regions else definition.regions)),
            locales=list((capability.locales if capability and capability.locales else definition.locales)),
            rate_limit_note=(capability.rate_limit_note if capability and capability.rate_limit_note else definition.rate_limit_note),
            cache_policy=(capability.cache_policy if capability and capability.cache_policy else definition.cache_policy),
            freshness={
                "label": freshness_label or "No freshness contract is registered for this capability.",
                "expected_lag": (capability.expected_lag if capability and capability.expected_lag else definition.expected_lag),
                "as_of_field": (capability.as_of_field if capability and capability.as_of_field else definition.as_of_field),
            },
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
        )

    def get_connections_catalog(self) -> ConnectionsCatalogResponse:
        return ConnectionsCatalogResponse(
            providers=[
                ProviderCapabilityProviderItem(
                    provider=definition.provider,
                    label=definition.label,
                    description=definition.description,
                    data_domains=list(definition.data_domains),
                    asset_coverage=list(definition.asset_coverage),
                    regions=list(definition.regions),
                    locales=list(definition.locales),
                    credential_note=definition.credential_note,
                    rate_limit_note=definition.rate_limit_note,
                    cache_policy=definition.cache_policy,
                    freshness={
                        "label": definition.freshness_label or "No freshness contract is registered for this provider.",
                        "expected_lag": definition.expected_lag,
                        "as_of_field": definition.as_of_field,
                    },
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
                    capabilities=[self._provider_capability(definition, capability_key) for capability_key in CAPABILITY_ORDER],
                )
                for definition in PROVIDER_REGISTRY
            ]
        )

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
