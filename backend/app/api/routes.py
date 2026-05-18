from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query, Request

from ..models import (
    AssetSearchResult,
    BinanceExecutionAuditEvent,
    BinanceExecutionConfig,
    BinanceExecutionIntentRequest,
    BinanceExecutionIntentResponse,
    BinanceKillSwitchRequest,
    ConnectionCheckRequest,
    ConnectionCheckResponse,
    ConnectionsCatalogResponse,
    ConnectionsStatusResponse,
    CreateCredentialProfileRequest,
    CreateResearchBriefRequest,
    CredentialProfile,
    CreateScreenerPresetVariantRequest,
    CryptoMarketsResponse,
    DataSourceReportExportRequest,
    DataSourceReportExportResponse,
    DashboardOverviewResponse,
    DataSourceRuntimeStatus,
    DataSourceStatusResponse,
    FactorFamilyDefinition,
    FactorRunListItem,
    FactorRunRequest,
    FactorRunResponse,
    FundamentalOverview,
    HealthResponse,
    LocalAuthSessionRequest,
    LocalAuthSessionResponse,
    LocalSecurityInitializeRequest,
    LocalSecurityStatus,
    LocalSecurityTouchRequest,
    LocalSecurityUnlockRequest,
    OnboardingState,
    PortfolioHolding,
    PortfolioSummaryResponse,
    PortfolioTransaction,
    PortfolioTransactionCreate,
    PortfolioTransactionUpdate,
    PricePoint,
    PriceHistoryInterval,
    QuoteResponse,
    RatioItem,
    ResearchBrief,
    ResearchEvidenceContext,
    ResearchBriefExportResponse,
    ResearchBriefListItem,
    RoutePermissionClassification,
    MacroSeriesResponse,
    NewsEventsResponse,
    ScreenerPreset,
    ScreenerPresetVariant,
    ScreenerRunRequest,
    ScreenerRunResponse,
    SettingsRuntimeResponse,
    SecurityAuditEvent,
    SetActiveCredentialProfileRequest,
    StrategyBacktestListItem,
    StrategyBacktestRequest,
    StrategyBacktestResponse,
    StrategyPaperSessionListItem,
    StrategyPaperSessionRequest,
    StrategyPaperSessionResponse,
    StrategyReportExportResponse,
    StrategyTemplateDefinition,
    TranslationStatusResponse,
    TranslationSuggestRequest,
    TranslationSuggestResponse,
    UpdateBinanceExecutionConfigRequest,
    UpdateAppPreferencesRequest,
    UpdateOnboardingStateRequest,
    UpdateResearchBriefNotesRequest,
    UpdateScreenerPresetRequest,
    UpdateScreenerPresetVariantRequest,
    WatchlistUpdateRequest,
    AppPreferences,
    WorkflowRunRequest,
    WorkflowRunResponse,
    WorkflowTemplateDefinition,
)
from ..providers.catalog import get_asset
from ..services.auth_session_service import AuthSessionError


def _container(request: Request):
    return request.app.state.container


def _value_error_to_http(error: ValueError) -> HTTPException:
    message = str(error)
    status_code = 404 if "not found" in message.lower() else 400
    return HTTPException(status_code=status_code, detail=message)


def _permission_error_to_http(error: PermissionError) -> HTTPException:
    return HTTPException(status_code=423, detail=str(error))


def _require_unlocked(request: Request, surface: str) -> None:
    try:
        _container(request).local_security_service.require_unlocked(surface)
    except PermissionError as error:
        raise _permission_error_to_http(error) from error
    except ValueError as error:
        raise _permission_error_to_http(PermissionError(str(error))) from error


def _session_token(request: Request) -> str | None:
    return request.headers.get("x-pengbo-session")


def _require_permission(request: Request, permission: str, *, surface: str) -> None:
    try:
        _container(request).auth_session_service.require_session(
            _session_token(request),
            permission,
            surface=surface,
            path=request.url.path,
        )
    except AuthSessionError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


