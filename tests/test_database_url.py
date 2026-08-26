from sqlalchemy.engine import make_url

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


def test_normalizes_neon_sslmode_for_asyncpg() -> None:
    normalized = normalize_database_url(
        "postgresql://user:pass@example.neon.tech/db?sslmode=require&channel_binding=require"
    )
    url = make_url(normalized)

    assert url.drivername == "postgresql+asyncpg"
    assert url.query["ssl"] == "require"
    assert "sslmode" not in url.query
    assert "channel_binding" not in url.query


def test_preserves_explicit_asyncpg_ssl_override() -> None:
    normalized = normalize_database_url(
        "postgresql+asyncpg://user:pass@example.neon.tech/db?ssl=verify-full&sslmode=require"
    )
    url = make_url(normalized)

    assert url.query["ssl"] == "verify-full"
    assert "sslmode" not in url.query
