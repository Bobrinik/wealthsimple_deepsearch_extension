"""News API response schema."""

from pydantic import BaseModel


class NewsItem(BaseModel):
    symbol: str
    publishedDate: str
    publisher: str
    title: str
    image: str
    site: str
    text: str
    url: str
