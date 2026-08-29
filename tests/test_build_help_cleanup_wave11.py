from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory

ROOT = Path(__file__).resolve().parents[1]
PREVIOUS_REVISION = "20260827_0003"
CLEANUP_REVISION = "20260830_0004"


def _config(database: Path) -> Config:
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", f"sqlite+aiosqlite:///{database}")
    return config


def _table_exists(database: Path, table: str) -> bool:
    with sqlite3.connect(database) as connection:
        row = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
        ).fetchone()
    return row is not None


def _seed_stale_build_help_config(database: Path, *, with_solution: bool) -> None:
    with sqlite3.connect(database) as connection:
        connection.execute("INSERT INTO guilds (guild_id) VALUES (1)")
        connection.execute(
            "INSERT INTO feature_flags (guild_id, feature, enabled) VALUES (1, 'build_help', 1)"
        )
        connection.execute(
            "INSERT INTO guild_resources (guild_id, key, resource_type, discord_id, updated_by) "
            "VALUES (1, 'build_help_forum', 'channel', 100, 1)"
        )
        connection.execute(
            "INSERT INTO guild_resources (guild_id, key, resource_type, discord_id, updated_by) "
            "VALUES (1, 'solved_tag', 'forum_tag', 101, 1)"
        )
        if with_solution:
            connection.execute(
                "INSERT INTO forum_solutions "
                "(guild_id, thread_id, answer_message_id, helper_id, solved_by, question_title) "
                "VALUES (1, 200, 201, 202, 203, 'Do not destroy')"
            )
        connection.commit()


def test_empty_forum_solutions_upgrade_drops_table_and_stale_configuration(tmp_path: Path) -> None:
    database = tmp_path / "empty.db"
    config = _config(database)
    command.upgrade(config, PREVIOUS_REVISION)
    _seed_stale_build_help_config(database, with_solution=False)

    command.upgrade(config, CLEANUP_REVISION)

    assert not _table_exists(database, "forum_solutions")
    with sqlite3.connect(database) as connection:
        assert (
            connection.execute(
                "SELECT COUNT(*) FROM feature_flags WHERE feature='build_help'"
            ).fetchone()[0]
            == 0
        )
        assert (
            connection.execute(
                "SELECT COUNT(*) FROM guild_resources WHERE key IN ('build_help_forum', 'solved_tag')"
            ).fetchone()[0]
            == 0
        )


def test_nonempty_forum_solutions_aborts_before_any_destructive_change(tmp_path: Path) -> None:
    database = tmp_path / "nonempty.db"
    config = _config(database)
    command.upgrade(config, PREVIOUS_REVISION)
    _seed_stale_build_help_config(database, with_solution=True)

    with pytest.raises(RuntimeError, match="forum_solutions"):
        command.upgrade(config, CLEANUP_REVISION)

    assert _table_exists(database, "forum_solutions")
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT COUNT(*) FROM forum_solutions").fetchone()[0] == 1
        assert (
            connection.execute(
                "SELECT COUNT(*) FROM feature_flags WHERE feature='build_help'"
            ).fetchone()[0]
            == 1
        )
        assert (
            connection.execute(
                "SELECT COUNT(*) FROM guild_resources WHERE key IN ('build_help_forum', 'solved_tag')"
            ).fetchone()[0]
            == 2
        )


def test_downgrade_recreates_compatible_empty_forum_solutions_schema(tmp_path: Path) -> None:
    database = tmp_path / "downgrade.db"
    config = _config(database)
    command.upgrade(config, CLEANUP_REVISION)
    assert not _table_exists(database, "forum_solutions")

    command.downgrade(config, PREVIOUS_REVISION)

    assert _table_exists(database, "forum_solutions")
    with sqlite3.connect(database) as connection:
        assert connection.execute("SELECT COUNT(*) FROM forum_solutions").fetchone()[0] == 0
        columns = {row[1] for row in connection.execute("PRAGMA table_info(forum_solutions)")}
        assert columns == {
            "id",
            "guild_id",
            "thread_id",
            "answer_message_id",
            "helper_id",
            "solved_by",
            "question_title",
            "answer_excerpt",
            "created_at",
        }
        indexes = {row[1] for row in connection.execute("PRAGMA index_list(forum_solutions)")}
        assert {
            "ix_forum_solutions_guild_id",
            "ix_forum_solutions_thread_id",
            "ix_forum_solutions_helper_id",
        } <= indexes


def test_cleanup_revision_follows_stage3_revision_and_is_head() -> None:
    migration = ROOT / "migrations/versions/20260830_0004_remove_build_help.py"
    assert migration.exists()

    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "migrations"))
    script = ScriptDirectory.from_config(config)

    assert script.get_heads() == [CLEANUP_REVISION]
    revision = script.get_revision(CLEANUP_REVISION)
    assert revision is not None
    assert revision.down_revision == PREVIOUS_REVISION
