from datetime import UTC, datetime

import pytest

from marwie_bot.features.anonymous_messages.service import (
    AnonymousMessageKind,
    AnonymousMessageRecord,
    AnonymousMessageService,
    AnonymousPanelRecord,
)


class FakeAnonymousMessageRepository:
    def __init__(self) -> None:
        self.messages: list[AnonymousMessageRecord] = []
        self.panel: AnonymousPanelRecord | None = None
        self.next_id = 1

    async def next_display_number(self, guild_id: int) -> int:
        numbers = [
            record.display_number
            for record in self.messages
            if record.guild_id == guild_id
            and record.kind is AnonymousMessageKind.MESSAGE
            and record.deleted_at is None
            and record.display_number is not None
        ]
        return max(numbers, default=0) + 1

    async def create(
        self,
        *,
        guild_id: int,
        user_id: int,
        channel_id: int,
        kind: AnonymousMessageKind,
        content: str,
        display_number: int | None,
        reply_to_message_id: int | None,
    ) -> AnonymousMessageRecord:
        record = AnonymousMessageRecord(
            id=self.next_id,
            guild_id=guild_id,
            user_id=user_id,
            channel_id=channel_id,
            message_id=None,
            kind=kind,
            display_number=display_number,
            reply_to_message_id=reply_to_message_id,
            content=content,
            deleted_at=None,
            created_at=datetime.now(UTC),
        )
        self.next_id += 1
        self.messages.append(record)
        return record

    async def attach_message(self, record_id: int, message_id: int) -> AnonymousMessageRecord:
        record = self._get(record_id)
        updated = AnonymousMessageRecord(
            record.id,
            record.guild_id,
            record.user_id,
            record.channel_id,
            message_id,
            record.kind,
            record.display_number,
            record.reply_to_message_id,
            record.content,
            record.deleted_at,
            record.created_at,
        )
        self._replace(updated)
        return updated

    async def discard_unposted(self, record_id: int) -> bool:
        before = len(self.messages)
        self.messages = [record for record in self.messages if record.id != record_id]
        return len(self.messages) != before

    async def mark_deleted_by_message(
        self, guild_id: int, message_id: int, deleted_at: datetime
    ) -> bool:
        for record in list(self.messages):
            if record.guild_id == guild_id and record.message_id == message_id:
                updated = AnonymousMessageRecord(
                    record.id,
                    record.guild_id,
                    record.user_id,
                    record.channel_id,
                    record.message_id,
                    record.kind,
                    record.display_number,
                    record.reply_to_message_id,
                    record.content,
                    deleted_at,
                    record.created_at,
                )
                self._replace(updated)
                return True
        return False

    async def list_active_top_level(self, guild_id: int) -> list[AnonymousMessageRecord]:
        return sorted(
            [
                record
                for record in self.messages
                if record.guild_id == guild_id
                and record.kind is AnonymousMessageKind.MESSAGE
                and record.deleted_at is None
                and record.message_id is not None
            ],
            key=lambda record: (record.created_at, record.id),
        )

    async def set_display_number(
        self, record_id: int, display_number: int
    ) -> AnonymousMessageRecord:
        record = self._get(record_id)
        updated = AnonymousMessageRecord(
            record.id,
            record.guild_id,
            record.user_id,
            record.channel_id,
            record.message_id,
            record.kind,
            display_number,
            record.reply_to_message_id,
            record.content,
            record.deleted_at,
            record.created_at,
        )
        self._replace(updated)
        return updated

    async def get_panel(self, guild_id: int) -> AnonymousPanelRecord | None:
        if self.panel is not None and self.panel.guild_id == guild_id:
            return self.panel
        return None

    async def save_panel(
        self, guild_id: int, channel_id: int, message_id: int
    ) -> AnonymousPanelRecord:
        self.panel = AnonymousPanelRecord(
            guild_id=guild_id,
            channel_id=channel_id,
            message_id=message_id,
            updated_at=datetime.now(UTC),
        )
        return self.panel

    async def clear_panel(self, guild_id: int) -> bool:
        if self.panel is None or self.panel.guild_id != guild_id:
            return False
        self.panel = None
        return True

    def _get(self, record_id: int) -> AnonymousMessageRecord:
        return next(record for record in self.messages if record.id == record_id)

    def _replace(self, record: AnonymousMessageRecord) -> None:
        self.messages = [record if item.id == record.id else item for item in self.messages]


