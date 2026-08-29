from __future__ import annotations

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any

import pytest

from marwie_bot.config.resources import FeatureName
from marwie_bot.db.base import Base
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.repository import SQLAlchemyFeatureConfigRepository
from marwie_bot.features.configuration.service import FeatureConfigService, FeatureConfigRecord
from marwie_bot.features.control_plane.domain import (
    ControlActionRecord,
    ControlActionStatus,
    ControlActionType,
)
from marwie_bot.features.control_plane.executor import ControlActionExecutor
from marwie_bot.features.control_plane.page_revisions import page_revision
from marwie_bot.features.control_plane.page_save_executor import PageSaveExecutor
from marwie_bot.features.control_plane.repository import SQLAlchemyControlRepository
from marwie_bot.features.control_plane.snapshot import serialize_quiz_questions
from marwie_bot.features.quizzes.cog import QuizzesCog
from marwie_bot.features.quizzes.repository import SQLAlchemyQuizRepository
from marwie_bot.features.quizzes.service import QuizQuestionRecord, QuizService

GUILD_ID = 123
ACTOR_ID = 456
PAGE_KEY = "/control/community/quizzes"


async def _database() -> Database:
    database = Database("sqlite+aiosqlite:///:memory:")
    async with database.engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    return database


async def _add_question(
    repository: SQLAlchemyQuizRepository,
    guild_id: int,
    *,
    prompt: str = "What does len return?",
    correct_index: int = 0,
) -> QuizQuestionRecord:
    return await repository.add_question(
        guild_id,
        "python",
        prompt,
        ("A count", "A string", "A bool", "None"),
        correct_index,
        "It returns an integer count.",
    )


async def _open_session(
    repository: SQLAlchemyQuizRepository,
    question: QuizQuestionRecord,
    *,
    message_id: int | None = None,
) -> None:
    session = await repository.create_session(
        question.guild_id,
        999,
        question.id,
        datetime.now(UTC) + timedelta(hours=1),
    )
    if message_id is not None:
        await repository.attach_message(session.id, message_id)


def test_quiz_scheduler_has_no_due_time_when_interval_is_unconfigured() -> None:
    config = FeatureConfigRecord(
        guild_id=GUILD_ID,
        feature=FeatureName.QUIZZES,
        enabled=True,
        config={},
    )
    assert QuizzesCog._auto_due_at(config, datetime.now(UTC)) is None


@pytest.mark.asyncio
async def test_open_quiz_question_content_is_immutable_and_grading_keeps_published_answer() -> None:
    database = await _database()
    repository = SQLAlchemyQuizRepository(database)
    service = QuizService(repository)
    try:
        question = await _add_question(repository, GUILD_ID)
        await _open_session(repository, question, message_id=777)

        with pytest.raises(ValueError, match="open quiz"):
            await service.update_question(
                GUILD_ID,
                question.id,
                "python",
                "What does len() produce?",
                ("A string", "A count", "A bool", "None"),
                1,
                "The displayed answer must stay stable while the quiz is open.",
            )

        unchanged = await repository.get_question(question.id)
        assert unchanged is not None
        assert unchanged.prompt == "What does len return?"
        assert unchanged.options == ("A count", "A string", "A bool", "None")
        assert unchanged.correct_index == 0
        assert await service.record_answer(777, GUILD_ID, 42, 0) == (True, True)
    finally:
        await database.close()


@pytest.mark.asyncio
async def test_closed_quiz_question_can_be_edited() -> None:
    database = await _database()
    repository = SQLAlchemyQuizRepository(database)
    service = QuizService(repository)
    try:
        question = await _add_question(repository, GUILD_ID)
        session = await repository.create_session(
            GUILD_ID,
            999,
            question.id,
            datetime.now(UTC) + timedelta(hours=1),
        )
        await repository.close_session(session.id)

        updated = await service.update_question(
            GUILD_ID,
            question.id,
            "python",
            "What does len() return?",
            ("A count", "A string", "A bool", "None"),
            0,
            "It returns an integer count.",
        )
        assert updated is not None
        assert updated.prompt == "What does len() return?"
    finally:
        await database.close()


