from __future__ import annotations

from sqlalchemy import select

from marwie_bot.db.models import ForumSolution
from marwie_bot.db.session import Database
from marwie_bot.features.build_help.service import SolutionRecord


class SQLAlchemySolutionRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _record(model: ForumSolution) -> SolutionRecord:
        return SolutionRecord(
            model.id,
            model.guild_id,
            model.thread_id,
            model.answer_message_id,
            model.helper_id,
            model.solved_by,
            model.question_title,
            model.answer_excerpt,
            model.created_at,
        )

    async def get_for_thread(
        self, guild_id: int, thread_id: int
    ) -> SolutionRecord | None:
        async with self.database.session() as session:
            statement = select(ForumSolution).where(
                ForumSolution.guild_id == guild_id,
                ForumSolution.thread_id == thread_id,
            )
            model = (await session.execute(statement)).scalar_one_or_none()
            return self._record(model) if model is not None else None

    async def create(
        self,
        guild_id: int,
        thread_id: int,
        answer_message_id: int,
        helper_id: int,
        solved_by: int,
        question_title: str,
        answer_excerpt: str | None,
    ) -> SolutionRecord:
        async with self.database.session() as session:
            model = ForumSolution(
                guild_id=guild_id,
                thread_id=thread_id,
                answer_message_id=answer_message_id,
                helper_id=helper_id,
                solved_by=solved_by,
                question_title=question_title,
                answer_excerpt=answer_excerpt,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return self._record(model)

    async def solved_thread_ids(self, guild_id: int) -> set[int]:
        async with self.database.session() as session:
            rows = (
                await session.execute(
                    select(ForumSolution.thread_id).where(
                        ForumSolution.guild_id == guild_id
                    )
                )
            ).scalars().all()
            return {int(value) for value in rows}
