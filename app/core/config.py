"""App configuration from environment."""

import os
from pathlib import Path


def get_db_path() -> Path:
    path = os.environ.get("DEEPSEARCH_DB_PATH")
    if path:
        return Path(path)
    root = Path(__file__).resolve().parent.parent.parent
    data_dir = root / "data"
    data_dir.mkdir(exist_ok=True)
    return data_dir / "deep_search.db"


def get_notes_images_dir() -> Path:
    """Directory for note images (data URLs saved to disk)."""
    root = Path(__file__).resolve().parent.parent.parent
    d = root / "data" / "notes_images"
    d.mkdir(parents=True, exist_ok=True)
    return d


FMP_NEWS_URL = os.environ.get("FMP_NEWS_URL", "https://financialmodelingprep.com/stable/news/stock")
