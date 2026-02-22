"""SQLite-backed cache for Deep Search responses keyed by company."""

import json
import os
import sqlite3
from pathlib import Path

DEFAULT_LABELS = ["research"]


def _db_path() -> Path:
    path = os.environ.get("DEEPSEARCH_DB_PATH")
    if path:
        return Path(path)
    # Default: project root / data / deep_search.db
    root = Path(__file__).resolve().parent.parent
    data_dir = root / "data"
    data_dir.mkdir(exist_ok=True)
    return data_dir / "deep_search.db"


def _get_conn() -> sqlite3.Connection:
    path = _db_path()
    conn = sqlite3.connect(str(path))
    default_labels_json = json.dumps(DEFAULT_LABELS)
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS deep_search_cache (
            cache_key TEXT PRIMARY KEY,
            result TEXT NOT NULL,
            sec_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            labels TEXT NOT NULL DEFAULT ('{json.dumps(DEFAULT_LABELS).replace("'", "''")}')
        )
        """
    )
    conn.commit()
    # Add sec_id column if missing (migration for existing DBs)
    cur = conn.execute("PRAGMA table_info(deep_search_cache)")
    columns = [row[1] for row in cur.fetchall()]
    if "sec_id" not in columns:
        conn.execute("ALTER TABLE deep_search_cache ADD COLUMN sec_id TEXT")
        conn.commit()
    # Add labels column if missing (migration for existing DBs)
    if "labels" not in columns:
        default_labels_json = json.dumps(DEFAULT_LABELS).replace("'", "''")
        conn.execute(
            f"ALTER TABLE deep_search_cache ADD COLUMN labels TEXT NOT NULL DEFAULT ('{default_labels_json}')"
        )
        conn.commit()
    return conn


def cache_key_from_task(task: str) -> str:
    """Derive a stable cache key from the task (e.g. company name)."""
    task = (task or "").strip()
    for line in task.split("\n"):
        line = line.strip()
        if line.lower().startswith("company:"):
            return line[8:].strip() or task  # after "company:"
    return task or "default"


def get_cached(cache_key: str) -> str | None:
    """Return cached result for the key, or None if missing."""
    conn = _get_conn()
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
    """Store result in cache for the key (overwrites if exists). Optionally store sec_id and labels (default: research)."""
    labels = labels if labels is not None else DEFAULT_LABELS
    labels_json = json.dumps(labels)
    conn = _get_conn()
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
    conn = _get_conn()
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
    """Parse labels from JSON stored in DB; return default if missing or invalid."""
    if not raw or not raw.strip():
        return list(DEFAULT_LABELS)
    try:
        parsed = json.loads(raw)
        return list(parsed) if isinstance(parsed, list) else list(DEFAULT_LABELS)
    except (json.JSONDecodeError, TypeError):
        return list(DEFAULT_LABELS)


def get_all_cached() -> list[dict]:
    """Return all cached deep search results (cache_key, result, sec_id, created_at, labels)."""
    conn = _get_conn()
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
        # Old DB without labels column
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
