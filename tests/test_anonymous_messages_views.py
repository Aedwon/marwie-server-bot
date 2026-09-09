from types import SimpleNamespace
from typing import Any, cast

import discord

from marwie_bot.features.anonymous_messages.render import (
    build_audit_embed,
    build_message_embed,
    build_panel_embed,
    build_reply_embed,
)
from marwie_bot.features.anonymous_messages.views import (
    AnonPanelView,
    AnonReplyView,
    AnonymousMessageDestinations,
    member_can_use_public_channels,
    resolve_destinations,
)


class _Service:
    pass


class _Features:
    pass


class _TextChannel:
    def __init__(self, channel_id: int, name: str, *, visible: bool = True) -> None:
        self.id = channel_id
        self.name = name
        self.mention = f"<#{channel_id}>"
        self.visible = visible

    def permissions_for(self, member: object) -> object:
        del member
        return SimpleNamespace(view_channel=self.visible)


class _Resources:
    def __init__(self) -> None:
        self.mapping = {
            "anon_messages_panel": 101,
            "anon_messages_submissions": 102,
            "anon_messages_audit_log": 103,
        }

    async def get(self, guild_id: int, key: Any) -> object | None:
        assert guild_id == 1
        channel_id = self.mapping.get(key.value)
        return SimpleNamespace(discord_id=channel_id) if channel_id is not None else None


def _guild() -> Any:
    channels = {
        101: _TextChannel(101, "anonymous-panel"),
        102: _TextChannel(102, "anonymous-messages"),
        103: _TextChannel(103, "anonymous-audit-log"),
    }
    return SimpleNamespace(
        id=1,
        icon=SimpleNamespace(url="https://example.test/icon.png"),
        get_channel=lambda channel_id: channels.get(channel_id),
    )


def test_panel_copy_is_transparent_about_staff_audit_visibility() -> None:
    embed = build_panel_embed(_guild())

    assert embed.title == "📨 Anonymous Messages"
    assert "hidden from other members" in (embed.description or "")
    assert "Authorized staff" in (embed.description or "")
    assert "abuse or safety" in (embed.description or "")
    assert embed.footer.text == "This panel refreshes every 10 minutes • Rob-bot"


def test_public_message_embed_uses_generic_identity_only() -> None:
    embed = build_message_embed(_guild(), 7, "A public anonymous message")

    assert embed.title == "Anonymous Message #7"
    assert embed.description == "A public anonymous message"
    assert embed.author.name == "Anonymous"
    assert "user" not in str(embed.to_dict()).lower()
    assert embed.footer.text == "Click below to reply anonymously"


def test_public_reply_embed_uses_generic_identity_only() -> None:
    embed = build_reply_embed(_guild(), "A public anonymous reply")

    assert embed.title is None
    assert embed.description == "A public anonymous reply"
    assert embed.author.name == "Anonymous Reply"
    assert "user" not in str(embed.to_dict()).lower()


def test_audit_embed_contains_staff_identity_and_context() -> None:
    user: Any = SimpleNamespace(
        id=55,
        mention="<@55>",
        display_avatar=SimpleNamespace(url="https://example.test/avatar.png"),
        __str__=lambda self: "member-name",
    )
    channel: Any = _TextChannel(102, "anonymous-messages")

    embed = build_audit_embed(
        user=user,
        action_type="Anon Message",
        content="private audit content",
        public_channel=channel,
        reference_label="Message #3",
    )
    payload = embed.to_dict()

    assert payload["title"] == "🔒 Anon Message"
    assert payload["description"] == "private audit content"
    assert any(field["name"] == "Author" and "55" in field["value"] for field in payload["fields"])
    assert any(
        field["name"] == "Context" and field["value"] == "Message #3" for field in payload["fields"]
    )


def test_persistent_view_custom_ids_match_reference_contract() -> None:
    service: Any = _Service()
    resources: Any = _Resources()
    features: Any = _Features()
    panel = AnonPanelView(service, resources, features)
    reply = AnonReplyView(service, resources, features)

    assert panel.timeout is None
    assert reply.timeout is None
    assert [item.custom_id for item in panel.children] == ["anon_messages:send_button"]
    assert [item.custom_id for item in reply.children] == ["anon_messages:reply_button"]


def test_member_must_be_able_to_view_both_public_anonymous_channels() -> None:
    member = cast(discord.Member, object())
    visible = AnonymousMessageDestinations(
        cast(Any, _TextChannel(101, "anonymous-panel")),
        cast(Any, _TextChannel(102, "anonymous-messages")),
        cast(Any, _TextChannel(103, "anonymous-audit-log", visible=False)),
    )
    hidden_submissions = AnonymousMessageDestinations(
        cast(Any, _TextChannel(101, "anonymous-panel")),
        cast(Any, _TextChannel(102, "anonymous-messages", visible=False)),
        cast(Any, _TextChannel(103, "anonymous-audit-log")),
    )

    assert member_can_use_public_channels(member, visible) is True
    assert member_can_use_public_channels(member, hidden_submissions) is False


async def test_destinations_resolve_independently(monkeypatch: Any) -> None:
    monkeypatch.setattr(discord, "TextChannel", _TextChannel)
    resources: Any = _Resources()

    destinations = await resolve_destinations(_guild(), resources)

    assert destinations is not None
    assert destinations.panel.id == 101
    assert destinations.submissions.id == 102
    assert destinations.audit_log.id == 103


async def test_destinations_fail_closed_when_a_required_mapping_is_missing(
    monkeypatch: Any,
) -> None:
    monkeypatch.setattr(discord, "TextChannel", _TextChannel)
    resources = _Resources()
    del resources.mapping["anon_messages_audit_log"]
    typed_resources: Any = resources

    assert await resolve_destinations(_guild(), typed_resources) is None
