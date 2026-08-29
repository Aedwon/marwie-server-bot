from __future__ import annotations

from types import SimpleNamespace
from typing import Any, cast

import discord
import pytest

from marwie_bot.config.resources import FeatureName, ResourceKey
from marwie_bot.features.control_plane.executor import ActionRejected, ControlActionExecutor

GUILD_ID = 100
ACTOR_ID = 200


class FakePermissions:
    def __init__(
        self,
        *,
        send_messages: bool = True,
        embed_links: bool = True,
        mention_everyone: bool = True,
    ) -> None:
        self.send_messages = send_messages
        self.embed_links = embed_links
        self.mention_everyone = mention_everyone


class FakeTextChannel:
    def __init__(self, channel_id: int, *, permissions: FakePermissions | None = None) -> None:
        self.id = channel_id
        self.permissions = permissions or FakePermissions()
        self.sent: list[dict[str, Any]] = []

    def permissions_for(self, _member: object) -> FakePermissions:
        return self.permissions

    async def send(self, **kwargs: Any) -> SimpleNamespace:
        self.sent.append(kwargs)
        return SimpleNamespace(id=9000 + len(self.sent))


class FakeRole:
    def __init__(self, role_id: int, *, mentionable: bool = True) -> None:
        self.id = role_id
        self.name = f"Role {role_id}"
        self.mention = f"<@&{role_id}>"
        self.mentionable = mentionable

    def is_default(self) -> bool:
        return False


class FakeGuild:
    def __init__(self) -> None:
        self.id = GUILD_ID
        self.me = object()
        self.channels: dict[int, FakeTextChannel] = {}
        self.roles: dict[int, FakeRole] = {}

    def get_channel(self, channel_id: int) -> FakeTextChannel | None:
        return self.channels.get(channel_id)

    def get_role(self, role_id: int) -> FakeRole | None:
        return self.roles.get(role_id)


class FakeResources:
    def __init__(self, mappings: dict[ResourceKey, int]) -> None:
        self.mappings = mappings

    async def get(self, guild_id: int, key: ResourceKey) -> SimpleNamespace | None:
        assert guild_id == GUILD_ID
        discord_id = self.mappings.get(key)
        return SimpleNamespace(discord_id=discord_id) if discord_id is not None else None


class FakeFeatures:
    def __init__(self) -> None:
        self.enabled = {
            FeatureName.ANNOUNCEMENTS: True,
            FeatureName.LIVE_ANNOUNCEMENTS: True,
        }

    async def is_enabled(self, guild_id: int, feature: FeatureName) -> bool:
        assert guild_id == GUILD_ID
        return self.enabled.get(feature, True)


def executor(
    mappings: dict[ResourceKey, int],
    *,
    features: FakeFeatures | None = None,
) -> ControlActionExecutor:
    value = object.__new__(ControlActionExecutor)
    fake_value = cast(Any, value)
    fake_value.resources = FakeResources(mappings)
    fake_value.features = features or FakeFeatures()
    fake_value.settings = SimpleNamespace(
        mar_wie_user_id=ACTOR_ID,
        mar_wie_tiktok_url="https://www.tiktok.com/@example",
    )
    return value


def announcement_payload(channel_id: int) -> dict[str, Any]:
    return {
        "channel_id": channel_id,
        "message": "",
        "title": "Update",
        "body": "Hello",
        "footer": "",
        "color": "5865F2",
        "mentions": {
            "everyone": False,
            "here": False,
            "role_ids": [],
            "user_ids": [],
        },
    }


def live_payload(channel_id: int, *, ping_role_id: int | None = None) -> dict[str, Any]:
    return {
        "channel_id": channel_id,
        "ping_role_id": ping_role_id,
        "topic": "Building live",
    }


async def send_announcement(
    worker: ControlActionExecutor,
    guild: FakeGuild,
    payload: dict[str, Any],
) -> dict[str, Any]:
    return cast(
        dict[str, Any],
        await worker._send_announcement(cast(discord.Guild, guild), payload),
    )


async def post_live(
    worker: ControlActionExecutor,
    guild: FakeGuild,
    payload: dict[str, Any],
) -> dict[str, Any]:
    actor = cast(discord.Member, SimpleNamespace(id=ACTOR_ID))
    return cast(
        dict[str, Any],
        await worker._post_live(cast(discord.Guild, guild), actor, payload),
    )


