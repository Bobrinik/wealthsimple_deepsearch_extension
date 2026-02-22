"""News fetching from Financial Modeling Prep."""

import os

import requests

from app.core.config import FMP_NEWS_URL


def fetch_news(symbol: str, page: int = 0, limit: int = 20) -> list[dict]:
    """Return stock news for the given ticker. Raises ValueError on bad input or API error."""
    api_key = os.environ.get("FMP_API_KEY")
    if not api_key:
        raise ValueError("FMP_API_KEY is not set in the environment or .env file.")
    ticker = symbol.strip().upper()
    if not ticker:
        raise ValueError("symbol is required.")
    if page < 0:
        raise ValueError("page must be >= 0.")
    if limit < 1 or limit > 100:
        raise ValueError("limit must be between 1 and 100.")
    resp = requests.get(
        FMP_NEWS_URL,
        params={"symbols": ticker, "apikey": api_key, "page": page, "limit": limit},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    if not isinstance(data, list):
        raise ValueError("Unexpected response from news API.")
    return data
