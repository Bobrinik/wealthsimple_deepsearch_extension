"""yfinance-based tools for stock/financial data. Each tool takes a ticker symbol."""

import json
from typing import Any

import yfinance as yf
from smolagents import tool


def _serialize(value: Any) -> str:
    """Convert yfinance outputs to a string the agent can use."""
    if value is None:
        return "No data available."
    if hasattr(value, "to_json"):
        return value.to_json(date_format="iso") if not value.empty else "No data available."
    if hasattr(value, "to_string"):
        return value.to_string() if len(value) else "No data available."
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str, indent=2)
    return str(value)


def _series_stats(s) -> dict:
    """Compute mean, median, std, min, max for a series. Values as float."""
    return {
        "mean": float(s.mean()),
        "median": float(s.median()),
        "std": float(s.std()) if s.std() == s.std() else 0.0,  # NaN-safe
        "min": float(s.min()),
        "max": float(s.max()),
    }


@tool
def ticker_history(ticker: str, period: str = "1mo") -> str:
    """
    Get summary statistics (mean, median, std, min, max) for Close and Volume
    over the specified period. Does not return the full timeseries.

    Args:
        ticker: Stock symbol (e.g. AAPL, RY.TO, SHOP.TO).
        period: Valid periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max. Default 1mo.
    """
    t = yf.Ticker(ticker)
    data = t.history(period=period)
    if data is None or data.empty:
        return "No data available."
    if "Close" not in data.columns or "Volume" not in data.columns:
        return "No Close or Volume data available."
    result = {
        "ticker": ticker,
        "period": period,
        "close": _series_stats(data["Close"]),
        "volume": _series_stats(data["Volume"].astype("float64")),
    }
    return json.dumps(result, indent=2)


@tool
def ticker_info(ticker: str) -> str:
    """
    Get company profile, key stats, and metadata for a ticker.

    Args:
        ticker: Stock symbol (e.g. AAPL, RY.TO, SHOP.TO).
    """
    t = yf.Ticker(ticker)
    info = t.info
    return _serialize(info) if info else "No data available."


@tool
def ticker_dividends(ticker: str) -> str:
    """
    Get dividend history for a ticker.

    Args:
        ticker: Stock symbol (e.g. AAPL, RY.TO).
    """
    t = yf.Ticker(ticker)
    div = t.dividends
    return _serialize(div)


@tool
def ticker_splits(ticker: str) -> str:
    """
    Get stock split history for a ticker.

    Args:
        ticker: Stock symbol (e.g. AAPL).
    """
    t = yf.Ticker(ticker)
    splits = t.splits
    return _serialize(splits)


@tool
def ticker_calendar(ticker: str) -> str:
    """
    Get earnings dates and related events for a ticker.

    Args:
        ticker: Stock symbol (e.g. AAPL, SHOP.TO).
    """
    t = yf.Ticker(ticker)
    cal = t.calendar
    return _serialize(cal) if cal is not None else "No calendar data available."


@tool
def ticker_financials(ticker: str) -> str:
    """
    Get annual income-statement (financials) data for a ticker.

    Args:
        ticker: Stock symbol (e.g. AAPL, RY.TO).
    """
    t = yf.Ticker(ticker)
    fin = t.financials
    return _serialize(fin)


@tool
def ticker_quarterly_financials(ticker: str) -> str:
    """
    Get quarterly income-statement (financials) data for a ticker.

    Args:
        ticker: Stock symbol (e.g. AAPL, RY.TO).
    """
    t = yf.Ticker(ticker)
    fin = t.quarterly_financials
    return _serialize(fin)


@tool
def ticker_balance_sheet(ticker: str) -> str:
    """
    Get annual balance-sheet data for a ticker.

    Args:
        ticker: Stock symbol (e.g. AAPL, RY.TO).
    """
    t = yf.Ticker(ticker)
    bs = t.balance_sheet
    return _serialize(bs)


@tool
def ticker_quarterly_balance_sheet(ticker: str) -> str:
    """
    Get quarterly balance-sheet data for a ticker.

    Args:
        ticker: Stock symbol (e.g. AAPL, RY.TO).
    """
    t = yf.Ticker(ticker)
    bs = t.quarterly_balance_sheet
    return _serialize(bs)


@tool
def ticker_cashflow(ticker: str) -> str:
    """
    Get annual cash-flow statement data for a ticker.

    Args:
        ticker: Stock symbol (e.g. AAPL, RY.TO).
    """
    t = yf.Ticker(ticker)
    cf = t.cashflow
    return _serialize(cf)


@tool
def ticker_quarterly_cashflow(ticker: str) -> str:
    """
    Get quarterly cash-flow statement data for a ticker.

    Args:
        ticker: Stock symbol (e.g. AAPL, RY.TO).
    """
    t = yf.Ticker(ticker)
    cf = t.quarterly_cashflow
    return _serialize(cf)


@tool
def ticker_institutional_holders(ticker: str) -> str:
    """
    Get large-holder / institutional ownership for a ticker.

    Args:
        ticker: Stock symbol (e.g. AAPL, RY.TO).
    """
    t = yf.Ticker(ticker)
    holders = t.institutional_holders
    return _serialize(holders) if holders is not None else "No data available."


@tool
def ticker_sustainability(ticker: str) -> str:
    """
    Get ESG / sustainability scores for a ticker if available.

    Args:
        ticker: Stock symbol (e.g. AAPL, RY.TO).
    """
    t = yf.Ticker(ticker)
    sus = t.sustainability
    return _serialize(sus) if sus is not None and not sus.empty else "No sustainability data available."


@tool
def ticker_options(ticker: str) -> str:
    """
    Get options expiration dates for a ticker.

    Args:
        ticker: Stock symbol (e.g. AAPL).
    """
    t = yf.Ticker(ticker)
    opt = t.options
    if opt is None or (hasattr(opt, "__len__") and len(opt) == 0):
        return "No options data available."
    return json.dumps(list(opt))


@tool
def ticker_option_chain(ticker: str, expiration: str | None = None) -> str:
    """
    Get option chain (calls and puts) for a ticker. If expiration is not given, uses the nearest expiration.

    Args:
        ticker: Stock symbol (e.g. AAPL).
        expiration: Option expiration date (e.g. 2025-01-17). If None, first available expiration is used.
    """
    t = yf.Ticker(ticker)
    opts = t.options
    if opts is None or len(opts) == 0:
        return "No options data available."
    exp = expiration if expiration else opts[0]
    try:
        chain = t.option_chain(exp)
        out = {
            "expiration": exp,
            "calls": chain.calls.to_dict() if chain.calls is not None and not chain.calls.empty else [],
            "puts": chain.puts.to_dict() if chain.puts is not None and not chain.puts.empty else [],
        }
        return json.dumps(out, default=str, indent=2)
    except Exception as e:
        return f"Error fetching option chain: {e}"


@tool
def ticker_download(ticker: str, period: str = "1mo") -> str:
    """
    Bulk OHLCV download for a ticker (same as history but via yf.download).

    Args:
        ticker: Stock symbol (e.g. AAPL, RY.TO).
        period: Valid periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max. Default 1mo.
    """
    data = yf.download(ticker, period=period, progress=False, group_by="ticker")
    if data is None or data.empty:
        return "No data available."
    return _serialize(data)