async def test_new_message_is_trimmed_and_numbered_per_guild() -> None:
    repository = FakeAnonymousMessageRepository()
    service = AnonymousMessageService(repository)

    first = await service.create_message(1, 10, 100, "   first anonymous message   ")
    second = await service.create_message(1, 11, 100, "second anonymous message")
    other_guild = await service.create_message(2, 12, 200, "other guild message")

    assert first.content == "first anonymous message"
    assert first.display_number == 1
    assert second.display_number == 2
    assert other_guild.display_number == 1


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        ("short", "at least 10"),
        ("x" * 2001, "cannot exceed 2000"),
    ],
)
async def test_new_message_enforces_reference_length_bounds(content: str, expected: str) -> None:
    service = AnonymousMessageService(FakeAnonymousMessageRepository())

    with pytest.raises(ValueError, match=expected):
        await service.create_message(1, 10, 100, content)


async def test_reply_is_trimmed_and_does_not_consume_top_level_number() -> None:
    repository = FakeAnonymousMessageRepository()
    service = AnonymousMessageService(repository)

    first = await service.create_message(1, 10, 100, "first anonymous message")
    await service.attach_message(first.id, 501)
    reply = await service.create_reply(1, 11, 100, 501, "   reply body   ")
    second = await service.create_message(1, 12, 100, "second anonymous message")

    assert reply.kind is AnonymousMessageKind.REPLY
    assert reply.display_number is None
    assert reply.reply_to_message_id == 501
    assert reply.content == "reply body"
    assert second.display_number == 2


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        ("no", "at least 5"),
        ("x" * 2001, "cannot exceed 2000"),
    ],
)
async def test_reply_enforces_reference_length_bounds(content: str, expected: str) -> None:
    service = AnonymousMessageService(FakeAnonymousMessageRepository())

    with pytest.raises(ValueError, match=expected):
        await service.create_reply(1, 10, 100, 500, content)


async def test_discard_unposted_record_releases_number_for_next_message() -> None:
    repository = FakeAnonymousMessageRepository()
    service = AnonymousMessageService(repository)

    failed = await service.create_message(1, 10, 100, "message that will fail")
    assert failed.display_number == 1
    assert await service.discard_unposted(failed.id) is True

    replacement = await service.create_message(1, 11, 100, "replacement message")
    assert replacement.display_number == 1


async def test_soft_deleted_top_level_message_produces_contiguous_renumber_plan() -> None:
    repository = FakeAnonymousMessageRepository()
    service = AnonymousMessageService(repository)

    first = await service.create_message(1, 10, 100, "first anonymous message")
    second = await service.create_message(1, 11, 100, "second anonymous message")
    third = await service.create_message(1, 12, 100, "third anonymous message")
    await service.attach_message(first.id, 501)
    await service.attach_message(second.id, 502)
    await service.attach_message(third.id, 503)

    assert await service.mark_deleted_by_message(1, 502) is True
    plan = await service.renumber_plan(1)

    assert [(item.message_id, item.current_number, item.expected_number) for item in plan] == [
        (501, 1, 1),
        (503, 3, 2),
    ]

    await service.set_display_number(third.id, 2)
    refreshed = await service.renumber_plan(1)
    assert [(item.current_number, item.expected_number) for item in refreshed] == [(1, 1), (2, 2)]


async def test_deleting_reply_does_not_change_top_level_plan() -> None:
    repository = FakeAnonymousMessageRepository()
    service = AnonymousMessageService(repository)

    message = await service.create_message(1, 10, 100, "first anonymous message")
    await service.attach_message(message.id, 501)
    reply = await service.create_reply(1, 11, 100, 501, "reply body")
    await service.attach_message(reply.id, 601)

    assert await service.mark_deleted_by_message(1, 601) is True
    plan = await service.renumber_plan(1)

    assert [(item.message_id, item.expected_number) for item in plan] == [(501, 1)]


async def test_panel_state_round_trips_through_service() -> None:
    service = AnonymousMessageService(FakeAnonymousMessageRepository())

    assert await service.get_panel(1) is None
    saved = await service.save_panel(1, 100, 500)
    assert (saved.guild_id, saved.channel_id, saved.message_id) == (1, 100, 500)
    assert await service.get_panel(1) == saved
    assert await service.clear_panel(1) is True
    assert await service.get_panel(1) is None
