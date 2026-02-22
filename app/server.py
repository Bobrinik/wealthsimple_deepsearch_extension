"""Minimal FastAPI server exposing the smolagents CodeAgent as an HTTP endpoint."""

import os

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

FMP_NEWS_URL = "https://financialmodelingprep.com/stable/news/stock"

# Reuse the same agent and model as main (Gradio UI)
from app.cache import cache_key_from_task, delete_cached, get_all_cached, get_cached, set_cached
from app.main import agent
from app.prompt import PROMPT

app = FastAPI(title="Wealthsimple DeepSearch Agent", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://my.wealthsimple.com", "http://localhost", "http://127.0.0.1"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


class TaskRequest(BaseModel):
    task: str
    sec_id: str | None = None  # from page URL, e.g. sec-s-159a99834ea34fdbb66c05700828da52


class TaskResponse(BaseModel):
    result: str


class HealthResponse(BaseModel):
    status: str


class CachedNote(BaseModel):
    cache_key: str
    result: str
    sec_id: str | None
    created_at: str
    labels: list[str] = ["research"]


class NotesResponse(BaseModel):
    notes: list[CachedNote]


class NewsItem(BaseModel):
    symbol: str
    publishedDate: str
    publisher: str
    title: str
    image: str
    site: str
    text: str
    url: str


@app.get("/health", response_model=HealthResponse)
def health():
    """Health check for load balancers and monitoring."""
    return HealthResponse(status="ok")


@app.get("/notes", response_model=NotesResponse)
def notes():
    """Return all saved deep search results from the SQLite cache."""
    return NotesResponse(notes=[CachedNote(**n) for n in get_all_cached()])


@app.get("/news", response_model=list[NewsItem])
def news(symbol: str, page: int = 0, limit: int = 20):
    """Return stock news for the given ticker symbol from Financial Modeling Prep. Supports pagination via page (0-based) and limit."""
    api_key = os.environ.get("FMP_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="FMP_API_KEY is not set in the environment or .env file.")
    ticker = symbol.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="symbol is required.")
    if page < 0:
        raise HTTPException(status_code=400, detail="page must be >= 0.")
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100.")
    try:
        resp = requests.get(
            FMP_NEWS_URL,
            params={"symbols": ticker, "apikey": api_key, "page": page, "limit": limit},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch news: {e!s}")
    if not isinstance(data, list):
        raise HTTPException(status_code=502, detail="Unexpected response from news API.")
    return [NewsItem(**item) for item in data]


@app.delete("/notes/{cache_key}")
def delete_note(cache_key: str):
    """Delete a note from the SQLite cache by its cache_key. Returns 204 on success, 404 if not found."""
    if not delete_cached(cache_key):
        raise HTTPException(status_code=404, detail="Note not found")
    return Response(status_code=204)


@app.post("/run", response_model=TaskResponse)
def run_agent(request: TaskRequest):
    """Run the agent on the given task and return the result. Uses SQLite cache by company so repeated requests for the same company return the cached response."""
    key = cache_key_from_task(request.task)
    cached = get_cached(key)
    if cached is not None:
        return TaskResponse(result=cached)
    result = agent.run(PROMPT + request.task)
    result_str = str(result)
    set_cached(key, result_str, sec_id=request.sec_id)
    return TaskResponse(result=result_str)
