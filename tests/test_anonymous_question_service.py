from datetime import UTC, datetime

import pytest

from marwie_bot.features.anonymous_questions.service import (
    AnonymousQuestionRecord,
    AnonymousQuestionService,
)


class FakeAnonymousQuestions:
    def __init__(self) -> None:
        self.latest: AnonymousQuestionRecord | None = None
        self.count = 0

    async def count_since(self, guild_id: int, user_id: int, since: datetime) -> int:
        return self.count

    async def latest_for_user(
        self, guild_id: int, user_id: int
    ) -> AnonymousQuestionRecord | None:
        return self.latest

    async def create(
        self, guild_id: int, user_id: int, channel_id: int, question: str
    ) -> AnonymousQuestionRecord:
        self.latest = AnonymousQuestionRecord(
            1, guild_id, user_id, channel_id, None, question, datetime.now(UTC)
        )
        return self.latest

    async def attach_message(
        self, question_id: int, message_id: int
    ) -> AnonymousQuestionRecord:
        assert self.latest is not None
        return self.latest

    async def get(
        self, guild_id: int, question_id: int
    ) -> AnonymousQuestionRecord | None:
        return self.latest


async def test_rejects_short_question() -> None:
    service = AnonymousQuestionService(FakeAnonymousQuestions())
    with pytest.raises(ValueError, match="10 characters"):
        await service.create(1, 2, 3, "short")


async def test_enforces_daily_limit() -> None:
    repo = FakeAnonymousQuestions()
    repo.count = 3
    service = AnonymousQuestionService(repo)
    with pytest.raises(ValueError, match="3 per 24 hours"):
        await service.create(1, 2, 3, "This is a long enough technical question")
