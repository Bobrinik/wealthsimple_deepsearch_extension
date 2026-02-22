"""News endpoint."""

from fastapi import APIRouter, HTTPException

from app.schemas import NewsItem
from app.services import news_service

router = APIRouter(tags=["news"])


@router.get("/news", response_model=list[NewsItem])
def news(symbol: str, page: int = 0, limit: int = 20):
    """Return stock news for the given ticker symbol from Financial Modeling Prep."""
    try:
        data = news_service.fetch_news(symbol, page=page, limit=limit)
    except ValueError as e:
        msg = str(e)
        if "FMP_API_KEY" in msg:
            raise HTTPException(status_code=500, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch news: {e!s}")
    return [NewsItem(**item) for item in data]
