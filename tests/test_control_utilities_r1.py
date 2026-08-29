from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import pytest

from marwie_bot.config.resources import ResourceKey
from marwie_bot.db.base import Base
from marwie_bot.db.session import Database
from marwie_bot.features.control_plane import executor as executor_module
from marwie_bot.features.control_plane import page_save_executor as page_save_executor_module
from marwie_bot.features.control_plane.domain import (
    NotificationRoleButtonRecord,
    NotificationRolePanelRecord,
)
from marwie_bot.features.control_plane.executor import ControlActionExecutor
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


def _normalize(raw: dict[str, object]) -> dict[str, Any]:
    return normalize_page_save_payload(
        raw,
        normalize_action_type=PageSaveExecutor._normalize_action_type,
        validate_action_payload=PageSaveExecutor._validate_action_payload,
    )


class _Rank:
    def __init__(self, position: int) -> None:
        self.position = position

    def __le__(self, other: object) -> bool:
        return self.position <= int(getattr(other, "position", 0))


class _Role(_Rank):
    managed = False

    def is_default(self) -> bool:
        return False


class _TextChannel:
    def __init__(self, channel_id: int) -> None:
        self.id = channel_id

    def permissions_for(self, member: object) -> object:
        del member
        return SimpleNamespace(send_messages=True, embed_links=True)


class _Resources:
    def __init__(self, discord_id: int | None) -> None:
        self.discord_id = discord_id
        self.calls: list[tuple[int, ResourceKey]] = []

    async def get(self, guild_id: int, key: ResourceKey) -> object | None:
        self.calls.append((guild_id, key))
        if self.discord_id is None:
            return None
        return SimpleNamespace(discord_id=self.discord_id)


class _Control:
    def __init__(self) -> None:
        self.saved: dict[str, Any] | None = None

    async def save_notification_panel(self, **kwargs: Any) -> NotificationRolePanelRecord:
        self.saved = dict(kwargs)
        button = kwargs["buttons"][0]
        return NotificationRolePanelRecord(
            guild_id=int(kwargs["guild_id"]),
            channel_id=int(kwargs["channel_id"]),
            message_id=None,
            title=str(kwargs["title"]),
            description=str(kwargs["description"]),
            updated_by=int(kwargs["updated_by"]),
            updated_at=datetime.now(UTC),
            buttons=(
                NotificationRoleButtonRecord(
                    position=0,
                    role_id=int(button["role_id"]),
                    label=str(button["label"]),
                    emoji=str(button.get("emoji") or "") or None,
                    style=str(button["style"]),
                ),
            ),
        )


def _notification_guild(channel: _TextChannel) -> object:
    role = _Role(5)
    bot_member = SimpleNamespace(
        guild_permissions=SimpleNamespace(manage_roles=True),
        top_role=_Rank(10),
    )
    return SimpleNamespace(
        id=123,
        me=bot_member,
        get_channel=lambda channel_id: channel if channel_id == channel.id else None,
        get_role=lambda role_id: role if role_id == 456 else None,
    )


def test_canonical_notification_page_save_does_not_require_destination_channel() -> None:
    normalized = _normalize(_notification_save())
    payload = normalized["changes"][0]["payload"]
    assert payload["channel_id"] is None


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


async def test_notification_page_preflight_resolves_role_panel_mapping(monkeypatch: Any) -> None:
    monkeypatch.setattr(page_save_executor_module.discord, "TextChannel", _TextChannel)
    channel = _TextChannel(789)
    guild = _notification_guild(channel)
    resources = _Resources(channel.id)
    nested = SimpleNamespace(
        resources=resources,
        _require_actor_permission=lambda actor, action_type: None,
    )
    executor = PageSaveExecutor(
        bot=SimpleNamespace(),
        executor=nested,  # type: ignore[arg-type]
        snapshots=SimpleNamespace(),  # type: ignore[arg-type]
    )
    changes = _normalize(_notification_save())["changes"]

    await executor._preflight(guild, object(), changes)  # type: ignore[arg-type]

    assert resources.calls == [(123, ResourceKey.ROLE_PANEL)]


async def test_notification_save_derives_mapped_destination_before_persisting(
    monkeypatch: Any,
) -> None:
    monkeypatch.setattr(executor_module.discord, "TextChannel", _TextChannel)
    channel = _TextChannel(789)
    guild = _notification_guild(channel)
    resources = _Resources(channel.id)
    control = _Control()
    added_views: list[tuple[object, int]] = []

    async def publish(**kwargs: Any) -> tuple[object, object]:
        assert kwargs["channel"] is channel
        return SimpleNamespace(id=991), object()

    monkeypatch.setattr(executor_module, "upsert_notification_panel", publish)
    executor = object.__new__(ControlActionExecutor)
    object.__setattr__(executor, "resources", resources)
    object.__setattr__(executor, "control", control)
    object.__setattr__(
        executor,
        "bot",
        SimpleNamespace(
            add_view=lambda view, message_id: added_views.append((view, message_id))
        ),
    )
    payload = _normalize(_notification_save())["changes"][0]["payload"]

    result = await executor._save_notification_panel(
        guild,  # type: ignore[arg-type]
        SimpleNamespace(id=42),  # type: ignore[arg-type]
        payload,
    )

    assert resources.calls == [(123, ResourceKey.ROLE_PANEL)]
    assert control.saved is not None
    assert control.saved["channel_id"] == channel.id
    assert result == {"channel_id": channel.id, "message_id": 991, "buttons": 1}
    assert added_views[0][1] == 991


async def test_notification_publication_failure_happens_after_config_persistence(
    monkeypatch: Any,
) -> None:
    monkeypatch.setattr(executor_module.discord, "TextChannel", _TextChannel)
    channel = _TextChannel(789)
    guild = _notification_guild(channel)
    resources = _Resources(channel.id)
    control = _Control()

    async def fail_publish(**kwargs: Any) -> tuple[object, object]:
        del kwargs
        raise RuntimeError("simulated Discord publication failure")

    monkeypatch.setattr(executor_module, "upsert_notification_panel", fail_publish)
    executor = object.__new__(ControlActionExecutor)
    object.__setattr__(executor, "resources", resources)
    object.__setattr__(executor, "control", control)
    object.__setattr__(
        executor,
        "bot",
        SimpleNamespace(add_view=lambda view, message_id: None),
    )
    payload = _normalize(_notification_save())["changes"][0]["payload"]

    with pytest.raises(RuntimeError, match="publication failure"):
        await executor._save_notification_panel(
            guild,  # type: ignore[arg-type]
            SimpleNamespace(id=42),  # type: ignore[arg-type]
            payload,
        )

    assert control.saved is not None
    assert control.saved["channel_id"] == channel.id


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
        "set_log_exclusions" not in actions for actions in PAGE_SAVE_ACTIONS_BY_PAGE.values()
    )
    assert not any(
        "message" in page_key and "log" in page_key for page_key in PAGE_SAVE_ACTIONS_BY_PAGE
    )


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
