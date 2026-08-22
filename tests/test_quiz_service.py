from datetime import UTC, datetime

from marwie_bot.features.quizzes.service import (
    QuizQuestionRecord,
    QuizService,
    QuizSessionRecord,
)


class FakeQuiz:
    def __init__(self) -> None:
        self.question = QuizQuestionRecord(1, 1, "python", "Q?", ("A", "B", "C", "D"), 2, None)
        self.session = QuizSessionRecord(
            1,
            1,
            10,
            99,
            1,
            "open",
            datetime.now(UTC).replace(year=2099),
        )
        self.answered = False

    async def add_question(
        self,
        guild_id: int,
        category: str,
        prompt: str,
        options: tuple[str, str, str, str],
        correct_index: int,
        explanation: str | None,
    ) -> QuizQuestionRecord:
        return self.question

    async def random_question(self, guild_id: int) -> QuizQuestionRecord | None:
        return self.question

    async def create_session(
        self, guild_id: int, channel_id: int, question_id: int, closes_at: datetime
    ) -> QuizSessionRecord:
        return self.session

    async def attach_message(self, session_id: int, message_id: int) -> QuizSessionRecord:
        return self.session

    async def get_session_by_message(self, message_id: int) -> QuizSessionRecord | None:
        return self.session

    async def get_question(self, question_id: int) -> QuizQuestionRecord | None:
        return self.question

    async def answer(
        self,
        session_id: int,
        guild_id: int,
        user_id: int,
        answer_index: int,
        correct: bool,
    ) -> bool:
        if self.answered:
            return False
        self.answered = True
        return True

    async def due_sessions(self, now: datetime) -> list[QuizSessionRecord]:
        return []

    async def close_session(self, session_id: int) -> tuple[int, int]:
        return (0, 0)


async def test_quiz_answer_reports_correctness() -> None:
    service = QuizService(FakeQuiz())
    assert await service.record_answer(99, 1, 7, 2) == (True, True)
