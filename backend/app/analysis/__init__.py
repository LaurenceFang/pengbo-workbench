from __future__ import annotations

from .modules import (
    AssetQualitySnapshotModule,
    FilingsBriefModule,
    PortfolioRiskSnapshotModule,
    ScreenerMatchExplainerModule,
)
from .registry import AnalysisModuleContext, AnalysisModuleRegistry


def build_default_analysis_registry() -> AnalysisModuleRegistry:
    registry = AnalysisModuleRegistry()
    registry.register(AssetQualitySnapshotModule())
    registry.register(FilingsBriefModule())
    registry.register(ScreenerMatchExplainerModule())
    registry.register(PortfolioRiskSnapshotModule())
    return registry


__all__ = [
    "AnalysisModuleContext",
    "AnalysisModuleRegistry",
    "build_default_analysis_registry",
]
