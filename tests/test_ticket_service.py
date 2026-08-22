from datetime import UTC, datetime

import pytest

from marwie_bot.features.tickets.service import TicketRecord, TicketService, TicketTypeRecord


class FakeTickets:
    def __init__(self) -> None:
        self.types: dict[tuple[int, str], TicketTypeRecord] = {}
        self.active: TicketRecord | None = None

    async def list_types(
        self, guild_id: int, *, enabled_only: bool = True
    ) -> list[TicketTypeRecord]:
        return [
            item
            for (gid, _), item in self.types.items()
            if gid == guild_id and (item.enabled or not enabled_only)
        ]

    async def upsert_type(
        self, guild_id: int, key: str, label: str, description: str
    ) -> TicketTypeRecord:
        item = TicketTypeRecord(guild_id, key, label, description, True)
        self.types[(guild_id, key)] = item
        return item

    async def disable_type(self, guild_id: int, key: str) -> bool:
        item = self.types.get((guild_id, key))
        if item is None:
            return False
        self.types[(guild_id, key)] = TicketTypeRecord(
            guild_id, key, item.label, item.description, False
        )
        return True

    async def find_active_for_user(self, guild_id: int, opener_id: int) -> TicketRecord | None:
        return self.active

    async def create(
        self, guild_id: int, channel_id: int, opener_id: int, type_key: str
    ) -> TicketRecord:
        self.active = TicketRecord(
            1,
            guild_id,
            channel_id,
            opener_id,
            type_key,
            "open",
            None,
            None,
            None,
            datetime.now(UTC),
            None,
        )
        return self.active

    async def get_by_channel(self, channel_id: int) -> TicketRecord | None:
        return self.active if self.active and self.active.channel_id == channel_id else None

    async def set_state(
        self,
        channel_id: int,
        status: str,
        actor_id: int | None,
        detail: str | None = None,
    ) -> TicketRecord | None:
        if self.active is None:
            return None
        self.active = TicketRecord(
            self.active.id,
            self.active.guild_id,
            self.active.channel_id,
            self.active.opener_id,
            self.active.type_key,
            status,
            actor_id if status == "claimed" else self.active.claimed_by,
            actor_id if status == "closed" else None,
            detail if status == "closed" else None,
            self.active.created_at,
            datetime.now(UTC) if status == "closed" else None,
        )
        return self.active

    async def mark_deleted(self, channel_id: int) -> TicketRecord | None:
        return await self.set_state(channel_id, "deleted", None)


async def test_ticket_type_normalizes_key() -> None:
    repo = FakeTickets()
    service = TicketService(repo)
    item = await service.upsert_type(1, "  Build_Help ", "Build help", "Technical support")
    assert item.key == "build_help"


async def test_ticket_type_rejects_invalid_key() -> None:
    service = TicketService(FakeTickets())
    with pytest.raises(ValueError, match="key"):
        await service.upsert_type(1, "Not Allowed!", "Label", "Description")


async def test_close_defaults_reason() -> None:
    repo = FakeTickets()
    service = TicketService(repo)
    await service.create(1, 10, 20, "general")
    ticket = await service.close(10, 30, "  ")
    assert ticket is not None
    assert ticket.close_reason == "Closed by staff."
