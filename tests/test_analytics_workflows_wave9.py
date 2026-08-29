from __future__ import annotations

from datetime import UTC, datetime, timedelta

from marwie_bot.db.base import Base
from marwie_bot.db.models import (
    AnonymousQuestion,
    ModerationCase,
    QuizAnswer,
    ReputationEvent,
    Ticket,
)
from marwie_bot.db.session import Database
from marwie_bot.features.analytics.service import AnalyticsService
from marwie_bot.features.control_plane.page_save_contract import PAGE_SAVE_ACTIONS_BY_PAGE


async def _database() -> Database:
    database = Database("sqlite+aiosqlite:///:memory:")
    async with database.engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    return database


async def test_weekly_analytics_uses_exact_utc_168_hour_window_and_only_v1_metrics() -> None:
    database = await _database()
    now = datetime(2026, 8, 28, 12, 0, tzinfo=UTC)
    start = now - timedelta(days=7)
    just_before_start = start - timedelta(microseconds=1)
    just_before_end = now - timedelta(microseconds=1)

    try:
        async with database.session() as session:
            session.add_all(
                [
                    ModerationCase(
                        guild_id=1,
                        action="warn",
                        target_id=10,
                        moderator_id=20,
                        reason="before",
                        created_at=just_before_start,
                    ),
                    ModerationCase(
                        guild_id=1,
                        action="warn",
                        target_id=11,
                        moderator_id=20,
                        reason="at start",
                        created_at=start,
                    ),
                    ModerationCase(
                        guild_id=1,
                        action="warn",
                        target_id=12,
                        moderator_id=20,
                        reason="inside",
                        created_at=just_before_end,
                    ),
                    ModerationCase(
                        guild_id=1,
                        action="warn",
                        target_id=13,
                        moderator_id=20,
                        reason="at end",
                        created_at=now,
                    ),
                    ModerationCase(
                        guild_id=2,
                        action="warn",
                        target_id=14,
                        moderator_id=20,
                        reason="other guild",
                        created_at=start,
                    ),
                    Ticket(
                        guild_id=1,
                        channel_id=100,
                        opener_id=30,
                        type_key="general",
                        status="open",
                        created_at=start,
                    ),
                    Ticket(
                        guild_id=1,
                        channel_id=101,
                        opener_id=31,
                        type_key="general",
                        status="open",
                        created_at=now,
                    ),
                    Ticket(
                        guild_id=1,
                        channel_id=102,
                        opener_id=32,
                        type_key="general",
                        status="closed",
                        created_at=just_before_start,
                        closed_by=40,
                        close_reason="done",
                        closed_at=just_before_end,
                    ),
                    Ticket(
                        guild_id=1,
                        channel_id=103,
                        opener_id=33,
                        type_key="general",
                        status="closed",
                        created_at=just_before_start,
                        closed_by=40,
                        close_reason="done",
                        closed_at=now,
                    ),
                    QuizAnswer(
                        session_id=1000,
                        guild_id=1,
                        user_id=50,
                        answer_index=0,
                        is_correct=True,
                        answered_at=start,
                    ),
                    QuizAnswer(
                        session_id=1001,
                        guild_id=1,
                        user_id=51,
                        answer_index=1,
                        is_correct=False,
                        answered_at=just_before_end,
                    ),
                    QuizAnswer(
                        session_id=1002,
                        guild_id=1,
                        user_id=52,
                        answer_index=2,
                        is_correct=True,
                        answered_at=now,
                    ),
                    AnonymousQuestion(
                        guild_id=1,
                        user_id=60,
                        channel_id=200,
                        message_id=300,
                        question="inside",
                        created_at=start,
                    ),
                    AnonymousQuestion(
                        guild_id=1,
                        user_id=61,
                        channel_id=201,
                        message_id=301,
                        question="excluded end",
                        created_at=now,
                    ),
                    ReputationEvent(
                        guild_id=1,
                        user_id=70,
                        kind="award",
                        points=1,
                        actor_id=71,
                        created_at=just_before_end,
                    ),
                    ReputationEvent(
                        guild_id=1,
                        user_id=72,
                        kind="award",
                        points=1,
                        actor_id=73,
                        created_at=just_before_start,
                    ),
                ]
            )
            await session.commit()

        report = await AnalyticsService(database).weekly(1, now)

        assert report.period_start == start
        assert report.period_end == now
        assert report.moderation_cases == 2
        assert report.tickets_opened == 1
        assert report.tickets_closed == 1
        assert report.quiz_answers == 2
        assert report.quiz_accuracy == 0.5
        assert report.anonymous_questions == 1
        assert report.reputation_events == 1
        assert not hasattr(report, "quiz_correct")

        projection = report.to_snapshot()
        assert projection == {
            "period_start": start.isoformat(),
            "period_end": now.isoformat(),
            "moderation_cases": 2,
            "tickets_opened": 1,
            "tickets_closed": 1,
            "quiz_answers": 2,
            "quiz_accuracy": 0.5,
            "anonymous_questions": 1,
            "reputation_events": 1,
        }
        for forbidden_key in (
            "user_id",
            "author_id",
            "message_id",
            "question",
            "source_rows",
            "active_member",
        ):
            assert forbidden_key not in projection
    finally:
        await database.close()


async def test_weekly_analytics_zero_answers_has_no_misleading_percentage() -> None:
    database = await _database()
    now = datetime(2026, 8, 28, 12, 0, tzinfo=UTC)
    try:
        report = await AnalyticsService(database).weekly(1, now)
        assert report.quiz_answers == 0
        assert report.quiz_accuracy is None
        assert report.to_snapshot()["quiz_accuracy"] is None
    finally:
        await database.close()


def test_page_save_contract_keeps_analytics_single_owner_and_workflows_read_only() -> None:
    assert PAGE_SAVE_ACTIONS_BY_PAGE["/control/analytics"] == frozenset({"set_feature"})
    assert PAGE_SAVE_ACTIONS_BY_PAGE["/control/workflows/moderation"] == frozenset()
    assert PAGE_SAVE_ACTIONS_BY_PAGE["/control/workflows/ticket-handling"] == frozenset()
    assert PAGE_SAVE_ACTIONS_BY_PAGE["/control/workflows/events"] == frozenset()
