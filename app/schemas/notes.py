"""Note/cache response schemas."""

from pydantic import BaseModel


class CachedNote(BaseModel):
    cache_key: str
    result: str
    sec_id: str | None
    created_at: str
    labels: list[str] = ["research"]


class CreateNoteRequest(BaseModel):
    """Schema matching greese_monkey.add_note.js: ticker, company name, HTML content."""

    ticker: str
    company_name: str | None = None
    content: str
    sec_id: str | None = None


class NotesResponse(BaseModel):
    notes: list[CachedNote]


class UpdateNoteRequest(BaseModel):
    """Body for updating an existing note's content."""

    content: str
