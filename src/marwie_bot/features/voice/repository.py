from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select

from marwie_bot.db.models import TemporaryVoiceChannel
from marwie_bot.db.session import Database


@dataclass(frozen=True, slots=True)
class TemporaryVoiceRecord:
    channel_id: int
    guild_id: int
    owner_id: int


class SQLAlchemyVoiceRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def add(self, guild_id: int, channel_id: int, owner_id: int) -> TemporaryVoiceRecord:
        async with self.database.session() as session:
            model = TemporaryVoiceChannel(
                channel_id=channel_id, guild_id=guild_id, owner_id=owner_id
            )
            session.add(model)
            await session.commit()
            return TemporaryVoiceRecord(channel_id, guild_id, owner_id)

    async def get(self, channel_id: int) -> TemporaryVoiceRecord | None:
        async with self.database.session() as session:
            model = await session.get(TemporaryVoiceChannel, channel_id)
            if model is None:
                return None
            return TemporaryVoiceRecord(model.channel_id, model.guild_id, model.owner_id)

    async def list_all(self) -> list[TemporaryVoiceRecord]:
        async with self.database.session() as session:
            models = (await session.execute(select(TemporaryVoiceChannel))).scalars().all()
            return [
                TemporaryVoiceRecord(item.channel_id, item.guild_id, item.owner_id)
                for item in models
            ]

    async def remove(self, channel_id: int) -> None:
        async with self.database.session() as session:
            model = await session.get(TemporaryVoiceChannel, channel_id)
            if model is not None:
                await session.delete(model)
                await session.commit()
