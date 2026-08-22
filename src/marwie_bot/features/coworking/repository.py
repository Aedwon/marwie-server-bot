from __future__ import annotations

from datetime import datetime

from sqlalchemy import select

from marwie_bot.db.models import PomodoroSession
from marwie_bot.db.session import Database
from marwie_bot.features.coworking.service import PomodoroRecord


class SQLAlchemyPomodoroRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _record(model: PomodoroSession) -> PomodoroRecord:
        return PomodoroRecord(
            model.id,
            model.guild_id,
            model.user_id,
            model.channel_id,
            model.ends_at,
            model.status,
        )

    async def active(self, guild_id: int, user_id: int) -> PomodoroRecord | None:
        async with self.database.session() as session:
            statement = (
                select(PomodoroSession)
                .where(
                    PomodoroSession.guild_id == guild_id,
                    PomodoroSession.user_id == user_id,
                    PomodoroSession.status == "active",
                )
                .order_by(PomodoroSession.id.desc())
                .limit(1)
            )
            model = (await session.execute(statement)).scalar_one_or_none()
            return self._record(model) if model is not None else None

    async def create(
        self, guild_id: int, user_id: int, channel_id: int, ends_at: datetime
    ) -> PomodoroRecord:
        async with self.database.session() as session:
            model = PomodoroSession(
                guild_id=guild_id,
                user_id=user_id,
                channel_id=channel_id,
                ends_at=ends_at,
                status="active",
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return self._record(model)

    async def stop(self, session_id: int, status: str) -> PomodoroRecord | None:
        async with self.database.session() as session:
            model = await session.get(PomodoroSession, session_id)
            if model is None:
                return None
            model.status = status
            await session.commit()
            await session.refresh(model)
            return self._record(model)

    async def due(self, now: datetime) -> list[PomodoroRecord]:
        async with self.database.session() as session:
            models = (
                (
                    await session.execute(
                        select(PomodoroSession).where(
                            PomodoroSession.status == "active",
                            PomodoroSession.ends_at <= now,
                        )
                    )
                )
                .scalars()
                .all()
            )
            return [self._record(model) for model in models]
