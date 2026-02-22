"""Note/cache business logic."""

import json

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
