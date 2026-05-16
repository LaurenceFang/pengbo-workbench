from __future__ import annotations

import unittest

from backend.app.analysis import AnalysisModuleContext, build_default_analysis_registry
from backend.app.models import (
    ResearchPortfolioContext,
    ResearchPortfolioHandoffDraft,
    ResearchScreenerContext,
    ResearchScreenerSummary,
)
from backend.tests.test_research_service import make_asset_workspace


class AnalysisRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.registry = build_default_analysis_registry()

    def test_registry_resolves_known_module_and_handles_unknown_key(self):
        self.assertIsNotNone(self.registry.resolve("asset_quality_snapshot"))
        self.assertIsNone(self.registry.resolve("missing-module"))

    def test_default_modules_render_complete_envelopes(self):
        asset_snapshot = make_asset_workspace(symbol="AAPL", stale=True)
        screener_context = ResearchScreenerContext(
            source=None,
            summaries=[
                ResearchScreenerSummary(
                    preset_key="quality-equities",
                    preset_title="Quality",
                    variant_key="default",
                    variant_name="Default",
                    universe_source="expanded",
                    matched=True,
                    score=81.5,
                    score_label="high",
                    explanations=["Strong quality signal"],
                    matched_rules=["high ROE"],
                    notes=["Realtime data"],
                    stale=True,
                )
            ],
        )
        portfolio_context = ResearchPortfolioContext(
            in_portfolio=True,
            quantity=4.0,
            average_cost=110.0,
            valuation_status="cached",
            market_value=493.8,
            cost_basis=440.0,
            transaction_count=2,
            notes=["Held in core portfolio"],
            handoff_draft=ResearchPortfolioHandoffDraft(
                symbol="AAPL",
                side="buy",
                quantity=1,
                price=123.45,
                fees=0,
                traded_at="2026-04-22",
                notes="Created from research brief AAPL",
            ),
        )
        context = AnalysisModuleContext(
            brief_id="brief-test",
            symbol="AAPL",
            generated_at="2026-04-22T00:00:00+00:00",
            stale=True,
            asset_snapshot=asset_snapshot,
            screener_context=screener_context,
            portfolio_context=portfolio_context,
        )
        modules = self.registry.render_all(context)
        self.assertEqual(len(modules), 4)
        self.assertTrue(all(module.summary for module in modules))
        self.assertTrue(all(module.generated_at == "2026-04-22T00:00:00+00:00" for module in modules))
        self.assertTrue(all(module.stale for module in modules))


if __name__ == "__main__":
    unittest.main()
