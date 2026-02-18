"""Custom tools for the smolagents CodeAgent."""

import os
from datetime import datetime, timezone

import requests
from smolagents import tool

PERPLEXITY_CHAT_URL = "https://api.perplexity.ai/chat/completions"
PERPLEXITY_SEARCH_URL = "https://api.perplexity.ai/search"
ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"

@tool
def scoped_perplexity_search(
    query: str,
    search_domain_filter: list[str],
    search_recency_filter: str = "month",
) -> str:
    """
    Query Perplexity's sonar model with web search scoped to given domains and recency.
    search_domain_filter is required. Requires PERPLEXITY_API_KEY in the environment or .env.

    Args:
        query: The user question or search prompt to send to Perplexity.
        search_domain_filter: List of domains to restrict search to (e.g. ["arxiv.org"]).
        search_recency_filter: How recent the search should be (e.g. "month", "week", "day"). Defaults to "month".
    """
    api_key = os.environ.get("PERPLEXITY_API_KEY")
    if not api_key:
        return "Error: PERPLEXITY_API_KEY is not set in the environment or .env file."

    payload = {
        "model": "sonar",
        "messages": [{"role": "user", "content": query}],
        "web_search_options": {
            "search_domain_filter": search_domain_filter,
            "search_recency_filter": search_recency_filter,
        },
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(PERPLEXITY_CHAT_URL, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return content or "No content in response."
    except requests.RequestException as e:
        return f"Perplexity API request failed: {e}"
    except (KeyError, IndexError) as e:
        return f"Unexpected Perplexity response shape: {e}"


@tool
def generic_search(queries: list[str]) -> str:
    """
    Run a generic web search via Perplexity's search API for a list of queries.
    Returns the raw API response. Requires PERPLEXITY_API_KEY in the environment or .env.

    Args:
        queries: List of search query strings (e.g. ["What is X?", "Who founded Y?"]).
    """
    api_key = os.environ.get("PERPLEXITY_API_KEY")
    if not api_key:
        return "Error: PERPLEXITY_API_KEY is not set in the environment or .env file."

    payload = {"query": queries}
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            PERPLEXITY_SEARCH_URL, json=payload, headers=headers, timeout=60
        )
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as e:
        return f"Perplexity search API request failed: {e}"


@tool
def generate_deep_research_hypothesis(
    company_description: str,
    model: str = "claude-opus-4-5",
    max_tokens: int = 1024,
) -> str:
    """
    Generate deep research hypotheses for a company using Claude.
    Takes a company description and returns hypotheses worth investigating.
    Requires ANTHROPIC_API_KEY in the environment or .env.

    Args:
        company_description: Description of the company (business, sector, key facts).
        model: Claude model ID. Defaults to claude-opus-4-5.
        max_tokens: Maximum tokens in the response. Defaults to 1024.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return "Error: ANTHROPIC_API_KEY is not set in the environment or .env file."

    user_message = (
        "Based on the following company description, generate a concise list of "
        "deep research hypotheses worth investigating (e.g. competitive position, "
        "risks, growth drivers, valuation angles). Be specific and actionable.\n\n"
        f"Company description:\n{company_description}"
    )
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": user_message}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            ANTHROPIC_MESSAGES_URL, json=payload, headers=headers, timeout=60
        )
        resp.raise_for_status()
        data = resp.json()
        # Anthropic returns content as a list of content blocks
        content_blocks = data.get("content", [])
        if not content_blocks:
            return "No content in response."
        text_parts = [
            b["text"] for b in content_blocks if b.get("type") == "text"
        ]
        return "\n".join(text_parts) if text_parts else "No text in response."
    except requests.RequestException as e:
        return f"Anthropic API request failed: {e}"
    except (KeyError, IndexError) as e:
        return f"Unexpected Anthropic response shape: {e}"


@tool
def output_formatter(
    final_answer: str,
    model: str = "claude-opus-4-5",
    max_tokens: int = 4096,
) -> str:
    """
    Format the final answer as HTML suitable for innerHTML.
    Takes raw text/markdown and returns a single HTML string (no outer html/body).
    Requires ANTHROPIC_API_KEY in the environment or .env.

    Args:
        final_answer: The final answer or report text to convert to HTML.
        model: Claude model ID. Defaults to claude-opus-4-5.
        max_tokens: Maximum tokens in the response. Defaults to 4096.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return "Error: ANTHROPIC_API_KEY is not set in the environment or .env file."

    user_message = (
        "Convert the following final answer into clean HTML suitable for setting as innerHTML. "
        "Use semantic tags (e.g. sections, headings, lists, paragraphs). "
        "Do not include <html>, <head>, or <body>. Output only the fragment to be used as innerHTML.\n\n"
        f"Final answer:\n{final_answer}"
    )
    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": user_message}],
    }
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            ANTHROPIC_MESSAGES_URL, json=payload, headers=headers, timeout=60
        )
        resp.raise_for_status()
        data = resp.json()
        content_blocks = data.get("content", [])
        if not content_blocks:
            return "No content in response."
        text_parts = [
            b["text"] for b in content_blocks if b.get("type") == "text"
        ]
        return "\n".join(text_parts).strip() if text_parts else "No text in response."
    except requests.RequestException as e:
        return f"Anthropic API request failed: {e}"
    except (KeyError, IndexError) as e:
        return f"Unexpected Anthropic response shape: {e}"
