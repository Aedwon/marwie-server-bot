from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select

from marwie_bot.db.models import Ticket, TicketEvent, TicketType
from marwie_bot.db.session import Database
from marwie_bot.features.tickets.service import TicketRecord, TicketTypeRecord


class SQLAlchemyTicketRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _type_record(model: TicketType) -> TicketTypeRecord:
        return TicketTypeRecord(
            model.guild_id, model.key, model.label, model.description, model.enabled
        )

    @staticmethod
    def _record(model: Ticket) -> TicketRecord:
        return TicketRecord(
            model.id,
            model.guild_id,
            model.channel_id,
            model.opener_id,
            model.type_key,
            model.status,
            model.claimed_by,
            model.closed_by,
            model.close_reason,
            model.created_at,
            model.closed_at,
        )

    async def list_types(
        self, guild_id: int, *, enabled_only: bool = True
    ) -> list[TicketTypeRecord]:
        async with self.database.session() as session:
            statement = select(TicketType).where(TicketType.guild_id == guild_id)
            if enabled_only:
                statement = statement.where(TicketType.enabled.is_(True))
            statement = statement.order_by(TicketType.label)
            models = (await session.execute(statement)).scalars().all()
            return [self._type_record(model) for model in models]

    async def upsert_type(
        self, guild_id: int, key: str, label: str, description: str
    ) -> TicketTypeRecord:
        async with self.database.session() as session:
            statement = select(TicketType).where(
                TicketType.guild_id == guild_id, TicketType.key == key
            )
            model = (await session.execute(statement)).scalar_one_or_none()
            if model is None:
                model = TicketType(
                    guild_id=guild_id,
                    key=key,
                    label=label,
                    description=description,
                    enabled=True,
                )
                session.add(model)
            else:
                model.label = label
                model.description = description
                model.enabled = True
            await session.commit()
            await session.refresh(model)
            return self._type_record(model)

    async def disable_type(self, guild_id: int, key: str) -> bool:
        async with self.database.session() as session:
            statement = select(TicketType).where(
                TicketType.guild_id == guild_id, TicketType.key == key
            )
            model = (await session.execute(statement)).scalar_one_or_none()
            if model is None:
                return False
            model.enabled = False
            await session.commit()
            return True

    async def find_active_for_user(self, guild_id: int, opener_id: int) -> TicketRecord | None:
        async with self.database.session() as session:
            statement = (
                select(Ticket)
                .where(
                    Ticket.guild_id == guild_id,
                    Ticket.opener_id == opener_id,
                    Ticket.status.in_(("open", "claimed")),
                )
                .order_by(Ticket.id.desc())
                .limit(1)
            )
            model = (await session.execute(statement)).scalar_one_or_none()
            return self._record(model) if model is not None else None

    async def create(
        self, guild_id: int, channel_id: int, opener_id: int, type_key: str
    ) -> TicketRecord:
        async with self.database.session() as session:
            model = Ticket(
                guild_id=guild_id,
                channel_id=channel_id,
                opener_id=opener_id,
                type_key=type_key,
                status="open",
            )
            session.add(model)
            await session.flush()
            session.add(
                TicketEvent(
                    ticket_id=model.id,
                    guild_id=guild_id,
                    actor_id=opener_id,
                    event="opened",
                    detail=type_key,
                )
            )
            await session.commit()
            await session.refresh(model)
            return self._record(model)

    async def get_by_channel(self, channel_id: int) -> TicketRecord | None:
        async with self.database.session() as session:
            model = (
                await session.execute(select(Ticket).where(Ticket.channel_id == channel_id))
            ).scalar_one_or_none()
            return self._record(model) if model is not None else None

    async def set_state(
        self,
        channel_id: int,
        status: str,
        actor_id: int | None,
        detail: str | None = None,
    ) -> TicketRecord | None:
        async with self.database.session() as session:
            model = (
                await session.execute(select(Ticket).where(Ticket.channel_id == channel_id))
            ).scalar_one_or_none()
            if model is None:
                return None
            model.status = status
            if status == "claimed":
                model.claimed_by = actor_id
            elif status == "closed":
                model.closed_by = actor_id
                model.close_reason = detail
                model.closed_at = datetime.now(UTC)
            elif status == "open":
                model.closed_by = None
                model.close_reason = None
                model.closed_at = None
            session.add(
                TicketEvent(
                    ticket_id=model.id,
                    guild_id=model.guild_id,
                    actor_id=actor_id,
                    event=status,
                    detail=detail,
                )
            )
            await session.commit()
            await session.refresh(model)
            return self._record(model)

    async def mark_deleted(self, channel_id: int) -> TicketRecord | None:
        async with self.database.session() as session:
            model = (
                await session.execute(select(Ticket).where(Ticket.channel_id == channel_id))
            ).scalar_one_or_none()
            if model is None:
                return None
            model.status = "deleted"
            if model.closed_at is None:
                model.closed_at = datetime.now(UTC)
            session.add(
                TicketEvent(
                    ticket_id=model.id,
                    guild_id=model.guild_id,
                    actor_id=None,
                    event="deleted",
                    detail="Discord channel was deleted.",
                )
            )
            await session.commit()
            await session.refresh(model)
            return self._record(model)
