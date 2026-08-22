from datetime import UTC, datetime

import pytest

from marwie_bot.features.moderation.service import ModerationCaseRecord, ModerationService


class FakeModerationRepository:
    def __init__(self) -> None:
        self.cases: list[ModerationCaseRecord] = []
        self.last_limit: int | None = None

    async def create_warning(
        self,
        guild_id: int,
        target_id: int,
        moderator_id: int,
        reason: str,
    ) -> ModerationCaseRecord:
        case = ModerationCaseRecord(
            id=len(self.cases) + 1,
            guild_id=guild_id,
            action="warn",
            target_id=target_id,
            moderator_id=moderator_id,
            reason=reason,
            created_at=datetime.now(UTC),
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
            case
            for case in self.cases
            if case.guild_id == guild_id and case.target_id == target_id
        ]
        return list(reversed(matches))[:limit]


async def test_warn_strips_reason_and_persists_case() -> None:
    repository = FakeModerationRepository()
    service = ModerationService(repository)

    case = await service.warn(1, 2, 3, "  repeated spam  ")

    assert case.reason == "repeated spam"
    assert repository.cases == [case]


async def test_warn_rejects_blank_reason() -> None:
    service = ModerationService(FakeModerationRepository())
    with pytest.raises(ValueError, match="reason"):
        await service.warn(1, 2, 3, "   ")


async def test_history_bounds_limit_to_25() -> None:
    repository = FakeModerationRepository()
    service = ModerationService(repository)

    await service.history(1, 2, limit=500)

    assert repository.last_limit == 25
