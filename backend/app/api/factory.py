from __future__ import annotations

from contextlib import asynccontextmanager
from threading import Lock

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..providers.binance import BinanceProvider
from ..providers.filings import FilingsProvider
from ..providers.fundamentals import FundamentalProvider
from ..providers.market import MarketProvider
from ..runtime import RuntimeSettings
from ..services.asset_service import AssetService
from ..services.ai_runtime_service import AIRuntimeService
from ..services.auth_session_service import AuthSessionService
from ..services.capability_service import CapabilityService
from ..services.connections_service import ConnectionsService
from ..services.data_source_service import DataSourceService
from ..services.dashboard_service import DashboardService
from ..services.execution_service import ExecutionService
from ..services.evidence_service import EvidenceService
from ..services.factor_service import FactorService
from ..services.portfolio_service import PortfolioService
from ..services.research_service import ResearchService
from ..services.research_assistant_service import ResearchAssistantService
from ..services.screener_service import ScreenerService
from ..services.settings_service import SettingsService
from ..services.security_audit_service import SecurityAuditService
from ..services.local_security_service import LocalSecurityService
from ..services.strategy_service import StrategyService
from ..services.translation_service import TranslationService
from ..services.watchlist_service import WatchlistService
from ..services.workflow_service import WorkflowService
from ..storage.duckdb_store import DuckDbStore
from ..storage.sqlite_store import SqliteStore
from .gateway import GatewayHardeningMiddleware, allowed_origins, validate_sidecar_bind
from .routes import register_routes


class AppContainer:
    def __init__(self, settings: RuntimeSettings) -> None:
        settings.ensure_directories()
        self.settings = settings
        self.sqlite_store = SqliteStore(settings.sqlite_path)
        self.duck_store = DuckDbStore(settings.duckdb_path)
        self.sqlite_store.initialize()
        self.duck_store.initialize()
        self.binance_provider = BinanceProvider(settings)
        self.market_provider = MarketProvider(self.binance_provider)
        self.fundamental_provider = FundamentalProvider()
        self.filings_provider = FilingsProvider(settings.edgar_identity)
        self.watchlist_service = WatchlistService(self.sqlite_store)
        self.security_audit_service = SecurityAuditService(self.sqlite_store)
        self.local_security_service = LocalSecurityService(self.sqlite_store, self.security_audit_service)
        self.auth_session_service = AuthSessionService(self.sqlite_store, self.security_audit_service)
        self.ai_runtime_service = AIRuntimeService(settings)
        self.capability_service = CapabilityService(
            self.filings_provider,
            self.binance_provider,
            fred_configured=bool(settings.fred_api_key),
            coingecko_configured=bool(settings.coingecko_demo_api_key or settings.coingecko_pro_api_key),
        )
        self.data_source_service = DataSourceService(
            settings,
            self.duck_store,
            self.capability_service,
        )
        self.asset_service = AssetService(
            self.market_provider,
            self.fundamental_provider,
            self.filings_provider,
            self.duck_store,
            self.capability_service,
        )
        self.dashboard_service = DashboardService(
            self.watchlist_service,
            self.asset_service,
            self.market_provider,
            self.sqlite_store,
            self.duck_store,
            self.binance_provider,
        )
        self.settings_service = SettingsService(settings, self.sqlite_store)
        self.translation_service = TranslationService(settings)
        self.connections_service = ConnectionsService(
            self.sqlite_store,
            self.duck_store,
            self.binance_provider,
            self.filings_provider,
            self.capability_service,
            self.data_source_service,
            self.security_audit_service,
        )
        self.portfolio_service = PortfolioService(self.sqlite_store, self.asset_service)
        self.screener_service = ScreenerService(self.sqlite_store, self.asset_service)
        self.factor_service = FactorService(
            self.duck_store,
            self.asset_service,
            self.screener_service,
        )
        self.screener_service.attach_factor_service(self.factor_service)
        self.strategy_service = StrategyService(
            settings,
            self.duck_store,
            self.sqlite_store,
            self.asset_service,
        )
        self.execution_service = ExecutionService(
            self.sqlite_store,
            self.asset_service,
            self.binance_provider,
            self.security_audit_service,
        )
        self.evidence_service = EvidenceService(
            self.factor_service,
            self.strategy_service,
            self.execution_service,
            self.screener_service,
        )
        self.research_service = ResearchService(
            settings,
            self.sqlite_store,
            self.asset_service,
            self.screener_service,
            self.portfolio_service,
            self.watchlist_service,
            self.factor_service,
            self.evidence_service,
        )
        self.research_assistant_service = ResearchAssistantService(
            settings,
            self.research_service,
            self.security_audit_service,
            self.settings_service,
        )
        self.workflow_service = WorkflowService(
            self.sqlite_store,
            self.screener_service,
            self.research_service,
            self.factor_service,
            self.strategy_service,
            self.execution_service,
            self.data_source_service,
        )

    def close(self) -> None:
        self.sqlite_store.close()
        self.duck_store.close()


class LazyAppContainer:
    def __init__(self, settings: RuntimeSettings) -> None:
        settings.ensure_directories()
        self.settings = settings
        self.sqlite_store = SqliteStore(settings.sqlite_path)
        self.sqlite_store.initialize()
        self.settings_service = SettingsService(settings, self.sqlite_store)
        self.security_audit_service = SecurityAuditService(self.sqlite_store)
        self.local_security_service = LocalSecurityService(self.sqlite_store, self.security_audit_service)
        self.ai_runtime_service = AIRuntimeService(settings)
        self._container: AppContainer | None = None
        self._lock = Lock()

    def _get_container(self) -> AppContainer:
        if self._container is None:
            with self._lock:
                if self._container is None:
                    self._container = AppContainer(self.settings)
        return self._container

    def __getattr__(self, name: str):
        return getattr(self._get_container(), name)

    def close(self) -> None:
        if self._container is not None:
            self._container.close()
        self.sqlite_store.close()


def create_app(settings: RuntimeSettings) -> FastAPI:
    validate_sidecar_bind(settings)
    container = LazyAppContainer(settings) if settings.runtime_mode == "tauri" else AppContainer(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.container = container
        try:
            yield
        finally:
            container.close()

    app = FastAPI(
        title="Pengbo Workbench Sidecar",
        version="0.3.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins(),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )
    app.add_middleware(GatewayHardeningMiddleware, settings=settings)
    register_routes(app)
    return app