def register_routes(app: FastAPI) -> None:
    @app.get("/api/v1/health", response_model=HealthResponse)
    def health(request: Request) -> HealthResponse:
        settings = _container(request).settings
        return HealthResponse(
            status="ok",
            message=f"FastAPI sidecar is running (mode={settings.runtime_mode}, port={settings.port})",
        )

    @app.post("/api/v1/security/session", response_model=LocalAuthSessionResponse)
    def create_local_auth_session(
        request: Request,
        payload: LocalAuthSessionRequest | None = None,
    ) -> LocalAuthSessionResponse:
        return _container(request).auth_session_service.create_session(payload)

    @app.get("/api/v1/security/session", response_model=LocalAuthSessionResponse)
    def get_local_auth_session(request: Request) -> LocalAuthSessionResponse:
        try:
            return _container(request).auth_session_service.require_session(
                _session_token(request),
                "session:read",
                surface="auth_session",
                path=request.url.path,
            )
        except AuthSessionError as error:
            raise HTTPException(status_code=error.status_code, detail=str(error)) from error

    @app.delete("/api/v1/security/session", response_model=LocalAuthSessionResponse)
    def revoke_local_auth_session(request: Request) -> LocalAuthSessionResponse:
        try:
            return _container(request).auth_session_service.revoke_session(_session_token(request))
        except AuthSessionError as error:
            raise HTTPException(status_code=error.status_code, detail=str(error)) from error

    @app.get("/api/v1/security/route-classification", response_model=list[RoutePermissionClassification])
    def get_route_permission_classification(request: Request) -> list[RoutePermissionClassification]:
        return _container(request).auth_session_service.route_classifications()

    @app.get("/api/v1/search/assets", response_model=list[AssetSearchResult])
    def search_assets(request: Request, q: str = Query("", min_length=0)) -> list[AssetSearchResult]:
        results = _container(request).watchlist_service.search_assets(q)
        return [
            AssetSearchResult.model_validate(
                {
                    "symbol": entry.symbol,
                    "name": entry.name,
                    "market": entry.market,
                    "asset_class": entry.asset_class,
                    "currency": entry.currency,
                    "provider": entry.provider,
                }
            )
            for entry in results
        ]

    @app.get("/api/v1/quotes/latest", response_model=QuoteResponse)
    def get_latest_quote(request: Request, symbol: str) -> QuoteResponse:
        entry = get_asset(symbol)
        if entry is None:
            raise HTTPException(status_code=404, detail="symbol not found")
        workspace = _container(request).asset_service.get_asset_workspace(symbol)
        return workspace.quote

    @app.get("/api/v1/prices/history", response_model=list[PricePoint])
    def get_price_history(
        request: Request,
        symbol: str,
        interval: PriceHistoryInterval = Query("1d"),
        range: str = Query("1y"),
    ) -> list[PricePoint]:
        entry = get_asset(symbol)
        if entry is None:
            raise HTTPException(status_code=404, detail="price history not found")
        try:
            _, history, _ = _container(request).asset_service.get_price_history_snapshot(
                symbol,
                interval=interval,
                range_value=range,
            )
        except ValueError as error:
            raise _value_error_to_http(error) from error
        return history

    @app.get("/api/v1/translation/status", response_model=TranslationStatusResponse)
    def get_translation_status(request: Request) -> TranslationStatusResponse:
        return _container(request).translation_service.get_status()

    @app.post("/api/v1/translation/suggest", response_model=TranslationSuggestResponse)
    def suggest_translation(request: Request, payload: TranslationSuggestRequest) -> TranslationSuggestResponse:
        return _container(request).translation_service.suggest(payload)

    @app.get("/api/v1/fundamentals/overview", response_model=FundamentalOverview | None)
    def get_fundamental_overview(request: Request, symbol: str) -> FundamentalOverview | None:
        entry = get_asset(symbol)
        if entry is None:
            raise HTTPException(status_code=404, detail="fundamental overview unavailable")
        workspace = _container(request).asset_service.get_asset_workspace(symbol)
        return workspace.overview

    @app.get("/api/v1/fundamentals/ratios", response_model=list[RatioItem])
    def get_fundamental_ratios(request: Request, symbol: str) -> list[RatioItem]:
        entry = get_asset(symbol)
        if entry is None:
            raise HTTPException(status_code=404, detail="fundamental ratios unavailable")
        workspace = _container(request).asset_service.get_asset_workspace(symbol)
        return workspace.ratios

    @app.get("/api/v1/filings/list")
    def get_filings(request: Request, symbol: str):
        entry = get_asset(symbol)
        if entry is None:
            raise HTTPException(status_code=404, detail="filings unavailable")
        workspace = _container(request).asset_service.get_asset_workspace(symbol)
        return workspace.filings

    @app.get("/api/v1/dashboard/overview", response_model=DashboardOverviewResponse)
    def get_dashboard_overview(request: Request) -> DashboardOverviewResponse:
        return _container(request).dashboard_service.get_overview()

    @app.get("/api/v1/assets/{symbol:path}/workspace")
    def get_asset_workspace(request: Request, symbol: str):
        entry = get_asset(symbol)
        if entry is None:
            raise HTTPException(status_code=404, detail="asset not found")
        return _container(request).asset_service.get_asset_workspace(symbol)

    @app.get("/api/v1/watchlist/default")
    def get_default_watchlist(request: Request):
        entries = _container(request).watchlist_service.get_default_watchlist_entries()
        return {"symbols": [entry.symbol for entry in entries]}

    @app.put("/api/v1/watchlist/default")
    def put_default_watchlist(request: Request, payload: WatchlistUpdateRequest):
        try:
            entries = _container(request).watchlist_service.set_default_watchlist_entries(payload.symbols)
        except ValueError as error:
            raise _value_error_to_http(error) from error
        return {"symbols": [entry.symbol for entry in entries]}

    @app.get("/api/v1/research/briefs/recent", response_model=list[ResearchBriefListItem])
    def get_recent_research_briefs(request: Request, limit: int = Query(20, ge=1, le=100)) -> list[ResearchBriefListItem]:
        return _container(request).research_service.list_recent_briefs(limit)

    @app.post("/api/v1/research/briefs", response_model=ResearchBrief)
    def create_research_brief(request: Request, payload: CreateResearchBriefRequest) -> ResearchBrief:
        try:
            return _container(request).research_service.create_brief(payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/research/evidence/{symbol:path}", response_model=ResearchEvidenceContext)
    def get_research_evidence(
        request: Request,
        symbol: str,
        factorRunId: str | None = None,
        backtestRunId: str | None = None,
        paperSessionId: str | None = None,
        intentId: str | None = None,
    ) -> ResearchEvidenceContext:
        try:
            return _container(request).research_service.get_evidence(
                symbol,
                factor_run_id=factorRunId,
                backtest_run_id=backtestRunId,
                paper_session_id=paperSessionId,
                intent_id=intentId,
            )
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/research/briefs/{brief_id}", response_model=ResearchBrief)
    def get_research_brief(request: Request, brief_id: str) -> ResearchBrief:
        try:
            return _container(request).research_service.get_brief(brief_id)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.post("/api/v1/research/briefs/{brief_id}/refresh", response_model=ResearchBrief)
    def refresh_research_brief(request: Request, brief_id: str) -> ResearchBrief:
        try:
            return _container(request).research_service.refresh_brief(brief_id)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.put("/api/v1/research/briefs/{brief_id}/notes", response_model=ResearchBrief)
    def update_research_brief_notes(
        request: Request,
        brief_id: str,
        payload: UpdateResearchBriefNotesRequest,
    ) -> ResearchBrief:
        try:
            return _container(request).research_service.update_notes(brief_id, payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.post("/api/v1/research/briefs/{brief_id}/export", response_model=ResearchBriefExportResponse)
    def export_research_brief(request: Request, brief_id: str) -> ResearchBriefExportResponse:
        try:
            return _container(request).research_service.export_brief(brief_id)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/factors/families", response_model=list[FactorFamilyDefinition])
    def get_factor_families(request: Request) -> list[FactorFamilyDefinition]:
        return _container(request).factor_service.list_families()

    @app.get("/api/v1/factors/runs/recent", response_model=list[FactorRunListItem])
    def get_recent_factor_runs(request: Request, limit: int = Query(20, ge=1, le=100)) -> list[FactorRunListItem]:
        return _container(request).factor_service.list_recent_runs(limit)

    @app.post("/api/v1/factors/runs", response_model=FactorRunResponse)
    def create_factor_run(request: Request, payload: FactorRunRequest) -> FactorRunResponse:
        try:
            return _container(request).factor_service.run(payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/factors/runs/{run_id}", response_model=FactorRunResponse)
    def get_factor_run(request: Request, run_id: str) -> FactorRunResponse:
        try:
            return _container(request).factor_service.get_run(run_id)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/strategies/templates", response_model=list[StrategyTemplateDefinition])
    def get_strategy_templates(request: Request) -> list[StrategyTemplateDefinition]:
        return _container(request).strategy_service.list_templates()

    @app.get("/api/v1/strategies/backtests/recent", response_model=list[StrategyBacktestListItem])
    def get_recent_strategy_backtests(
        request: Request,
        limit: int = Query(20, ge=1, le=100),
    ) -> list[StrategyBacktestListItem]:
        return _container(request).strategy_service.list_recent_backtests(limit)

    @app.post("/api/v1/strategies/backtests", response_model=StrategyBacktestResponse)
    def create_strategy_backtest(request: Request, payload: StrategyBacktestRequest) -> StrategyBacktestResponse:
        try:
            return _container(request).strategy_service.run_backtest(payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/strategies/backtests/{run_id}", response_model=StrategyBacktestResponse)
    def get_strategy_backtest(request: Request, run_id: str) -> StrategyBacktestResponse:
        try:
            return _container(request).strategy_service.get_backtest(run_id)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/strategies/paper/sessions/recent", response_model=list[StrategyPaperSessionListItem])
    def get_recent_strategy_paper_sessions(
        request: Request,
        limit: int = Query(20, ge=1, le=100),
    ) -> list[StrategyPaperSessionListItem]:
        return _container(request).strategy_service.list_recent_paper_sessions(limit)

    @app.post("/api/v1/strategies/paper/sessions", response_model=StrategyPaperSessionResponse)
    def create_strategy_paper_session(
        request: Request,
        payload: StrategyPaperSessionRequest,
    ) -> StrategyPaperSessionResponse:
        try:
            return _container(request).strategy_service.create_paper_session(payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/strategies/paper/sessions/{session_id}", response_model=StrategyPaperSessionResponse)
    def get_strategy_paper_session(request: Request, session_id: str) -> StrategyPaperSessionResponse:
        try:
            return _container(request).strategy_service.get_paper_session(session_id)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.post("/api/v1/strategies/reports/{artifact_id}/export", response_model=StrategyReportExportResponse)
    def export_strategy_report(request: Request, artifact_id: str) -> StrategyReportExportResponse:
        _require_permission(request, "reports:export", surface="strategy_lab")
        try:
            return _container(request).strategy_service.export_report(artifact_id)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/execution/binance/config", response_model=BinanceExecutionConfig)
    def get_binance_execution_config(request: Request) -> BinanceExecutionConfig:
        _require_unlocked(request, "execution_risk")
        return _container(request).execution_service.get_config()

    @app.put("/api/v1/execution/binance/config", response_model=BinanceExecutionConfig)
    def put_binance_execution_config(
        request: Request,
        payload: UpdateBinanceExecutionConfigRequest,
    ) -> BinanceExecutionConfig:
        _require_unlocked(request, "execution_risk")
        _require_permission(request, "execution:manage", surface="strategy_lab")
        try:
            return _container(request).execution_service.update_config(payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/execution/binance/intents/recent", response_model=list[BinanceExecutionIntentResponse])
    def get_recent_binance_execution_intents(
        request: Request,
        limit: int = Query(20, ge=1, le=100),
    ) -> list[BinanceExecutionIntentResponse]:
        return _container(request).execution_service.list_recent_intents(limit)

    @app.post("/api/v1/execution/binance/intents", response_model=BinanceExecutionIntentResponse)
    def create_binance_execution_intent(
        request: Request,
        payload: BinanceExecutionIntentRequest,
    ) -> BinanceExecutionIntentResponse:
        _require_unlocked(request, "execution_risk")
        _require_permission(request, "execution:manage", surface="strategy_lab")
        try:
            return _container(request).execution_service.create_intent(payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.post("/api/v1/execution/binance/intents/{intent_id}/submit", response_model=BinanceExecutionIntentResponse)
    def submit_binance_execution_intent(request: Request, intent_id: str) -> BinanceExecutionIntentResponse:
        _require_unlocked(request, "execution_risk")
        _require_permission(request, "execution:manage", surface="strategy_lab")
        try:
            return _container(request).execution_service.submit_intent(intent_id)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.post("/api/v1/execution/binance/kill-switch", response_model=BinanceExecutionConfig)
    def update_binance_execution_kill_switch(
        request: Request,
        payload: BinanceKillSwitchRequest,
    ) -> BinanceExecutionConfig:
        _require_unlocked(request, "execution_risk")
        _require_permission(request, "execution:manage", surface="strategy_lab")
        return _container(request).execution_service.set_kill_switch(payload)

    @app.get("/api/v1/execution/binance/audit", response_model=list[BinanceExecutionAuditEvent])
    def get_binance_execution_audit(
        request: Request,
        limit: int = Query(50, ge=1, le=200),
    ) -> list[BinanceExecutionAuditEvent]:
        _require_unlocked(request, "execution_risk")
        _require_permission(request, "execution:manage", surface="strategy_lab")
        return _container(request).execution_service.list_audit_events(limit)

    @app.get("/api/v1/security/audit", response_model=list[SecurityAuditEvent])
    def get_security_audit(
        request: Request,
        limit: int = Query(100, ge=1, le=500),
        category: str | None = None,
    ) -> list[SecurityAuditEvent]:
        _require_unlocked(request, "security_audit")
        _require_permission(request, "security:audit:read", surface="security_audit")
        return _container(request).security_audit_service.list_events(limit=limit, category=category)

    @app.get("/api/v1/security/local/status", response_model=LocalSecurityStatus)
    def get_local_security_status(request: Request) -> LocalSecurityStatus:
        return _container(request).local_security_service.get_status()

    @app.post("/api/v1/security/local/initialize", response_model=LocalSecurityStatus)
    def initialize_local_security(
        request: Request,
        payload: LocalSecurityInitializeRequest,
    ) -> LocalSecurityStatus:
        try:
            return _container(request).local_security_service.initialize(payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.post("/api/v1/security/local/unlock", response_model=LocalSecurityStatus)
    def unlock_local_security(
        request: Request,
        payload: LocalSecurityUnlockRequest,
    ) -> LocalSecurityStatus:
        try:
            return _container(request).local_security_service.unlock(payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.post("/api/v1/security/local/lock", response_model=LocalSecurityStatus)
    def lock_local_security(request: Request) -> LocalSecurityStatus:
        try:
            return _container(request).local_security_service.lock()
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.post("/api/v1/security/local/idle-timeout", response_model=LocalSecurityStatus)
    def idle_timeout_local_security(request: Request) -> LocalSecurityStatus:
        try:
            return _container(request).local_security_service.lock(reason="idle_timeout")
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.post("/api/v1/security/local/touch", response_model=LocalSecurityStatus)
    def touch_local_security(
        request: Request,
        payload: LocalSecurityTouchRequest,
    ) -> LocalSecurityStatus:
        try:
            return _container(request).local_security_service.touch(payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/workflows/templates", response_model=list[WorkflowTemplateDefinition])
    def get_workflow_templates(request: Request) -> list[WorkflowTemplateDefinition]:
        return _container(request).workflow_service.list_templates()

    @app.get("/api/v1/workflows/runs/recent", response_model=list[WorkflowRunResponse])
    def get_recent_workflow_runs(
        request: Request,
        limit: int = Query(20, ge=1, le=100),
    ) -> list[WorkflowRunResponse]:
        return _container(request).workflow_service.list_recent_runs(limit)

    @app.post("/api/v1/workflows/runs", response_model=WorkflowRunResponse)
    def create_workflow_run(request: Request, payload: WorkflowRunRequest) -> WorkflowRunResponse:
        try:
            return _container(request).workflow_service.run(payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/workflows/runs/{run_id}", response_model=WorkflowRunResponse)
    def get_workflow_run(request: Request, run_id: str) -> WorkflowRunResponse:
        try:
            return _container(request).workflow_service.get_run(run_id)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/settings/runtime", response_model=SettingsRuntimeResponse)
    def get_settings_runtime(request: Request) -> SettingsRuntimeResponse:
        return _container(request).settings_service.get_runtime()

    @app.get("/api/v1/settings/preferences", response_model=AppPreferences)
    def get_settings_preferences(request: Request) -> AppPreferences:
        return _container(request).settings_service.get_preferences()

    @app.put("/api/v1/settings/preferences", response_model=AppPreferences)
    def put_settings_preferences(request: Request, payload: UpdateAppPreferencesRequest) -> AppPreferences:
        return _container(request).settings_service.update_preferences(payload)

    @app.get("/api/v1/settings/onboarding", response_model=OnboardingState)
    def get_settings_onboarding(request: Request) -> OnboardingState:
        return _container(request).settings_service.get_onboarding()

    @app.put("/api/v1/settings/onboarding", response_model=OnboardingState)
    def put_settings_onboarding(request: Request, payload: UpdateOnboardingStateRequest) -> OnboardingState:
        return _container(request).settings_service.update_onboarding(payload)

    @app.get("/api/v1/connections/status", response_model=ConnectionsStatusResponse)
    def get_connections_status(request: Request) -> ConnectionsStatusResponse:
        return _container(request).connections_service.get_status()

    @app.get("/api/v1/connections/catalog", response_model=ConnectionsCatalogResponse)
    def get_connections_catalog(request: Request) -> ConnectionsCatalogResponse:
        return _container(request).connections_service.get_catalog()

    @app.get("/api/v1/connections/profiles", response_model=list[CredentialProfile])
    def get_connection_profiles(request: Request) -> list[CredentialProfile]:
        _require_unlocked(request, "provider_credentials")
        return _container(request).connections_service.list_profiles()

    @app.post("/api/v1/connections/profiles", response_model=CredentialProfile)
    def create_connection_profile(request: Request, payload: CreateCredentialProfileRequest) -> CredentialProfile:
        _require_unlocked(request, "provider_credentials")
        return _container(request).connections_service.create_profile(payload)

    @app.put("/api/v1/connections/profiles/active", response_model=CredentialProfile)
    def set_active_connection_profile(request: Request, payload: SetActiveCredentialProfileRequest) -> CredentialProfile:
        _require_unlocked(request, "provider_credentials")
        try:
            return _container(request).connections_service.set_active_profile(payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.post("/api/v1/connections/test", response_model=ConnectionCheckResponse)
    def test_connection(request: Request, payload: ConnectionCheckRequest) -> ConnectionCheckResponse:
        if payload.provider.lower() in {"binance", "edgar", "fred", "coingecko"}:
            _require_unlocked(request, "provider_credentials")
        return _container(request).connections_service.test_connection(payload.provider)

    @app.get("/api/v1/data-sources/status", response_model=DataSourceStatusResponse)
    def get_data_source_status(request: Request) -> DataSourceStatusResponse:
        return _container(request).data_source_service.list_status()

    @app.get("/api/v1/data-sources/sources/{provider}/status", response_model=DataSourceRuntimeStatus)
    def get_data_source_provider_status(request: Request, provider: str) -> DataSourceRuntimeStatus:
        return _container(request).data_source_service.get_provider_status(provider)

    @app.get("/api/v1/data-sources/macro/series", response_model=MacroSeriesResponse)
    def get_data_source_macro_series(
        request: Request,
        provider: str = "worldbank",
        seriesId: str = "NY.GDP.MKTP.CD",
        country: str = "CN",
        limit: int = Query(20, ge=1, le=100),
    ) -> MacroSeriesResponse:
        try:
            return _container(request).data_source_service.get_macro_series(
                provider=provider,
                series_id=seriesId,
                country=country,
                limit=limit,
            )
        except ValueError as error:
            raise _value_error_to_http(error) from error
        except Exception as error:
            raise HTTPException(status_code=503, detail=str(error)) from error

    @app.get("/api/v1/data-sources/crypto/markets", response_model=CryptoMarketsResponse)
    def get_data_source_crypto_markets(
        request: Request,
        ids: str = "bitcoin,ethereum",
        limit: int = Query(10, ge=1, le=50),
    ) -> CryptoMarketsResponse:
        try:
            return _container(request).data_source_service.get_crypto_markets(ids=ids, limit=limit)
        except ValueError as error:
            raise _value_error_to_http(error) from error
        except Exception as error:
            raise HTTPException(status_code=503, detail=str(error)) from error

    @app.get("/api/v1/data-sources/news/events", response_model=NewsEventsResponse)
    def get_data_source_news_events(
        request: Request,
        query: str = "market",
        limit: int = Query(20, ge=1, le=50),
    ) -> NewsEventsResponse:
        try:
            return _container(request).data_source_service.get_news_events(query=query, limit=limit)
        except ValueError as error:
            raise _value_error_to_http(error) from error
        except Exception as error:
            raise HTTPException(status_code=503, detail=str(error)) from error

    @app.post("/api/v1/data-sources/reports/export", response_model=DataSourceReportExportResponse)
    def export_data_source_report(
        request: Request,
        payload: DataSourceReportExportRequest,
    ) -> DataSourceReportExportResponse:
        _require_permission(request, "reports:export", surface="data_sources")
        return _container(request).data_source_service.export_report(payload)

    @app.delete("/api/v1/connections/{provider}/profile")
    def clear_connection_profile(request: Request, provider: str):
        _require_unlocked(request, "provider_credentials")
        _require_permission(request, "credentials:manage", surface="connections")
        try:
            _container(request).connections_service.clear_connection_profile(provider)
        except ValueError as error:
            raise _value_error_to_http(error) from error
        return {"ok": True}

    @app.post("/api/v1/connections/binance/test", response_model=ConnectionCheckResponse)
    def test_binance_connection(request: Request) -> ConnectionCheckResponse:
        _require_unlocked(request, "provider_credentials")
        return _container(request).connections_service.test_binance_connection()

    @app.get("/api/v1/connections/binance/account")
    def get_binance_account(request: Request):
        _require_unlocked(request, "provider_credentials")
        _require_permission(request, "account:read", surface="connections")
        try:
            return _container(request).connections_service.get_binance_account()
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/portfolio/summary", response_model=PortfolioSummaryResponse)
    def get_portfolio_summary(request: Request) -> PortfolioSummaryResponse:
        return _container(request).portfolio_service.get_summary()

    @app.get("/api/v1/portfolio/holdings", response_model=list[PortfolioHolding])
    def get_portfolio_holdings(request: Request) -> list[PortfolioHolding]:
        return _container(request).portfolio_service.get_holdings()

    @app.get("/api/v1/portfolio/transactions", response_model=list[PortfolioTransaction])
    def get_portfolio_transactions(request: Request) -> list[PortfolioTransaction]:
        return _container(request).portfolio_service.get_transactions()

    @app.post("/api/v1/portfolio/transactions", response_model=PortfolioTransaction)
    def add_portfolio_transaction(request: Request, payload: PortfolioTransactionCreate) -> PortfolioTransaction:
        try:
            return _container(request).portfolio_service.create_transaction(payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.put("/api/v1/portfolio/transactions/{transaction_id}", response_model=PortfolioTransaction)
    def update_portfolio_transaction(
        request: Request,
        transaction_id: int,
        payload: PortfolioTransactionUpdate,
    ) -> PortfolioTransaction:
        try:
            return _container(request).portfolio_service.update_transaction(transaction_id, payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.delete("/api/v1/portfolio/transactions/{transaction_id}")
    def delete_portfolio_transaction(request: Request, transaction_id: int):
        try:
            _container(request).portfolio_service.delete_transaction(transaction_id)
        except ValueError as error:
            raise _value_error_to_http(error) from error
        return {"ok": True}

    @app.get("/api/v1/screeners/presets", response_model=list[ScreenerPreset])
    def get_screener_presets(request: Request) -> list[ScreenerPreset]:
        return _container(request).screener_service.get_presets()

    @app.put("/api/v1/screeners/presets/{preset_key}", response_model=ScreenerPreset)
    def update_screener_preset(
        request: Request,
        preset_key: str,
        payload: UpdateScreenerPresetRequest,
    ) -> ScreenerPreset:
        try:
            return _container(request).screener_service.update_preset(preset_key, payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.get("/api/v1/screeners/presets/{preset_key}/variants", response_model=list[ScreenerPresetVariant])
    def get_screener_preset_variants(request: Request, preset_key: str) -> list[ScreenerPresetVariant]:
        try:
            return _container(request).screener_service.get_variants(preset_key)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.post("/api/v1/screeners/presets/{preset_key}/variants", response_model=ScreenerPresetVariant)
    def create_screener_preset_variant(
        request: Request,
        preset_key: str,
        payload: CreateScreenerPresetVariantRequest,
    ) -> ScreenerPresetVariant:
        try:
            return _container(request).screener_service.create_variant(preset_key, payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.put("/api/v1/screeners/presets/{preset_key}/variants/{variant_key}", response_model=ScreenerPresetVariant)
    def update_screener_preset_variant(
        request: Request,
        preset_key: str,
        variant_key: str,
        payload: UpdateScreenerPresetVariantRequest,
    ) -> ScreenerPresetVariant:
        try:
            return _container(request).screener_service.update_variant(preset_key, variant_key, payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.post(
        "/api/v1/screeners/presets/{preset_key}/variants/{variant_key}/activate",
        response_model=ScreenerPresetVariant,
    )
    def activate_screener_preset_variant(
        request: Request,
        preset_key: str,
        variant_key: str,
    ) -> ScreenerPresetVariant:
        try:
            return _container(request).screener_service.activate_variant(preset_key, variant_key)
        except ValueError as error:
            raise _value_error_to_http(error) from error

    @app.delete("/api/v1/screeners/presets/{preset_key}/variants/{variant_key}")
    def delete_screener_preset_variant(request: Request, preset_key: str, variant_key: str):
        try:
            _container(request).screener_service.delete_variant(preset_key, variant_key)
        except ValueError as error:
            raise _value_error_to_http(error) from error
        return {"ok": True}

    @app.post("/api/v1/screeners/run", response_model=ScreenerRunResponse)
    def run_screener(request: Request, payload: ScreenerRunRequest) -> ScreenerRunResponse:
        try:
            return _container(request).screener_service.run(payload)
        except ValueError as error:
            raise _value_error_to_http(error) from error
