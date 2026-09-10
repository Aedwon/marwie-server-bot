from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast

import discord

from marwie_bot.config.resources import ResourceKey
from marwie_bot.db.base import Base
from marwie_bot.db.session import Database
from marwie_bot.features.anonymous_messages.repository import SQLAlchemyAnonymousMessageRepository
from marwie_bot.features.anonymous_messages.service import (
    AnonymousMessageKind,
    AnonymousMessageRecord,
    AnonymousMessageService,
)
from marwie_bot.features.anonymous_messages.views import (
    AnonMessageModal,
    AnonPanelView,
    AnonReplyModal,
    AnonReplyView,
    interaction_destinations,
)


class _NeverResources:
    async def get(self, *_args: object, **_kwargs: object) -> object:
        raise AssertionError("button callbacks must not perform resource I/O before opening a modal")

    async def list_for_guild(self, *_args: object, **_kwargs: object) -> object:
        raise AssertionError("button callbacks must not perform resource I/O before opening a modal")


class _NeverFeatures:
    async def is_enabled(self, *_args: object, **_kwargs: object) -> bool:
        raise AssertionError("button callbacks must not perform feature I/O before opening a modal")


class _ModalResponse:
    def __init__(self) -> None:
        self.modal: discord.ui.Modal | None = None

    async def send_modal(self, modal: discord.ui.Modal) -> None:
        self.modal = modal


async def test_send_button_opens_modal_without_database_preflight() -> None:
    response = _ModalResponse()
    view = AnonPanelView(
        cast(Any, object()),
        cast(Any, _NeverResources()),
        cast(Any, _NeverFeatures()),
    )
    button = cast(Any, view.children[0])
    interaction = cast(Any, SimpleNamespace(response=response))

    await button.callback(interaction)

    assert isinstance(response.modal, AnonMessageModal)


async def test_reply_button_opens_modal_without_database_preflight() -> None:
    response = _ModalResponse()
    original_message = SimpleNamespace(id=55)
    view = AnonReplyView(
        cast(Any, object()),
        cast(Any, _NeverResources()),
        cast(Any, _NeverFeatures()),
    )
    button = cast(Any, view.children[0])
    interaction = cast(Any, SimpleNamespace(response=response, message=original_message))

    await button.callback(interaction)

    assert isinstance(response.modal, AnonReplyModal)
    assert response.modal.original_message is original_message


class _Member:
    pass


class _TextChannel:
    def __init__(self, channel_id: int, *, audit: bool = False) -> None:
        self.id = channel_id
        self.name = f"channel-{channel_id}"
        self.mention = f"<#{channel_id}>"
        self.audit = audit

    def permissions_for(self, member: object) -> object:
        if self.audit and getattr(member, "is_default_role", False):
            return SimpleNamespace(view_channel=False)
        return SimpleNamespace(
            view_channel=True,
            send_messages=True,
            embed_links=True,
            read_message_history=True,
            manage_messages=True,
        )


class _BulkResources:
    def __init__(self) -> None:
        self.list_calls = 0

    async def get(self, *_args: object, **_kwargs: object) -> object:
        raise AssertionError("interaction validation should bulk-load mappings")

    async def list_for_guild(self, guild_id: int) -> list[object]:
        assert guild_id == 1
        self.list_calls += 1
        return [
            SimpleNamespace(key=ResourceKey.ANON_MESSAGES_PANEL, discord_id=101),
            SimpleNamespace(key=ResourceKey.ANON_MESSAGES_SUBMISSIONS, discord_id=102),
            SimpleNamespace(key=ResourceKey.ANON_MESSAGES_AUDIT_LOG, discord_id=103),
        ]


class _BulkFeatures:
    def __init__(self) -> None:
        self.calls = 0

    async def is_enabled(self, guild_id: int, feature: object) -> bool:
        assert guild_id == 1
        assert getattr(feature, "value", None) == "anonymous_messages"
        self.calls += 1
        return True


async def test_submit_preflight_bulk_loads_mappings_once(monkeypatch: Any) -> None:
    monkeypatch.setattr(discord, "Member", _Member)
    monkeypatch.setattr(discord, "TextChannel", _TextChannel)
    default_role = SimpleNamespace(is_default_role=True)
    member = _Member()
    channels = {
        101: _TextChannel(101),
        102: _TextChannel(102),
        103: _TextChannel(103, audit=True),
    }
    guild = SimpleNamespace(
        id=1,
        me=member,
        default_role=default_role,
        get_channel=lambda channel_id: channels.get(channel_id),
    )
    interaction = cast(Any, SimpleNamespace(guild=guild, user=member))
    resources = _BulkResources()
    features = _BulkFeatures()

    destinations = await interaction_destinations(
        interaction,
        cast(Any, resources),
        cast(Any, features),
    )

    assert destinations is not None
    assert resources.list_calls == 1
    assert features.calls == 1


class _AtomicRepository:
    def __init__(self) -> None:
        self.atomic_calls = 0

    async def next_display_number(self, guild_id: int) -> int:
        del guild_id
        raise AssertionError("create_message must not use a separate number-allocation query")

    async def create_top_level(
        self,
        *,
        guild_id: int,
        user_id: int,
        channel_id: int,
        content: str,
    ) -> AnonymousMessageRecord:
        self.atomic_calls += 1
        return AnonymousMessageRecord(
            id=1,
            guild_id=guild_id,
            user_id=user_id,
            channel_id=channel_id,
            message_id=None,
            kind=AnonymousMessageKind.MESSAGE,
            display_number=1,
            reply_to_message_id=None,
            content=content,
            deleted_at=None,
            created_at=datetime.now(UTC),
        )


async def test_create_message_uses_atomic_repository_path() -> None:
    repository = _AtomicRepository()
    service = AnonymousMessageService(cast(Any, repository))

    record = await service.create_message(1, 22, 101, "  quick anonymous message  ")

    assert record.display_number == 1
    assert record.content == "quick anonymous message"
    assert repository.atomic_calls == 1


async def test_sql_repository_atomic_top_level_create_round_trips() -> None:
    database = Database("sqlite+aiosqlite:///:memory:")
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        repository = SQLAlchemyAnonymousMessageRepository(database)

        first = await repository.create_top_level(
            guild_id=1,
            user_id=22,
            channel_id=101,
            content="first atomic message",
        )
        second = await repository.create_top_level(
            guild_id=1,
            user_id=23,
            channel_id=101,
            content="second atomic message",
        )

        assert first.display_number == 1
        assert second.display_number == 2
        assert first.created_at is not None
        assert second.created_at is not None
    finally:
        await database.close()
