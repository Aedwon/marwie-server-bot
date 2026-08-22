from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol


@dataclass(frozen=True, slots=True)
class AnonymousQuestionRecord:
    id: int
    guild_id: int
    user_id: int
    channel_id: int
    message_id: int | None
    question: str
    created_at: datetime


class AnonymousQuestionRepository(Protocol):
    async def count_since(self, guild_id: int, user_id: int, since: datetime) -> int: ...

    async def latest_for_user(
        self, guild_id: int, user_id: int
    ) -> AnonymousQuestionRecord | None: ...

    async def create(
        self, guild_id: int, user_id: int, channel_id: int, question: str
    ) -> AnonymousQuestionRecord: ...

    async def attach_message(
        self, question_id: int, message_id: int
    ) -> AnonymousQuestionRecord: ...

    async def get(self, guild_id: int, question_id: int) -> AnonymousQuestionRecord | None: ...


class AnonymousQuestionService:
    def __init__(self, repository: AnonymousQuestionRepository) -> None:
        self.repository = repository

    async def create(
        self,
        guild_id: int,
        user_id: int,
        channel_id: int,
        question: str,
        *,
        daily_limit: int = 3,
        cooldown_minutes: int = 10,
    ) -> AnonymousQuestionRecord:
        normalized = question.strip()
        if len(normalized) < 10:
            raise ValueError("Anonymous questions must contain at least 10 characters.")
        now = datetime.now(UTC)
        latest = await self.repository.latest_for_user(guild_id, user_id)
        if latest is not None and now - latest.created_at < timedelta(minutes=cooldown_minutes):
            raise ValueError(f"Wait {cooldown_minutes} minutes between anonymous questions.")
        count = await self.repository.count_since(guild_id, user_id, now - timedelta(days=1))
        if count >= daily_limit:
            raise ValueError(f"Anonymous questions are limited to {daily_limit} per 24 hours.")
        return await self.repository.create(guild_id, user_id, channel_id, normalized[:4000])

    async def get(self, guild_id: int, question_id: int) -> AnonymousQuestionRecord | None:
        return await self.repository.get(guild_id, question_id)
