from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import re
import sqlite3
import sys
import tempfile
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import asyncpg
from sqlalchemy.engine import make_url

from marwie_bot.db.migrations import upgrade_database
from marwie_bot.db.session import normalize_database_url

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_EXCLUDED_SOURCE_TABLES = {"alembic_version", "sqlite_sequence"}
_JSON_TYPES = {"json", "jsonb"}
_INTEGER_TYPES = {"smallint", "integer", "bigint"}
_FLOAT_TYPES = {"real", "double precision", "numeric", "decimal"}
_TIMESTAMP_TYPES = {"timestamp with time zone", "timestamp without time zone"}


@dataclass(frozen=True, slots=True)
class TargetColumn:
    name: str
    data_type: str


@dataclass(frozen=True, slots=True)
class TableSnapshot:
    name: str
    columns: tuple[str, ...]
    primary_key: tuple[str, ...]
    rows: tuple[tuple[Any, ...], ...]
    digest: str


def _quote(identifier: str) -> str:
    if not _IDENTIFIER.fullmatch(identifier):
        raise ValueError(f"Unsafe SQL identifier: {identifier!r}")
    return f'"{identifier}"'


def _source_path(database_url: str) -> Path:
    normalized = normalize_database_url(database_url)
    url = make_url(normalized)
    if not url.drivername.startswith("sqlite"):
        raise ValueError("Source database must be SQLite.")
    if not url.database or url.database == ":memory:":
        raise ValueError("Source database must be a persistent SQLite file.")
    path = Path(url.database).expanduser()
    if not path.is_absolute():
        path = Path.cwd() / path
    path = path.resolve()
    if not path.is_file():
        raise FileNotFoundError(f"SQLite source does not exist: {path}")
    return path


def _postgres_connect_kwargs(database_url: str) -> dict[str, Any]:
    normalized = normalize_database_url(database_url)
    url = make_url(normalized)
    if url.drivername != "postgresql+asyncpg":
        raise ValueError("Migration target must be PostgreSQL.")
    if not url.host or not url.database or not url.username:
        raise ValueError("Migration target PostgreSQL URL is incomplete.")

    kwargs: dict[str, Any] = {
        "host": url.host,
        "port": url.port or 5432,
        "user": url.username,
        "password": url.password,
        "database": url.database,
    }
    ssl_value = url.query.get("ssl")
    if ssl_value is not None:
        kwargs["ssl"] = ssl_value
    return kwargs


def _sqlite_backup(source: Path, destination: Path) -> None:
    source_connection = sqlite3.connect(f"file:{source}?mode=ro", uri=True, timeout=30)
    try:
        destination_connection = sqlite3.connect(destination)
        try:
            source_connection.backup(destination_connection)
            destination_connection.execute("PRAGMA foreign_keys = ON")
        finally:
            destination_connection.close()
    finally:
        source_connection.close()


def _source_tables(connection: sqlite3.Connection) -> list[str]:
    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    ).fetchall()
    tables = [str(row[0]) for row in rows if str(row[0]) not in _EXCLUDED_SOURCE_TABLES]
    for table in tables:
        _quote(table)
    return tables


def _source_columns(connection: sqlite3.Connection, table: str) -> tuple[list[str], list[str]]:
    rows = connection.execute(f"PRAGMA table_info({_quote(table)})").fetchall()
    columns = [str(row[1]) for row in rows]
    primary_key = [str(row[1]) for row in sorted(rows, key=lambda row: int(row[5])) if int(row[5])]
    if not columns:
        raise RuntimeError(f"Source table `{table}` has no columns.")
    return columns, primary_key


def _copy_order(connection: sqlite3.Connection, tables: list[str]) -> list[str]:
    table_set = set(tables)
    dependencies: dict[str, set[str]] = {table: set() for table in tables}
    for table in tables:
        for row in connection.execute(f"PRAGMA foreign_key_list({_quote(table)})").fetchall():
            dependency = str(row[2])
            if dependency in table_set and dependency != table:
                dependencies[table].add(dependency)

    ordered: list[str] = []
    pending = {table: set(values) for table, values in dependencies.items()}
    while pending:
        ready = sorted(table for table, values in pending.items() if not values)
        if not ready:
            raise RuntimeError(f"Could not resolve source foreign-key order: {sorted(pending)}")
        for table in ready:
            ordered.append(table)
            pending.pop(table)
        for values in pending.values():
            values.difference_update(ready)
    return ordered