@pytest.mark.asyncio
async def test_other_guild_open_session_does_not_block_question_edit() -> None:
    database = await _database()
    repository = SQLAlchemyQuizRepository(database)
    service = QuizService(repository)
    try:
        current = await _add_question(repository, GUILD_ID)
        other = await _add_question(repository, GUILD_ID + 1, prompt="Other guild question")
        await _open_session(repository, other)

        updated = await service.update_question(
            GUILD_ID,
            current.id,
            "python",
            "Current guild can still edit",
            ("A count", "A string", "A bool", "None"),
            0,
            None,
        )
        assert updated is not None
        assert updated.prompt == "Current guild can still edit"
    finally:
        await database.close()


@pytest.mark.asyncio
async def test_disable_and_reenable_remain_allowed_while_quiz_is_open() -> None:
    database = await _database()
    repository = SQLAlchemyQuizRepository(database)
    service = QuizService(repository)
    try:
        question = await _add_question(repository, GUILD_ID)
        await _open_session(repository, question, message_id=778)

        disabled = await service.set_question_active(GUILD_ID, question.id, False)
        assert disabled is not None and disabled.active is False
        assert await repository.random_question(GUILD_ID) is None
        assert await service.record_answer(778, GUILD_ID, 43, 0) == (True, True)

        enabled = await service.set_question_active(GUILD_ID, question.id, True)
        assert enabled is not None and enabled.active is True
        selected = await repository.random_question(GUILD_ID)
        assert selected is not None and selected.id == question.id
    finally:
        await database.close()


class _QuizSnapshots:
    def __init__(
        self,
        features: SQLAlchemyFeatureConfigRepository,
        quizzes: SQLAlchemyQuizRepository,
    ) -> None:
        self.features = features
        self.quizzes = quizzes

    async def build(self, guild: object) -> dict[str, Any]:
        guild_id = guild.id  # type: ignore[attr-defined]
        feature = await self.features.get(guild_id, FeatureName.QUIZZES)
        assert feature is not None
        questions = await self.quizzes.list_questions(guild_id)
        return {
            "features": [{"name": "quizzes", "enabled": feature.enabled}],
            "quiz": {
                "interval_hours": feature.config.get("interval_hours"),
                "questions": serialize_quiz_questions(questions),
            },
        }


class _FakeBot:
    def __init__(self, guild_id: int) -> None:
        self.member = SimpleNamespace(
            guild_permissions=SimpleNamespace(administrator=True, manage_guild=True)
        )
        self.guild = SimpleNamespace(id=guild_id, get_member=lambda _member_id: self.member)

    def get_guild(self, guild_id: int) -> object | None:
        return self.guild if guild_id == self.guild.id else None


def _save_action(base_revision: str, *, prompt: str, correct: int) -> ControlActionRecord:
    now = datetime.now(UTC)
    return ControlActionRecord(
        id="community-r2-page-save",
        guild_id=GUILD_ID,
        actor_id=ACTOR_ID,
        action_type=ControlActionType.SAVE_PAGE,
        payload={
            "page_key": PAGE_KEY,
            "base_revision": base_revision,
            "changes": [
                {
                    "action_type": ControlActionType.SET_QUIZ_SCHEDULE.value,
                    "payload": {"interval_hours": 12},
                },
                {
                    "action_type": ControlActionType.UPDATE_QUIZ_QUESTION.value,
                    "payload": {
                        "question_id": 1,
                        "category": "python",
                        "prompt": prompt,
                        "options": ["A count", "A string", "A bool", "None"],
                        "correct": correct,
                        "explanation": "Updated explanation.",
                    },
                },
            ],
        },
        idempotency_key="community-r2-page-save",
        status=ControlActionStatus.CLAIMED,
        claimed_by="test-worker",
        result=None,
        user_error=None,
        error_reference=None,
        created_at=now,
        claimed_at=now,
        finished_at=None,
    )


