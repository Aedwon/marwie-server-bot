from __future__ import annotations

import importlib.util
import sqlite3
import sys
from datetime import UTC
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest

# These unit tests exercise pure migration helpers. Vercel installs its own
# asyncpg extension for serverless functions under a different Python runtime,
# so avoid importing that native extension into the isolated uv test runtime.
sys.modules.setdefault("asyncpg", ModuleType("asyncpg"))

MODULE_PATH = Path(__file__).resolve().parents[1] / "tools" / "migrate_sqlite_to_postgres.py"
SPEC = importlib.util.spec_from_file_location("migrate_sqlite_to_postgres", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
cutover = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = cutover
SPEC.loader.exec_module(cutover)


def test_copy_order_places_foreign_key_parents_first(tmp_path: Path) -> None:
    database = tmp_path / "source.sqlite3"
    connection = sqlite3.connect(database)
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("CREATE TABLE parent (id INTEGER PRIMARY KEY)")
        connection.execute(
            "CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parent(id))"
        )
        assert cutover._copy_order(connection, ["child", "parent"]) == ["parent", "child"]
    finally:
        connection.close()


def test_neon_target_kwargs_do_not_expose_libpq_only_options() -> None:
    kwargs = cutover._postgres_connect_kwargs(
        "postgresql://user:pass@example.neon.tech/db?sslmode=require&channel_binding=require"
    )
    assert kwargs == {
        "host": "example.neon.tech",
        "port": 5432,
        "user": "user",
        "password": "pass",
        "database": "db",
        "ssl": "require",
    }


def test_timestamp_conversion_assumes_utc_for_legacy_sqlite_values() -> None:
    value = cutover._convert_value("2026-08-27 01:02:03.000000", "timestamp with time zone")
    assert value.tzinfo is UTC
    assert value.isoformat() == "2026-08-27T01:02:03+00:00"


def test_json_conversion_is_canonical() -> None:
    assert cutover._convert_value('{"b": 2, "a": 1}', "json") == '{"a":1,"b":2}'


def test_source_path_rejects_non_sqlite_url() -> None:
    with pytest.raises(ValueError, match="SQLite"):
        cutover._source_path("postgresql://user:pass@example.com/db")


class FakeTransaction:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    async def __aenter__(self) -> None:
        self.connection.in_transaction = True

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: Any,
    ) -> None:
        self.connection.in_transaction = False


class FakeConnection:
    def __init__(self) -> None:
        self.in_transaction = False
        self.closed = False

    def transaction(self) -> FakeTransaction:
        return FakeTransaction(self)

    async def fetchval(self, query: str, *args: object) -> str | None:
        assert not self.in_transaction
        assert "alembic_version" in query
        return "0003"

    async def close(self) -> None:
        self.closed = True


async def test_apply_verifies_copy_inside_transaction(monkeypatch: pytest.MonkeyPatch) -> None:
    connection = FakeConnection()

    async def fake_upgrade_database(target_url: str) -> None:
        assert target_url == "postgresql://target"

    async def fake_connect(**kwargs: object) -> FakeConnection:
        assert kwargs
        return connection

    async def fake_prepare_snapshots(
        backup_path: Path, target: FakeConnection
    ) -> tuple[list[object], dict[str, list[object]]]:
        assert backup_path == Path("source.sqlite3")
        assert target is connection
        return [], {}

    async def fake_reset_sequences(target: FakeConnection, snapshots: list[object]) -> None:
        assert target is connection
        assert snapshots == []
        assert target.in_transaction

    async def fake_verify(
        target: FakeConnection,
        snapshots: list[object],
        metadata: dict[str, list[object]],
    ) -> dict[str, dict[str, object]]:
        assert target is connection
        assert snapshots == []
        assert metadata == {}
        assert target.in_transaction
        return {}

    monkeypatch.setattr(cutover, "upgrade_database", fake_upgrade_database)
    monkeypatch.setattr(cutover, "_postgres_connect_kwargs", lambda _: {"dsn": "target"})
    monkeypatch.setattr(cutover.asyncpg, "connect", fake_connect, raising=False)
    monkeypatch.setattr(cutover, "_prepare_snapshots", fake_prepare_snapshots)
    monkeypatch.setattr(cutover, "_reset_sequences", fake_reset_sequences)
    monkeypatch.setattr(cutover, "_verify", fake_verify)

    report, revision = await cutover._apply(Path("source.sqlite3"), "postgresql://target")

    assert report == {}
    assert revision == "0003"
    assert connection.closed
