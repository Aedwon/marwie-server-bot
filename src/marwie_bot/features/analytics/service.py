from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from marwie_bot.db.models import (
    AnonymousQuestion,
    ForumSolution,
    ModerationCase,
    QuizAnswer,
    ReputationEvent,
    Ticket,
)
from marwie_bot.db.session import Database


@dataclass(frozen=True, slots=True)
class WeeklyAnalytics:
    moderation_cases: int
    tickets_opened: int
    tickets_closed: int
    solutions: int
    quiz_answers: int
    quiz_correct: int
    anonymous_questions: int
    reputation_events: int


class AnalyticsService:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def weekly(self, guild_id: int, now: datetime | None = None) -> WeeklyAnalytics:
        current = now or datetime.now(UTC)
        since = current - timedelta(days=7)
        async with self.database.session() as session:
            async def count(model: type, *conditions: object) -> int:
                statement = select(func.count()).select_from(model).where(*conditions)
                return int((await session.execute(statement)).scalar_one())

            moderation = await count(
                ModerationCase,
                ModerationCase.guild_id == guild_id,
                ModerationCase.created_at >= since,
            )
            opened = await count(
                Ticket, Ticket.guild_id == guild_id, Ticket.created_at >= since
            )
            closed = await count(
                Ticket,
                Ticket.guild_id == guild_id,
                Ticket.closed_at.is_not(None),
                Ticket.closed_at >= since,
            )
            solutions = await count(
                ForumSolution,
                ForumSolution.guild_id == guild_id,
                ForumSolution.created_at >= since,
            )
            answers = await count(
                QuizAnswer,
                QuizAnswer.guild_id == guild_id,
                QuizAnswer.answered_at >= since,
            )
            correct = await count(
                QuizAnswer,
                QuizAnswer.guild_id == guild_id,
                QuizAnswer.answered_at >= since,
                QuizAnswer.is_correct.is_(True),
            )
            anonymous = await count(
                AnonymousQuestion,
                AnonymousQuestion.guild_id == guild_id,
                AnonymousQuestion.created_at >= since,
            )
            reputation = await count(
                ReputationEvent,
                ReputationEvent.guild_id == guild_id,
                ReputationEvent.created_at >= since,
            )
        return WeeklyAnalytics(
            moderation,
            opened,
            closed,
            solutions,
            answers,
            correct,
            anonymous,
            reputation,
        )
