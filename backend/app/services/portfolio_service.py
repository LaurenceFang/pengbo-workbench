from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from math import sqrt
from queue import Queue
from threading import Thread
from typing import Any

from ..data_seed import AssetCatalogEntry
from ..models import (
    PortfolioAllocationBucket,
    PortfolioAnalytics,
    PortfolioAnalyticsWindow,
    PortfolioDataStatus,
    PortfolioHolding,
    PortfolioPnlBreakdown,
    PortfolioSummaryResponse,
    PortfolioTransaction,
    PortfolioTransactionCreate,
    PortfolioTransactionUpdate,
    PortfolioValuePoint,
)
from ..providers.catalog import get_asset
from ..storage.sqlite_store import SqliteStore
from .asset_service import AssetService


@dataclass
class PositionState:
    quantity: float = 0.0
    cost_basis: float = 0.0


@dataclass
class QuoteSnapshot:
    entry: AssetCatalogEntry
    quote: dict[str, Any] | None
    status: PortfolioDataStatus
    notes: list[str]


@dataclass
class HistorySnapshot:
    entry: AssetCatalogEntry
    prices: dict[date, float]
    status: PortfolioDataStatus
    notes: list[str]


@dataclass
class PerformanceBuildResult:
    performance: list[PortfolioValuePoint]
    benchmarks: dict[str, list[PortfolioValuePoint]]
    benchmark_status: dict[str, PortfolioDataStatus]
    missing_symbols: set[str]
    notes: list[str]
    stale: bool


@dataclass
class PnlBuildResult:
    realized_pnl: float
    notes: list[str]


def _parse_traded_at(value: str) -> date:
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(normalized).astimezone(UTC).date()
    except ValueError:
        return date.fromisoformat(normalized)


def _status_from_stale(stale: bool) -> PortfolioDataStatus:
    return "cached" if stale else "live"


def _add_unique_note(notes: list[str], message: str) -> None:
    if message not in notes:
        notes.append(message)


def _pct_change(start_value: float, end_value: float) -> float | None:
    if abs(start_value) < 1e-8:
        return None
    return ((end_value - start_value) / abs(start_value)) * 100


