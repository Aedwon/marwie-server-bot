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

    async def add_question(self, guild_id, category, prompt, options, correct_index, explanation):
        return self.question

    async def random_question(self, guild_id):
        return self.question

    async def create_session(self, guild_id, channel_id, question_id, closes_at):
        return self.session

    async def attach_message(self, session_id, message_id):
        return self.session

    async def get_session_by_message(self, message_id):
        return self.session

    async def get_question(self, question_id):
        return self.question

    async def answer(self, session_id, guild_id, user_id, answer_index, correct):
        if self.answered:
            return False
        self.answered = True
        return True

    async def due_sessions(self, now):
        return []

    async def close_session(self, session_id):
        return (0, 0)


async def test_quiz_answer_reports_correctness() -> None:
    service = QuizService(FakeQuiz())
    assert await service.record_answer(99, 1, 7, 2) == (True, True)
