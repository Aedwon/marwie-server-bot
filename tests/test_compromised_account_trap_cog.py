from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import discord
import pytest

from marwie_bot.config.resources import ResourceKey
from marwie_bot.features.moderation import compromise_trap
from marwie_bot.features.moderation.compromise_trap import (
    CompromisedAccountTrapCog,
    DiscordTrapEnforcer,
)
from marwie_bot.features.moderation.compromise_trap_repository import ClaimDisposition
from marwie_bot.features.moderation.compromise_trap_service import (
    BanStatus,
    ContainmentStatus,
    TrapExecutionResult,
)

NOW = datetime(2026, 9, 9, 4, 0, tzinfo=UTC)


class FakePermissions:
    def __init__(
        self,
        *,
        view_channel: bool = True,
        read_message_history: bool = True,
        manage_messages: bool = True,
    ) -> None:
        self.view_channel = view_channel
        self.read_message_history = read_message_history
        self.manage_messages = manage_messages


class FakeAuthor:
    def __init__(self, user_id: int, *, bot: bool = False) -> None:
        self.id = user_id
        self.bot = bot


class FakeHistoryMessage:
    def __init__(self, message_id: int, author_id: int, *, delete_error: Exception | None = None) -> None:
        self.id = message_id
        self.author = FakeAuthor(author_id)
        self.delete_error = delete_error
        self.deleted = False

    async def delete(self, *, reason: str) -> None:
        del reason
        if self.delete_error is not None:
            raise self.delete_error
        self.deleted = True


class FakeScope:
    def __init__(
        self,
        scope_id: int,
        name: str,
        *,
        permissions: FakePermissions | None = None,
        messages: list[FakeHistoryMessage] | None = None,
        history_error: Exception | None = None,
    ) -> None:
        self.id = scope_id
        self.name = name
        self._permissions = permissions or FakePermissions()
        self._messages = messages or []
        self._history_error = history_error
        self.history_after: datetime | None = None

    def permissions_for(self, member: Any) -> FakePermissions:
        del member
        return self._permissions

    def history(self, *, limit: None, after: datetime):
        assert limit is None
        self.history_after = after

        async def iterator():
            if self._history_error is not None:
                raise self._history_error
            for message in self._messages:
                yield message

        return iterator()


class FakeTextChannel(FakeScope):
    def __init__(
        self,
        scope_id: int,
        name: str,
        *,
        permissions: FakePermissions | None = None,
        messages: list[FakeHistoryMessage] | None = None,
        history_error: Exception | None = None,
        threads: list[FakeScope] | None = None,
        public_archived: list[FakeScope] | None = None,
        private_archived: list[FakeScope] | None = None,
        public_archive_error: Exception | None = None,
        private_archive_error: Exception | None = None,
    ) -> None:
        super().__init__(
            scope_id,
            name,
            permissions=permissions,
            messages=messages,
            history_error=history_error,
        )
        self.threads = threads or []
        self._public_archived = public_archived or []
        self._private_archived = private_archived or []
        self._public_archive_error = public_archive_error
        self._private_archive_error = private_archive_error

    def archived_threads(
        self,
        *,
        private: bool = False,
        joined: bool = False,
        limit: None = None,
    ):
        del joined
        assert limit is None
        values = self._private_archived if private else self._public_archived
        error = self._private_archive_error if private else self._public_archive_error

        async def iterator():
            if error is not None:
                raise error
            for thread in values:
                yield thread

        return iterator()


class FakeGuild:
    def __init__(self, guild_id: int, *, channels: list[FakeTextChannel] | None = None) -> None:
        self.id = guild_id
        self.text_channels = channels or []
        self.me = SimpleNamespace(id=999)
        self._resolved: dict[int, Any] = {channel.id: channel for channel in self.text_channels}
        self.ban_calls: list[tuple[int, str, int]] = []
        self.ban_error: Exception | None = None

    def get_channel(self, channel_id: int) -> Any:
        return self._resolved.get(channel_id)

    async def ban(
        self,
        target: discord.Object,
        *,
        reason: str,
        delete_message_seconds: int,
    ) -> None:
        self.ban_calls.append((target.id, reason, delete_message_seconds))
        if self.ban_error is not None:
            raise self.ban_error


class FakeResourceService:
    def __init__(self, discord_id: int | None) -> None:
        self.discord_id = discord_id
        self.calls: list[tuple[int, ResourceKey]] = []

    async def get(self, guild_id: int, key: ResourceKey):
        self.calls.append((guild_id, key))
        if self.discord_id is None:
            return None
        return SimpleNamespace(discord_id=self.discord_id)


