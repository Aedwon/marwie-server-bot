from marwie_bot.config.resources import RESOURCE_TYPES, ResourceKey, ResourceType
from marwie_bot.features.configuration.service import GuildResourceRecord, ResourceService


class FakeResourceRepository:
    def __init__(self) -> None:
        self.records: dict[tuple[int, ResourceKey], GuildResourceRecord] = {}

    async def get(self, guild_id: int, key: ResourceKey) -> GuildResourceRecord | None:
        return self.records.get((guild_id, key))

    async def list_for_guild(self, guild_id: int) -> list[GuildResourceRecord]:
        return [record for record in self.records.values() if record.guild_id == guild_id]

    async def set(
        self,
        guild_id: int,
        key: ResourceKey,
        resource_type: ResourceType,
        discord_id: int,
        updated_by: int,
    ) -> GuildResourceRecord:
        record = GuildResourceRecord(
            guild_id=guild_id,
            key=key,
            resource_type=resource_type,
            discord_id=discord_id,
            updated_by=updated_by,
        )
        self.records[(guild_id, key)] = record
        return record

    async def clear(self, guild_id: int, key: ResourceKey) -> bool:
        return self.records.pop((guild_id, key), None) is not None


async def test_resource_service_sets_and_reads_channel() -> None:
    repository = FakeResourceRepository()
    service = ResourceService(repository)

    saved = await service.set_channel(
        guild_id=100,
        key=ResourceKey.MODERATION_LOG,
        channel_id=200,
        updated_by=300,
    )

    assert saved.resource_type is ResourceType.CHANNEL
    assert saved.discord_id == 200
    assert await service.get(100, ResourceKey.MODERATION_LOG) == saved


async def test_resource_service_returns_none_for_missing_resource() -> None:
    service = ResourceService(FakeResourceRepository())
    assert await service.get(100, ResourceKey.MODERATION_LOG) is None


async def test_resource_service_clears_binding() -> None:
    repository = FakeResourceRepository()
    service = ResourceService(repository)
    await service.set_channel(100, ResourceKey.MODERATION_LOG, 200, 300)

    assert await service.clear(100, ResourceKey.MODERATION_LOG) is True
    assert await service.get(100, ResourceKey.MODERATION_LOG) is None
    assert await service.clear(100, ResourceKey.MODERATION_LOG) is False


def test_live_announcement_resource_types() -> None:
    assert RESOURCE_TYPES[ResourceKey.LIVE_ANNOUNCEMENTS] is ResourceType.CHANNEL
    assert RESOURCE_TYPES[ResourceKey.LIVE_PING_ROLE] is ResourceType.ROLE
