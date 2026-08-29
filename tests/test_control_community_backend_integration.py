from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from marwie_bot.db.base import Base
from marwie_bot.db.session import Database
from marwie_bot.features.control_plane import snapshot as snapshot_module
from marwie_bot.features.control_plane.cog import ControlPlaneCog
from marwie_bot.features.control_plane.domain import (
    ControlActionRecord,
    ControlActionStatus,
    ControlActionType,
)
from marwie_bot.features.control_plane.executor import ControlActionExecutor
from marwie_bot.features.control_plane.page_save_executor import _DB_ONLY_ACTIONS
from marwie_bot.features.quizzes.repository import SQLAlchemyQuizRepository
from marwie_bot.features.quizzes.service import QuizQuestionRecord


@pytest.mark.asyncio
async def test_quiz_repository_lists_updates_and_toggles_questions_per_guild() -> None:
    database = Database("sqlite+aiosqlite:///:memory:")
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

        repository = SQLAlchemyQuizRepository(database)
        first = await repository.add_question(
            1,
            "python",
            "What does len return?",
            ("A count", "A string", "A bool", "None"),
            0,
            None,
        )
        other = await repository.add_question(
            2,
            "discord",
            "Which permission manages server settings?",
            ("Manage Server", "Mention Everyone", "Attach Files", "Use Voice Activity"),
            0,
            None,
        )

        assert [item.id for item in await repository.list_questions(1)] == [first.id]
        assert [item.id for item in await repository.list_questions(2)] == [other.id]

        updated = await repository.update_question(
            1,
            first.id,
            "python",
            "What does len() return?",
            ("A count", "A string", "A bool", "None"),
            0,
            "It returns an integer count.",
        )
        assert updated is not None and updated.prompt == "What does len() return?"
        assert (
            await repository.update_question(
                2,
                first.id,
                "python",
                "Wrong guild",
                ("A", "B", "C", "D"),
                0,
                None,
            )
            is None
        )

        disabled = await repository.set_question_active(1, first.id, False)
        assert disabled is not None and disabled.active is False
        assert await repository.list_questions(1, active_only=True) == []
        assert [item.id for item in await repository.list_questions(1)] == [first.id]

        enabled = await repository.set_question_active(1, first.id, True)
        assert enabled is not None and enabled.active is True
    finally:
        await database.close()


class _FakeQuizService:
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
        assert guild_id == 1 and question_id == 7
        self.question = QuizQuestionRecord(
            7,
            1,
            category,
            prompt,
            options,
            correct_index,
            explanation,
            self.question.active,
        )
        return self.question

    async def set_question_active(
        self, guild_id: int, question_id: int, active: bool
    ) -> QuizQuestionRecord | None:
        assert guild_id == 1 and question_id == 7
        self.question = QuizQuestionRecord(
            self.question.id,
            self.question.guild_id,
            self.question.category,
            self.question.prompt,
            self.question.options,
            self.question.correct_index,
            self.question.explanation,
            active,
        )
        return self.question


class _FakeBot:
    def __init__(self) -> None:
        self.member = SimpleNamespace(
            guild_permissions=SimpleNamespace(administrator=True, manage_guild=True)
        )
        self.guild = SimpleNamespace(id=1, get_member=lambda _member_id: self.member)

    def get_guild(self, guild_id: int) -> object | None:
        return self.guild if guild_id == 1 else None


def _action(action_type: ControlActionType, payload: dict[str, object]) -> ControlActionRecord:
    now = datetime.now(UTC)
    return ControlActionRecord(
        id="action-1",
        guild_id=1,
        actor_id=99,
        action_type=action_type,
        payload=payload,
        idempotency_key="key-1",
        status=ControlActionStatus.CLAIMED,
        claimed_by="worker",
        result=None,
        user_error=None,
        error_reference=None,
        created_at=now,
        claimed_at=now,
        finished_at=None,
    )


@pytest.mark.asyncio
async def test_control_executor_applies_quiz_question_update_and_enable_actions() -> None:
    quizzes = _FakeQuizService()
    executor = ControlActionExecutor(
        bot=_FakeBot(),  # type: ignore[arg-type]
        settings=object(),  # type: ignore[arg-type]
        resources=object(),  # type: ignore[arg-type]
        features=object(),  # type: ignore[arg-type]
        provisioner=object(),  # type: ignore[arg-type]
        tickets=object(),  # type: ignore[arg-type]
        reputation=object(),  # type: ignore[arg-type]
        quizzes=quizzes,  # type: ignore[arg-type]
        ai_sources=object(),  # type: ignore[arg-type]
        control=object(),  # type: ignore[arg-type]
    )

    updated = await executor.execute(
        _action(
            ControlActionType.UPDATE_QUIZ_QUESTION,
            {
                "question_id": 7,
                "category": "python",
                "prompt": "What does len() return?",
                "options": ["A count", "A string", "A bool", "None"],
                "correct": 1,
                "explanation": "It returns an integer count.",
            },
        )
    )
    assert updated == {"question_id": 7}

    toggled = await executor.execute(
        _action(
            ControlActionType.SET_QUIZ_QUESTION_ENABLED,
            {"question_id": 7, "enabled": False},
        )
    )
    assert toggled == {"question_id": 7, "enabled": False}


def test_quiz_question_lifecycle_actions_remain_database_atomic() -> None:
    assert ControlActionType.UPDATE_QUIZ_QUESTION in _DB_ONLY_ACTIONS
    assert ControlActionType.SET_QUIZ_QUESTION_ENABLED in _DB_ONLY_ACTIONS


def test_reenabling_quiz_question_wakes_scheduler_through_page_save() -> None:
    action = _action(
        ControlActionType.SAVE_PAGE,
        {
            "changes": [
                {
                    "action_type": ControlActionType.SET_QUIZ_QUESTION_ENABLED.value,
                    "payload": {"question_id": 7, "enabled": True},
                }
            ]
        },
    )
    assert ControlPlaneCog._affects_quiz_scheduler(action) is True


def test_snapshot_serializer_exposes_full_quiz_question_state() -> None:
    serializer = getattr(snapshot_module, "serialize_quiz_questions", None)
    assert callable(serializer)
    question = QuizQuestionRecord(
        7,
        1,
        "python",
        "What does len() return?",
        ("A count", "A string", "A bool", "None"),
        0,
        "It returns an integer count.",
        False,
    )
    assert serializer([question]) == [
        {
            "id": 7,
            "category": "python",
            "prompt": "What does len() return?",
            "options": ["A count", "A string", "A bool", "None"],
            "correct": 1,
            "explanation": "It returns an integer count.",
            "enabled": False,
        }
    ]
