"""Deep research agent: Gradio server and CodeAgent using smolagents with LiteLLMModel."""

import os

import litellm
from dotenv import load_dotenv
from smolagents import CodeAgent, DuckDuckGoSearchTool, GradioUI, LiteLLMModel

load_dotenv()

litellm._turn_on_debug()

from app.agents.tools import (
    generate_deep_research_hypothesis,
    generic_search,
    output_formatter,
    scoped_perplexity_search,
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

model = LiteLLMModel(
    model_id="gemini/gemini-2.0-flash",
    api_key=os.environ.get("GOOGLE_API_KEY"),
    temperature=0.2,
)

agent = CodeAgent(
    model=model,
    tools=[
        scoped_perplexity_search,
        generic_search,
        generate_deep_research_hypothesis,
        DuckDuckGoSearchTool(),
        ticker_history,
        ticker_info,
        ticker_dividends,
        ticker_splits,
        ticker_calendar,
        ticker_financials,
        ticker_quarterly_financials,
        ticker_balance_sheet,
        ticker_quarterly_balance_sheet,
        ticker_cashflow,
        ticker_quarterly_cashflow,
        ticker_institutional_holders,
        ticker_sustainability,
        ticker_options,
        ticker_option_chain,
        ticker_download,
    ],
)

if __name__ == "__main__":
    GradioUI(agent).launch()
