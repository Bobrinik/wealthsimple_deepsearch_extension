"""FastAPI application: Wealthsimple DeepSearch Agent API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import agent, health, items, news, notes, users

app = FastAPI(title="Wealthsimple DeepSearch Agent", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://my.wealthsimple.com", "http://localhost", "http://127.0.0.1"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(notes.router)
app.include_router(news.router)
app.include_router(agent.router)
app.include_router(users.router)
app.include_router(items.router)
