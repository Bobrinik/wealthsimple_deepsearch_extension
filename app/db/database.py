"""SQLite connection and schema for Deep Search cache."""

import json
import sqlite3

from app.core.config import get_db_path

DEFAULT_LABELS = ["research"]


def get_conn() -> sqlite3.Connection:
    path = get_db_path()
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
    cur = conn.execute("PRAGMA table_info(deep_search_cache)")
    columns = [row[1] for row in cur.fetchall()]
    if "sec_id" not in columns:
        conn.execute("ALTER TABLE deep_search_cache ADD COLUMN sec_id TEXT")
        conn.commit()
    if "labels" not in columns:
        default_labels_json = json.dumps(DEFAULT_LABELS).replace("'", "''")
        conn.execute(
            f"ALTER TABLE deep_search_cache ADD COLUMN labels TEXT NOT NULL DEFAULT ('{default_labels_json}')"
        )
        conn.commit()
    return conn
