from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import Protocol, runtime_checkable


class AnonymousMessageKind(StrEnum):
    MESSAGE = "message"
    REPLY = "reply"


@dataclass(frozen=True, slots=True)
class AnonymousMessageRecord:
    id: int
    guild_id: int
    user_id: int
    channel_id: int
    message_id: int | None
    kind: AnonymousMessageKind
    display_number: int | None
    reply_to_message_id: int | None
    content: str
    deleted_at: datetime | None
    created_at: datetime


@dataclass(frozen=True, slots=True)
class AnonymousPanelRecord:
    guild_id: int
    channel_id: int
    message_id: int
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class RenumberItem:
    record_id: int
    message_id: int
    current_number: int | None
    expected_number: int


class AnonymousMessageRepository(Protocol):
    async def next_display_number(self, guild_id: int) -> int: ...

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
    ) -> AnonymousMessageRecord: ...

    async def attach_message(self, record_id: int, message_id: int) -> AnonymousMessageRecord: ...

    async def discard_unposted(self, record_id: int) -> bool: ...

    async def mark_deleted_by_message(
        self, guild_id: int, message_id: int, deleted_at: datetime
    ) -> bool: ...

    async def list_active_top_level(self, guild_id: int) -> list[AnonymousMessageRecord]: ...

    async def set_display_number(
        self, record_id: int, display_number: int
    ) -> AnonymousMessageRecord: ...

    async def get_panel(self, guild_id: int) -> AnonymousPanelRecord | None: ...

    async def save_panel(
        self, guild_id: int, channel_id: int, message_id: int
    ) -> AnonymousPanelRecord: ...

    async def clear_panel(self, guild_id: int) -> bool: ...


@runtime_checkable
class AtomicTopLevelRepository(Protocol):
    async def create_top_level(
        self,
        *,
        guild_id: int,
        user_id: int,
        channel_id: int,
        content: str,
    ) -> AnonymousMessageRecord: ...


class AnonymousMessageService:
    def __init__(self, repository: AnonymousMessageRepository) -> None:
        self.repository = repository
        self._number_locks: dict[int, asyncio.Lock] = {}

    def _number_lock(self, guild_id: int) -> asyncio.Lock:
        lock = self._number_locks.get(guild_id)
        if lock is None:
            lock = asyncio.Lock()
            self._number_locks[guild_id] = lock
        return lock

    @staticmethod
    def _normalize_message(content: str) -> str:
        normalized = content.strip()
        if len(normalized) < 10:
            raise ValueError("Anonymous messages must contain at least 10 characters.")
        if len(normalized) > 2000:
            raise ValueError("Anonymous messages cannot exceed 2000 characters.")
        return normalized

    @staticmethod
    def _normalize_reply(content: str) -> str:
        normalized = content.strip()
        if len(normalized) < 5:
            raise ValueError("Anonymous replies must contain at least 5 characters.")
        if len(normalized) > 2000:
            raise ValueError("Anonymous replies cannot exceed 2000 characters.")
        return normalized

    async def create_message(
        self, guild_id: int, user_id: int, channel_id: int, content: str
    ) -> AnonymousMessageRecord:
        normalized = self._normalize_message(content)
        async with self._number_lock(guild_id):
            if isinstance(self.repository, AtomicTopLevelRepository):
                return await self.repository.create_top_level(
                    guild_id=guild_id,
                    user_id=user_id,
                    channel_id=channel_id,
                    content=normalized,
                )

            display_number = await self.repository.next_display_number(guild_id)
            return await self.repository.create(
                guild_id=guild_id,
                user_id=user_id,
                channel_id=channel_id,
                kind=AnonymousMessageKind.MESSAGE,
                content=normalized,
                display_number=display_number,
                reply_to_message_id=None,
            )

    async def create_reply(
        self,
        guild_id: int,
        user_id: int,
        channel_id: int,
        reply_to_message_id: int,
        content: str,
    ) -> AnonymousMessageRecord:
        normalized = self._normalize_reply(content)
        return await self.repository.create(
            guild_id=guild_id,
            user_id=user_id,
            channel_id=channel_id,
            kind=AnonymousMessageKind.REPLY,
            content=normalized,
            display_number=None,
            reply_to_message_id=reply_to_message_id,
        )

    async def attach_message(self, record_id: int, message_id: int) -> AnonymousMessageRecord:
        return await self.repository.attach_message(record_id, message_id)

    async def discard_unposted(self, record_id: int) -> bool:
        return await self.repository.discard_unposted(record_id)

    async def mark_deleted_by_message(self, guild_id: int, message_id: int) -> bool:
        return await self.repository.mark_deleted_by_message(
            guild_id,
            message_id,
            datetime.now(UTC),
        )

    async def renumber_plan(self, guild_id: int) -> list[RenumberItem]:
        records = await self.repository.list_active_top_level(guild_id)
        return [
            RenumberItem(
                record_id=record.id,
                message_id=record.message_id,
                current_number=record.display_number,
                expected_number=expected_number,
            )
            for expected_number, record in enumerate(records, start=1)
            if record.message_id is not None
        ]

    async def set_display_number(
        self, record_id: int, display_number: int
    ) -> AnonymousMessageRecord:
        return await self.repository.set_display_number(record_id, display_number)

    async def get_panel(self, guild_id: int) -> AnonymousPanelRecord | None:
        return await self.repository.get_panel(guild_id)

    async def save_panel(
        self, guild_id: int, channel_id: int, message_id: int
    ) -> AnonymousPanelRecord:
        return await self.repository.save_panel(guild_id, channel_id, message_id)

    async def clear_panel(self, guild_id: int) -> bool:
        return await self.repository.clear_panel(guild_id)
