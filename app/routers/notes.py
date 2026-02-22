"""Notes (cached deep search results) endpoints."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.schemas import CachedNote, NotesResponse
from app.services import note_service

router = APIRouter(tags=["notes"])


@router.get("/notes", response_model=NotesResponse)
def notes():
    """Return all saved deep search results from the SQLite cache."""
    return NotesResponse(notes=[CachedNote(**n) for n in note_service.get_all_cached()])


@router.delete("/notes/{cache_key}")
def delete_note(cache_key: str):
    """Delete a note from the SQLite cache by its cache_key. Returns 204 on success, 404 if not found."""
    if not note_service.delete_cached(cache_key):
        raise HTTPException(status_code=404, detail="Note not found")
    return Response(status_code=204)
