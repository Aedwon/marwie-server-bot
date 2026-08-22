from __future__ import annotations

from typing import Any

from sqlalchemy import select

from marwie_bot.config.resources import FeatureName, ResourceKey, ResourceType
from marwie_bot.db.models import FeatureFlag, Guild, GuildResource
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.service import FeatureConfigRecord, GuildResourceRecord


async def _ensure_guild(session: Any, guild_id: int) -> None:
    if await session.get(Guild, guild_id) is None:
        session.add(Guild(guild_id=guild_id))
        await session.flush()


class SQLAlchemyResourceRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _record(model: GuildResource) -> GuildResourceRecord:
        return GuildResourceRecord(
            guild_id=model.guild_id,
            key=ResourceKey(model.key),
            resource_type=ResourceType(model.resource_type),
            discord_id=model.discord_id,
            updated_by=model.updated_by,
        )

    async def get(self, guild_id: int, key: ResourceKey) -> GuildResourceRecord | None:
        async with self.database.session() as session:
            statement = select(GuildResource).where(
                GuildResource.guild_id == guild_id,
                GuildResource.key == key.value,
            )
            model = (await session.execute(statement)).scalar_one_or_none()
            return self._record(model) if model is not None else None

    async def list_for_guild(self, guild_id: int) -> list[GuildResourceRecord]:
        async with self.database.session() as session:
            statement = (
                select(GuildResource)
                .where(GuildResource.guild_id == guild_id)
                .order_by(GuildResource.key)
            )
            models = (await session.execute(statement)).scalars().all()
            return [self._record(model) for model in models]

    async def set(
        self,
        guild_id: int,
        key: ResourceKey,
        resource_type: ResourceType,
        discord_id: int,
        updated_by: int,
    ) -> GuildResourceRecord:
        async with self.database.session() as session:
            await _ensure_guild(session, guild_id)
            statement = select(GuildResource).where(
                GuildResource.guild_id == guild_id,
                GuildResource.key == key.value,
            )
            model = (await session.execute(statement)).scalar_one_or_none()
            if model is None:
                model = GuildResource(
                    guild_id=guild_id,
                    key=key.value,
                    resource_type=resource_type.value,
                    discord_id=discord_id,
                    updated_by=updated_by,
                )
                session.add(model)
            else:
                model.resource_type = resource_type.value
                model.discord_id = discord_id
                model.updated_by = updated_by
            await session.commit()
            await session.refresh(model)
            return self._record(model)


class SQLAlchemyFeatureConfigRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _record(model: FeatureFlag) -> FeatureConfigRecord:
        return FeatureConfigRecord(
            guild_id=model.guild_id,
            feature=FeatureName(model.feature),
            enabled=model.enabled,
            config=dict(model.config_json or {}),
        )

    async def get(self, guild_id: int, feature: FeatureName) -> FeatureConfigRecord | None:
        async with self.database.session() as session:
            statement = select(FeatureFlag).where(
                FeatureFlag.guild_id == guild_id,
                FeatureFlag.feature == feature.value,
            )
            model = (await session.execute(statement)).scalar_one_or_none()
            return self._record(model) if model is not None else None

    async def set(
        self,
        guild_id: int,
        feature: FeatureName,
        enabled: bool,
        config: dict[str, Any],
    ) -> FeatureConfigRecord:
        async with self.database.session() as session:
            await _ensure_guild(session, guild_id)
            statement = select(FeatureFlag).where(
                FeatureFlag.guild_id == guild_id,
                FeatureFlag.feature == feature.value,
            )
            model = (await session.execute(statement)).scalar_one_or_none()
            if model is None:
                model = FeatureFlag(
                    guild_id=guild_id,
                    feature=feature.value,
                    enabled=enabled,
                    config_json=dict(config),
                )
                session.add(model)
            else:
                model.enabled = enabled
                model.config_json = dict(config)
            await session.commit()
            await session.refresh(model)
            return self._record(model)
