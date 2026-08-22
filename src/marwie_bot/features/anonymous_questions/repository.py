from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select

from marwie_bot.db.models import AnonymousQuestion
from marwie_bot.db.session import Database
from marwie_bot.features.anonymous_questions.service import AnonymousQuestionRecord


class SQLAlchemyAnonymousQuestionRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _record(model: AnonymousQuestion) -> AnonymousQuestionRecord:
        return AnonymousQuestionRecord(
            model.id,
            model.guild_id,
            model.user_id,
            model.channel_id,
            model.message_id,
            model.question,
            model.created_at,
        )

    async def count_since(self, guild_id: int, user_id: int, since: datetime) -> int:
        async with self.database.session() as session:
            statement = select(func.count(AnonymousQuestion.id)).where(
                AnonymousQuestion.guild_id == guild_id,
                AnonymousQuestion.user_id == user_id,
                AnonymousQuestion.created_at >= since,
            )
            return int((await session.execute(statement)).scalar_one())

    async def latest_for_user(self, guild_id: int, user_id: int) -> AnonymousQuestionRecord | None:
        async with self.database.session() as session:
            statement = (
                select(AnonymousQuestion)
                .where(
                    AnonymousQuestion.guild_id == guild_id,
                    AnonymousQuestion.user_id == user_id,
                )
                .order_by(AnonymousQuestion.created_at.desc())
                .limit(1)
            )
            model = (await session.execute(statement)).scalar_one_or_none()
            return self._record(model) if model is not None else None

    async def create(
        self, guild_id: int, user_id: int, channel_id: int, question: str
    ) -> AnonymousQuestionRecord:
        async with self.database.session() as session:
            model = AnonymousQuestion(
                guild_id=guild_id,
                user_id=user_id,
                channel_id=channel_id,
                question=question,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return self._record(model)

    async def attach_message(self, question_id: int, message_id: int) -> AnonymousQuestionRecord:
        async with self.database.session() as session:
            model = await session.get(AnonymousQuestion, question_id)
            if model is None:
                raise RuntimeError("Anonymous question disappeared before message attachment")
            model.message_id = message_id
            await session.commit()
            await session.refresh(model)
            return self._record(model)

    async def get(self, guild_id: int, question_id: int) -> AnonymousQuestionRecord | None:
        async with self.database.session() as session:
            statement = select(AnonymousQuestion).where(
                AnonymousQuestion.guild_id == guild_id,
                AnonymousQuestion.id == question_id,
            )
            model = (await session.execute(statement)).scalar_one_or_none()
            return self._record(model) if model is not None else None
