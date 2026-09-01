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
from marwie_bot.features.control_plane.page_revisions import page_revision
from marwie_bot.features.control_plane.page_save_contract import FEATURE_OWNER


async def _database() -> Database:
    database = Database("sqlite+aiosqlite:///:memory:")
    async with database.engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    return database


def test_voice_control_ownership_and_revision_ignore_coworking() -> None:
    page_key = "/control/community/voice-coworking"
    assert FEATURE_OWNER[page_key] == frozenset({"voice"})

    base = {
        "features": [
            {"name": "voice", "enabled": True},
            {"name": "coworking", "enabled": False},
        ]
    }
    coworking_changed = {
        "features": [
            {"name": "voice", "enabled": True},
            {"name": "coworking", "enabled": True},
        ]
    }
    voice_changed = {
        "features": [
            {"name": "voice", "enabled": False},
            {"name": "coworking", "enabled": False},
        ]
    }

    assert page_revision(base, page_key) == page_revision(coworking_changed, page_key)
    assert page_revision(base, page_key) != page_revision(voice_changed, page_key)


async def test_control_analytics_dashboard_uses_real_multi_range_data_and_contiguous_buckets() -> None:
    database = await _database()
    now = datetime(2026, 9, 1, 12, 0, tzinfo=UTC)

    try:
        async with database.session() as session:
            session.add_all(
                [
                    ModerationCase(
                        guild_id=1,
                        action="warn",
                        target_id=10,
                        moderator_id=20,
                        reason="recent",
                        created_at=now - timedelta(hours=2),
                    ),
                    Ticket(
                        guild_id=1,
                        channel_id=100,
                        opener_id=30,
                        type_key="general",
                        status="open",
                        created_at=now - timedelta(hours=26),
                    ),
                    QuizAnswer(
                        session_id=1000,
                        guild_id=1,
                        user_id=50,
                        answer_index=0,
                        is_correct=True,
                        answered_at=now - timedelta(days=8),
                    ),
                    AnonymousQuestion(
                        guild_id=1,
                        user_id=60,
                        channel_id=200,
                        message_id=300,
                        question="old but real",
                        created_at=now - timedelta(days=40),
                    ),
                    ReputationEvent(
                        guild_id=2,
                        user_id=70,
                        kind="award",
                        points=1,
                        actor_id=71,
                        created_at=now - timedelta(hours=1),
                    ),
                ]
            )
            await session.commit()

        dashboard = await AnalyticsService(database).dashboard(1, now)
        projection = dashboard.to_snapshot()

        assert projection["default_range"] == "7d"
        assert set(projection["ranges"]) == {"1d", "3d", "7d", "2w", "1m", "all"}

        one_day = projection["ranges"]["1d"]
        three_days = projection["ranges"]["3d"]
        seven_days = projection["ranges"]["7d"]
        two_weeks = projection["ranges"]["2w"]
        one_month = projection["ranges"]["1m"]
        all_time = projection["ranges"]["all"]

        assert one_day["moderation_cases"] == 1
        assert one_day["tickets_opened"] == 0
        assert three_days["tickets_opened"] == 1
        assert seven_days["quiz_answers"] == 0
        assert seven_days["quiz_accuracy"] is None
        assert two_weeks["quiz_answers"] == 1
        assert two_weeks["quiz_accuracy"] == 1.0
        assert one_month["anonymous_questions"] == 0
        assert all_time["anonymous_questions"] == 1
        assert all_time["reputation_events"] == 0

        expected_buckets = {"1d": 6, "3d": 6, "7d": 7, "2w": 7, "1m": 10}
        for key, count in expected_buckets.items():
            assert len(projection["ranges"][key]["series"]) == count
        assert 1 <= len(all_time["series"]) <= 12

        for range_projection in projection["ranges"].values():
            series = range_projection["series"]
            assert series[0]["period_start"] == range_projection["period_start"]
            assert series[-1]["period_end"] == range_projection["period_end"]
            for left, right in zip(series, series[1:], strict=False):
                assert left["period_end"] == right["period_start"]
            assert all("quiz_correct" not in bucket for bucket in series)

        for key in (
            "period_start",
            "period_end",
            "moderation_cases",
            "tickets_opened",
            "tickets_closed",
            "quiz_answers",
            "quiz_accuracy",
            "anonymous_questions",
            "reputation_events",
        ):
            assert projection[key] == seven_days[key]
    finally:
        await database.close()
