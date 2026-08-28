from __future__ import annotations

from copy import deepcopy

import pytest

from marwie_bot.db.base import Base
from marwie_bot.db.session import Database
from marwie_bot.features.control_plane.page_revisions import page_revision
from marwie_bot.features.control_plane.page_save_contract import (
    PAGE_SAVE_ACTIONS_BY_PAGE,
    normalize_page_save_payload,
)
from marwie_bot.features.control_plane.page_save_executor import PageSaveExecutor
from marwie_bot.features.tickets.repository import SQLAlchemyTicketRepository

NOTIFICATION_PAGE = "/control/utilities/notification-roles"
ANONYMOUS_PAGE = "/control/utilities/anonymous-questions"


def _notification_save(*, channel_id: int | None = None) -> dict[str, object]:
    panel: dict[str, object] = {
        "title": "Notifications",
        "description": "Choose the updates you want.",
        "buttons": [
            {
                "role_id": 456,
                "label": "Events",
                "emoji": "",
                "style": "primary",
            }
        ],
    }
    if channel_id is not None:
        panel["channel_id"] = channel_id
    return {
        "page_key": NOTIFICATION_PAGE,
        "base_revision": "a" * 64,
        "changes": [
            {
                "action_type": "save_notification_panel",
                "payload": panel,
            }
        ],
    }


def _normalize(raw: dict[str, object]) -> dict[str, object]:
    return normalize_page_save_payload(
        raw,
        normalize_action_type=PageSaveExecutor._normalize_action_type,
        validate_action_payload=PageSaveExecutor._validate_action_payload,
    )


def test_canonical_notification_page_save_does_not_require_destination_channel() -> None:
    normalized = _normalize(_notification_save())
    payload = normalized["changes"][0]["payload"]  # type: ignore[index]
    assert payload["channel_id"] is None  # type: ignore[index]


def test_canonical_notification_page_save_rejects_caller_owned_destination_channel() -> None:
    with pytest.raises(ValueError, match="Mappings"):
        _normalize(_notification_save(channel_id=123))


def test_notification_page_revision_does_not_own_destination_mapping() -> None:
    left = {
        "notification_panel": {
            "channel_id": "111",
            "title": "Notifications",
            "description": "Choose updates.",
            "buttons": [
                {
                    "role_id": "456",
                    "label": "Events",
                    "emoji": "",
                    "style": "primary",
                }
            ],
        }
    }
    right = deepcopy(left)
    right["notification_panel"]["channel_id"] = "222"
    assert page_revision(left, NOTIFICATION_PAGE) == page_revision(right, NOTIFICATION_PAGE)


def test_anonymous_question_control_revision_ignores_submitter_identity() -> None:
    safe = {
        "features": [{"name": "anonymous_questions", "enabled": True}],
    }
    contaminated = deepcopy(safe)
    contaminated["anonymous_question_submissions"] = [
        {
            "id": 1,
            "user_id": "9988776655",
            "question": "Private audit-only row",
        }
    ]
    assert page_revision(safe, ANONYMOUS_PAGE) == page_revision(contaminated, ANONYMOUS_PAGE)


def test_message_logging_has_no_control_page_save_owner() -> None:
    assert all(
        "set_log_exclusions" not in actions
        for actions in PAGE_SAVE_ACTIONS_BY_PAGE.values()
    )
    assert not any("message" in page_key and "log" in page_key for page_key in PAGE_SAVE_ACTIONS_BY_PAGE)


async def test_ticket_type_upsert_explicitly_reenables_disabled_type() -> None:
    database = Database("sqlite+aiosqlite:///:memory:")
    async with database.engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    repository = SQLAlchemyTicketRepository(database)

    try:
        created = await repository.upsert_type(123, "general", "General", "General support")
        assert created.enabled is True
        assert await repository.disable_type(123, "general") is True

        disabled = await repository.list_types(123, enabled_only=False)
        assert len(disabled) == 1
        assert disabled[0].enabled is False

        restored = await repository.upsert_type(123, "general", "General", "Updated support")
        assert restored.enabled is True
        assert restored.description == "Updated support"
    finally:
        await database.close()
