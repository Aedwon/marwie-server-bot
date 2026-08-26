from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import cast

import discord

from marwie_bot.config.resources import FeatureName
from marwie_bot.features.configuration.service import FeatureConfigRecord, FeatureConfigService
from marwie_bot.features.quizzes.cog import QuizzesCog


class FakeFeatures:
    def __init__(self, now: datetime) -> None:
        self.now = now
        self.get_calls = 0

    async def get(self, guild_id: int, feature: FeatureName) -> FeatureConfigRecord:
        self.get_calls += 1
        return FeatureConfigRecord(
            guild_id=guild_id,
            feature=feature,
            enabled=True,
            config={
                "interval_hours": 1,
                "last_posted_at": (self.now - timedelta(hours=2)).isoformat(),
            },
        )


class SchedulerTestCog(QuizzesCog):
    def __init__(self, features: FeatureConfigService) -> None:
        self.features = features
        self._scheduler_wake = asyncio.Event()
        self._scheduler_task = None
        self._auto_blocked_guilds: set[int] = set()
        self.start_attempts = 0

    async def _quiz_channel(self, guild: discord.Guild) -> discord.TextChannel | None:
        return cast(discord.TextChannel, object())

    async def _start_quiz(
        self, guild: discord.Guild, channel: discord.TextChannel
    ) -> discord.Message | None:
        self.start_attempts += 1
        return None


async def test_due_auto_quiz_without_question_stays_blocked_until_wake() -> None:
    now = datetime(2026, 8, 27, 4, 0, tzinfo=UTC)
    fake_features = FakeFeatures(now)
    cog = SchedulerTestCog(cast(FeatureConfigService, fake_features))
    guild = cast(discord.Guild, SimpleNamespace(id=123))

    assert await cog._process_auto_guild(guild, now) is None
    assert fake_features.get_calls == 1
    assert cog.start_attempts == 1
    assert 123 in cog._auto_blocked_guilds

    assert await cog._process_auto_guild(guild, now + timedelta(hours=1)) is None
    assert fake_features.get_calls == 1
    assert cog.start_attempts == 1

    cog.notify_scheduler(123)
    assert 123 not in cog._auto_blocked_guilds

    assert await cog._process_auto_guild(guild, now + timedelta(hours=1)) is None
    assert fake_features.get_calls == 2
    assert cog.start_attempts == 2
