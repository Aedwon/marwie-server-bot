from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import func, select

from marwie_bot.db.models import CompromisedAccountIncident
from marwie_bot.db.session import Database
from marwie_bot.features.moderation.compromise_trap_repository import (
    ClaimDisposition,
    SQLAlchemyCompromiseTrapRepository,
)

ROOT = Path(__file__).resolve().parents[1]


def _database(tmp_path: Path) -> Database:
    path = tmp_path / "trap.db"
    url = f"sqlite+aiosqlite:///{path}"
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
    return Database(url)


async def _count(database: Database) -> int:
    async with database.session() as session:
        return int(
            (await session.execute(select(func.count()).select_from(CompromisedAccountIncident)))
            .scalar_one()
        )


@pytest.mark.asyncio
async def test_claim_persists_in_progress_incident_before_return(tmp_path: Path) -> None:
    database = _database(tmp_path)
    repository = SQLAlchemyCompromiseTrapRepository(database)
    triggered_at = datetime(2026, 9, 9, 3, 0, tzinfo=UTC)

    try:
        result = await repository.claim_incident(
            guild_id=10,
            target_id=20,
            trigger_channel_id=30,
            trigger_message_id=40,
            triggered_at=triggered_at,
            now=triggered_at,
        )

        assert result.disposition is ClaimDisposition.CLAIMED
        assert result.incident is not None
        assert result.incident.status == "in_progress"
        assert result.incident.guild_id == 10
        assert result.incident.target_id == 20
        assert result.incident.trigger_channel_id == 30
        assert result.incident.trigger_message_id == 40
        assert result.incident.active_key == "10:20"
        assert await _count(database) == 1
    finally:
        await database.close()


@pytest.mark.asyncio
async def test_active_same_user_is_in_flight_but_different_user_can_claim(tmp_path: Path) -> None:
    database = _database(tmp_path)
    repository = SQLAlchemyCompromiseTrapRepository(database)
    now = datetime(2026, 9, 9, 3, 5, tzinfo=UTC)

    try:
        first = await repository.claim_incident(
            guild_id=10,
            target_id=20,
            trigger_channel_id=30,
            trigger_message_id=41,
            triggered_at=now,
            now=now,
        )
        duplicate = await repository.claim_incident(
            guild_id=10,
            target_id=20,
            trigger_channel_id=30,
            trigger_message_id=42,
            triggered_at=now,
            now=now,
        )
        other_user = await repository.claim_incident(
            guild_id=10,
            target_id=21,
            trigger_channel_id=30,
            trigger_message_id=43,
            triggered_at=now,
            now=now,
        )

        assert first.disposition is ClaimDisposition.CLAIMED
        assert duplicate.disposition is ClaimDisposition.IN_FLIGHT
        assert other_user.disposition is ClaimDisposition.CLAIMED
        assert await _count(database) == 2
    finally:
        await database.close()


@pytest.mark.asyncio
async def test_finalize_clears_active_key_and_persists_durable_cooldown(tmp_path: Path) -> None:
    database = _database(tmp_path)
    repository = SQLAlchemyCompromiseTrapRepository(database)
    triggered_at = datetime(2026, 9, 9, 3, 10, tzinfo=UTC)
    finalized_at = triggered_at + timedelta(seconds=5)

    try:
        claimed = await repository.claim_incident(
            guild_id=10,
            target_id=20,
            trigger_channel_id=30,
            trigger_message_id=44,
            triggered_at=triggered_at,
            now=triggered_at,
        )
        assert claimed.incident is not None

        record = await repository.finalize_incident(
            claimed.incident.id,
            containment_status="partially_contained",
            ban_status="failed",
            ban_error="Forbidden: hierarchy",
            native_delete_requested=False,
            fallback_cleanup_run=True,
            deleted_message_count=7,
            failed_scopes=[{"scope_id": 99, "scope_name": "private", "error": "Forbidden"}],
            finalized_at=finalized_at,
            cooldown_seconds=60,
        )

        assert record.status == "completed"
        assert record.containment_status == "partially_contained"
        assert record.ban_status == "failed"
        assert record.ban_error == "Forbidden: hierarchy"
        assert record.native_delete_requested is False
        assert record.fallback_cleanup_run is True
        assert record.deleted_message_count == 7
        assert record.failed_scopes == (
            {"scope_id": 99, "scope_name": "private", "error": "Forbidden"},
        )
        assert record.active_key is None
        assert record.cooldown_until == finalized_at + timedelta(seconds=60)
    finally:
        await database.close()


