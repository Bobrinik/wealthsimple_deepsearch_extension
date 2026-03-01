"""Notes (cached deep search results) endpoints."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, Response

from app.core.config import get_notes_images_dir
from app.schemas import CachedNote, CreateNoteRequest, NotesResponse, UpdateNoteRequest
from app.services import note_service

router = APIRouter(tags=["notes"])


@router.get("/notes", response_model=NotesResponse)
def notes():
    """Return all saved deep search results from the SQLite cache."""
    return NotesResponse(notes=[CachedNote(**n) for n in note_service.get_all_cached()])


@router.post("/notes", status_code=201)
def create_note(body: CreateNoteRequest):
    """Create or update an annotation note. Schema matches greese_monkey.add_note.js. Saves to SQLite; images saved on disk."""
    cache_key = note_service.save_annotation_note(
        ticker=body.ticker,
        content=body.content,
        sec_id=body.sec_id,
        company_name=body.company_name,
    )
    return {"cache_key": cache_key}


@router.get("/notes/images/{filename:path}")
def get_note_image(filename: str):
    """Serve a note image stored on disk (from data URLs in POST /notes)."""
    images_dir = get_notes_images_dir()
    base = images_dir.resolve()
    path = (images_dir / filename).resolve()
    try:
        path.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=404, detail="Image not found")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)


@router.delete("/notes/{cache_key}")
def delete_note(cache_key: str):
    """Delete a note from the SQLite cache by its cache_key. Returns 204 on success, 404 if not found."""
    if not note_service.delete_cached(cache_key):
        raise HTTPException(status_code=404, detail="Note not found")
    return Response(status_code=204)


@router.put("/notes/{cache_key}")
def update_note(cache_key: str, body: UpdateNoteRequest):
    """Update an existing note's content by cache_key. Returns 200 on success, 404 if not found."""
    if not note_service.update_cached(cache_key, body.content):
        raise HTTPException(status_code=404, detail="Note not found")
    return {"cache_key": cache_key}
