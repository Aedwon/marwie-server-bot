from __future__ import annotations

import importlib.util
import sqlite3
import sys
from datetime import UTC
from pathlib import Path

import pytest

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
