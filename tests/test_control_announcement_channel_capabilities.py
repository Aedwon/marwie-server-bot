from __future__ import annotations

from typing import cast

import discord
import pytest

from marwie_bot.features.control_plane import snapshot as snapshot_module


class FakePermissions:
    def __init__(self, *, send_messages: bool, embed_links: bool) -> None:
        self.send_messages = send_messages
        self.embed_links = embed_links


class FakeTextChannel:
    def __init__(self, *, send_messages: bool, embed_links: bool) -> None:
        self._permissions = FakePermissions(
            send_messages=send_messages,
            embed_links=embed_links,
        )

    def permissions_for(self, _member: object) -> FakePermissions:
        return self._permissions


def test_snapshot_exposes_per_text_channel_announcement_capabilities(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(discord, "TextChannel", FakeTextChannel)
    channel = cast(discord.TextChannel, FakeTextChannel(send_messages=True, embed_links=False))

    result = snapshot_module._channel_capabilities(channel, cast(discord.Member, object()))

    assert result == {"send_messages": True, "embed_links": False}


def test_snapshot_capabilities_fail_closed_without_bot_member(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(discord, "TextChannel", FakeTextChannel)
    channel = cast(discord.TextChannel, FakeTextChannel(send_messages=True, embed_links=True))

    result = snapshot_module._channel_capabilities(channel, None)

    assert result == {"send_messages": False, "embed_links": False}