@pytest.fixture(autouse=True)
def fake_text_channel_type(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(discord, "TextChannel", FakeTextChannel)


@pytest.mark.asyncio
async def test_announcement_modified_payload_cannot_redirect_to_another_text_channel() -> None:
    guild = FakeGuild()
    mapped = FakeTextChannel(101)
    tampered = FakeTextChannel(999)
    guild.channels = {101: mapped, 999: tampered}
    worker = executor({ResourceKey.ANNOUNCEMENTS: 101})

    with pytest.raises(ActionRejected, match="mapping|Mappings|destination"):
        await send_announcement(worker, guild, announcement_payload(999))

    assert mapped.sent == []
    assert tampered.sent == []


@pytest.mark.asyncio
async def test_announcement_mapping_change_after_action_construction_fails_closed() -> None:
    guild = FakeGuild()
    reviewed = FakeTextChannel(101)
    current = FakeTextChannel(102)
    guild.channels = {101: reviewed, 102: current}
    worker = executor({ResourceKey.ANNOUNCEMENTS: 102})

    with pytest.raises(ActionRejected, match="mapping|Mappings|destination"):
        await send_announcement(worker, guild, announcement_payload(101))

    assert reviewed.sent == []
    assert current.sent == []


@pytest.mark.asyncio
async def test_announcement_current_mapped_destination_still_publishes() -> None:
    guild = FakeGuild()
    mapped = FakeTextChannel(101)
    guild.channels = {101: mapped}
    worker = executor({ResourceKey.ANNOUNCEMENTS: 101})

    result = await send_announcement(worker, guild, announcement_payload(101))

    assert result["channel_id"] == 101
    assert len(mapped.sent) == 1


@pytest.mark.asyncio
async def test_announcement_feature_and_bot_permission_checks_remain_active() -> None:
    guild = FakeGuild()
    channel = FakeTextChannel(101, permissions=FakePermissions(send_messages=False))
    guild.channels = {101: channel}
    features = FakeFeatures()
    worker = executor({ResourceKey.ANNOUNCEMENTS: 101}, features=features)

    features.enabled[FeatureName.ANNOUNCEMENTS] = False
    with pytest.raises(ActionRejected, match="disabled"):
        await send_announcement(worker, guild, announcement_payload(101))

    features.enabled[FeatureName.ANNOUNCEMENTS] = True
    with pytest.raises(ActionRejected, match="Send Messages"):
        await send_announcement(worker, guild, announcement_payload(101))

    assert channel.sent == []


@pytest.mark.asyncio
async def test_live_modified_payload_cannot_redirect_to_another_text_channel() -> None:
    guild = FakeGuild()
    mapped = FakeTextChannel(201)
    tampered = FakeTextChannel(999)
    guild.channels = {201: mapped, 999: tampered}
    worker = executor({ResourceKey.LIVE_ANNOUNCEMENTS: 201})

    with pytest.raises(ActionRejected, match="mapping|Mappings|destination"):
        await post_live(worker, guild, live_payload(999))

    assert mapped.sent == []
    assert tampered.sent == []


@pytest.mark.asyncio
async def test_live_mapping_change_after_action_construction_fails_closed() -> None:
    guild = FakeGuild()
    reviewed = FakeTextChannel(201)
    current = FakeTextChannel(202)
    guild.channels = {201: reviewed, 202: current}
    worker = executor({ResourceKey.LIVE_ANNOUNCEMENTS: 202})

    with pytest.raises(ActionRejected, match="mapping|Mappings|destination"):
        await post_live(worker, guild, live_payload(201))

    assert reviewed.sent == []
    assert current.sent == []


@pytest.mark.asyncio
async def test_live_fallback_mapping_is_revalidated_server_side() -> None:
    guild = FakeGuild()
    fallback = FakeTextChannel(203)
    guild.channels = {203: fallback}
    worker = executor({ResourceKey.ANNOUNCEMENTS: 203})

    result = await post_live(worker, guild, live_payload(203))

    assert result["channel_id"] == 203
    assert len(fallback.sent) == 1


@pytest.mark.asyncio
async def test_live_cannot_substitute_an_arbitrary_ping_role() -> None:
    guild = FakeGuild()
    channel = FakeTextChannel(201)
    mapped_role = FakeRole(301)
    tampered_role = FakeRole(999)
    guild.channels = {201: channel}
    guild.roles = {301: mapped_role, 999: tampered_role}
    worker = executor(
        {
            ResourceKey.LIVE_ANNOUNCEMENTS: 201,
            ResourceKey.LIVE_PING_ROLE: 301,
        }
    )

    with pytest.raises(ActionRejected, match="mapping|Mappings|role"):
        await post_live(worker, guild, live_payload(201, ping_role_id=999))

    assert channel.sent == []


@pytest.mark.asyncio
async def test_live_role_mapping_change_after_confirmation_fails_closed() -> None:
    guild = FakeGuild()
    channel = FakeTextChannel(201)
    reviewed_role = FakeRole(301)
    current_role = FakeRole(302)
    guild.channels = {201: channel}
    guild.roles = {301: reviewed_role, 302: current_role}
    worker = executor(
        {
            ResourceKey.LIVE_ANNOUNCEMENTS: 201,
            ResourceKey.LIVE_PING_ROLE: 302,
        }
    )

    with pytest.raises(ActionRejected, match="mapping|Mappings|role"):
        await post_live(worker, guild, live_payload(201, ping_role_id=301))

    assert channel.sent == []


@pytest.mark.asyncio
async def test_live_current_mapped_destination_and_role_still_publish() -> None:
    guild = FakeGuild()
    channel = FakeTextChannel(201)
    role = FakeRole(301)
    guild.channels = {201: channel}
    guild.roles = {301: role}
    worker = executor(
        {
            ResourceKey.LIVE_ANNOUNCEMENTS: 201,
            ResourceKey.LIVE_PING_ROLE: 301,
        }
    )

    result = await post_live(worker, guild, live_payload(201, ping_role_id=301))

    assert result["channel_id"] == 201
    assert result["ping_role_id"] == 301
    assert result["pinged"] is True
    assert len(channel.sent) == 1


@pytest.mark.asyncio
async def test_live_feature_and_bot_permission_checks_remain_active() -> None:
    guild = FakeGuild()
    channel = FakeTextChannel(201, permissions=FakePermissions(embed_links=False))
    guild.channels = {201: channel}
    features = FakeFeatures()
    worker = executor({ResourceKey.LIVE_ANNOUNCEMENTS: 201}, features=features)

    features.enabled[FeatureName.LIVE_ANNOUNCEMENTS] = False
    with pytest.raises(ActionRejected, match="disabled"):
        await post_live(worker, guild, live_payload(201))

    features.enabled[FeatureName.LIVE_ANNOUNCEMENTS] = True
    with pytest.raises(ActionRejected, match="Embed Links"):
        await post_live(worker, guild, live_payload(201))

    assert channel.sent == []
