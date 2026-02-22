"""Test each yfinance tool with a real ticker."""

import sys

from app.agents.tools.yfinance_tools import (
    ticker_balance_sheet,
    ticker_calendar,
    ticker_cashflow,
    ticker_dividends,
    ticker_download,
    ticker_financials,
    ticker_history,
    ticker_info,
    ticker_institutional_holders,
    ticker_option_chain,
    ticker_options,
    ticker_quarterly_balance_sheet,
    ticker_quarterly_cashflow,
    ticker_quarterly_financials,
    ticker_splits,
    ticker_sustainability,
)

TICKER = "AAPL"
TOOLS = [
    ("ticker_history", lambda: ticker_history(TICKER)),
    ("ticker_info", lambda: ticker_info(TICKER)),
    ("ticker_dividends", lambda: ticker_dividends(TICKER)),
    ("ticker_splits", lambda: ticker_splits(TICKER)),
    ("ticker_calendar", lambda: ticker_calendar(TICKER)),
    ("ticker_financials", lambda: ticker_financials(TICKER)),
    ("ticker_quarterly_financials", lambda: ticker_quarterly_financials(TICKER)),
    ("ticker_balance_sheet", lambda: ticker_balance_sheet(TICKER)),
    ("ticker_quarterly_balance_sheet", lambda: ticker_quarterly_balance_sheet(TICKER)),
    ("ticker_cashflow", lambda: ticker_cashflow(TICKER)),
    ("ticker_quarterly_cashflow", lambda: ticker_quarterly_cashflow(TICKER)),
    ("ticker_institutional_holders", lambda: ticker_institutional_holders(TICKER)),
    ("ticker_sustainability", lambda: ticker_sustainability(TICKER)),
    ("ticker_options", lambda: ticker_options(TICKER)),
    ("ticker_option_chain", lambda: ticker_option_chain(TICKER)),
    ("ticker_download", lambda: ticker_download(TICKER)),
]


def main() -> None:
    failed = []
    for name, fn in TOOLS:
        try:
            out = fn()
            assert isinstance(out, str), f"{name}: expected str, got {type(out)}"
            assert len(out) > 0, f"{name}: empty output"
            print(f"  OK  {name}")
        except Exception as e:
            print(f"  FAIL {name}: {e}")
            failed.append(name)
    if failed:
        print(f"\nFailed: {failed}")
        sys.exit(1)
    print(f"\nAll {len(TOOLS)} yfinance tools OK for ticker {TICKER}")


if __name__ == "__main__":
    main()
