from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol


@dataclass(frozen=True, slots=True)
class ReputationProfile:
    guild_id: int
    user_id: int
    points: int
    rank: int
    event_counts: dict[str, int]


class ReputationRepository(Protocol):
    async def add_event(
        self,
        guild_id: int,
        user_id: int,
        kind: str,
        points: int,
        actor_id: int | None,
        source_ref: str | None,
    ) -> int: ...

    async def total(self, guild_id: int, user_id: int) -> int: ...

    async def leaderboard(self, guild_id: int, limit: int) -> list[tuple[int, int]]: ...

    async def rank(self, guild_id: int, user_id: int) -> int: ...

    async def event_counts(self, guild_id: int, user_id: int) -> dict[str, int]: ...

    async def has_recent_event(
        self, guild_id: int, user_id: int, kind: str, since: datetime
    ) -> bool: ...


class ReputationService:
    def __init__(self, repository: ReputationRepository) -> None:
        self.repository = repository

    async def award(
        self,
        guild_id: int,
        user_id: int,
        kind: str,
        points: int,
        *,
        actor_id: int | None = None,
        source_ref: str | None = None,
    ) -> int:
        if points == 0 or points < -1000 or points > 1000:
            raise ValueError(
                "Reputation points must be between -1000 and 1000 and cannot be zero."
            )
        normalized_kind = kind.strip().lower().replace(" ", "_")[:50]
        if not normalized_kind:
            raise ValueError("A reputation event kind is required.")
        return await self.repository.add_event(
            guild_id, user_id, normalized_kind, points, actor_id, source_ref
        )

    async def award_message(
        self, guild_id: int, user_id: int, source_ref: str
    ) -> int | None:
        since = datetime.now(UTC) - timedelta(minutes=10)
        if await self.repository.has_recent_event(
            guild_id, user_id, "community_message", since
        ):
            return None
        return await self.award(
            guild_id,
            user_id,
            "community_message",
            1,
            source_ref=source_ref,
        )

    async def profile(self, guild_id: int, user_id: int) -> ReputationProfile:
        return ReputationProfile(
            guild_id=guild_id,
            user_id=user_id,
            points=await self.repository.total(guild_id, user_id),
            rank=await self.repository.rank(guild_id, user_id),
            event_counts=await self.repository.event_counts(guild_id, user_id),
        )

    async def leaderboard(
        self, guild_id: int, limit: int = 10
    ) -> list[tuple[int, int]]:
        return await self.repository.leaderboard(guild_id, max(1, min(limit, 25)))