class FakeTrapService:
    def __init__(self, *, delete_trigger_only: bool = False) -> None:
        self.delete_trigger_only = delete_trigger_only
        self.calls: list[tuple[Any, Any, int]] = []

    async def execute(self, trigger: Any, enforcer: Any, *, moderator_id: int, now: Any = None):
        del now
        self.calls.append((trigger, enforcer, moderator_id))
        return TrapExecutionResult(
            disposition=(ClaimDisposition.COOLDOWN if self.delete_trigger_only else ClaimDisposition.CLAIMED),
            full_incident=not self.delete_trigger_only,
            delete_trigger_only=self.delete_trigger_only,
            incident_id=1,
            reason="automatic trap",
            containment_status=(None if self.delete_trigger_only else ContainmentStatus.CONTAINED),
            ban_status=(None if self.delete_trigger_only else BanStatus.SUCCEEDED),
            ban_error=None,
            native_delete_requested=not self.delete_trigger_only,
            fallback_cleanup_run=False,
            deleted_message_count=0,
            failed_scopes=(),
            metadata={},
        )


class FakeIncomingMessage:
    def __init__(
        self,
        guild: FakeGuild,
        channel: Any,
        *,
        message_id: int = 500,
        author_id: int = 123,
        author_bot: bool = False,
        webhook_id: int | None = None,
        message_type: discord.MessageType = discord.MessageType.default,
        attachments: list[Any] | None = None,
        stickers: list[Any] | None = None,
    ) -> None:
        self.id = message_id
        self.guild = guild
        self.channel = channel
        self.author = FakeAuthor(author_id, bot=author_bot)
        self.webhook_id = webhook_id
        self.type = message_type
        self.created_at = NOW
        self.attachments = attachments or []
        self.stickers = stickers or []
        self.deleted = False
        self.delete_error: Exception | None = None

    @property
    def content(self) -> str:
        raise AssertionError("Compromised-account trap qualification must not read message content")

    async def delete(self, *, reason: str) -> None:
        del reason
        if self.delete_error is not None:
            raise self.delete_error
        self.deleted = True


def _bot() -> Any:
    return SimpleNamespace(user=SimpleNamespace(id=999))


def _http_error(kind: type[discord.HTTPException], status: int, message: str) -> discord.HTTPException:
    response = SimpleNamespace(status=status, reason=message)
    return kind(response, {"message": message, "code": 0})


