from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Protocol

from marwie_bot.config.resources import RESOURCE_TYPES, FeatureName, ResourceKey, ResourceType


@dataclass(frozen=True, slots=True)
class GuildResourceRecord:
    guild_id: int
    key: ResourceKey
    resource_type: ResourceType
    discord_id: int
    updated_by: int


@dataclass(frozen=True, slots=True)
class FeatureConfigRecord:
    guild_id: int
    feature: FeatureName
    enabled: bool
    config: dict[str, Any]


class ResourceRepository(Protocol):
    async def get(self, guild_id: int, key: ResourceKey) -> GuildResourceRecord | None: ...

    async def list_for_guild(self, guild_id: int) -> list[GuildResourceRecord]: ...

    async def set(
        self,
        guild_id: int,
        key: ResourceKey,
        resource_type: ResourceType,
        discord_id: int,
        updated_by: int,
    ) -> GuildResourceRecord: ...

    async def clear(self, guild_id: int, key: ResourceKey) -> bool: ...


class FeatureConfigRepository(Protocol):
    async def get(self, guild_id: int, feature: FeatureName) -> FeatureConfigRecord | None: ...

    async def list_for_guild(self, guild_id: int) -> list[FeatureConfigRecord]: ...

    async def set_enabled(
        self,
        guild_id: int,
        feature: FeatureName,
        enabled: bool,
    ) -> FeatureConfigRecord: ...

    async def set(
        self,
        guild_id: int,
        feature: FeatureName,
        enabled: bool,
        config: dict[str, Any],
    ) -> FeatureConfigRecord: ...


class ResourceService:
    def __init__(self, repository: ResourceRepository) -> None:
        self.repository = repository

    async def get(self, guild_id: int, key: ResourceKey) -> GuildResourceRecord | None:
        return await self.repository.get(guild_id, key)

    async def list_for_guild(self, guild_id: int) -> list[GuildResourceRecord]:
        return await self.repository.list_for_guild(guild_id)

    async def set_resource(
        self,
        guild_id: int,
        key: ResourceKey,
        resource_type: ResourceType,
        discord_id: int,
        updated_by: int,
    ) -> GuildResourceRecord:
        expected = RESOURCE_TYPES[key]
        if expected != resource_type:
            raise ValueError(f"{key.value} expects a {expected.value} resource")
        return await self.repository.set(
            guild_id=guild_id,
            key=key,
            resource_type=resource_type,
            discord_id=discord_id,
            updated_by=updated_by,
        )

    async def set_channel(
        self,
        guild_id: int,
        key: ResourceKey,
        channel_id: int,
        updated_by: int,
    ) -> GuildResourceRecord:
        return await self.set_resource(guild_id, key, ResourceType.CHANNEL, channel_id, updated_by)

    async def clear(self, guild_id: int, key: ResourceKey) -> bool:
        return await self.repository.clear(guild_id, key)


class FeatureConfigService:
    def __init__(self, repository: FeatureConfigRepository) -> None:
        self.repository = repository
        self._load_tasks: dict[int, asyncio.Task[list[FeatureConfigRecord]]] = {}

    async def _persisted_for_guild(self, guild_id: int) -> list[FeatureConfigRecord]:
        task = self._load_tasks.get(guild_id)
        if task is None:
            task = asyncio.create_task(self.repository.list_for_guild(guild_id))
            self._load_tasks[guild_id] = task
        try:
            return await task
        finally:
            if self._load_tasks.get(guild_id) is task:
                self._load_tasks.pop(guild_id, None)

    async def get(
        self,
        guild_id: int,
        feature: FeatureName,
        *,
        default_enabled: bool = True,
    ) -> FeatureConfigRecord:
        for record in await self._persisted_for_guild(guild_id):
            if record.feature is feature:
                return record
        return FeatureConfigRecord(guild_id, feature, default_enabled, {})

    async def list_for_guild(self, guild_id: int) -> list[FeatureConfigRecord]:
        persisted = {
            record.feature: record for record in await self._persisted_for_guild(guild_id)
        }
        return [
            persisted.get(feature, FeatureConfigRecord(guild_id, feature, True, {}))
            for feature in FeatureName
        ]

    async def is_enabled(self, guild_id: int, feature: FeatureName) -> bool:
        return (await self.get(guild_id, feature)).enabled

    async def set_enabled(
        self, guild_id: int, feature: FeatureName, enabled: bool
    ) -> FeatureConfigRecord:
        return await self.repository.set_enabled(guild_id, feature, enabled)

    async def update_config(
        self,
        guild_id: int,
        feature: FeatureName,
        values: dict[str, Any],
    ) -> FeatureConfigRecord:
        current = await self.get(guild_id, feature)
        merged = dict(current.config)
        merged.update(values)
        return await self.repository.set(guild_id, feature, current.enabled, merged)