class PortfolioService:
    benchmark_symbols = ("SPY", "BTC/USDT")
    request_timeout_seconds = 4.0

    def __init__(self, sqlite_store: SqliteStore, asset_service: AssetService) -> None:
        self.sqlite_store = sqlite_store
        self.asset_service = asset_service

    def _get_entry(self, symbol: str) -> AssetCatalogEntry:
        entry = get_asset(symbol)
        if entry is None:
            raise ValueError(f"Unsupported asset symbol: {symbol}")
        return entry

    def _validate_symbol(self, symbol: str) -> None:
        self._get_entry(symbol)

    def _decorate_transaction(self, raw: dict[str, Any]) -> PortfolioTransaction:
        entry = self._get_entry(raw["symbol"])
        return PortfolioTransaction.model_validate(
            {
                **raw,
                "name": entry.name,
                "market": entry.market,
                "asset_class": entry.asset_class,
                "currency": entry.currency,
            }
        )

    def _run_with_timeout(self, loader, *args):
        result_queue: Queue[tuple[str, Any]] = Queue(maxsize=1)

        def target() -> None:
            try:
                result_queue.put(("ok", loader(*args)))
            except Exception as error:  # pragma: no cover - exercised through callers
                result_queue.put(("error", error))

        thread = Thread(target=target, daemon=True)
        thread.start()
        thread.join(self.request_timeout_seconds)
        if thread.is_alive():
            raise TimeoutError(f"portfolio request timed out after {self.request_timeout_seconds:.1f}s")

        status, payload = result_queue.get_nowait()
        if status == "error":
            raise payload
        return payload

    def _load_quote_snapshot(self, symbol: str) -> QuoteSnapshot:
        entry = self._get_entry(symbol)
        try:
            _, quote, stale = self._run_with_timeout(self.asset_service.get_quote_snapshot, symbol)
        except Exception:
            cached = self.asset_service.duck_store.get_latest_quote_snapshot(symbol)
            if cached is not None:
                return QuoteSnapshot(
                    entry=entry,
                    quote=cached,
                    status="cached",
                    notes=["Quote served from cache after the live request failed or timed out."],
                )
            return QuoteSnapshot(
                entry=entry,
                quote=None,
                status="unavailable",
                notes=["Live quote unavailable or timed out and no cached quote is available."],
            )

        return QuoteSnapshot(
            entry=entry,
            quote=quote,
            status=_status_from_stale(stale),
            notes=["Quote served from cache."] if stale else [],
        )

    def _load_history_snapshot(self, symbol: str, current_price: float | None) -> HistorySnapshot:
        entry = self._get_entry(symbol)
        try:
            _, history, stale = self._run_with_timeout(self.asset_service.get_price_history_snapshot, symbol)
        except Exception:
            cached = self.asset_service.duck_store.get_latest_price_history(symbol, "1d")
            if cached is not None:
                prices = {_parse_traded_at(point["timestamp"]): float(point["close"]) for point in cached}
                if prices and current_price is not None:
                    latest_date = max(prices)
                    today = datetime.now(UTC).date()
                    if today > latest_date:
                        prices[today] = current_price
                return HistorySnapshot(
                    entry=entry,
                    prices=prices,
                    status="cached",
                    notes=["Price history served from cache after the live request failed or timed out."],
                )
            return HistorySnapshot(
                entry=entry,
                prices={},
                status="unavailable",
                notes=["Price history unavailable or timed out and no cached history is available."],
            )

        prices = {_parse_traded_at(point["timestamp"]): float(point["close"]) for point in history}
        if prices and current_price is not None:
            latest_date = max(prices)
            today = datetime.now(UTC).date()
            if today > latest_date:
                prices[today] = current_price

        return HistorySnapshot(
            entry=entry,
            prices=prices,
            status=_status_from_stale(stale),
            notes=["Price history served from cache."] if stale else [],
        )

    def get_transactions(self) -> list[PortfolioTransaction]:
        return [self._decorate_transaction(raw) for raw in self.sqlite_store.list_portfolio_transactions()]

    def create_transaction(self, payload: PortfolioTransactionCreate) -> PortfolioTransaction:
        self._validate_symbol(payload.symbol)
        row = self.sqlite_store.create_portfolio_transaction(payload.model_dump())
        return self._decorate_transaction(row)

    def update_transaction(self, transaction_id: int, payload: PortfolioTransactionUpdate) -> PortfolioTransaction:
        self._validate_symbol(payload.symbol)
        row = self.sqlite_store.update_portfolio_transaction(transaction_id, payload.model_dump())
        if row is None:
            raise ValueError(f"Portfolio transaction not found: {transaction_id}")
        return self._decorate_transaction(row)

    def delete_transaction(self, transaction_id: int) -> None:
        deleted = self.sqlite_store.delete_portfolio_transaction(transaction_id)
        if not deleted:
            raise ValueError(f"Portfolio transaction not found: {transaction_id}")

    def _current_positions(self, transactions: list[PortfolioTransaction]) -> dict[str, PositionState]:
        positions: dict[str, PositionState] = defaultdict(PositionState)
        ordered = sorted(transactions, key=lambda item: (_parse_traded_at(item.traded_at), item.id))
        for tx in ordered:
            position = positions[tx.symbol]
            if tx.side == "buy":
                position.quantity += tx.quantity
                position.cost_basis += tx.quantity * tx.price + tx.fees
                continue

            if position.quantity <= 0:
                position.quantity -= tx.quantity
                position.cost_basis = 0.0
                continue

            average_cost = position.cost_basis / position.quantity if position.quantity else 0.0
            position.quantity -= tx.quantity
            position.cost_basis = max(0.0, position.cost_basis - (average_cost * tx.quantity))
            if position.quantity <= 0:
                position.quantity = 0.0
                position.cost_basis = 0.0
        return positions

    def get_holdings(self) -> list[PortfolioHolding]:
        transactions = self.get_transactions()
        positions = self._current_positions(transactions)
        if not positions:
            return []

        raw_holdings: list[dict[str, Any]] = []
        total_value = 0.0
        for symbol, position in positions.items():
            if abs(position.quantity) < 1e-8:
                continue

            quote_snapshot = self._load_quote_snapshot(symbol)
            current_price: float | None = None
            market_value: float | None = None
            pnl: float | None = None
            pnl_pct: float | None = None
            day_change_pct: float | None = None
            notes = list(quote_snapshot.notes)

            if quote_snapshot.quote is None:
                _add_unique_note(
                    notes,
                    "Valuation unavailable because neither a live quote nor a cached quote is available.",
                )
            else:
                current_price = float(quote_snapshot.quote["price"])
                market_value = position.quantity * current_price
                pnl = market_value - position.cost_basis
                pnl_pct = 0.0 if position.cost_basis == 0 else (pnl / position.cost_basis) * 100
                day_change_pct = float(quote_snapshot.quote["change_pct"])
                total_value += market_value

            raw_holdings.append(
                {
                    "symbol": quote_snapshot.entry.symbol,
                    "name": quote_snapshot.entry.name,
                    "market": quote_snapshot.entry.market,
                    "asset_class": quote_snapshot.entry.asset_class,
                    "currency": quote_snapshot.entry.currency,
                    "quantity": position.quantity,
                    "average_cost": 0.0 if position.quantity == 0 else position.cost_basis / position.quantity,
                    "valuation_status": quote_snapshot.status,
                    "current_price": current_price,
                    "market_value": market_value,
                    "cost_basis": position.cost_basis,
                    "pnl": pnl,
                    "pnl_pct": pnl_pct,
                    "allocation": None,
                    "day_change_pct": day_change_pct,
                    "stale": quote_snapshot.status == "cached",
                    "notes": notes,
                }
            )

        enriched_holdings = [
            PortfolioHolding.model_validate(
                {
                    **item,
                    "allocation": (
                        None
                        if item["market_value"] is None or total_value == 0
                        else (item["market_value"] / total_value) * 100
                    ),
                }
            )
            for item in sorted(
                raw_holdings,
                key=lambda item: (
                    item["market_value"] is None,
                    -(item["market_value"] or 0.0),
                    item["symbol"],
                ),
            )
        ]
        return enriched_holdings

    def _build_performance(self, transactions: list[PortfolioTransaction]) -> PerformanceBuildResult:
        benchmark_curves = {symbol: [] for symbol in self.benchmark_symbols}
        benchmark_status = {symbol: "live" for symbol in self.benchmark_symbols}
        if not transactions:
            return PerformanceBuildResult(
                performance=[],
                benchmarks=benchmark_curves,
                benchmark_status=benchmark_status,
                missing_symbols=set(),
                notes=[],
                stale=False,
            )

        ordered_transactions = sorted(transactions, key=lambda item: (_parse_traded_at(item.traded_at), item.id))
        first_trade = _parse_traded_at(ordered_transactions[0].traded_at)
        price_history: dict[str, dict[date, float]] = {}
        missing_symbols: set[str] = set()
        notes: list[str] = []
        stale = False

        for symbol in sorted({tx.symbol for tx in transactions}):
            quote_snapshot = self._load_quote_snapshot(symbol)
            current_price = None if quote_snapshot.quote is None else float(quote_snapshot.quote["price"])
            history_snapshot = self._load_history_snapshot(symbol, current_price)
            if quote_snapshot.status == "cached" or history_snapshot.status == "cached":
                stale = True

            if history_snapshot.status == "unavailable" or not history_snapshot.prices:
                missing_symbols.add(symbol)
                _add_unique_note(
                    notes,
                    f"{symbol} is excluded from the portfolio curve because no usable price history is available.",
                )
                continue

            price_history[symbol] = history_snapshot.prices

        for benchmark_symbol in self.benchmark_symbols:
            quote_snapshot = self._load_quote_snapshot(benchmark_symbol)
            current_price = None if quote_snapshot.quote is None else float(quote_snapshot.quote["price"])
            history_snapshot = self._load_history_snapshot(benchmark_symbol, current_price)
            if history_snapshot.status == "unavailable" or not history_snapshot.prices:
                benchmark_status[benchmark_symbol] = "unavailable"
                _add_unique_note(notes, f"{benchmark_symbol} benchmark is currently unavailable.")
                continue

            benchmark_status[benchmark_symbol] = (
                "cached"
                if quote_snapshot.status == "cached" or history_snapshot.status == "cached"
                else "live"
            )
            if benchmark_status[benchmark_symbol] == "cached":
                stale = True
            price_history[benchmark_symbol] = history_snapshot.prices

        portfolio_symbols = {tx.symbol for tx in transactions if tx.symbol in price_history}
        if not portfolio_symbols:
            _add_unique_note(
                notes,
                "Portfolio performance is unavailable because none of the traded symbols have usable price history.",
            )
            return PerformanceBuildResult(
                performance=[],
                benchmarks=benchmark_curves,
                benchmark_status=benchmark_status,
                missing_symbols=missing_symbols,
                notes=notes,
                stale=stale,
            )

        timeline = sorted(
            {
                point_date
                for symbol, symbol_history in price_history.items()
                if symbol in portfolio_symbols or symbol in self.benchmark_symbols
                for point_date in symbol_history
                if point_date >= first_trade
            }
        )
        if not timeline:
            _add_unique_note(notes, "Portfolio performance is unavailable because no timeline points could be built.")
            return PerformanceBuildResult(
                performance=[],
                benchmarks=benchmark_curves,
                benchmark_status=benchmark_status,
                missing_symbols=missing_symbols,
                notes=notes,
                stale=stale,
            )

        last_seen: dict[str, float | None] = {symbol: None for symbol in price_history}
        quantities: dict[str, float] = defaultdict(float)
        benchmark_quantities = {symbol: 0.0 for symbol in self.benchmark_symbols}
        tx_index = 0
        performance: list[PortfolioValuePoint] = []

        for point_date in timeline:
            for symbol, symbol_history in price_history.items():
                if point_date in symbol_history:
                    last_seen[symbol] = symbol_history[point_date]

            while tx_index < len(ordered_transactions) and _parse_traded_at(ordered_transactions[tx_index].traded_at) <= point_date:
                tx = ordered_transactions[tx_index]
                sign = 1.0 if tx.side == "buy" else -1.0
                quantities[tx.symbol] += sign * tx.quantity
                cash_flow = (tx.quantity * tx.price + tx.fees) if tx.side == "buy" else -(tx.quantity * tx.price - tx.fees)
                for benchmark_symbol in self.benchmark_symbols:
                    benchmark_price = last_seen.get(benchmark_symbol)
                    if benchmark_status[benchmark_symbol] != "unavailable" and benchmark_price:
                        benchmark_quantities[benchmark_symbol] += cash_flow / benchmark_price
                tx_index += 1

            portfolio_value = 0.0
            for symbol, quantity in quantities.items():
                if symbol not in portfolio_symbols:
                    continue
                price = last_seen.get(symbol)
                if price is not None:
                    portfolio_value += quantity * price

            performance.append(PortfolioValuePoint(date=point_date.isoformat(), value=portfolio_value))
            for benchmark_symbol in self.benchmark_symbols:
                if benchmark_status[benchmark_symbol] == "unavailable":
                    continue
                benchmark_price = last_seen.get(benchmark_symbol)
                benchmark_value = (
                    0.0 if benchmark_price is None else benchmark_quantities[benchmark_symbol] * benchmark_price
                )
                benchmark_curves[benchmark_symbol].append(
                    PortfolioValuePoint(date=point_date.isoformat(), value=benchmark_value)
                )

        return PerformanceBuildResult(
            performance=performance,
            benchmarks=benchmark_curves,
            benchmark_status=benchmark_status,
            missing_symbols=missing_symbols,
            notes=notes,
            stale=stale,
        )

    def _build_realized_pnl(self, transactions: list[PortfolioTransaction]) -> PnlBuildResult:
        positions: dict[str, PositionState] = defaultdict(PositionState)
        ordered = sorted(transactions, key=lambda item: (_parse_traded_at(item.traded_at), item.id))
        realized_pnl = 0.0
        notes: list[str] = []

        for tx in ordered:
            position = positions[tx.symbol]
            if tx.side == "buy":
                position.quantity += tx.quantity
                position.cost_basis += tx.quantity * tx.price + tx.fees
                continue

            if position.quantity <= 0:
                _add_unique_note(
                    notes,
                    f"{tx.symbol} sell transaction was recorded without an open average-cost lot.",
                )
                continue

            closed_quantity = min(tx.quantity, position.quantity)
            average_cost = position.cost_basis / position.quantity if position.quantity else 0.0
            proceeds = closed_quantity * tx.price - tx.fees
            realized_pnl += proceeds - (average_cost * closed_quantity)
            position.quantity -= closed_quantity
            position.cost_basis = max(0.0, position.cost_basis - (average_cost * closed_quantity))
            if tx.quantity > closed_quantity:
                _add_unique_note(
                    notes,
                    f"{tx.symbol} sell quantity exceeded the open position; only the open quantity is counted.",
                )
            if position.quantity <= 0:
                position.quantity = 0.0
                position.cost_basis = 0.0

        return PnlBuildResult(realized_pnl=realized_pnl, notes=notes)

    def _window_start_dates(self, end_date: date) -> list[tuple[str, str, date]]:
        return [
            ("today", "Today", end_date),
            ("mtd", "MTD", end_date.replace(day=1)),
            ("ytd", "YTD", end_date.replace(month=1, day=1)),
            ("one_year", "1Y", end_date - timedelta(days=365)),
            ("max", "Max", date.min),
        ]

    def _slice_curve(
        self,
        points: list[PortfolioValuePoint],
        start_date: date,
        end_date: date,
    ) -> list[PortfolioValuePoint]:
        return [
            point
            for point in points
            if start_date <= date.fromisoformat(point.date) <= end_date
        ]

    def _daily_returns(self, points: list[PortfolioValuePoint]) -> list[float]:
        returns: list[float] = []
        for previous, current in zip(points, points[1:], strict=False):
            if abs(previous.value) < 1e-8:
                continue
            returns.append((current.value - previous.value) / abs(previous.value))
        return returns

    def _max_drawdown_pct(self, points: list[PortfolioValuePoint]) -> float | None:
        peak: float | None = None
        max_drawdown = 0.0
        for point in points:
            if peak is None or point.value > peak:
                peak = point.value
            if peak is None or abs(peak) < 1e-8:
                continue
            drawdown = ((point.value - peak) / abs(peak)) * 100
            max_drawdown = min(max_drawdown, drawdown)
        return max_drawdown if peak is not None else None

    def _build_analytics_windows(
        self,
        performance_result: PerformanceBuildResult,
    ) -> list[PortfolioAnalyticsWindow]:
        performance = performance_result.performance
        if not performance:
            return [
                PortfolioAnalyticsWindow(
                    key=key,
                    label=label,
                    status="unavailable",
                    notes=["Portfolio performance history is unavailable for this window."],
                )
                for key, label, _ in self._window_start_dates(datetime.now(UTC).date())
            ]

        end_date = date.fromisoformat(performance[-1].date)
        benchmark_symbol = next(
            (
                symbol
                for symbol in self.benchmark_symbols
                if performance_result.benchmark_status.get(symbol) != "unavailable"
                and len(performance_result.benchmarks.get(symbol, [])) >= 2
            ),
            None,
        )
        windows: list[PortfolioAnalyticsWindow] = []

        for key, label, start_date in self._window_start_dates(end_date):
            window_points = self._slice_curve(performance, start_date, end_date)
            status: PortfolioDataStatus = "cached" if performance_result.stale else "live"
            notes: list[str] = []
            if len(window_points) < 2:
                status = "unavailable"
                _add_unique_note(notes, "At least two priced points are needed for this window.")

            total_return_pct: float | None = None
            max_drawdown_pct: float | None = None
            volatility_pct: float | None = None
            sharpe_style: float | None = None
            benchmark_return_pct: float | None = None
            benchmark_relative_return_pct: float | None = None

            if len(window_points) >= 2:
                total_return_pct = _pct_change(window_points[0].value, window_points[-1].value)
                max_drawdown_pct = self._max_drawdown_pct(window_points)
                returns = self._daily_returns(window_points)
                if len(returns) >= 2:
                    mean_return = sum(returns) / len(returns)
                    variance = sum((item - mean_return) ** 2 for item in returns) / (len(returns) - 1)
                    volatility = sqrt(variance)
                    volatility_pct = volatility * sqrt(252) * 100
                    sharpe_style = None if volatility == 0 else (mean_return / volatility) * sqrt(252)
                elif len(returns) == 1:
                    volatility_pct = 0.0

                if benchmark_symbol is not None:
                    benchmark_points = self._slice_curve(
                        performance_result.benchmarks.get(benchmark_symbol, []),
                        start_date,
                        end_date,
                    )
                    if len(benchmark_points) >= 2:
                        benchmark_return_pct = _pct_change(
                            benchmark_points[0].value,
                            benchmark_points[-1].value,
                        )
                        if total_return_pct is not None and benchmark_return_pct is not None:
                            benchmark_relative_return_pct = total_return_pct - benchmark_return_pct
                    else:
                        _add_unique_note(notes, f"{benchmark_symbol} benchmark has too few points for this window.")

            windows.append(
                PortfolioAnalyticsWindow(
                    key=key,
                    label=label,
                    status=status,
                    start_date=window_points[0].date if window_points else None,
                    end_date=window_points[-1].date if window_points else None,
                    start_value=window_points[0].value if window_points else None,
                    end_value=window_points[-1].value if window_points else None,
                    total_return_pct=total_return_pct,
                    max_drawdown_pct=max_drawdown_pct,
                    volatility_pct=volatility_pct,
                    sharpe_style=sharpe_style,
                    benchmark_symbol=benchmark_symbol,
                    benchmark_return_pct=benchmark_return_pct,
                    benchmark_relative_return_pct=benchmark_relative_return_pct,
                    notes=notes,
                )
            )

        return windows

    def _build_allocation(
        self,
        holdings: list[PortfolioHolding],
    ) -> dict[str, list[PortfolioAllocationBucket]]:
        valued_holdings = [holding for holding in holdings if holding.market_value is not None]
        total_value = sum(holding.market_value or 0.0 for holding in valued_holdings)

        def make_bucket(key: str, label: str, value: float, status: PortfolioDataStatus) -> PortfolioAllocationBucket:
            return PortfolioAllocationBucket(
                key=key,
                label=label,
                value=value,
                allocation=0.0 if total_value == 0 else (value / total_value) * 100,
                status=status,
            )

        allocation: dict[str, list[PortfolioAllocationBucket]] = {
            "asset": [],
            "asset_class": [],
            "currency": [],
            "market": [],
            "sector": [],
        }
        if total_value == 0:
            return allocation

        allocation["asset"] = [
            make_bucket(holding.symbol, holding.symbol, holding.market_value or 0.0, holding.valuation_status)
            for holding in valued_holdings
        ]

        grouped_values: dict[str, dict[str, float]] = {
            "asset_class": defaultdict(float),
            "currency": defaultdict(float),
            "market": defaultdict(float),
            "sector": defaultdict(float),
        }
        grouped_statuses: dict[str, dict[str, set[PortfolioDataStatus]]] = {
            key: defaultdict(set) for key in grouped_values
        }

        for holding in valued_holdings:
            value = holding.market_value or 0.0
            sector = self._get_entry(holding.symbol).sector or "Unknown"
            group_map = {
                "asset_class": holding.asset_class,
                "currency": holding.currency,
                "market": holding.market,
                "sector": sector,
            }
            for group_key, bucket_key in group_map.items():
                grouped_values[group_key][bucket_key] += value
                grouped_statuses[group_key][bucket_key].add(holding.valuation_status)

        for group_key, buckets in grouped_values.items():
            allocation[group_key] = [
                make_bucket(
                    key=bucket_key,
                    label=bucket_key,
                    value=value,
                    status="cached" if "cached" in grouped_statuses[group_key][bucket_key] else "live",
                )
                for bucket_key, value in buckets.items()
            ]

        for bucket_list in allocation.values():
            bucket_list.sort(key=lambda item: (-item.value, item.label))

        return allocation

    def _build_analytics(
        self,
        transactions: list[PortfolioTransaction],
        holdings: list[PortfolioHolding],
        performance_result: PerformanceBuildResult,
    ) -> PortfolioAnalytics:
        realized = self._build_realized_pnl(transactions)
        unrealized_pnl = sum(holding.pnl or 0.0 for holding in holdings if holding.pnl is not None)
        allocation = self._build_allocation(holdings)
        concentration_pct = None
        if allocation["asset"]:
            concentration_pct = max(bucket.allocation for bucket in allocation["asset"])

        notes = list(realized.notes)
        if any(holding.valuation_status == "unavailable" for holding in holdings):
            _add_unique_note(notes, "Unrealized PnL excludes holdings without usable valuation.")

        return PortfolioAnalytics(
            windows=self._build_analytics_windows(performance_result),
            pnl=PortfolioPnlBreakdown(
                realized_pnl=realized.realized_pnl,
                unrealized_pnl=unrealized_pnl,
                total_pnl=realized.realized_pnl + unrealized_pnl,
                method="average_cost",
                notes=realized.notes,
            ),
            allocation=allocation,
            concentration_pct=concentration_pct,
            notes=notes,
        )

    def get_summary(self) -> PortfolioSummaryResponse:
        transactions = self.get_transactions()
        holdings = self.get_holdings()
        performance_result = self._build_performance(transactions)
        analytics = self._build_analytics(transactions, holdings, performance_result)
        valuation_missing_symbols = {
            holding.symbol for holding in holdings if holding.valuation_status == "unavailable"
        }
        missing_symbols = set(performance_result.missing_symbols)
        missing_symbols.update(valuation_missing_symbols)
        included_holdings = [holding for holding in holdings if holding.market_value is not None]
        total_value = sum(holding.market_value or 0.0 for holding in included_holdings)
        total_cost = sum(holding.cost_basis for holding in included_holdings)
        total_pnl = total_value - total_cost
        total_pnl_pct = 0.0 if total_cost == 0 else (total_pnl / total_cost) * 100
        daily_pnl = sum(
            (holding.market_value or 0.0) * ((holding.day_change_pct or 0.0) / 100) for holding in included_holdings
        )
        notes = list(performance_result.notes)

        if any(holding.stale for holding in holdings):
            _add_unique_note(notes, "Some holdings are valued from the local cache.")
        if any(status == "cached" for status in performance_result.benchmark_status.values()):
            _add_unique_note(notes, "Some benchmark data is served from the local cache.")
        unavailable_benchmarks = [
            symbol for symbol, status in performance_result.benchmark_status.items() if status == "unavailable"
        ]
        if unavailable_benchmarks:
            _add_unique_note(notes, f"Unavailable benchmarks: {', '.join(unavailable_benchmarks)}.")
        if valuation_missing_symbols:
            _add_unique_note(
                notes,
                f"Portfolio totals exclude symbols without a usable valuation: {', '.join(sorted(valuation_missing_symbols))}.",
            )

        degraded = (
            any(holding.valuation_status != "live" for holding in holdings)
            or any(status != "live" for status in performance_result.benchmark_status.values())
            or bool(performance_result.missing_symbols)
        )

        return PortfolioSummaryResponse(
            currency="USD",
            total_value=total_value,
            total_cost=total_cost,
            total_pnl=total_pnl,
            total_pnl_pct=total_pnl_pct,
            daily_pnl=daily_pnl,
            positions=len(holdings),
            stale=any(holding.stale for holding in holdings) or performance_result.stale,
            degraded=degraded,
            notes=notes,
            missing_symbols=sorted(missing_symbols),
            benchmark_status=performance_result.benchmark_status,
            performance=performance_result.performance,
            benchmarks=performance_result.benchmarks,
            analytics=analytics,
        )
