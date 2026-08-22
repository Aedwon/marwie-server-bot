from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

_TICKET_KEY = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")
_ACTIVE = {"open", "claimed"}


@dataclass(frozen=True, slots=True)
class TicketTypeRecord:
    guild_id: int
    key: str
    label: str
    description: str
    enabled: bool


@dataclass(frozen=True, slots=True)
class TicketRecord:
    id: int
    guild_id: int
    channel_id: int
    opener_id: int
    type_key: str
    status: str
    claimed_by: int | None
    closed_by: int | None
    close_reason: str | None
    created_at: datetime
    closed_at: datetime | None


class TicketRepository(Protocol):
    async def list_types(
        self, guild_id: int, *, enabled_only: bool = True
    ) -> list[TicketTypeRecord]: ...

    async def upsert_type(
        self, guild_id: int, key: str, label: str, description: str
    ) -> TicketTypeRecord: ...

    async def disable_type(self, guild_id: int, key: str) -> bool: ...

    async def find_active_for_user(
        self, guild_id: int, opener_id: int
    ) -> TicketRecord | None: ...

    async def create(
        self, guild_id: int, channel_id: int, opener_id: int, type_key: str
    ) -> TicketRecord: ...

    async def get_by_channel(self, channel_id: int) -> TicketRecord | None: ...

    async def set_state(
        self,
        channel_id: int,
        status: str,
        actor_id: int | None,
        detail: str | None = None,
    ) -> TicketRecord | None: ...

    async def mark_deleted(self, channel_id: int) -> TicketRecord | None: ...


class TicketService:
    def __init__(self, repository: TicketRepository) -> None:
        self.repository = repository

    async def list_types(self, guild_id: int) -> list[TicketTypeRecord]:
        return await self.repository.list_types(guild_id)

    async def upsert_type(
        self, guild_id: int, key: str, label: str, description: str
    ) -> TicketTypeRecord:
        normalized_key = key.strip().lower()
        normalized_label = label.strip()
        normalized_description = description.strip()
        if not _TICKET_KEY.fullmatch(normalized_key):
            raise ValueError("Ticket type key must use lowercase letters, numbers, `_` or `-`.")
        if not normalized_label:
            raise ValueError("Ticket type label is required.")
        if not normalized_description:
            raise ValueError("Ticket type description is required.")
        return await self.repository.upsert_type(
            guild_id, normalized_key, normalized_label[:80], normalized_description[:200]
        )

    async def disable_type(self, guild_id: int, key: str) -> bool:
        return await self.repository.disable_type(guild_id, key.strip().lower())

    async def active_for_user(self, guild_id: int, opener_id: int) -> TicketRecord | None:
        ticket = await self.repository.find_active_for_user(guild_id, opener_id)
        if ticket is not None and ticket.status in _ACTIVE:
            return ticket
        return None

    async def create(
        self, guild_id: int, channel_id: int, opener_id: int, type_key: str
    ) -> TicketRecord:
        return await self.repository.create(guild_id, channel_id, opener_id, type_key)

    async def get_by_channel(self, channel_id: int) -> TicketRecord | None:
        return await self.repository.get_by_channel(channel_id)

    async def claim(self, channel_id: int, actor_id: int) -> TicketRecord | None:
        return await self.repository.set_state(channel_id, "claimed", actor_id)

    async def close(self, channel_id: int, actor_id: int, reason: str) -> TicketRecord | None:
        normalized = reason.strip() or "Closed by staff."
        return await self.repository.set_state(channel_id, "closed", actor_id, normalized[:1000])

    async def reopen(self, channel_id: int, actor_id: int) -> TicketRecord | None:
        return await self.repository.set_state(channel_id, "open", actor_id)

    async def mark_deleted(self, channel_id: int) -> TicketRecord | None:
        return await self.repository.mark_deleted(channel_id)
