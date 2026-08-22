from datetime import UTC, datetime

import pytest

from marwie_bot.features.build_help.service import BuildHelpService, SolutionRecord


class FakeSolutions:
    def __init__(self) -> None:
        self.record: SolutionRecord | None = None

    async def get_for_thread(
        self, guild_id: int, thread_id: int
    ) -> SolutionRecord | None:
        return self.record

    async def create(
        self,
        guild_id: int,
        thread_id: int,
        answer_message_id: int,
        helper_id: int,
        solved_by: int,
        question_title: str,
        answer_excerpt: str | None,
    ) -> SolutionRecord:
        self.record = SolutionRecord(
            1,
            guild_id,
            thread_id,
            answer_message_id,
            helper_id,
            solved_by,
            question_title,
            answer_excerpt,
            datetime.now(UTC),
        )
        return self.record

    async def solved_thread_ids(self, guild_id: int) -> set[int]:
        return {self.record.thread_id} if self.record else set()


async def test_cannot_solve_thread_twice() -> None:
    repo = FakeSolutions()
    service = BuildHelpService(repo)
    await service.solve(1, 2, 3, 4, 5, "Question", "Answer")
    with pytest.raises(ValueError, match="already"):
        await service.solve(1, 2, 6, 7, 5, "Question", "Other")
