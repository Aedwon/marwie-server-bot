from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.sql.elements import ColumnElement

from marwie_bot.db.models import (
    AnonymousQuestion,
    ModerationCase,
    QuizAnswer,
    ReputationEvent,
    Ticket,
)
from marwie_bot.db.session import Database


@dataclass(frozen=True, slots=True)
class WeeklyAnalytics:
    period_start: datetime
    period_end: datetime
    moderation_cases: int
    tickets_opened: int
    tickets_closed: int
    quiz_answers: int
    quiz_accuracy: float | None
    anonymous_questions: int
    reputation_events: int

    def to_snapshot(self) -> dict[str, str | int | float | None]:
        return {
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "moderation_cases": self.moderation_cases,
            "tickets_opened": self.tickets_opened,
            "tickets_closed": self.tickets_closed,
            "quiz_answers": self.quiz_answers,
            "quiz_accuracy": self.quiz_accuracy,
            "anonymous_questions": self.anonymous_questions,
            "reputation_events": self.reputation_events,
        }


class AnalyticsService:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def weekly(self, guild_id: int, now: datetime | None = None) -> WeeklyAnalytics:
        current = now or datetime.now(UTC)
        if current.tzinfo is None:
            current = current.replace(tzinfo=UTC)
        else:
            current = current.astimezone(UTC)
        since = current - timedelta(hours=168)

        async with self.database.session() as session:

            async def count(model: type, *conditions: ColumnElement[bool]) -> int:
                statement = select(func.count()).select_from(model).where(*conditions)
                return int((await session.execute(statement)).scalar_one())

            moderation = await count(
                ModerationCase,
                ModerationCase.guild_id == guild_id,
                ModerationCase.created_at >= since,
                ModerationCase.created_at < current,
            )
            opened = await count(
                Ticket,
                Ticket.guild_id == guild_id,
                Ticket.created_at >= since,
                Ticket.created_at < current,
            )
            closed = await count(
                Ticket,
                Ticket.guild_id == guild_id,
                Ticket.closed_at.is_not(None),
                Ticket.closed_at >= since,
                Ticket.closed_at < current,
            )
            answers = await count(
                QuizAnswer,
                QuizAnswer.guild_id == guild_id,
                QuizAnswer.answered_at >= since,
                QuizAnswer.answered_at < current,
            )
            correct = await count(
                QuizAnswer,
                QuizAnswer.guild_id == guild_id,
                QuizAnswer.answered_at >= since,
                QuizAnswer.answered_at < current,
                QuizAnswer.is_correct.is_(True),
            )
            anonymous = await count(
                AnonymousQuestion,
                AnonymousQuestion.guild_id == guild_id,
                AnonymousQuestion.created_at >= since,
                AnonymousQuestion.created_at < current,
            )
            reputation = await count(
                ReputationEvent,
                ReputationEvent.guild_id == guild_id,
                ReputationEvent.created_at >= since,
                ReputationEvent.created_at < current,
            )

        return WeeklyAnalytics(
            period_start=since,
            period_end=current,
            moderation_cases=moderation,
            tickets_opened=opened,
            tickets_closed=closed,
            quiz_answers=answers,
            quiz_accuracy=(correct / answers) if answers else None,
            anonymous_questions=anonymous,
            reputation_events=reputation,
        )
