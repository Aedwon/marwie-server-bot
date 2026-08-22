from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select

from marwie_bot.db.models import ShowcaseSpotlight
from marwie_bot.db.session import Database


@dataclass(frozen=True, slots=True)
class SpotlightRecord:
    id: int
    guild_id: int
    thread_id: int
    posted_message_id: int | None
    selected_by: int


class SQLAlchemyShowcaseRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def spotlighted_thread_ids(self, guild_id: int) -> set[int]:
        async with self.database.session() as session:
            rows = (
                (
                    await session.execute(
                        select(ShowcaseSpotlight.thread_id).where(
                            ShowcaseSpotlight.guild_id == guild_id
                        )
                    )
                )
                .scalars()
                .all()
            )
            return {int(value) for value in rows}

    async def create(
        self,
        guild_id: int,
        thread_id: int,
        selected_by: int,
        posted_message_id: int | None,
    ) -> SpotlightRecord:
        async with self.database.session() as session:
            model = ShowcaseSpotlight(
                guild_id=guild_id,
                thread_id=thread_id,
                selected_by=selected_by,
                posted_message_id=posted_message_id,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return SpotlightRecord(
                model.id,
                model.guild_id,
                model.thread_id,
                model.posted_message_id,
                model.selected_by,
            )
