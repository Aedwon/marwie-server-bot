from __future__ import annotations

from dataclasses import replace

import pytest

from marwie_bot.features.control_plane.domain import ControlActionType
from marwie_bot.features.control_plane.page_revisions import page_revision
from marwie_bot.features.control_plane.page_save_contract import PAGE_SAVE_ACTIONS_BY_PAGE
from marwie_bot.features.control_plane.validation import validate_action_payload
from marwie_bot.features.quizzes.service import QuizQuestionRecord, QuizService


QUIZ_PAGE = "/control/community/quizzes"


def test_quiz_page_save_owns_question_update_and_enable_lifecycle() -> None:
    allowed = PAGE_SAVE_ACTIONS_BY_PAGE[QUIZ_PAGE]
    assert "update_quiz_question" in allowed
    assert "set_quiz_question_enabled" in allowed


def test_quiz_question_lifecycle_payloads_are_validated() -> None:
    update_type = ControlActionType("update_quiz_question")
    enabled_type = ControlActionType("set_quiz_question_enabled")

    assert validate_action_payload(
        update_type,
        {
            "question_id": 7,
            "category": "python",
            "prompt": "What does len() return?",
            "options": ["A count", "A string", "A bool", "None"],
            "correct": 1,
            "explanation": "It returns an integer count.",
        },
    ) == {
        "question_id": 7,
        "category": "python",
        "prompt": "What does len() return?",
        "options": ["A count", "A string", "A bool", "None"],
        "correct": 1,
        "explanation": "It returns an integer count.",
    }
    assert validate_action_payload(
        enabled_type,
        {"question_id": 7, "enabled": False},
    ) == {"question_id": 7, "enabled": False}


class FakeQuestionRepository:
    def __init__(self) -> None:
        self.question = QuizQuestionRecord(
            7,
            1,
            "python",
            "What does len return?",
            ("A count", "A string", "A bool", "None"),
            0,
            None,
            True,
        )

    async def list_questions(self, guild_id: int, *, active_only: bool = False) -> list[QuizQuestionRecord]:
        assert guild_id == 1
        if active_only and not self.question.active:
            return []
        return [self.question]

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
        if guild_id != self.question.guild_id or question_id != self.question.id:
            return None
        self.question = replace(
            self.question,
            category=category,
            prompt=prompt,
            options=options,
            correct_index=correct_index,
            explanation=explanation,
        )
        return self.question

    async def set_question_active(
        self,
        guild_id: int,
        question_id: int,
        active: bool,
    ) -> QuizQuestionRecord | None:
        if guild_id != self.question.guild_id or question_id != self.question.id:
            return None
        self.question = replace(self.question, active=active)
        return self.question


@pytest.mark.asyncio
async def test_quiz_service_supports_list_edit_disable_and_reenable() -> None:
    repository = FakeQuestionRepository()
    service = QuizService(repository)  # type: ignore[arg-type]

    questions = await service.list_questions(1, active_only=False)
    assert [question.id for question in questions] == [7]

    updated = await service.update_question(
        1,
        7,
        "python",
        "What does len() return?",
        ("A count", "A string", "A bool", "None"),
        0,
        "It returns an integer count.",
    )
    assert updated is not None
    assert updated.prompt == "What does len() return?"

    disabled = await service.set_question_active(1, 7, False)
    assert disabled is not None and disabled.active is False
    assert await service.list_questions(1, active_only=True) == []

    enabled = await service.set_question_active(1, 7, True)
    assert enabled is not None and enabled.active is True


def quiz_snapshot() -> dict[str, object]:
    return {
        "features": [{"name": "quizzes", "enabled": True, "config": {}}],
        "quiz": {
            "interval_hours": 24,
            "questions": [
                {
                    "id": 7,
                    "category": "python",
                    "prompt": "What does len return?",
                    "options": ["A count", "A string", "A bool", "None"],
                    "correct": 1,
                    "explanation": None,
                    "enabled": True,
                }
            ],
        },
    }


def test_quiz_page_revision_tracks_question_content_and_enabled_state() -> None:
    before = quiz_snapshot()
    prompt_changed = quiz_snapshot()
    prompt_changed["quiz"]["questions"][0]["prompt"] = "What does len() return?"  # type: ignore[index]
    disabled = quiz_snapshot()
    disabled["quiz"]["questions"][0]["enabled"] = False  # type: ignore[index]

    original_revision = page_revision(before, QUIZ_PAGE)
    assert page_revision(prompt_changed, QUIZ_PAGE) != original_revision
    assert page_revision(disabled, QUIZ_PAGE) != original_revision
