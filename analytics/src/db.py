from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

import pandas as pd
from sqlalchemy import create_engine, text

REPO_ROOT = Path(__file__).resolve().parents[2]


def _load_backend_env() -> None:
    """Load DATABASE_URL without printing or returning credentials."""
    if os.getenv("DATABASE_URL"):
        return
    env_path = REPO_ROOT / "backend" / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() == "DATABASE_URL":
            os.environ["DATABASE_URL"] = value.strip().strip('"').strip("'")
            return


def database_url() -> str | None:
    _load_backend_env()
    raw = os.getenv("DATABASE_URL")
    if not raw:
        return None
    # SQLAlchemy uses the installed psycopg2 driver. Preserve all SSL options.
    if raw.startswith("postgresql://"):
        return raw.replace("postgresql://", "postgresql+psycopg2://", 1)
    return raw


def safe_database_label() -> str:
    """Return a credential-free source label for UI/report metadata."""
    raw = database_url()
    if not raw:
        return "demo CSV"
    parts = urlsplit(raw.replace("postgresql+psycopg2", "postgresql", 1))
    return f"PostgreSQL/{parts.hostname or 'configured-host'}/{parts.path.lstrip('/')}"


def get_engine():
    url = database_url()
    if not url:
        raise RuntimeError("DATABASE_URL is not configured")
    return create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 10})


def query_frame(sql: str, params: dict | None = None) -> pd.DataFrame:
    with get_engine().connect() as connection:
        return pd.read_sql_query(text(sql), connection, params=params or {})


def healthcheck() -> dict:
    with get_engine().connect() as connection:
        row = connection.execute(text("SELECT current_database(), now()"))
        db_name, server_time = row.one()
    return {"database": db_name, "server_time": server_time.isoformat()}