@pytest.mark.asyncio
async def test_cooldown_blocks_then_expires_for_same_user(tmp_path: Path) -> None:
    database = _database(tmp_path)
    repository = SQLAlchemyCompromiseTrapRepository(database)
    triggered_at = datetime(2026, 9, 9, 3, 20, tzinfo=UTC)
    finalized_at = triggered_at + timedelta(seconds=2)

    try:
        claimed = await repository.claim_incident(
            guild_id=10,
            target_id=20,
            trigger_channel_id=30,
            trigger_message_id=45,
            triggered_at=triggered_at,
            now=triggered_at,
        )
        assert claimed.incident is not None
        await repository.finalize_incident(
            claimed.incident.id,
            containment_status="contained",
            ban_status="succeeded",
            ban_error=None,
            native_delete_requested=True,
            fallback_cleanup_run=False,
            deleted_message_count=0,
            failed_scopes=[],
            finalized_at=finalized_at,
            cooldown_seconds=60,
        )

        during = await repository.claim_incident(
            guild_id=10,
            target_id=20,
            trigger_channel_id=30,
            trigger_message_id=46,
            triggered_at=finalized_at + timedelta(seconds=10),
            now=finalized_at + timedelta(seconds=10),
        )
        after = await repository.claim_incident(
            guild_id=10,
            target_id=20,
            trigger_channel_id=30,
            trigger_message_id=47,
            triggered_at=finalized_at + timedelta(seconds=61),
            now=finalized_at + timedelta(seconds=61),
        )

        assert during.disposition is ClaimDisposition.COOLDOWN
        assert after.disposition is ClaimDisposition.CLAIMED
        assert await _count(database) == 2
    finally:
        await database.close()


@pytest.mark.asyncio
async def test_restart_reconciliation_is_idempotent_and_never_reclaims(tmp_path: Path) -> None:
    database = _database(tmp_path)
    repository = SQLAlchemyCompromiseTrapRepository(database)
    now = datetime(2026, 9, 9, 3, 30, tzinfo=UTC)

    try:
        claimed = await repository.claim_incident(
            guild_id=10,
            target_id=20,
            trigger_channel_id=30,
            trigger_message_id=48,
            triggered_at=now - timedelta(seconds=30),
            now=now - timedelta(seconds=30),
        )
        assert claimed.disposition is ClaimDisposition.CLAIMED

        interrupted = await repository.mark_in_progress_interrupted(now)
        second = await repository.mark_in_progress_interrupted(now + timedelta(seconds=1))

        assert len(interrupted) == 1
        assert interrupted[0].status == "interrupted"
        assert interrupted[0].containment_status == "interrupted"
        assert interrupted[0].active_key is None
        assert second == []
    finally:
        await database.close()


@pytest.mark.asyncio
async def test_duplicate_trigger_message_id_is_non_destructive(tmp_path: Path) -> None:
    database = _database(tmp_path)
    repository = SQLAlchemyCompromiseTrapRepository(database)
    now = datetime(2026, 9, 9, 3, 40, tzinfo=UTC)

    try:
        first = await repository.claim_incident(
            guild_id=10,
            target_id=20,
            trigger_channel_id=30,
            trigger_message_id=49,
            triggered_at=now,
            now=now,
        )
        duplicate_event = await repository.claim_incident(
            guild_id=11,
            target_id=21,
            trigger_channel_id=31,
            trigger_message_id=49,
            triggered_at=now,
            now=now,
        )

        assert first.disposition is ClaimDisposition.CLAIMED
        assert duplicate_event.disposition is ClaimDisposition.IN_FLIGHT
        assert await _count(database) == 1
    finally:
        await database.close()