def _patch_text_channel(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(compromise_trap.discord, "TextChannel", FakeTextChannel)


async def test_no_mapping_means_no_service_call(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_text_channel(monkeypatch)
    channel = FakeTextChannel(10, "trap")
    guild = FakeGuild(1, channels=[channel])
    resources = FakeResourceService(None)
    service = FakeTrapService()
    cog = CompromisedAccountTrapCog(_bot(), resources, service)

    await cog.on_message(FakeIncomingMessage(guild, channel))

    assert service.calls == []
    assert resources.calls == [(1, ResourceKey.COMPROMISED_ACCOUNT_TRAP)]


async def test_stale_mapping_fails_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_text_channel(monkeypatch)
    guild = FakeGuild(1)
    guild._resolved[10] = SimpleNamespace(id=10)
    resources = FakeResourceService(10)
    service = FakeTrapService()
    cog = CompromisedAccountTrapCog(_bot(), resources, service)

    await cog.on_message(FakeIncomingMessage(guild, SimpleNamespace(id=10)))

    assert service.calls == []


@pytest.mark.parametrize(
    ("label", "message_type", "attachments", "stickers"),
    [
        ("text", discord.MessageType.default, [], []),
        ("reply", discord.MessageType.reply, [], []),
        ("attachment-only", discord.MessageType.default, [object()], []),
        ("sticker-only", discord.MessageType.default, [], [object()]),
        ("emoji-only", discord.MessageType.default, [], []),
        ("no-normal-text", discord.MessageType.default, [], []),
    ],
)
async def test_exact_mapped_human_message_qualifies_without_reading_content(
    monkeypatch: pytest.MonkeyPatch,
    label: str,
    message_type: discord.MessageType,
    attachments: list[Any],
    stickers: list[Any],
) -> None:
    del label
    _patch_text_channel(monkeypatch)
    channel = FakeTextChannel(10, "trap")
    guild = FakeGuild(1, channels=[channel])
    service = FakeTrapService()
    cog = CompromisedAccountTrapCog(_bot(), FakeResourceService(10), service)
    message = FakeIncomingMessage(
        guild,
        channel,
        message_type=message_type,
        attachments=attachments,
        stickers=stickers,
    )

    await cog.on_message(message)

    assert len(service.calls) == 1
    trigger, enforcer, moderator_id = service.calls[0]
    assert trigger.guild_id == 1
    assert trigger.user_id == 123
    assert trigger.channel_id == 10
    assert trigger.message_id == 500
    assert trigger.triggered_at == NOW
    assert isinstance(enforcer, DiscordTrapEnforcer)
    assert moderator_id == 999


@pytest.mark.parametrize(
    ("author_bot", "webhook_id", "message_type", "channel_kind"),
    [
        (True, None, discord.MessageType.default, "mapped"),
        (False, 55, discord.MessageType.default, "mapped"),
        (False, None, discord.MessageType.pins_add, "mapped"),
        (False, None, discord.MessageType.default, "other"),
        (False, None, discord.MessageType.default, "thread"),
    ],
)
async def test_non_trigger_messages_are_ignored(
    monkeypatch: pytest.MonkeyPatch,
    author_bot: bool,
    webhook_id: int | None,
    message_type: discord.MessageType,
    channel_kind: str,
) -> None:
    _patch_text_channel(monkeypatch)
    mapped = FakeTextChannel(10, "trap")
    other = FakeTextChannel(11, "general")
    guild = FakeGuild(1, channels=[mapped, other])
    thread = FakeScope(12, "trap-thread")
    channel = {"mapped": mapped, "other": other, "thread": thread}[channel_kind]
    service = FakeTrapService()
    cog = CompromisedAccountTrapCog(_bot(), FakeResourceService(10), service)

    await cog.on_message(
        FakeIncomingMessage(
            guild,
            channel,
            author_bot=author_bot,
            webhook_id=webhook_id,
            message_type=message_type,
        )
    )

    assert service.calls == []


def test_cog_registers_no_reaction_enforcement_listener() -> None:
    assert "on_reaction_add" not in CompromisedAccountTrapCog.__dict__
    assert "on_raw_reaction_add" not in CompromisedAccountTrapCog.__dict__


async def test_duplicate_or_cooldown_deletes_only_new_trigger_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_text_channel(monkeypatch)
    channel = FakeTextChannel(10, "trap")
    guild = FakeGuild(1, channels=[channel])
    message = FakeIncomingMessage(guild, channel)
    cog = CompromisedAccountTrapCog(_bot(), FakeResourceService(10), FakeTrapService(delete_trigger_only=True))

    await cog.on_message(message)

    assert message.deleted is True
    assert guild.ban_calls == []


async def test_ban_uses_user_id_object_and_exact_delete_window() -> None:
    guild = FakeGuild(1)
    enforcer = DiscordTrapEnforcer(guild)

    result = await enforcer.ban(123, "reason", 86_400)

    assert result.succeeded is True
    assert guild.ban_calls == [(123, "reason", 86_400)]


@pytest.mark.parametrize(
    ("kind", "status"),
    [(discord.Forbidden, 403), (discord.NotFound, 404), (discord.HTTPException, 500)],
)
async def test_expected_ban_failures_return_typed_failure(
    kind: type[discord.HTTPException], status: int
) -> None:
    guild = FakeGuild(1)
    guild.ban_error = _http_error(kind, status, "blocked")
    enforcer = DiscordTrapEnforcer(guild)

    result = await enforcer.ban(123, "reason", 86_400)

    assert result.succeeded is False
    assert result.error is not None
    assert kind.__name__ in result.error
    assert len(guild.ban_calls) == 1


async def test_cleanup_checks_permissions_and_continues_other_scopes() -> None:
    inaccessible = FakeTextChannel(
        10,
        "private",
        permissions=FakePermissions(manage_messages=False),
    )
    target_message = FakeHistoryMessage(1, 123)
    other_message = FakeHistoryMessage(2, 456)
    accessible = FakeTextChannel(11, "general", messages=[target_message, other_message])
    guild = FakeGuild(1, channels=[inaccessible, accessible])
    enforcer = DiscordTrapEnforcer(guild)

    result = await enforcer.cleanup(123, NOW)

    assert accessible.history_after == NOW
    assert target_message.deleted is True
    assert other_message.deleted is False
    assert result.deleted_count == 1
    assert result.scanned_scopes == 1
    assert any(failure.scope_id == 10 for failure in result.failures)


async def test_cleanup_scans_active_and_archived_threads_once() -> None:
    active_message = FakeHistoryMessage(1, 123)
    archived_message = FakeHistoryMessage(2, 123)
    active = FakeScope(20, "active", messages=[active_message])
    archived = FakeScope(21, "archived", messages=[archived_message])
    channel = FakeTextChannel(
        10,
        "general",
        threads=[active],
        public_archived=[active, archived],
    )
    guild = FakeGuild(1, channels=[channel])
    enforcer = DiscordTrapEnforcer(guild)

    result = await enforcer.cleanup(123, NOW)

    assert active_message.deleted is True
    assert archived_message.deleted is True
    assert result.deleted_count == 2
    assert result.scanned_scopes == 3


async def test_cleanup_records_message_and_archive_failures_without_aborting() -> None:
    delete_error = _http_error(discord.Forbidden, 403, "cannot delete")
    archive_error = _http_error(discord.HTTPException, 500, "archive unavailable")
    failed_message = FakeHistoryMessage(1, 123, delete_error=delete_error)
    later_message = FakeHistoryMessage(2, 123)
    first = FakeTextChannel(
        10,
        "first",
        messages=[failed_message, later_message],
        public_archive_error=archive_error,
    )
    survivor = FakeHistoryMessage(3, 123)
    second = FakeTextChannel(11, "second", messages=[survivor])
    guild = FakeGuild(1, channels=[first, second])
    enforcer = DiscordTrapEnforcer(guild)

    result = await enforcer.cleanup(123, NOW)

    assert failed_message.deleted is False
    assert later_message.deleted is True
    assert survivor.deleted is True
    assert result.deleted_count == 2
    assert result.scanned_scopes == 2
    assert any(failure.scope_id == 10 for failure in result.failures)
