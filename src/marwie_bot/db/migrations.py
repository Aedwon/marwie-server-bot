from __future__ import annotations

import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config

from marwie_bot.db.session import ensure_sqlite_parent, normalize_database_url


PROJECT_ROOT = Path(__file__).resolve().parents[3]


async def upgrade_database(database_url: str) -> None:
    normalized = normalize_database_url(database_url)
    ensure_sqlite_parent(normalized)

    config = Config(str(PROJECT_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(PROJECT_ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", normalized.replace("%", "%%"))
    await asyncio.to_thread(command.upgrade, config, "head")
