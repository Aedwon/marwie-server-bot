from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol


@dataclass(frozen=True, slots=True)
class PomodoroRecord:
    id: int
    guild_id: int
    user_id: int
    channel_id: int
    ends_at: datetime
    status: str


class PomodoroRepository(Protocol):
    async def active(self, guild_id: int, user_id: int) -> PomodoroRecord | None: ...

    async def create(
        self, guild_id: int, user_id: int, channel_id: int, ends_at: datetime
    ) -> PomodoroRecord: ...

    async def stop(self, session_id: int, status: str) -> PomodoroRecord | None: ...

    async def due(self, now: datetime) -> list[PomodoroRecord]: ...

    async def next_active_end(self) -> datetime | None: ...


class CoworkingService:
    def __init__(self, repository: PomodoroRepository) -> None:
        self.repository = repository

    async def start(
        self, guild_id: int, user_id: int, channel_id: int, minutes: int
    ) -> PomodoroRecord:
        existing = await self.repository.active(guild_id, user_id)
        if existing is not None:
            raise ValueError("You already have an active Pomodoro session.")
        duration = max(5, min(minutes, 180))
        return await self.repository.create(
            guild_id,
            user_id,
            channel_id,
            datetime.now(UTC) + timedelta(minutes=duration),
        )

    async def active(self, guild_id: int, user_id: int) -> PomodoroRecord | None:
        return await self.repository.active(guild_id, user_id)

    async def stop(self, guild_id: int, user_id: int) -> PomodoroRecord | None:
        active = await self.repository.active(guild_id, user_id)
        if active is None:
            return None
        return await self.repository.stop(active.id, "cancelled")
