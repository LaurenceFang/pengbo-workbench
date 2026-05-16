from __future__ import annotations

import unittest

from scripts.build_sidecar import _classify_warning_lines


class SidecarBuildReportTests(unittest.TestCase):
    def test_residual_scipy_lines_are_reported_as_accepted_packaging_noise(self) -> None:
        actionable, optional_noise, accepted_noise = _classify_warning_lines(
            [
                "missing module named 'scipy.stats' - imported by pandas.core.nanops (delayed, conditional), pandas.plotting._matplotlib.misc (delayed, conditional), pandas.plotting._matplotlib.hist (delayed)",
                "excluded module named scipy - imported by pandas.core.missing (delayed), yfinance.scrapers.history (delayed)",
                "missing module named 'scipy.sparse' - imported by pandas.core.dtypes.common (delayed, conditional, optional), pandas.core.arrays.sparse.array (conditional), pandas.core.arrays.sparse.scipy_sparse (delayed, conditional), pandas.core.arrays.sparse.accessor (delayed)",
                "missing module named readability - imported by curl_cffi.requests.models (top-level)",
                "missing module named custom.runtime.module - imported by backend.app.runtime (top-level)",
            ]
        )

        self.assertEqual(
            [item["line"] for item in accepted_noise],
            [
                "missing module named 'scipy.stats' - imported by pandas.core.nanops (delayed, conditional), pandas.plotting._matplotlib.misc (delayed, conditional), pandas.plotting._matplotlib.hist (delayed)",
                "excluded module named scipy - imported by pandas.core.missing (delayed), yfinance.scrapers.history (delayed)",
                "missing module named 'scipy.sparse' - imported by pandas.core.dtypes.common (delayed, conditional, optional), pandas.core.arrays.sparse.array (conditional), pandas.core.arrays.sparse.scipy_sparse (delayed, conditional), pandas.core.arrays.sparse.accessor (delayed)",
            ],
        )
        self.assertEqual(
            [item["reason"] for item in accepted_noise],
            [
                "pandas optional SciPy stats helpers stay excluded from the packaged sidecar",
                "the packaged fundamentals flow keeps SciPy excluded while yfinance still exposes delayed history hooks",
                "pandas sparse-array helpers are optional and remain outside the packaged desktop contract",
            ],
        )
        self.assertEqual(
            optional_noise,
            [
                "missing module named readability - imported by curl_cffi.requests.models (top-level)",
            ],
        )
        self.assertEqual(
            actionable,
            [
                "missing module named custom.runtime.module - imported by backend.app.runtime (top-level)",
            ],
        )


if __name__ == "__main__":
    unittest.main()
