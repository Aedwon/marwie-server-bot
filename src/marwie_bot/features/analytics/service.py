from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, case, func, select
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


@dataclass(frozen=True, slots=True)
class AnalyticsBucket:
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


@dataclass(frozen=True, slots=True)
class AnalyticsRange:
    period_start: datetime
    period_end: datetime
    moderation_cases: int
    tickets_opened: int
    tickets_closed: int
    quiz_answers: int
    quiz_accuracy: float | None
    anonymous_questions: int
    reputation_events: int
    series: tuple[AnalyticsBucket, ...]

    def to_snapshot(self) -> dict[str, Any]:
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
            "series": [bucket.to_snapshot() for bucket in self.series],
        }


@dataclass(frozen=True, slots=True)
class AnalyticsDashboard:
    ranges: dict[str, AnalyticsRange]
    default_range: str = "7d"

    def to_snapshot(self) -> dict[str, Any]:
        projections = {key: value.to_snapshot() for key, value in self.ranges.items()}
        seven_days = projections[self.default_range]
        compatibility = {key: value for key, value in seven_days.items() if key != "series"}
        return {
            **compatibility,
            "default_range": self.default_range,
            "ranges": projections,
        }


def _normalize_now(value: datetime | None) -> datetime:
    current = value or datetime.now(UTC)
    if current.tzinfo is None:
        return current.replace(tzinfo=UTC)
    return current.astimezone(UTC)


def _fixed_buckets(end: datetime, *, hours: int, count: int) -> list[tuple[datetime, datetime]]:
    start = end - timedelta(hours=hours)
    step = timedelta(hours=hours / count)
    return [(start + (step * index), start + (step * (index + 1))) for index in range(count)]


def _all_time_buckets(start: datetime, end: datetime) -> list[tuple[datetime, datetime]]:
    if start >= end:
        return [(end, end)]
    span = end - start
    count = min(12, max(1, math.ceil(span.total_seconds() / 86400)))
    boundaries = [start + (span * index / count) for index in range(count)] + [end]
    return list(zip(boundaries, boundaries[1:], strict=False))


class AnalyticsService:
    def __init__(self, database: Database) -> None:
        self.database = database

    async def weekly(self, guild_id: int, now: datetime | None = None) -> WeeklyAnalytics:
        current = _normalize_now(now)
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

    async def dashboard(self, guild_id: int, now: datetime | None = None) -> AnalyticsDashboard:
        current = _normalize_now(now)

        async with self.database.session() as session:

            async def earliest(model: type, guild_column: Any, time_column: Any) -> datetime | None:
                statement = (
                    select(func.min(time_column))
                    .select_from(model)
                    .where(
                        guild_column == guild_id,
                        time_column < current,
                    )
                )
                value = (await session.execute(statement)).scalar_one_or_none()
                if value is None:
                    return None
                if value.tzinfo is None:
                    return value.replace(tzinfo=UTC)
                return value.astimezone(UTC)

            earliest_values = [
                await earliest(ModerationCase, ModerationCase.guild_id, ModerationCase.created_at),
                await earliest(Ticket, Ticket.guild_id, Ticket.created_at),
                await earliest(Ticket, Ticket.guild_id, Ticket.closed_at),
                await earliest(QuizAnswer, QuizAnswer.guild_id, QuizAnswer.answered_at),
                await earliest(
                    AnonymousQuestion, AnonymousQuestion.guild_id, AnonymousQuestion.created_at
                ),
                await earliest(
                    ReputationEvent, ReputationEvent.guild_id, ReputationEvent.created_at
                ),
            ]
            all_start = min(
                (value for value in earliest_values if value is not None), default=current
            )

            buckets_by_range: dict[str, list[tuple[datetime, datetime]]] = {
                "1d": _fixed_buckets(current, hours=24, count=6),
                "3d": _fixed_buckets(current, hours=72, count=6),
                "7d": _fixed_buckets(current, hours=168, count=7),
                "2w": _fixed_buckets(current, hours=336, count=7),
                "1m": _fixed_buckets(current, hours=720, count=10),
                "all": _all_time_buckets(all_start, current),
            }
            flat_buckets = [bucket for buckets in buckets_by_range.values() for bucket in buckets]

            async def bucket_counts(
                model: type,
                guild_column: Any,
                time_column: Any,
                *extra_conditions: ColumnElement[bool],
            ) -> list[int]:
                expressions = [
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    and_(
                                        time_column >= start,
                                        time_column < end,
                                        *extra_conditions,
                                    ),
                                    1,
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ).label(f"bucket_{index}")
                    for index, (start, end) in enumerate(flat_buckets)
                ]
                statement = select(*expressions).select_from(model).where(guild_column == guild_id)
                row = (await session.execute(statement)).one()
                return [int(value or 0) for value in row]

            metric_counts = {
                "moderation_cases": await bucket_counts(
                    ModerationCase, ModerationCase.guild_id, ModerationCase.created_at
                ),
                "tickets_opened": await bucket_counts(Ticket, Ticket.guild_id, Ticket.created_at),
                "tickets_closed": await bucket_counts(
                    Ticket, Ticket.guild_id, Ticket.closed_at, Ticket.closed_at.is_not(None)
                ),
                "quiz_answers": await bucket_counts(
                    QuizAnswer, QuizAnswer.guild_id, QuizAnswer.answered_at
                ),
                "quiz_correct": await bucket_counts(
                    QuizAnswer,
                    QuizAnswer.guild_id,
                    QuizAnswer.answered_at,
                    QuizAnswer.is_correct.is_(True),
                ),
                "anonymous_questions": await bucket_counts(
                    AnonymousQuestion, AnonymousQuestion.guild_id, AnonymousQuestion.created_at
                ),
                "reputation_events": await bucket_counts(
                    ReputationEvent, ReputationEvent.guild_id, ReputationEvent.created_at
                ),
            }

        ranges: dict[str, AnalyticsRange] = {}
        offset = 0
        for key, buckets in buckets_by_range.items():
            series: list[AnalyticsBucket] = []
            for local_index, (start, end) in enumerate(buckets):
                index = offset + local_index
                answers = metric_counts["quiz_answers"][index]
                correct = metric_counts["quiz_correct"][index]
                series.append(
                    AnalyticsBucket(
                        period_start=start,
                        period_end=end,
                        moderation_cases=metric_counts["moderation_cases"][index],
                        tickets_opened=metric_counts["tickets_opened"][index],
                        tickets_closed=metric_counts["tickets_closed"][index],
                        quiz_answers=answers,
                        quiz_accuracy=(correct / answers) if answers else None,
                        anonymous_questions=metric_counts["anonymous_questions"][index],
                        reputation_events=metric_counts["reputation_events"][index],
                    )
                )
            offset += len(buckets)

            moderation = sum(item.moderation_cases for item in series)
            opened = sum(item.tickets_opened for item in series)
            closed = sum(item.tickets_closed for item in series)
            answers = sum(item.quiz_answers for item in series)
            anonymous = sum(item.anonymous_questions for item in series)
            reputation = sum(item.reputation_events for item in series)
            correct_total = sum(metric_counts["quiz_correct"][offset - len(buckets) : offset])
            ranges[key] = AnalyticsRange(
                period_start=buckets[0][0],
                period_end=buckets[-1][1],
                moderation_cases=moderation,
                tickets_opened=opened,
                tickets_closed=closed,
                quiz_answers=answers,
                quiz_accuracy=(correct_total / answers) if answers else None,
                anonymous_questions=anonymous,
                reputation_events=reputation,
                series=tuple(series),
            )

        return AnalyticsDashboard(ranges=ranges)
