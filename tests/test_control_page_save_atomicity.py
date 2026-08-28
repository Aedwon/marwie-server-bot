from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

from marwie_bot.config.resources import FeatureName
from marwie_bot.db.base import Base
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService
from marwie_bot.features.control_plane.domain import (
    ControlActionRecord,
    ControlActionStatus,
    ControlActionType,
)
from marwie_bot.features.control_plane.page_revisions import page_revision
from marwie_bot.features.control_plane.page_save_executor import PageSaveExecutor
from marwie_bot.features.control_plane.repository import SQLAlchemyControlRepository

GUILD_ID = 123
ACTOR_ID = 456
PAGE_KEY = "/control/community/reputation"

INITIAL_THRESHOLDS = {
    "builder": 50,
    "contributor": 150,
    "mentor": 500,
}
UPDATED_THRESHOLDS = {
    "builder": 60,
    "contributor": 160,
    "mentor": 510,
}


async def _database() -> Database:
    database = Database("sqlite+aiosqlite:///:memory:")
    async with database.engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    return database


class RepositoryBackedSnapshots:
    def __init__(
        self,
        repository: SQLAlchemyFeatureConfigRepository,
    ) -> None:
        self.repository = repository

    async def build(self, guild: object) -> dict[str, Any]:
        record = await self.repository.get(
            guild.id,  # type: ignore[attr-defined]
            FeatureName.REPUTATION,
        )
        assert record is not None
        return {
            "features": [
                {
                    "name": "reputation",
                    "enabled": record.enabled,
                }
            ],
            "reputation": {
                "thresholds": dict(
                    record.config.get(
                        "thresholds",
                        INITIAL_THRESHOLDS,
                    )
                )
            },
        }


class RepositoryBackedExecutor:
    def __init__(
        self,
        database: Database,
        repository: SQLAlchemyFeatureConfigRepository,
        *,
        fail_threshold_update: bool,
    ) -> None:
        self.features = FeatureConfigService(repository)
        self.control = SQLAlchemyControlRepository(database)
        self.fail_threshold_update = fail_threshold_update

    async def _actor(self, guild: object, actor_id: int) -> object:
        del guild, actor_id
        return object()

    def _require_actor_permission(
        self,
        actor: object,
        action_type: ControlActionType,
    ) -> None:
        del actor, action_type

    async def execute(
        self,
        action: ControlActionRecord,
    ) -> dict[str, Any]:
        if action.action_type is ControlActionType.SET_FEATURE:
            record = await self.features.set_enabled(
                action.guild_id,
                FeatureName.REPUTATION,
                bool(action.payload["enabled"]),
            )
            return {
                "feature": "reputation",
                "enabled": record.enabled,
            }

        if action.action_type is ControlActionType.SET_REPUTATION_THRESHOLDS:
            if self.fail_threshold_update:
                raise ValueError("simulated later database mutation failure")

            values = {
                "builder": int(action.payload["builder"]),
                "contributor": int(action.payload["contributor"]),
                "mentor": int(action.payload["mentor"]),
            }
            await self.features.update_config(
                action.guild_id,
                FeatureName.REPUTATION,
                {"thresholds": values},
            )
            return {"thresholds": values}

        raise AssertionError(f"Unexpected nested action: {action.action_type}")


def _action(base_revision: str) -> ControlActionRecord:
    now = datetime.now(UTC)
    return ControlActionRecord(
        id="page-save-atomicity",
        guild_id=GUILD_ID,
        actor_id=ACTOR_ID,
        action_type=ControlActionType.SAVE_PAGE,
        payload={
            "page_key": PAGE_KEY,
            "base_revision": base_revision,
            "changes": [
                {
                    "action_type": ControlActionType.SET_FEATURE.value,
                    "payload": {
                        "feature": "reputation",
                        "enabled": True,
                    },
                },
                {
                    "action_type": (ControlActionType.SET_REPUTATION_THRESHOLDS.value),
                    "payload": UPDATED_THRESHOLDS,
                },
            ],
        },
        idempotency_key="page-save-atomicity",
        status=ControlActionStatus.CLAIMED,
        claimed_by="test-worker",
        result=None,
        user_error=None,
        error_reference=None,
        created_at=now,
        claimed_at=now,
        finished_at=None,
    )


async def _seed(
    repository: SQLAlchemyFeatureConfigRepository,
) -> None:
    await repository.set(
        GUILD_ID,
        FeatureName.REPUTATION,
        False,
        {"thresholds": INITIAL_THRESHOLDS},
    )


async def test_db_only_page_save_rolls_back_real_repository_mutations_together() -> None:
    database = await _database()
    repository = SQLAlchemyFeatureConfigRepository(database)

    try:
        await _seed(repository)

        guild = SimpleNamespace(id=GUILD_ID)
        snapshots = RepositoryBackedSnapshots(repository)
        before = await snapshots.build(guild)
        base_revision = page_revision(before, PAGE_KEY)

        nested = RepositoryBackedExecutor(
            database,
            repository,
            fail_threshold_update=True,
        )
        executor = PageSaveExecutor(
            bot=SimpleNamespace(get_guild=lambda guild_id: guild if guild_id == GUILD_ID else None),
            executor=nested,  # type: ignore[arg-type]
            snapshots=snapshots,  # type: ignore[arg-type]
        )

        result = await executor.execute(
            _action(base_revision),
        )

        persisted = await repository.get(
            GUILD_ID,
            FeatureName.REPUTATION,
        )
        assert persisted is not None

        # Mandatory rollback proof: the first mutation must not survive
        # failure of the later compatible DB-only mutation.
        assert persisted.enabled is False
        assert persisted.config["thresholds"] == INITIAL_THRESHOLDS

        assert result["outcome"] == "partial"
        assert result["applied_indices"] == []
        assert result["failed_indices"] == [1]
        assert result["items"][0]["status"] == "rolled_back"
        assert result["revision"] == base_revision
    finally:
        await database.close()


async def test_db_only_page_save_commits_real_repository_mutations_together() -> None:
    database = await _database()
    repository = SQLAlchemyFeatureConfigRepository(database)

    try:
        await _seed(repository)

        guild = SimpleNamespace(id=GUILD_ID)
        snapshots = RepositoryBackedSnapshots(repository)
        before = await snapshots.build(guild)
        base_revision = page_revision(before, PAGE_KEY)

        nested = RepositoryBackedExecutor(
            database,
            repository,
            fail_threshold_update=False,
        )
        executor = PageSaveExecutor(
            bot=SimpleNamespace(get_guild=lambda guild_id: guild if guild_id == GUILD_ID else None),
            executor=nested,  # type: ignore[arg-type]
            snapshots=snapshots,  # type: ignore[arg-type]
        )

        result = await executor.execute(
            _action(base_revision),
        )

        persisted = await repository.get(
            GUILD_ID,
            FeatureName.REPUTATION,
        )
        assert persisted is not None
        assert persisted.enabled is True
        assert persisted.config["thresholds"] == UPDATED_THRESHOLDS

        assert result["outcome"] == "saved"
        assert result["applied_indices"] == [0, 1]
        assert result["failed_indices"] == []
        assert result["revision"] != base_revision
    finally:
        await database.close()
