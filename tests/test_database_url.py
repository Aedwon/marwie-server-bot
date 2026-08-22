from marwie_bot.db.session import normalize_database_url


def test_normalizes_plain_sqlite_url() -> None:
    assert (
        normalize_database_url("sqlite:///./data/test.db") == "sqlite+aiosqlite:///./data/test.db"
    )


def test_normalizes_postgres_url() -> None:
    assert (
        normalize_database_url("postgres://user:pass@example.com/db")
        == "postgresql+asyncpg://user:pass@example.com/db"
    )


def test_normalizes_postgresql_url() -> None:
    assert (
        normalize_database_url("postgresql://user:pass@example.com/db")
        == "postgresql+asyncpg://user:pass@example.com/db"
    )


def test_keeps_async_postgresql_url() -> None:
    value = "postgresql+asyncpg://user:pass@example.com/db"
    assert normalize_database_url(value) == value
