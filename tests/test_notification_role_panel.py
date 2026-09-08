from types import SimpleNamespace
from typing import Any

import discord

from marwie_bot.features.control_plane import notification_panel as notification_panel_module
from marwie_bot.features.control_plane.notification_panel import (
    button_custom_id,
    button_style,
    parse_button_custom_id,
)


def test_notification_button_custom_id_round_trips() -> None:
    custom_id = button_custom_id(123, 456)
    assert custom_id == "rob:self-role:123:456"
    assert parse_button_custom_id(custom_id) == (123, 456)


def test_notification_button_custom_id_rejects_other_controls() -> None:
    assert parse_button_custom_id("rob:other:123:456") is None
    assert parse_button_custom_id("rob:self-role:not-a-number:456") is None


def test_notification_button_styles_are_explicit() -> None:
    assert button_style("primary") is discord.ButtonStyle.primary
    assert button_style("secondary") is discord.ButtonStyle.secondary
    assert button_style("success") is discord.ButtonStyle.success
    assert button_style("danger") is discord.ButtonStyle.danger


class _TextChannel:
    def __init__(self, channel_id: int, messages: list[object]) -> None:
        self.id = channel_id
        self._messages = messages

    def history(self, *, limit: int) -> Any:
        assert limit == 50

        async def iterate() -> Any:
            for message in self._messages:
                yield message

        return iterate()


class _Resources:
    def __init__(self, channel_id: int, role_id: int) -> None:
        self.channel_id = channel_id
        self.role_id = role_id

    async def get(self, guild_id: int, key: Any) -> object | None:
        assert guild_id == 123
        if key.value == "role_panel":
            return SimpleNamespace(discord_id=self.channel_id)
        if key.value == "live_ping_role":
            return SimpleNamespace(discord_id=self.role_id)
        return None


class _Repository:
    def __init__(self) -> None:
        self.saved: dict[str, Any] | None = None

    async def get_notification_panel(self, guild_id: int) -> object | None:
        assert guild_id == 123
        return None

    async def save_notification_panel(self, **kwargs: Any) -> object:
        self.saved = dict(kwargs)
        return SimpleNamespace(**kwargs)


async def test_legacy_notification_panel_is_adopted_without_posting_a_duplicate(
    monkeypatch: Any,
) -> None:
    bot_user_id = 999
    channel_id = 321
    role_id = 456
    message_id = 654
    description = (
        "Use the button below to toggle optional community notifications. "
        "You can press it again at any time to remove the role."
    )
    message = SimpleNamespace(
        id=message_id,
        author=SimpleNamespace(id=bot_user_id),
        embeds=[SimpleNamespace(title="Notification roles", description=description)],
    )
    channel = _TextChannel(channel_id, [message])
    role = SimpleNamespace(id=role_id)
    guild = SimpleNamespace(
        id=123,
        get_channel=lambda candidate: channel if candidate == channel_id else None,
        get_role=lambda candidate: role if candidate == role_id else None,
    )
    resources = _Resources(channel_id, role_id)
    repository = _Repository()
    monkeypatch.setattr(notification_panel_module.discord, "TextChannel", _TextChannel)

    adopt = getattr(notification_panel_module, "adopt_legacy_notification_panel")
    adopted = await adopt(
        guild=guild,
        bot_user_id=bot_user_id,
        resources=resources,
        repository=repository,
    )

    assert adopted is not None
    assert repository.saved == {
        "guild_id": 123,
        "channel_id": channel_id,
        "message_id": message_id,
        "title": "Notification roles",
        "description": description,
        "buttons": [
            {
                "role_id": role_id,
                "label": "Live Notifications",
                "emoji": "",
                "style": "primary",
            }
        ],
        "updated_by": bot_user_id,
    }
