"""Note/cache business logic."""

import base64
import json
import re
import uuid
from pathlib import Path

from app.core.config import get_notes_images_dir
from app.db.database import DEFAULT_LABELS, get_conn


def cache_key_from_task(task: str) -> str:
    """Derive a stable cache key from the task (e.g. company name)."""
    task = (task or "").strip()
    for line in task.split("\n"):
        line = line.strip()
        if line.lower().startswith("company:"):
            return line[8:].strip() or task
    return task or "default"


def get_cached(cache_key: str) -> str | None:
    """Return cached result for the key, or None if missing."""
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT result FROM deep_search_cache WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()
        return row[0] if row else None
    finally:
        conn.close()


def set_cached(
    cache_key: str,
    result: str,
    sec_id: str | None = None,
    labels: list[str] | None = None,
) -> None:
    """Store result in cache for the key (overwrites if exists)."""
    labels = labels if labels is not None else DEFAULT_LABELS
    labels_json = json.dumps(labels)
    conn = get_conn()
    try:
        conn.execute(
            """
            INSERT OR REPLACE INTO deep_search_cache (cache_key, result, sec_id, labels)
            VALUES (?, ?, ?, ?)
            """,
            (cache_key, result, sec_id, labels_json),
        )
        conn.commit()
    finally:
        conn.close()


def delete_cached(cache_key: str) -> bool:
    """Delete the cached entry for the key. Returns True if a row was deleted."""
    conn = get_conn()
    try:
        cur = conn.execute(
            "DELETE FROM deep_search_cache WHERE cache_key = ?",
            (cache_key,),
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def update_cached(cache_key: str, result: str) -> bool:
    """Update the result content for the given cache_key. Returns True if a row was updated."""
    conn = get_conn()
    try:
        cur = conn.execute(
            "UPDATE deep_search_cache SET result = ? WHERE cache_key = ?",
            (result, cache_key),
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def _parse_labels(raw: str | None) -> list[str]:
    if not raw or not raw.strip():
        return list(DEFAULT_LABELS)
    try:
        parsed = json.loads(raw)
        return list(parsed) if isinstance(parsed, list) else list(DEFAULT_LABELS)
    except (json.JSONDecodeError, TypeError):
        return list(DEFAULT_LABELS)


def get_all_cached() -> list[dict]:
    """Return all cached deep search results."""
    conn = get_conn()
    try:
        cur = conn.execute("PRAGMA table_info(deep_search_cache)")
        columns = [row[1] for row in cur.fetchall()]
        has_labels = "labels" in columns
        if has_labels:
            rows = conn.execute(
                """
                SELECT cache_key, result, sec_id, created_at, labels
                FROM deep_search_cache
                ORDER BY created_at DESC
                """
            ).fetchall()
            return [
                {
                    "cache_key": row[0],
                    "result": row[1],
                    "sec_id": row[2],
                    "created_at": row[3],
                    "labels": _parse_labels(row[4]),
                }
                for row in rows
            ]
        rows = conn.execute(
            """
            SELECT cache_key, result, sec_id, created_at
            FROM deep_search_cache
            ORDER BY created_at DESC
            """
        ).fetchall()
        return [
            {
                "cache_key": row[0],
                "result": row[1],
                "sec_id": row[2],
                "created_at": row[3],
                "labels": list(DEFAULT_LABELS),
            }
            for row in rows
        ]
    finally:
        conn.close()


# Data URL pattern: src="data:image/<subtype>;base64,<data>"
_DATA_URL_PATTERN = re.compile(
    r'(\bsrc=)(["\'])(data:image/([a-zA-Z0-9+.]+);base64,([^"\']+))\2',
    re.IGNORECASE,
)

_MIME_EXT = {
    "png": ".png",
    "jpeg": ".jpg",
    "jpg": ".jpg",
    "gif": ".gif",
    "webp": ".webp",
    "svg+xml": ".svg",
}


def _extract_and_save_images(html: str, images_dir: Path) -> str:
    """Replace data:image/... URLs in HTML with /notes/images/<filename>; save images to disk."""
    def replacer(match: re.Match) -> str:
        prefix, quote, _full, subtype, b64 = match.groups()
        try:
            data = base64.b64decode(b64, validate=True)
        except Exception:
            return match.group(0)
        ext = _MIME_EXT.get(subtype.lower(), ".bin")
        name = uuid.uuid4().hex + ext
        path = images_dir / name
        path.write_bytes(data)
        return f'{prefix}{quote}/notes/images/{name}{quote}'
    return _DATA_URL_PATTERN.sub(replacer, html)


ANNOTATION_LABELS = ["annotation"]


def save_annotation_note(
    ticker: str,
    content: str,
    sec_id: str | None = None,
    company_name: str | None = None,
) -> str:
    """
    Save an annotation note (from add_note injector). Uses cache_key ws-annot-{ticker}.
    Extracts inline images to disk and rewrites HTML. Returns cache_key.
    """
    cache_key = f"ws-annot-{ticker}"
    images_dir = get_notes_images_dir()
    processed = _extract_and_save_images(content, images_dir)
    set_cached(
        cache_key,
        processed,
        sec_id=sec_id,
        labels=ANNOTATION_LABELS,
    )
    return cache_key
