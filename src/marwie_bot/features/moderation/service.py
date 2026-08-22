from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True, slots=True)
class ModerationCaseRecord:
    id: int
    guild_id: int
    action: str
    target_id: int
    moderator_id: int
    reason: str
    created_at: datetime
    expires_at: datetime | None = None


class ModerationRepository(Protocol):
    async def create_warning(
        self,
        guild_id: int,
        target_id: int,
        moderator_id: int,
        reason: str,
    ) -> ModerationCaseRecord: ...

    async def list_history(
        self,
        guild_id: int,
        target_id: int,
        limit: int,
    ) -> list[ModerationCaseRecord]: ...


class ModerationService:
    def __init__(self, repository: ModerationRepository) -> None:
        self.repository = repository

    async def warn(
        self,
        guild_id: int,
        target_id: int,
        moderator_id: int,
        reason: str,
    ) -> ModerationCaseRecord:
        normalized_reason = reason.strip()
        if not normalized_reason:
            raise ValueError("A warning reason is required.")
        return await self.repository.create_warning(
            guild_id=guild_id,
            target_id=target_id,
            moderator_id=moderator_id,
            reason=normalized_reason,
        )

    async def history(
        self,
        guild_id: int,
        target_id: int,
        limit: int = 10,
    ) -> list[ModerationCaseRecord]:
        bounded_limit = max(1, min(limit, 25))
        return await self.repository.list_history(guild_id, target_id, bounded_limit)
