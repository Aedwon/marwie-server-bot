from datetime import UTC, datetime
from typing import Any

import pytest

from marwie_bot.features.moderation.service import ModerationCaseRecord, ModerationService


class FakeModerationRepository:
    def __init__(self) -> None:
        self.cases: list[ModerationCaseRecord] = []
        self.last_limit: int | None = None

    async def create_case(
        self,
        guild_id: int,
        action: str,
        target_id: int,
        moderator_id: int,
        reason: str,
        expires_at: datetime | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ModerationCaseRecord:
        case = ModerationCaseRecord(
            id=len(self.cases) + 1,
            guild_id=guild_id,
            action=action,
            target_id=target_id,
            moderator_id=moderator_id,
            reason=reason,
            created_at=datetime.now(UTC),
            expires_at=expires_at,
            metadata=metadata,
        )
        self.cases.append(case)
        return case

    async def list_history(
        self,
        guild_id: int,
        target_id: int,
        limit: int,
    ) -> list[ModerationCaseRecord]:
        self.last_limit = limit
        matches = [
            case for case in self.cases if case.guild_id == guild_id and case.target_id == target_id
        ]
        return list(reversed(matches))[:limit]


async def test_warn_strips_reason_and_persists_case() -> None:
    repository = FakeModerationRepository()
    service = ModerationService(repository)
    case = await service.warn(1, 2, 3, "  repeated spam  ")
    assert case.action == "warn"
    assert case.reason == "repeated spam"
    assert repository.cases == [case]


async def test_create_case_rejects_blank_reason() -> None:
    service = ModerationService(FakeModerationRepository())
    with pytest.raises(ValueError, match="reason"):
        await service.create_case(1, "kick", 2, 3, "   ")


async def test_history_bounds_limit_to_25() -> None:
    repository = FakeModerationRepository()
    service = ModerationService(repository)
    await service.history(1, 2, limit=500)
    assert repository.last_limit == 25
