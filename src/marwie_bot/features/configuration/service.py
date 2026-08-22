from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from marwie_bot.config.resources import ResourceKey, ResourceType


@dataclass(frozen=True, slots=True)
class GuildResourceRecord:
    guild_id: int
    key: ResourceKey
    resource_type: ResourceType
    discord_id: int
    updated_by: int


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


class ResourceService:
    def __init__(self, repository: ResourceRepository) -> None:
        self.repository = repository

    async def get(self, guild_id: int, key: ResourceKey) -> GuildResourceRecord | None:
        return await self.repository.get(guild_id, key)

    async def list_for_guild(self, guild_id: int) -> list[GuildResourceRecord]:
        return await self.repository.list_for_guild(guild_id)

    async def set_channel(
        self,
        guild_id: int,
        key: ResourceKey,
        channel_id: int,
        updated_by: int,
    ) -> GuildResourceRecord:
        return await self.repository.set(
            guild_id=guild_id,
            key=key,
            resource_type=ResourceType.CHANNEL,
            discord_id=channel_id,
            updated_by=updated_by,
        )
