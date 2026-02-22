"""Note/cache response schemas."""

from pydantic import BaseModel


class CachedNote(BaseModel):
    cache_key: str
    result: str
    sec_id: str | None
    created_at: str
    labels: list[str] = ["research"]


class NotesResponse(BaseModel):
    notes: list[CachedNote]
