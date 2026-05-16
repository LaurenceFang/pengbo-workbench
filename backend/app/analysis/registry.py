from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from ..models import (
    AnalysisHighlight,
    AnalysisModuleResult,
    AnalysisSection,
    AnalysisSource,
    AssetWorkspaceResponse,
    ResearchPortfolioContext,
    ResearchScreenerContext,
)


@dataclass(slots=True)
class AnalysisModuleContext:
    brief_id: str
    symbol: str
    generated_at: str
    stale: bool
    asset_snapshot: AssetWorkspaceResponse
    screener_context: ResearchScreenerContext
    portfolio_context: ResearchPortfolioContext


class AnalysisModule(Protocol):
    key: str
    title: str

    def build(self, context: AnalysisModuleContext) -> AnalysisModuleResult:
        ...


class AnalysisModuleRegistry:
    def __init__(self) -> None:
        self._modules: dict[str, AnalysisModule] = {}

    def register(self, module: AnalysisModule) -> None:
        self._modules[module.key] = module

    def resolve(self, key: str) -> AnalysisModule | None:
        return self._modules.get(key)

    def render_all(self, context: AnalysisModuleContext) -> list[AnalysisModuleResult]:
        return [module.build(context) for module in self._modules.values()]


def highlight(label: str, value: str, tone: str = "neutral") -> AnalysisHighlight:
    return AnalysisHighlight(label=label, value=value, tone=tone)


def paragraph(title: str, body: str) -> AnalysisSection:
    return AnalysisSection(title=title, body=body, kind="paragraph")


def bullets(title: str, items: list[str]) -> AnalysisSection:
    return AnalysisSection(title=title, body="", kind="bullets", items=items)


def source(label: str, detail: str | None = None) -> AnalysisSource:
    return AnalysisSource(label=label, detail=detail)
