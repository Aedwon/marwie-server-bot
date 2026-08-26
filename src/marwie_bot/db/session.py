from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


def normalize_database_url(database_url: str) -> str:
    value = database_url.strip()
    if value.startswith(("postgres://", "postgresql://", "postgresql+asyncpg://")):
        url = make_url(value)
        if url.drivername in {"postgres", "postgresql"}:
            url = url.set(drivername="postgresql+asyncpg")

        # Neon exposes libpq-style connection strings. SQLAlchemy's asyncpg
        # dialect forwards URL query parameters as asyncpg keyword arguments,
        # where `ssl` is supported but `sslmode` / `channel_binding` are not.
        query = dict(url.query)
        sslmode = query.pop("sslmode", None)
        query.pop("channel_binding", None)
        if sslmode is not None and "ssl" not in query:
            query["ssl"] = sslmode
        url = url.set(query=query)
        return url.render_as_string(hide_password=False)

    if value.startswith("sqlite:///"):
        return "sqlite+aiosqlite:///" + value.removeprefix("sqlite:///")
    return value


def ensure_sqlite_parent(database_url: str) -> None:
    normalized = normalize_database_url(database_url)
    url = make_url(normalized)
    if not url.drivername.startswith("sqlite"):
        return
    if not url.database or url.database == ":memory:":
        return
    Path(url.database).expanduser().parent.mkdir(parents=True, exist_ok=True)


class Database:
    def __init__(self, database_url: str, *, read_only: bool = False) -> None:
        self.url = normalize_database_url(database_url)
        self.read_only = read_only
        ensure_sqlite_parent(self.url)
        self.engine = create_async_engine(self.url, pool_pre_ping=True)

        if read_only and make_url(self.url).drivername.startswith("sqlite"):

            @event.listens_for(self.engine.sync_engine, "connect")
            def _enable_query_only(dbapi_connection: object, _connection_record: object) -> None:
                cursor = dbapi_connection.cursor()  # type: ignore[attr-defined]
                try:
                    cursor.execute("PRAGMA query_only=ON")
                finally:
                    cursor.close()

        self.session_factory = async_sessionmaker(
            self.engine, expire_on_commit=False, class_=AsyncSession
        )

    @asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        async with self.session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    async def close(self) -> None:
        await self.engine.dispose()
