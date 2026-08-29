from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol


@dataclass(frozen=True, slots=True)
class QuizQuestionRecord:
    id: int
    guild_id: int
    category: str
    prompt: str
    options: tuple[str, str, str, str]
    correct_index: int
    explanation: str | None
    active: bool = True


@dataclass(frozen=True, slots=True)
class QuizSessionRecord:
    id: int
    guild_id: int
    channel_id: int
    message_id: int | None
    question_id: int
    status: str
    closes_at: datetime


class QuizRepository(Protocol):
    async def add_question(
        self,
        guild_id: int,
        category: str,
        prompt: str,
        options: tuple[str, str, str, str],
        correct_index: int,
        explanation: str | None,
    ) -> QuizQuestionRecord: ...

    async def list_questions(
        self, guild_id: int, *, active_only: bool = False
    ) -> list[QuizQuestionRecord]: ...

    async def update_question(
        self,
        guild_id: int,
        question_id: int,
        category: str,
        prompt: str,
        options: tuple[str, str, str, str],
        correct_index: int,
        explanation: str | None,
    ) -> QuizQuestionRecord | None: ...

    async def set_question_active(
        self, guild_id: int, question_id: int, active: bool
    ) -> QuizQuestionRecord | None: ...

    async def random_question(self, guild_id: int) -> QuizQuestionRecord | None: ...

    async def create_session(
        self, guild_id: int, channel_id: int, question_id: int, closes_at: datetime
    ) -> QuizSessionRecord: ...

    async def attach_message(self, session_id: int, message_id: int) -> QuizSessionRecord: ...

    async def get_session_by_message(self, message_id: int) -> QuizSessionRecord | None: ...

    async def get_question(self, question_id: int) -> QuizQuestionRecord | None: ...

    async def answer(
        self,
        session_id: int,
        guild_id: int,
        user_id: int,
        answer_index: int,
        correct: bool,
    ) -> bool: ...

    async def due_sessions(self, now: datetime) -> list[QuizSessionRecord]: ...

    async def next_open_close(self) -> datetime | None: ...

    async def close_session(self, session_id: int) -> tuple[int, int]: ...


class QuizService:
    def __init__(self, repository: QuizRepository) -> None:
        self.repository = repository

    @staticmethod
    def _normalize_question(
        category: str,
        prompt: str,
        options: tuple[str, str, str, str],
        correct_index: int,
        explanation: str | None,
    ) -> tuple[str, str, tuple[str, str, str, str], int, str | None]:
        if correct_index not in range(4):
            raise ValueError("Correct answer must be 1, 2, 3 or 4.")
        normalized = tuple(option.strip()[:300] for option in options)
        if not prompt.strip() or any(not option for option in normalized):
            raise ValueError("Prompt and all four options are required.")
        typed_options: tuple[str, str, str, str] = (
            normalized[0],
            normalized[1],
            normalized[2],
            normalized[3],
        )
        return (
            category.strip()[:50] or "general",
            prompt.strip()[:2000],
            typed_options,
            correct_index,
            explanation.strip()[:2000] if explanation else None,
        )

    async def add_question(
        self,
        guild_id: int,
        category: str,
        prompt: str,
        options: tuple[str, str, str, str],
        correct_index: int,
        explanation: str | None,
    ) -> QuizQuestionRecord:
        normalized = self._normalize_question(
            category,
            prompt,
            options,
            correct_index,
            explanation,
        )
        return await self.repository.add_question(guild_id, *normalized)

    async def list_questions(
        self, guild_id: int, *, active_only: bool = False
    ) -> list[QuizQuestionRecord]:
        return await self.repository.list_questions(guild_id, active_only=active_only)

    async def update_question(
        self,
        guild_id: int,
        question_id: int,
        category: str,
        prompt: str,
        options: tuple[str, str, str, str],
        correct_index: int,
        explanation: str | None,
    ) -> QuizQuestionRecord | None:
        normalized = self._normalize_question(
            category,
            prompt,
            options,
            correct_index,
            explanation,
        )
        return await self.repository.update_question(guild_id, question_id, *normalized)

    async def set_question_active(
        self, guild_id: int, question_id: int, active: bool
    ) -> QuizQuestionRecord | None:
        return await self.repository.set_question_active(guild_id, question_id, active)

    async def new_session(
        self, guild_id: int, channel_id: int, duration_minutes: int = 60
    ) -> tuple[QuizSessionRecord, QuizQuestionRecord] | None:
        question = await self.repository.random_question(guild_id)
        if question is None:
            return None
        closes_at = datetime.now(UTC) + timedelta(minutes=max(5, min(duration_minutes, 1440)))
        session = await self.repository.create_session(guild_id, channel_id, question.id, closes_at)
        published_question = await self.repository.get_question(question.id)
        if published_question is None:
            raise RuntimeError("Quiz question disappeared after session creation.")
        return session, published_question

    async def record_answer(
        self, message_id: int, guild_id: int, user_id: int, answer_index: int
    ) -> tuple[bool, bool] | None:
        session = await self.repository.get_session_by_message(message_id)
        if session is None or session.guild_id != guild_id or session.status != "open":
            return None
        if session.closes_at <= datetime.now(UTC):
            return None
        question = await self.repository.get_question(session.question_id)
        if question is None:
            return None
        correct = answer_index == question.correct_index
        stored = await self.repository.answer(session.id, guild_id, user_id, answer_index, correct)
        return stored, correct
