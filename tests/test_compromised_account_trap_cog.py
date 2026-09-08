from __future__ import annotations

from collections.abc import AsyncIterator
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
from marwie_bot.features.moderation.service import ModerationCaseRecord

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
    def __init__(
        self, message_id: int, author_id: int, *, delete_error: Exception | None = None
    ) -> None:
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

    def history(self, *, limit: None, after: datetime) -> AsyncIterator[FakeHistoryMessage]:
        assert limit is None
        self.history_after = after

        async def iterator() -> AsyncIterator[FakeHistoryMessage]:
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
        send_error: Exception | None = None,
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
        self._send_error = send_error
        self.sent_embeds: list[discord.Embed] = []

    def archived_threads(
        self,
        *,
        private: bool = False,
        joined: bool = False,
        limit: None = None,
    ) -> AsyncIterator[FakeScope]:
        del joined
        assert limit is None
        values = self._private_archived if private else self._public_archived
        error = self._private_archive_error if private else self._public_archive_error

        async def iterator() -> AsyncIterator[FakeScope]:
            if error is not None:
                raise error
            for thread in values:
                yield thread

        return iterator()

    async def send(self, *, embed: discord.Embed) -> None:
        if self._send_error is not None:
            raise self._send_error
        self.sent_embeds.append(embed)


class FakeGuild:
    def __init__(self, guild_id: int, *, channels: list[FakeTextChannel] | None = None) -> None:
        self.id = guild_id
        self.text_channels = channels or []
        self.me = SimpleNamespace(id=999)
        self._resolved: dict[int, Any] = {channel.id: channel for channel in self.text_channels}
        self.ban_calls: list[tuple[int, str, int]] = []
        self.unban_calls: list[int] = []
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

    async def unban(self, target: discord.Object, *, reason: str | None = None) -> None:
        del reason
        self.unban_calls.append(target.id)


class FakeBot:
    def __init__(self, guild: FakeGuild | None = None) -> None:
        self.user = SimpleNamespace(id=999)
        self.guild = guild

    def get_guild(self, guild_id: int) -> FakeGuild | None:
        if self.guild is not None and self.guild.id == guild_id:
            return self.guild
        return None


class FakeResourceService:
    def __init__(
        self,
        trap_id: int | None,
        *,
        moderation_log_id: int | None = None,
    ) -> None:
        self.trap_id = trap_id
        self.moderation_log_id = moderation_log_id
        self.calls: list[tuple[int, ResourceKey]] = []

    async def get(self, guild_id: int, key: ResourceKey) -> Any:
        self.calls.append((guild_id, key))
        if key is ResourceKey.COMPROMISED_ACCOUNT_TRAP:
            discord_id = self.trap_id
        elif key is ResourceKey.MODERATION_LOG:
            discord_id = self.moderation_log_id
        else:
            discord_id = None
        if discord_id is None:
            return None
        return SimpleNamespace(discord_id=discord_id)


