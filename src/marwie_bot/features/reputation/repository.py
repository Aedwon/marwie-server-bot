from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select

from marwie_bot.db.models import ReputationEvent, ReputationTotal
from marwie_bot.db.session import Database


class SQLAlchemyReputationRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def add_event(
        self,
        guild_id: int,
        user_id: int,
        kind: str,
        points: int,
        actor_id: int | None,
        source_ref: str | None,
    ) -> int:
        async with self.database.session() as session:
            session.add(
                ReputationEvent(
                    guild_id=guild_id,
                    user_id=user_id,
                    kind=kind,
                    points=points,
                    actor_id=actor_id,
                    source_ref=source_ref,
                )
            )
            total = await session.get(ReputationTotal, (guild_id, user_id))
            if total is None:
                total = ReputationTotal(guild_id=guild_id, user_id=user_id, total_points=points)
                session.add(total)
            else:
                total.total_points += points
            await session.commit()
            return total.total_points

    async def total(self, guild_id: int, user_id: int) -> int:
        async with self.database.session() as session:
            model = await session.get(ReputationTotal, (guild_id, user_id))
            return model.total_points if model is not None else 0

    async def leaderboard(self, guild_id: int, limit: int) -> list[tuple[int, int]]:
        async with self.database.session() as session:
            statement = (
                select(ReputationTotal.user_id, ReputationTotal.total_points)
                .where(ReputationTotal.guild_id == guild_id)
                .order_by(ReputationTotal.total_points.desc(), ReputationTotal.user_id)
                .limit(limit)
            )
            rows = (await session.execute(statement)).all()
            return [(int(user_id), int(points)) for user_id, points in rows]

    async def rank(self, guild_id: int, user_id: int) -> int:
        points = await self.total(guild_id, user_id)
        async with self.database.session() as session:
            statement = (
                select(func.count())
                .select_from(ReputationTotal)
                .where(
                    ReputationTotal.guild_id == guild_id,
                    ReputationTotal.total_points > points,
                )
            )
            ahead = int((await session.execute(statement)).scalar_one())
            return ahead + 1

    async def event_counts(self, guild_id: int, user_id: int) -> dict[str, int]:
        async with self.database.session() as session:
            statement = (
                select(ReputationEvent.kind, func.count(ReputationEvent.id))
                .where(
                    ReputationEvent.guild_id == guild_id,
                    ReputationEvent.user_id == user_id,
                )
                .group_by(ReputationEvent.kind)
            )
            rows = (await session.execute(statement)).all()
            return {str(kind): int(count) for kind, count in rows}

    async def has_recent_event(
        self, guild_id: int, user_id: int, kind: str, since: datetime
    ) -> bool:
        async with self.database.session() as session:
            statement = (
                select(ReputationEvent.id)
                .where(
                    ReputationEvent.guild_id == guild_id,
                    ReputationEvent.user_id == user_id,
                    ReputationEvent.kind == kind,
                    ReputationEvent.created_at >= since,
                )
                .limit(1)
            )
            return (await session.execute(statement)).scalar_one_or_none() is not None
