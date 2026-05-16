ASSETS = [
    {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "market": "NASDAQ",
        "asset_class": "equity",
        "currency": "USD",
        "provider": "mock-openbb",
    },
    {
        "symbol": "SPY",
        "name": "SPDR S&P 500 ETF",
        "market": "NYSE Arca",
        "asset_class": "etf",
        "currency": "USD",
        "provider": "mock-openbb",
    },
    {
        "symbol": "BTC/USDT",
        "name": "Bitcoin / Tether",
        "market": "Binance",
        "asset_class": "crypto",
        "currency": "USDT",
        "provider": "mock-ccxt",
    },
]

QUOTES = {
    "AAPL": {"symbol": "AAPL", "price": 211.42, "change": 3.84, "change_pct": 1.85, "currency": "USD"},
    "SPY": {"symbol": "SPY", "price": 578.09, "change": 2.67, "change_pct": 0.46, "currency": "USD"},
    "BTC/USDT": {
        "symbol": "BTC/USDT",
        "price": 84640.0,
        "change": 1920.0,
        "change_pct": 2.32,
        "currency": "USDT",
    },
}

PRICE_HISTORY = {
    "AAPL": [
        {"timestamp": "2026-04-08", "close": 201.4, "volume": 72530000},
        {"timestamp": "2026-04-09", "close": 203.1, "volume": 68920000},
        {"timestamp": "2026-04-10", "close": 205.8, "volume": 71840000},
        {"timestamp": "2026-04-11", "close": 206.2, "volume": 70010000},
        {"timestamp": "2026-04-12", "close": 208.7, "volume": 75110000},
        {"timestamp": "2026-04-13", "close": 209.9, "volume": 73450000},
        {"timestamp": "2026-04-14", "close": 211.42, "volume": 78230000},
    ],
    "SPY": [
        {"timestamp": "2026-04-08", "close": 567.2, "volume": 68120000},
        {"timestamp": "2026-04-09", "close": 569.8, "volume": 61510000},
        {"timestamp": "2026-04-10", "close": 572.0, "volume": 62390000},
        {"timestamp": "2026-04-11", "close": 573.4, "volume": 59880000},
        {"timestamp": "2026-04-12", "close": 575.5, "volume": 64120000},
        {"timestamp": "2026-04-13", "close": 576.9, "volume": 63310000},
        {"timestamp": "2026-04-14", "close": 578.09, "volume": 66240000},
    ],
    "BTC/USDT": [
        {"timestamp": "2026-04-08", "close": 81120.0, "volume": 28210},
        {"timestamp": "2026-04-09", "close": 81840.0, "volume": 27580},
        {"timestamp": "2026-04-10", "close": 82340.0, "volume": 29510},
        {"timestamp": "2026-04-11", "close": 82910.0, "volume": 30420},
        {"timestamp": "2026-04-12", "close": 83530.0, "volume": 29980},
        {"timestamp": "2026-04-13", "close": 84110.0, "volume": 31500},
        {"timestamp": "2026-04-14", "close": 84640.0, "volume": 32440},
    ],
}

FUNDAMENTAL_OVERVIEW = {
    "AAPL": {
        "symbol": "AAPL",
        "company": "Apple Inc.",
        "sector": "Technology Hardware",
        "market_cap": "$3.17T",
        "summary": "硬件与服务双轮驱动，现金流质量稳定，适合作为 v1 基本面深度展示样本。",
    }
}

RATIOS = {
    "AAPL": [
        {"label": "TTM PE", "value": "29.4x", "note": "相对自身中枢偏上"},
        {"label": "ROE", "value": "154.6%", "note": "受资本结构影响较大"},
        {"label": "FCF Margin", "value": "26.8%", "note": "现金创造能力优秀"},
        {"label": "Revenue YoY", "value": "+6.3%", "note": "增速温和修复"},
    ]
}

FILINGS = {
    "AAPL": [
        {
            "type": "10-Q",
            "filed_at": "2026-02-01",
            "headline": "Q1 财报披露：服务业务与回购延续强势",
            "status": "parsed",
        },
        {
            "type": "8-K",
            "filed_at": "2026-01-18",
            "headline": "董事会更新资本分配框架",
            "status": "indexed",
        },
        {
            "type": "10-K",
            "filed_at": "2025-10-31",
            "headline": "年度报告：硬件周期与生态粘性双重巩固",
            "status": "summarized",
        },
    ]
}

SCREENER_RESULTS = {
    "quality-equities": [
        {"symbol": "AAPL", "score": 92},
        {"symbol": "MSFT", "score": 90},
        {"symbol": "COST", "score": 87},
    ],
    "trend-crypto": [
        {"symbol": "BTC/USDT", "score": 89},
        {"symbol": "SOL/USDT", "score": 84},
        {"symbol": "ETH/USDT", "score": 81},
    ],
}

PORTFOLIO_SUMMARY = {
    "total_value": "$1.28M",
    "daily_pnl": "+$12.4K",
    "benchmark": "SPY / BTC mix",
    "positions": 9,
}