class FakeTrapService:
    def __init__(
        self,
        *,
        delete_trigger_only: bool = False,
        full_incident: bool = False,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.delete_trigger_only = delete_trigger_only
        self.full_incident = full_incident
        self.metadata = metadata or {}
        self.calls: list[tuple[Any, Any, int]] = []

    async def execute(
        self,
        trigger: Any,
        enforcer: Any,
        *,
        moderator_id: int,
        now: Any = None,
    ) -> TrapExecutionResult:
        del now
        self.calls.append((trigger, enforcer, moderator_id))
        return TrapExecutionResult(
            disposition=(
                ClaimDisposition.COOLDOWN if self.delete_trigger_only else ClaimDisposition.CLAIMED
            ),
            full_incident=self.full_incident,
            delete_trigger_only=self.delete_trigger_only,
            incident_id=1,
            reason="automatic trap",
            containment_status=(ContainmentStatus.CONTAINED if self.full_incident else None),
            ban_status=BanStatus.SUCCEEDED if self.full_incident else None,
            ban_error=None,
            native_delete_requested=self.full_incident,
            fallback_cleanup_run=False,
            deleted_message_count=0,
            failed_scopes=(),
            metadata=dict(self.metadata),
        )


class FakeModerationService:
    def __init__(self, *, error: Exception | None = None) -> None:
        self.error = error
        self.calls: list[dict[str, Any]] = []

    async def create_case(
        self,
        guild_id: int,
        action: str,
        target_id: int,
        moderator_id: int,
        reason: str,
        *,
        expires_at: datetime | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ModerationCaseRecord:
        self.calls.append(
            {
                "guild_id": guild_id,
                "action": action,
                "target_id": target_id,
                "moderator_id": moderator_id,
                "reason": reason,
                "expires_at": expires_at,
                "metadata": dict(metadata or {}),
            }
        )
        if self.error is not None:
            raise self.error
        return ModerationCaseRecord(
            id=44,
            guild_id=guild_id,
            action=action,
            target_id=target_id,
            moderator_id=moderator_id,
            reason=reason,
            created_at=NOW,
            expires_at=expires_at,
            metadata=dict(metadata or {}),
        )


class FakeIncidentRepository:
    def __init__(self, interrupted: list[Any]) -> None:
        self.interrupted = list(interrupted)
        self.calls: list[datetime] = []

    async def mark_in_progress_interrupted(self, now: datetime) -> list[Any]:
        self.calls.append(now)
        if not self.interrupted:
            return []
        rows = list(self.interrupted)
        self.interrupted.clear()
        return rows


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


def _bot(guild: FakeGuild | None = None) -> FakeBot:
    return FakeBot(guild)


def _http_error(
    kind: type[discord.HTTPException], status: int, message: str
) -> discord.HTTPException:
    response = SimpleNamespace(status=status, reason=message)
    return kind(response, {"message": message, "code": 0})


def _patch_text_channel(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(compromise_trap.discord, "TextChannel", FakeTextChannel)


def _full_metadata() -> dict[str, Any]:
    return {
        "automated": True,
        "source": "compromised_account_trap",
        "incident_id": 1,
        "trigger_channel_id": 10,
        "trigger_message_id": 500,
        "moderator_id": 999,
        "ban_status": "succeeded",
        "ban_error": None,
        "native_delete_requested": True,
        "cleanup_path": "discord_native_ban",
        "fallback_cleanup_run": False,
        "deleted_message_count": 0,
        "failed_scope_ids": [],
        "containment_status": "contained",
    }


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
    cog = CompromisedAccountTrapCog(
        _bot(), FakeResourceService(10), FakeTrapService(delete_trigger_only=True)
    )

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


async def test_full_incident_creates_one_automated_case_and_summary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_text_channel(monkeypatch)
    trap = FakeTextChannel(10, "trap")
    moderation_log = FakeTextChannel(20, "moderation-log")
    guild = FakeGuild(1, channels=[trap, moderation_log])
    resources = FakeResourceService(10, moderation_log_id=20)
    service = FakeTrapService(full_incident=True, metadata=_full_metadata())
    moderation = FakeModerationService()
    cog = CompromisedAccountTrapCog(_bot(guild), resources, service, moderation)

    await cog.on_message(FakeIncomingMessage(guild, trap))

    assert len(moderation.calls) == 1
    call = moderation.calls[0]
    assert call["action"] == "ban"
    assert call["target_id"] == 123
    assert call["moderator_id"] == 999
    assert call["reason"] == "automatic trap"
    assert call["metadata"] == _full_metadata()
    assert all("content" not in key.lower() for key in call["metadata"])
    assert len(moderation_log.sent_embeds) == 1
    embed = moderation_log.sent_embeds[0]
    rendered = " ".join(
        [embed.title or "", embed.description or ""]
        + [f"{field.name} {field.value}" for field in embed.fields]
    )
    for expected in (
        "<@123>",
        "<#10>",
        "500",
        "succeeded",
        "discord_native_ban",
        "contained",
        "1",
        "44",
    ):
        assert expected in rendered


async def test_duplicate_or_cooldown_creates_no_case_or_summary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_text_channel(monkeypatch)
    trap = FakeTextChannel(10, "trap")
    moderation_log = FakeTextChannel(20, "moderation-log")
    guild = FakeGuild(1, channels=[trap, moderation_log])
    moderation = FakeModerationService()
    cog = CompromisedAccountTrapCog(
        _bot(guild),
        FakeResourceService(10, moderation_log_id=20),
        FakeTrapService(delete_trigger_only=True),
        moderation,
    )
    message = FakeIncomingMessage(guild, trap)

    await cog.on_message(message)

    assert message.deleted is True
    assert moderation.calls == []
    assert moderation_log.sent_embeds == []


async def test_case_persistence_failure_never_rolls_back_containment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_text_channel(monkeypatch)
    trap = FakeTextChannel(10, "trap")
    moderation_log = FakeTextChannel(20, "moderation-log")
    guild = FakeGuild(1, channels=[trap, moderation_log])
    moderation = FakeModerationService(error=RuntimeError("database unavailable"))
    cog = CompromisedAccountTrapCog(
        _bot(guild),
        FakeResourceService(10, moderation_log_id=20),
        FakeTrapService(full_incident=True, metadata=_full_metadata()),
        moderation,
    )

    await cog.on_message(FakeIncomingMessage(guild, trap))

    assert len(moderation.calls) == 1
    assert guild.unban_calls == []
    assert len(moderation_log.sent_embeds) == 1


@pytest.mark.parametrize("moderation_log_id", [None, 9999])
async def test_absent_or_stale_moderation_log_preserves_case(
    monkeypatch: pytest.MonkeyPatch,
    moderation_log_id: int | None,
) -> None:
    _patch_text_channel(monkeypatch)
    trap = FakeTextChannel(10, "trap")
    guild = FakeGuild(1, channels=[trap])
    moderation = FakeModerationService()
    cog = CompromisedAccountTrapCog(
        _bot(guild),
        FakeResourceService(10, moderation_log_id=moderation_log_id),
        FakeTrapService(full_incident=True, metadata=_full_metadata()),
        moderation,
    )

    await cog.on_message(FakeIncomingMessage(guild, trap))

    assert len(moderation.calls) == 1
    assert guild.unban_calls == []


async def test_moderation_log_post_failure_preserves_case(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_text_channel(monkeypatch)
    trap = FakeTextChannel(10, "trap")
    moderation_log = FakeTextChannel(
        20,
        "moderation-log",
        send_error=_http_error(discord.Forbidden, 403, "cannot post"),
    )
    guild = FakeGuild(1, channels=[trap, moderation_log])
    moderation = FakeModerationService()
    cog = CompromisedAccountTrapCog(
        _bot(guild),
        FakeResourceService(10, moderation_log_id=20),
        FakeTrapService(full_incident=True, metadata=_full_metadata()),
        moderation,
    )

    await cog.on_message(FakeIncomingMessage(guild, trap))

    assert len(moderation.calls) == 1
    assert guild.unban_calls == []


async def test_startup_reconciliation_reports_interrupted_once_without_destructive_replay(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _patch_text_channel(monkeypatch)
    moderation_log = FakeTextChannel(20, "moderation-log")
    guild = FakeGuild(1, channels=[moderation_log])
    interrupted = SimpleNamespace(
        id=7,
        guild_id=1,
        target_id=123,
        trigger_channel_id=10,
        trigger_message_id=500,
        containment_status="interrupted",
        ban_status=None,
        fallback_cleanup_run=False,
        deleted_message_count=0,
        failed_scopes=(),
    )
    incidents = FakeIncidentRepository([interrupted])
    service = FakeTrapService()
    cog = CompromisedAccountTrapCog(
        _bot(guild),
        FakeResourceService(None, moderation_log_id=20),
        service,
        FakeModerationService(),
    )
    cog.incidents = incidents

    assert hasattr(cog, "on_ready"), "Trap cog must reconcile interrupted incidents on ready"
    await cog.on_ready()
    await cog.on_ready()

    assert len(incidents.calls) == 2
    assert service.calls == []
    assert guild.ban_calls == []
    assert len(moderation_log.sent_embeds) == 1
    rendered = " ".join(
        [
            moderation_log.sent_embeds[0].title or "",
            moderation_log.sent_embeds[0].description or "",
        ]
        + [f"{field.name} {field.value}" for field in moderation_log.sent_embeds[0].fields]
    )
    assert "interrupted" in rendered.lower()
    assert "7" in rendered
