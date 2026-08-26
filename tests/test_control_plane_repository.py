from marwie_bot.db.base import Base
from marwie_bot.db.session import Database
from marwie_bot.features.control_plane.domain import ControlActionStatus, ControlActionType
from marwie_bot.features.control_plane.repository import SQLAlchemyControlRepository


async def _database() -> Database:
    database = Database("sqlite+aiosqlite:///:memory:")
    async with database.engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    return database


async def test_enqueue_is_idempotent_for_same_actor_guild_and_key() -> None:
    database = await _database()
    repository = SQLAlchemyControlRepository(database)
    try:
        first = await repository.enqueue(
            guild_id=100,
            actor_id=200,
            action_type=ControlActionType.SET_FEATURE,
            payload={"feature": "tickets", "enabled": False},
            idempotency_key="request-1",
        )
        second = await repository.enqueue(
            guild_id=100,
            actor_id=200,
            action_type=ControlActionType.SET_FEATURE,
            payload={"feature": "tickets", "enabled": False},
            idempotency_key="request-1",
        )

        assert second.id == first.id
        assert second.status is ControlActionStatus.QUEUED
    finally:
        await database.close()


async def test_claim_next_claims_one_action_only_once() -> None:
    database = await _database()
    repository = SQLAlchemyControlRepository(database)
    try:
        queued = await repository.enqueue(
            guild_id=100,
            actor_id=200,
            action_type=ControlActionType.SET_FEATURE,
            payload={"feature": "tickets", "enabled": True},
            idempotency_key="request-2",
        )

        claimed = await repository.claim_next("worker-a")
        assert claimed is not None
        assert claimed.id == queued.id
        assert claimed.status is ControlActionStatus.CLAIMED
        assert claimed.claimed_by == "worker-a"
        assert await repository.claim_next("worker-b") is None
    finally:
        await database.close()


async def test_action_can_complete_with_sanitized_result() -> None:
    database = await _database()
    repository = SQLAlchemyControlRepository(database)
    try:
        queued = await repository.enqueue(
            guild_id=100,
            actor_id=200,
            action_type=ControlActionType.SET_FEATURE,
            payload={"feature": "tickets", "enabled": True},
            idempotency_key="request-3",
        )
        await repository.claim_next("worker-a")

        completed = await repository.complete(queued.id, {"feature": "tickets", "enabled": True})

        assert completed is not None
        assert completed.status is ControlActionStatus.COMPLETED
        assert completed.result == {"feature": "tickets", "enabled": True}
        assert completed.finished_at is not None
    finally:
        await database.close()


async def test_snapshot_upsert_replaces_previous_guild_state() -> None:
    database = await _database()
    repository = SQLAlchemyControlRepository(database)
    try:
        await repository.upsert_snapshot(100, {"guild": {"name": "Before"}}, "worker-a")
        await repository.upsert_snapshot(100, {"guild": {"name": "After"}}, "worker-b")

        snapshot = await repository.get_snapshot(100)
        assert snapshot is not None
        assert snapshot.snapshot == {"guild": {"name": "After"}}
        assert snapshot.worker_version == "worker-b"
    finally:
        await database.close()
