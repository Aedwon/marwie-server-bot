from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from marwie_bot.db.session import Database


@pytest.mark.asyncio
async def test_sqlite_cutover_mode_is_query_only() -> None:
    database = Database("sqlite+aiosqlite:///:memory:", read_only=True)
    try:
        async with database.session() as session:
            assert int((await session.execute(text("PRAGMA query_only"))).scalar_one()) == 1
            with pytest.raises(OperationalError):
                await session.execute(
                    text("CREATE TABLE should_not_exist (id INTEGER PRIMARY KEY)")
                )
    finally:
        await database.close()
