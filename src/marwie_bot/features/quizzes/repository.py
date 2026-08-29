from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select

from marwie_bot.db.models import QuizAnswer, QuizQuestion, QuizSession
from marwie_bot.db.session import Database
from marwie_bot.features.quizzes.service import QuizQuestionRecord, QuizSessionRecord


class SQLAlchemyQuizRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _question(model: QuizQuestion) -> QuizQuestionRecord:
        return QuizQuestionRecord(
            model.id,
            model.guild_id,
            model.category,
            model.prompt,
            (model.option_a, model.option_b, model.option_c, model.option_d),
            model.correct_index,
            model.explanation,
            model.active,
        )

    @staticmethod
    def _as_utc(value: datetime) -> datetime:
        return value if value.tzinfo is not None else value.replace(tzinfo=UTC)

    @classmethod
    def _session(cls, model: QuizSession) -> QuizSessionRecord:
        return QuizSessionRecord(
            model.id,
            model.guild_id,
            model.channel_id,
            model.message_id,
            model.question_id,
            model.status,
            cls._as_utc(model.closes_at),
        )

    async def add_question(
        self,
        guild_id: int,
        category: str,
        prompt: str,
        options: tuple[str, str, str, str],
        correct_index: int,
        explanation: str | None,
    ) -> QuizQuestionRecord:
        async with self.database.session() as session:
            model = QuizQuestion(
                guild_id=guild_id,
                category=category,
                prompt=prompt,
                option_a=options[0],
                option_b=options[1],
                option_c=options[2],
                option_d=options[3],
                correct_index=correct_index,
                explanation=explanation,
                active=True,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return self._question(model)

    async def list_questions(
        self, guild_id: int, *, active_only: bool = False
    ) -> list[QuizQuestionRecord]:
        async with self.database.session() as session:
            statement = select(QuizQuestion).where(QuizQuestion.guild_id == guild_id)
            if active_only:
                statement = statement.where(QuizQuestion.active.is_(True))
            statement = statement.order_by(QuizQuestion.id)
            models = (await session.execute(statement)).scalars().all()
            return [self._question(model) for model in models]

    async def update_question(
        self,
        guild_id: int,
        question_id: int,
        category: str,
        prompt: str,
        options: tuple[str, str, str, str],
        correct_index: int,
        explanation: str | None,
    ) -> QuizQuestionRecord | None:
        async with self.database.session() as session:
            model = (
                await session.execute(
                    select(QuizQuestion)
                    .where(
                        QuizQuestion.id == question_id,
                        QuizQuestion.guild_id == guild_id,
                    )
                    .with_for_update()
                )
            ).scalar_one_or_none()
            if model is None:
                return None
            open_session_id = (
                await session.execute(
                    select(QuizSession.id)
                    .where(
                        QuizSession.guild_id == guild_id,
                        QuizSession.question_id == question_id,
                        QuizSession.status == "open",
                    )
                    .limit(1)
                )
            ).scalar_one_or_none()
            if open_session_id is not None:
                raise ValueError(
                    "That question is currently being used by an open quiz. "
                    "Edit it after the quiz closes."
                )
            model.category = category
            model.prompt = prompt
            model.option_a = options[0]
            model.option_b = options[1]
            model.option_c = options[2]
            model.option_d = options[3]
            model.correct_index = correct_index
            model.explanation = explanation
            await session.commit()
            await session.refresh(model)
            return self._question(model)

    async def set_question_active(
        self, guild_id: int, question_id: int, active: bool
    ) -> QuizQuestionRecord | None:
        async with self.database.session() as session:
            model = (
                await session.execute(
                    select(QuizQuestion).where(
                        QuizQuestion.id == question_id,
                        QuizQuestion.guild_id == guild_id,
                    )
                )
            ).scalar_one_or_none()
            if model is None:
                return None
            model.active = active
            await session.commit()
            await session.refresh(model)
            return self._question(model)

    async def random_question(self, guild_id: int) -> QuizQuestionRecord | None:
        async with self.database.session() as session:
            statement = (
                select(QuizQuestion)
                .where(
                    QuizQuestion.guild_id == guild_id,
                    QuizQuestion.active.is_(True),
                )
                .order_by(func.random())
                .limit(1)
            )
            model = (await session.execute(statement)).scalar_one_or_none()
            return self._question(model) if model is not None else None

    async def create_session(
        self, guild_id: int, channel_id: int, question_id: int, closes_at: datetime
    ) -> QuizSessionRecord:
        async with self.database.session() as session:
            question = (
                await session.execute(
                    select(QuizQuestion)
                    .where(
                        QuizQuestion.id == question_id,
                        QuizQuestion.guild_id == guild_id,
                    )
                    .with_for_update()
                )
            ).scalar_one_or_none()
            if question is None:
                raise ValueError("That quiz question no longer exists in this server.")
            model = QuizSession(
                guild_id=guild_id,
                channel_id=channel_id,
                question_id=question_id,
                status="open",
                starts_at=datetime.now(UTC),
                closes_at=closes_at,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return self._session(model)

    async def attach_message(self, session_id: int, message_id: int) -> QuizSessionRecord:
        async with self.database.session() as session:
            model = await session.get(QuizSession, session_id)
            if model is None:
                raise RuntimeError("Quiz session disappeared before message attachment")
            model.message_id = message_id
            await session.commit()
            await session.refresh(model)
            return self._session(model)

    async def get_session_by_message(self, message_id: int) -> QuizSessionRecord | None:
        async with self.database.session() as session:
            model = (
                await session.execute(
                    select(QuizSession).where(QuizSession.message_id == message_id)
                )
            ).scalar_one_or_none()
            return self._session(model) if model is not None else None

    async def get_question(self, question_id: int) -> QuizQuestionRecord | None:
        async with self.database.session() as session:
            model = await session.get(QuizQuestion, question_id)
            return self._question(model) if model is not None else None

    async def answer(
        self,
        session_id: int,
        guild_id: int,
        user_id: int,
        answer_index: int,
        correct: bool,
    ) -> bool:
        async with self.database.session() as session:
            existing = (
                await session.execute(
                    select(QuizAnswer.id).where(
                        QuizAnswer.session_id == session_id,
                        QuizAnswer.user_id == user_id,
                    )
                )
            ).scalar_one_or_none()
            if existing is not None:
                return False
            session.add(
                QuizAnswer(
                    session_id=session_id,
                    guild_id=guild_id,
                    user_id=user_id,
                    answer_index=answer_index,
                    is_correct=correct,
                )
            )
            await session.commit()
            return True

    async def due_sessions(self, now: datetime) -> list[QuizSessionRecord]:
        async with self.database.session() as session:
            models = (
                (
                    await session.execute(
                        select(QuizSession).where(
                            QuizSession.status == "open", QuizSession.closes_at <= now
                        )
                    )
                )
                .scalars()
                .all()
            )
            return [self._session(model) for model in models]

    async def next_open_close(self) -> datetime | None:
        async with self.database.session() as session:
            statement = (
                select(QuizSession.closes_at)
                .where(QuizSession.status == "open")
                .order_by(QuizSession.closes_at)
                .limit(1)
            )
            closes_at = (await session.execute(statement)).scalar_one_or_none()
            return self._as_utc(closes_at) if closes_at is not None else None

    async def close_session(self, session_id: int) -> tuple[int, int]:
        async with self.database.session() as session:
            model = await session.get(QuizSession, session_id)
            if model is None:
                return 0, 0
            model.status = "closed"
            model.closed_at = datetime.now(UTC)
            total = int(
                (
                    await session.execute(
                        select(func.count(QuizAnswer.id)).where(QuizAnswer.session_id == session_id)
                    )
                ).scalar_one()
            )
            correct = int(
                (
                    await session.execute(
                        select(func.count(QuizAnswer.id)).where(
                            QuizAnswer.session_id == session_id,
                            QuizAnswer.is_correct.is_(True),
                        )
                    )
                ).scalar_one()
            )
            await session.commit()
            return total, correct