def _parse_datetime(value: Any, *, with_timezone: bool) -> datetime:
    if isinstance(value, datetime):
        result = value
    else:
        text = str(value).strip().replace("Z", "+00:00")
        result = datetime.fromisoformat(text)
    if with_timezone:
        if result.tzinfo is None:
            return result.replace(tzinfo=UTC)
        return result.astimezone(UTC)
    if result.tzinfo is not None:
        return result.astimezone(UTC).replace(tzinfo=None)
    return result


def _convert_value(value: Any, data_type: str) -> Any:
    if value is None:
        return None
    if data_type in _JSON_TYPES:
        if isinstance(value, str):
            parsed = json.loads(value)
        else:
            parsed = value
        # asyncpg's native JSON codec accepts JSON text.
        return json.dumps(parsed, sort_keys=True, separators=(",", ":"))
    if data_type == "boolean":
        return bool(value)
    if data_type in _INTEGER_TYPES:
        return int(value)
    if data_type in _FLOAT_TYPES:
        return float(value)
    if data_type in _TIMESTAMP_TYPES:
        return _parse_datetime(value, with_timezone=data_type == "timestamp with time zone")
    if data_type == "date":
        return _parse_datetime(value, with_timezone=False).date()
    return value


def _canonical_value(value: Any, data_type: str) -> Any:
    if value is None:
        return None
    if data_type in _JSON_TYPES:
        if isinstance(value, str):
            return json.loads(value)
        return value
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(UTC)
        return value.isoformat()
    if hasattr(value, "isoformat") and data_type == "date":
        return value.isoformat()
    if data_type == "boolean":
        return bool(value)
    if data_type in _INTEGER_TYPES:
        return int(value)
    if data_type in _FLOAT_TYPES:
        return float(value)
    return value


