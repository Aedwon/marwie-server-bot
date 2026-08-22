from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True, slots=True)
class SolutionRecord:
    id: int
    guild_id: int
    thread_id: int
    answer_message_id: int
    helper_id: int
    solved_by: int
    question_title: str
    answer_excerpt: str | None
    created_at: datetime


class SolutionRepository(Protocol):
    async def get_for_thread(self, guild_id: int, thread_id: int) -> SolutionRecord | None: ...

    async def create(
        self,
        guild_id: int,
        thread_id: int,
        answer_message_id: int,
        helper_id: int,
        solved_by: int,
        question_title: str,
        answer_excerpt: str | None,
    ) -> SolutionRecord: ...

    async def solved_thread_ids(self, guild_id: int) -> set[int]: ...


class BuildHelpService:
    def __init__(self, repository: SolutionRepository) -> None:
        self.repository = repository

    async def solve(
        self,
        guild_id: int,
        thread_id: int,
        answer_message_id: int,
        helper_id: int,
        solved_by: int,
        question_title: str,
        answer_excerpt: str | None,
    ) -> SolutionRecord:
        existing = await self.repository.get_for_thread(guild_id, thread_id)
        if existing is not None:
            raise ValueError("This thread is already marked solved.")
        title = question_title.strip()[:200] or "Build-help thread"
        excerpt = answer_excerpt.strip()[:2000] if answer_excerpt else None
        return await self.repository.create(
            guild_id,
            thread_id,
            answer_message_id,
            helper_id,
            solved_by,
            title,
            excerpt,
        )

    async def solved_thread_ids(self, guild_id: int) -> set[int]:
        return await self.repository.solved_thread_ids(guild_id)