async def _page_save_fixture() -> tuple[
    Database,
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyQuizRepository,
    PageSaveExecutor,
    _QuizSnapshots,
    object,
]:
    database = await _database()
    feature_repository = SQLAlchemyFeatureConfigRepository(database)
    quiz_repository = SQLAlchemyQuizRepository(database)
    await feature_repository.set(
        GUILD_ID,
        FeatureName.QUIZZES,
        True,
        {"interval_hours": 24, "last_posted_at": None},
    )
    await _add_question(quiz_repository, GUILD_ID)

    bot = _FakeBot(GUILD_ID)
    control = SQLAlchemyControlRepository(database)
    nested = ControlActionExecutor(
        bot=bot,  # type: ignore[arg-type]
        settings=object(),  # type: ignore[arg-type]
        resources=object(),  # type: ignore[arg-type]
        features=FeatureConfigService(feature_repository),
        provisioner=object(),  # type: ignore[arg-type]
        tickets=object(),  # type: ignore[arg-type]
        reputation=object(),  # type: ignore[arg-type]
        quizzes=QuizService(quiz_repository),
        ai_sources=object(),  # type: ignore[arg-type]
        control=control,
    )
    snapshots = _QuizSnapshots(feature_repository, quiz_repository)
    page_save = PageSaveExecutor(
        bot=bot,  # type: ignore[arg-type]
        executor=nested,
        snapshots=snapshots,  # type: ignore[arg-type]
    )
    return database, feature_repository, quiz_repository, page_save, snapshots, bot.guild


@pytest.mark.asyncio
async def test_quiz_page_save_rolls_back_earlier_db_change_when_open_question_edit_fails() -> None:
    (
        database,
        features,
        quizzes,
        page_save,
        snapshots,
        guild,
    ) = await _page_save_fixture()
    try:
        question = await quizzes.get_question(1)
        assert question is not None
        await _open_session(quizzes, question)
        before = await snapshots.build(guild)
        base_revision = page_revision(before, PAGE_KEY)

        result = await page_save.execute(
            _save_action(base_revision, prompt="Unsafe changed prompt", correct=2)
        )

        feature = await features.get(GUILD_ID, FeatureName.QUIZZES)
        persisted_question = await quizzes.get_question(1)
        assert feature is not None
        assert feature.config["interval_hours"] == 24
        assert persisted_question is not None
        assert persisted_question.prompt == "What does len return?"
        assert persisted_question.correct_index == 0
        assert result["outcome"] == "partial"
        assert result["applied_indices"] == []
        assert result["failed_indices"] == [1]
        assert result["items"][0]["status"] == "rolled_back"
        assert result["items"][1]["status"] == "failed"
        assert result["revision"] == base_revision
    finally:
        await database.close()


@pytest.mark.asyncio
async def test_quiz_page_save_commits_schedule_and_question_edit_together_when_safe() -> None:
    (
        database,
        features,
        quizzes,
        page_save,
        snapshots,
        guild,
    ) = await _page_save_fixture()
    try:
        before = await snapshots.build(guild)
        base_revision = page_revision(before, PAGE_KEY)

        result = await page_save.execute(
            _save_action(base_revision, prompt="Safely changed prompt", correct=2)
        )

        feature = await features.get(GUILD_ID, FeatureName.QUIZZES)
        persisted_question = await quizzes.get_question(1)
        assert feature is not None
        assert feature.config["interval_hours"] == 12
        assert persisted_question is not None
        assert persisted_question.prompt == "Safely changed prompt"
        assert persisted_question.correct_index == 1
        assert result["outcome"] == "saved"
        assert result["applied_indices"] == [0, 1]
        assert result["failed_indices"] == []
        assert result["revision"] != base_revision
    finally:
        await database.close()