def _digest_rows(rows: list[tuple[Any, ...]], columns: list[TargetColumn]) -> str:
    digest = hashlib.sha256()
    for row in rows:
        canonical = [
            _canonical_value(value, column.data_type)
            for value, column in zip(row, columns, strict=True)
        ]
        digest.update(
            json.dumps(canonical, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode(
                "utf-8"
            )
        )
        digest.update(b"\n")
    return digest.hexdigest()


async def _target_columns(connection: asyncpg.Connection, table: str) -> list[TargetColumn]:
    rows = await connection.fetch(
        """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
        """,
        table,
    )
    return [TargetColumn(str(row["column_name"]), str(row["data_type"])) for row in rows]


async def _target_tables(connection: asyncpg.Connection) -> set[str]:
    rows = await connection.fetch(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        """
    )
    return {str(row["table_name"]) for row in rows}


def _load_source_table(
    connection: sqlite3.Connection,
    table: str,
    target_columns: list[TargetColumn],
) -> TableSnapshot:
    source_columns, primary_key = _source_columns(connection, table)
    target_by_name = {column.name: column for column in target_columns}
    missing = [column for column in source_columns if column not in target_by_name]
    if missing:
        raise RuntimeError(f"Target table `{table}` is missing source columns: {missing}")

    columns = [target_by_name[name] for name in source_columns]
    select_columns = ", ".join(_quote(name) for name in source_columns)
    order_columns = primary_key or source_columns
    order_by = ", ".join(_quote(name) for name in order_columns)
    raw_rows = connection.execute(
        f"SELECT {select_columns} FROM {_quote(table)} ORDER BY {order_by}"
    ).fetchall()
    rows = [
        tuple(
            _convert_value(value, column.data_type)
            for value, column in zip(row, columns, strict=True)
        )
        for row in raw_rows
    ]
    return TableSnapshot(
        name=table,
        columns=tuple(source_columns),
        primary_key=tuple(primary_key),
        rows=tuple(rows),
        digest=_digest_rows(rows, columns),
    )


async def _target_count(connection: asyncpg.Connection, table: str) -> int:
    return int(await connection.fetchval(f"SELECT COUNT(*) FROM {_quote(table)}"))


async def _target_digest(
    connection: asyncpg.Connection,
    snapshot: TableSnapshot,
    columns: list[TargetColumn],
) -> str:
    target_by_name = {column.name: column for column in columns}
    selected = [target_by_name[name] for name in snapshot.columns]
    select_columns = ", ".join(_quote(name) for name in snapshot.columns)
    order_columns = snapshot.primary_key or snapshot.columns
    order_by = ", ".join(_quote(name) for name in order_columns)
    records = await connection.fetch(
        f"SELECT {select_columns} FROM {_quote(snapshot.name)} ORDER BY {order_by}"
    )
    rows = [tuple(record[name] for name in snapshot.columns) for record in records]
    return _digest_rows(rows, selected)


async def _reset_sequences(connection: asyncpg.Connection, snapshots: list[TableSnapshot]) -> None:
    for snapshot in snapshots:
        for column in snapshot.columns:
            sequence = await connection.fetchval(
                "SELECT pg_get_serial_sequence($1, $2)", snapshot.name, column
            )
            if not sequence:
                continue
            maximum = await connection.fetchval(
                f"SELECT MAX({_quote(column)}) FROM {_quote(snapshot.name)}"
            )
            if maximum is None:
                continue
            await connection.execute(
                "SELECT setval($1::regclass, $2::bigint, true)", str(sequence), int(maximum)
            )


async def _verify(
    connection: asyncpg.Connection,
    snapshots: list[TableSnapshot],
    target_metadata: dict[str, list[TargetColumn]],
) -> dict[str, dict[str, Any]]:
    report: dict[str, dict[str, Any]] = {}
    failures: list[str] = []
    for snapshot in snapshots:
        target_count = await _target_count(connection, snapshot.name)
        target_digest = await _target_digest(connection, snapshot, target_metadata[snapshot.name])
        count_ok = target_count == len(snapshot.rows)
        digest_ok = target_digest == snapshot.digest
        report[snapshot.name] = {
            "source_rows": len(snapshot.rows),
            "target_rows": target_count,
            "count_ok": count_ok,
            "digest_ok": digest_ok,
            "sha256": snapshot.digest,
        }
        if not count_ok or not digest_ok:
            failures.append(snapshot.name)
    if failures:
        raise RuntimeError(f"Migration verification failed for tables: {', '.join(failures)}")
    return report


async def _prepare_snapshots(
    backup_path: Path, target: asyncpg.Connection
) -> tuple[list[TableSnapshot], dict[str, list[TargetColumn]]]:
    source = sqlite3.connect(backup_path)
    try:
        source.execute("PRAGMA foreign_keys = ON")
        tables = _source_tables(source)
        target_tables = await _target_tables(target)
        missing = [table for table in tables if table not in target_tables]
        if missing:
            raise RuntimeError(f"Target schema is missing source tables: {missing}")
        ordered = _copy_order(source, tables)
        metadata = {table: await _target_columns(target, table) for table in ordered}
        snapshots = [_load_source_table(source, table, metadata[table]) for table in ordered]
        return snapshots, metadata
    finally:
        source.close()


async def _apply(
    backup_path: Path, target_url: str
) -> tuple[dict[str, dict[str, Any]], str | None]:
    await upgrade_database(target_url)
    connection = await asyncpg.connect(**_postgres_connect_kwargs(target_url))
    try:
        snapshots, metadata = await _prepare_snapshots(backup_path, connection)
        nonempty = [
            snapshot.name
            for snapshot in snapshots
            if await _target_count(connection, snapshot.name) != 0
        ]
        if nonempty:
            raise RuntimeError(
                "Target application tables are not empty; refusing to overwrite: "
                + ", ".join(nonempty)
            )

        async with connection.transaction():
            for snapshot in snapshots:
                if not snapshot.rows:
                    continue
                columns = ", ".join(_quote(name) for name in snapshot.columns)
                placeholders = ", ".join(
                    f"${index}" for index in range(1, len(snapshot.columns) + 1)
                )
                statement = (
                    f"INSERT INTO {_quote(snapshot.name)} ({columns}) VALUES ({placeholders})"
                )
                await connection.executemany(statement, list(snapshot.rows))
            await _reset_sequences(connection, snapshots)

        report = await _verify(connection, snapshots, metadata)
        revision = await connection.fetchval("SELECT version_num FROM alembic_version LIMIT 1")
        return report, str(revision) if revision is not None else None
    finally:
        await connection.close()


async def _verify_only(
    backup_path: Path, target_url: str
) -> tuple[dict[str, dict[str, Any]], str | None]:
    connection = await asyncpg.connect(**_postgres_connect_kwargs(target_url))
    try:
        snapshots, metadata = await _prepare_snapshots(backup_path, connection)
        report = await _verify(connection, snapshots, metadata)
        revision = await connection.fetchval("SELECT version_num FROM alembic_version LIMIT 1")
        return report, str(revision) if revision is not None else None
    finally:
        await connection.close()


def _inspect(backup_path: Path) -> dict[str, int]:
    connection = sqlite3.connect(backup_path)
    try:
        return {
            table: int(connection.execute(f"SELECT COUNT(*) FROM {_quote(table)}").fetchone()[0])
            for table in _copy_order(connection, _source_tables(connection))
        }
    finally:
        connection.close()


def _write_report(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Safely migrate Rob-bot's SQLite database to an empty PostgreSQL target."
    )
    parser.add_argument(
        "--source",
        default=os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./data/marwie.db"),
        help="SQLite URL. Defaults to DATABASE_URL or ./data/marwie.db.",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Upgrade, copy and verify the target.")
    mode.add_argument("--verify", action="store_true", help="Verify an already-copied target only.")
    parser.add_argument(
        "--target-env",
        default="MIGRATION_TARGET_DATABASE_URL",
        help="Environment variable containing the PostgreSQL target URL.",
    )
    parser.add_argument(
        "--report",
        default="data/sqlite-to-postgres-report.json",
        help="Safe JSON report path. Connection strings are never written.",
    )
    args = parser.parse_args()

    source_path = _source_path(args.source)
    target_url = os.environ.get(args.target_env, "").strip()
    if (args.apply or args.verify) and not target_url:
        parser.error(f"{args.target_env} must be set for --apply/--verify.")

    with tempfile.TemporaryDirectory(prefix="rob-bot-cutover-") as temp_dir:
        backup_path = Path(temp_dir) / "source-snapshot.sqlite3"
        _sqlite_backup(source_path, backup_path)
        backup_sha = hashlib.sha256(backup_path.read_bytes()).hexdigest()
        created_at = datetime.now(UTC).isoformat()

        if not args.apply and not args.verify:
            counts = _inspect(backup_path)
            payload = {
                "mode": "inspect",
                "created_at": created_at,
                "source_snapshot_sha256": backup_sha,
                "tables": {name: {"source_rows": count} for name, count in counts.items()},
            }
        else:
            if args.apply:
                tables, revision = await _apply(backup_path, target_url)
                selected_mode = "apply"
            else:
                tables, revision = await _verify_only(backup_path, target_url)
                selected_mode = "verify"
            payload = {
                "mode": selected_mode,
                "created_at": created_at,
                "source_snapshot_sha256": backup_sha,
                "target_alembic_revision": revision,
                "tables": tables,
                "verified": True,
            }

        report_path = Path(args.report).expanduser()
        _write_report(report_path, payload)
        print(f"Migration mode: {payload['mode']}")
        print(f"Source snapshot SHA-256: {backup_sha}")
        for table, values in payload["tables"].items():
            if "target_rows" in values:
                print(
                    f"{table}: {values['source_rows']} -> {values['target_rows']} "
                    f"count={'PASS' if values['count_ok'] else 'FAIL'} "
                    f"digest={'PASS' if values['digest_ok'] else 'FAIL'}"
                )
            else:
                print(f"{table}: {values['source_rows']} rows")
        print(f"Report: {report_path}")
        if payload.get("verified"):
            print("MIGRATION_VERIFIED")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except KeyboardInterrupt:
        raise SystemExit(130) from None
    except Exception as error:
        print(f"MIGRATION_FAILED: {error}", file=sys.stderr)
        raise SystemExit(1) from error
