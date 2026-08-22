from datetime import datetime

import pytest

from marwie_bot.features.reputation.service import ReputationService


class FakeReputation:
    def __init__(self) -> None:
        self.points = 0
        self.recent = False

    async def add_event(
        self,
        guild_id: int,
        user_id: int,
        kind: str,
        points: int,
        actor_id: int | None,
        source_ref: str | None,
    ) -> int:
        self.points += points
        return self.points

    async def total(self, guild_id: int, user_id: int) -> int:
        return self.points

    async def leaderboard(self, guild_id: int, limit: int) -> list[tuple[int, int]]:
        return [(2, self.points)] if self.points else []

    async def rank(self, guild_id: int, user_id: int) -> int:
        return 1

    async def event_counts(self, guild_id: int, user_id: int) -> dict[str, int]:
        return {}

    async def has_recent_event(
        self, guild_id: int, user_id: int, kind: str, since: datetime
    ) -> bool:
        return self.recent


async def test_award_rejects_zero() -> None:
    service = ReputationService(FakeReputation())
    with pytest.raises(ValueError, match="cannot be zero"):
        await service.award(1, 2, "staff", 0)


async def test_message_award_is_rate_limited() -> None:
    repo = FakeReputation()
    service = ReputationService(repo)
    assert await service.award_message(1, 2, "message:1") == 1
    repo.recent = True
    assert await service.award_message(1, 2, "message:2") is None
