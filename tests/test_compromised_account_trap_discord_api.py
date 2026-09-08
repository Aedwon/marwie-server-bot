from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

from marwie_bot.features.moderation.compromise_trap import DiscordTrapEnforcer


class _Permissions:
    view_channel = True
    read_message_history = True
    manage_messages = True


class _Message:
    def __init__(self, user_id: int) -> None:
        self.author = SimpleNamespace(id=user_id)
        self.deleted = False

    async def delete(self) -> None:
        self.deleted = True


class _Channel:
    def __init__(self, message: _Message) -> None:
        self.id = 10
        self.name = "general"
        self.threads: list[Any] = []
        self.message = message
        self.history_after: datetime | None = None

    def permissions_for(self, member: Any) -> _Permissions:
        del member
        return _Permissions()

    def history(self, *, limit: None, after: datetime) -> AsyncIterator[_Message]:
        assert limit is None
        self.history_after = after

        async def iterator() -> AsyncIterator[_Message]:
            yield self.message

        return iterator()

    def archived_threads(
        self,
        *,
        private: bool = False,
        joined: bool = False,
        limit: None = None,
    ) -> AsyncIterator[Any]:
        del private, joined
        assert limit is None

        async def iterator() -> AsyncIterator[Any]:
            if False:
                yield None

        return iterator()


class _Guild:
    def __init__(self, channel: _Channel) -> None:
        self.id = 1
        self.me = SimpleNamespace(id=999)
        self.text_channels = [channel]


async def test_fallback_cleanup_uses_supported_discord_message_delete_signature() -> None:
    message = _Message(user_id=42)
    channel = _Channel(message)
    enforcer = DiscordTrapEnforcer(_Guild(channel))
    since = datetime(2026, 9, 8, 4, 0, tzinfo=UTC)

    result = await enforcer.cleanup(42, since)

    assert message.deleted is True
    assert channel.history_after == since
    assert result.deleted_count == 1
    assert result.scanned_scopes == 1
    assert result.failures == ()
