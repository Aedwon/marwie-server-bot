from datetime import datetime

import pytest

from marwie_bot.features.coworking.service import CoworkingService, PomodoroRecord


class FakePomodoros:
    def __init__(self) -> None:
        self.current: PomodoroRecord | None = None

    async def active(self, guild_id: int, user_id: int) -> PomodoroRecord | None:
        return self.current

    async def create(
        self, guild_id: int, user_id: int, channel_id: int, ends_at: datetime
    ) -> PomodoroRecord:
        self.current = PomodoroRecord(1, guild_id, user_id, channel_id, ends_at, "active")
        return self.current

    async def stop(self, session_id: int, status: str) -> PomodoroRecord | None:
        if self.current is None:
            return None
        self.current = PomodoroRecord(
            self.current.id,
            self.current.guild_id,
            self.current.user_id,
            self.current.channel_id,
            self.current.ends_at,
            status,
        )
        return self.current

    async def due(self, now: datetime) -> list[PomodoroRecord]:
        return []


async def test_prevents_second_active_timer() -> None:
    repo = FakePomodoros()
    service = CoworkingService(repo)
    await service.start(1, 2, 3, 25)
    with pytest.raises(ValueError, match="already"):
        await service.start(1, 2, 3, 25)
