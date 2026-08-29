from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

from marwie_bot.config.resources import ResourceKey
from marwie_bot.features.control_plane import executor as executor_module
from marwie_bot.features.control_plane import page_save_executor as page_save_executor_module
from marwie_bot.features.control_plane.domain import (
    ControlActionRecord,
    ControlActionStatus,
    ControlActionType,
    NotificationRoleButtonRecord,
    NotificationRolePanelRecord,
)
from marwie_bot.features.control_plane.executor import ControlActionExecutor
from marwie_bot.features.control_plane.page_revisions import page_revision
from marwie_bot.features.control_plane.page_save_executor import PageSaveExecutor

NOTIFICATION_PAGE = "/control/utilities/notification-roles"
GUILD_ID = 123
ACTOR_ID = 42
ROLE_ID = 456


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


class _Snapshots:
    async def build(self, guild: object) -> dict[str, Any]:
        del guild
        return {}


class _MappingChangingPageSaveExecutor(PageSaveExecutor):
    def __init__(self, *, resources: _Resources, next_channel_id: int, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._resources = resources
        self._next_channel_id = next_channel_id

    async def _preflight(
        self,
        guild: object,
        actor: object,
        changes: list[dict[str, Any]],
    ) -> None:
        await super()._preflight(guild, actor, changes)  # type: ignore[arg-type]
        self._resources.discord_id = self._next_channel_id


def _page_save_action(base_revision: str) -> ControlActionRecord:
    now = datetime.now(UTC)
    return ControlActionRecord(
        id="utilities-r2-stale-mapping",
        guild_id=GUILD_ID,
        actor_id=ACTOR_ID,
        action_type=ControlActionType.SAVE_PAGE,
        payload={
            "page_key": NOTIFICATION_PAGE,
            "base_revision": base_revision,
            "changes": [
                {
                    "action_type": ControlActionType.SAVE_NOTIFICATION_PANEL.value,
                    "payload": {
                        "title": "Notifications",
                        "description": "Choose the updates you want.",
                        "buttons": [
                            {
                                "role_id": ROLE_ID,
                                "label": "Events",
                                "emoji": "",
                                "style": "primary",
                            }
                        ],
                    },
                }
            ],
        },
        idempotency_key="utilities-r2-stale-mapping",
        status=ControlActionStatus.CLAIMED,
        claimed_by="test-worker",
        result=None,
        user_error=None,
        error_reference=None,
        created_at=now,
        claimed_at=now,
        finished_at=None,
    )


async def test_notification_page_save_re_resolves_mapping_after_preflight(monkeypatch: Any) -> None:
    monkeypatch.setattr(page_save_executor_module.discord, "TextChannel", _TextChannel)
    monkeypatch.setattr(executor_module.discord, "TextChannel", _TextChannel)

    channel_a = _TextChannel(789)
    channel_b = _TextChannel(790)
    channels = {channel_a.id: channel_a, channel_b.id: channel_b}
    role = _Role(5)
    bot_member = SimpleNamespace(
        guild_permissions=SimpleNamespace(manage_roles=True),
        top_role=_Rank(10),
    )
    actor = SimpleNamespace(
        id=ACTOR_ID,
        guild_permissions=SimpleNamespace(administrator=True, manage_guild=True),
    )
    guild = SimpleNamespace(
        id=GUILD_ID,
        me=bot_member,
        get_channel=lambda channel_id: channels.get(channel_id),
        get_role=lambda role_id: role if role_id == ROLE_ID else None,
        get_member=lambda member_id: actor if member_id == ACTOR_ID else None,
    )

    resources = _Resources(channel_a.id)
    control = _Control()
    published_channel_ids: list[int] = []

    async def publish(**kwargs: Any) -> tuple[object, object]:
        channel = kwargs["channel"]
        published_channel_ids.append(channel.id)
        return SimpleNamespace(id=991), object()

    monkeypatch.setattr(executor_module, "upsert_notification_panel", publish)

    bot = SimpleNamespace(
        get_guild=lambda guild_id: guild if guild_id == GUILD_ID else None,
        add_view=lambda view, message_id: None,
    )
    nested = object.__new__(ControlActionExecutor)
    object.__setattr__(nested, "resources", resources)
    object.__setattr__(nested, "control", control)
    object.__setattr__(nested, "bot", bot)

    snapshots = _Snapshots()
    executor = _MappingChangingPageSaveExecutor(
        bot=bot,
        executor=nested,
        snapshots=snapshots,
        resources=resources,
        next_channel_id=channel_b.id,
    )
    base_revision = page_revision(await snapshots.build(guild), NOTIFICATION_PAGE)

    result = await executor.execute(_page_save_action(base_revision))

    assert result["outcome"] == "saved"
    assert control.saved is not None
    assert control.saved["channel_id"] == channel_b.id
    assert published_channel_ids == [channel_b.id]
    assert resources.calls == [
        (GUILD_ID, ResourceKey.ROLE_PANEL),
        (GUILD_ID, ResourceKey.ROLE_PANEL),
    ]


class _AfterPreflightMutationExecutor(PageSaveExecutor):
    def __init__(self, *, mutate_after_preflight: Any, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._mutate_after_preflight = mutate_after_preflight

    async def _preflight(
        self,
        guild: object,
        actor: object,
        changes: list[dict[str, Any]],
    ) -> None:
        await super()._preflight(guild, actor, changes)  # type: ignore[arg-type]
        self._mutate_after_preflight()


def _notification_fixture(
    monkeypatch: Any,
    *,
    channel_a: _TextChannel,
    channels: dict[int, object],
    role: _Role,
) -> tuple[Any, _Resources, _Control, ControlActionExecutor, Any, list[int]]:
    monkeypatch.setattr(page_save_executor_module.discord, "TextChannel", _TextChannel)
    monkeypatch.setattr(executor_module.discord, "TextChannel", _TextChannel)
    bot_member = SimpleNamespace(
        guild_permissions=SimpleNamespace(manage_roles=True),
        top_role=_Rank(10),
    )
    actor = SimpleNamespace(
        id=ACTOR_ID,
        guild_permissions=SimpleNamespace(administrator=True, manage_guild=True),
    )
    guild = SimpleNamespace(
        id=GUILD_ID,
        me=bot_member,
        get_channel=lambda channel_id: channels.get(channel_id),
        get_role=lambda role_id: role if role_id == ROLE_ID else None,
        get_member=lambda member_id: actor if member_id == ACTOR_ID else None,
    )
    resources = _Resources(int(channel_a.id))
    control = _Control()
    published_channel_ids: list[int] = []
    bot = SimpleNamespace(
        get_guild=lambda guild_id: guild if guild_id == GUILD_ID else None,
        add_view=lambda view, message_id: None,
    )
    nested = object.__new__(ControlActionExecutor)
    object.__setattr__(nested, "resources", resources)
    object.__setattr__(nested, "control", control)
    object.__setattr__(nested, "bot", bot)
    snapshots = _Snapshots()
    return bot, resources, control, nested, snapshots, published_channel_ids


async def test_notification_page_save_fails_closed_when_mapping_removed_after_preflight(
    monkeypatch: Any,
) -> None:
    channel_a = _TextChannel(789)
    role = _Role(5)
    bot, resources, control, nested, snapshots, published = _notification_fixture(
        monkeypatch, channel_a=channel_a, channels={channel_a.id: channel_a}, role=role
    )

    async def publish(**kwargs: Any) -> tuple[object, object]:
        published.append(kwargs["channel"].id)
        return SimpleNamespace(id=991), object()

    monkeypatch.setattr(executor_module, "upsert_notification_panel", publish)
    executor = _AfterPreflightMutationExecutor(
        bot=bot,
        executor=nested,
        snapshots=snapshots,
        mutate_after_preflight=lambda: setattr(resources, "discord_id", None),
    )
    action = _page_save_action(
        page_revision(await snapshots.build(bot.get_guild(GUILD_ID)), NOTIFICATION_PAGE)
    )

    result = await executor.execute(action)

    assert result["outcome"] == "partial"
    assert result["failed_indices"] == [0]
    assert result["items"][0]["status"] == "failed"
    assert "Mappings first" in result["items"][0]["error"]
    assert control.saved is None
    assert published == []
    assert resources.calls == [
        (GUILD_ID, ResourceKey.ROLE_PANEL),
        (GUILD_ID, ResourceKey.ROLE_PANEL),
    ]


async def test_notification_page_save_rejects_current_invalid_mapping_after_preflight(
    monkeypatch: Any,
) -> None:
    channel_a = _TextChannel(789)
    invalid_b = SimpleNamespace(id=790)
    role = _Role(5)
    channels: dict[int, object] = {channel_a.id: channel_a, invalid_b.id: invalid_b}
    bot, resources, control, nested, snapshots, published = _notification_fixture(
        monkeypatch, channel_a=channel_a, channels=channels, role=role
    )

    async def publish(**kwargs: Any) -> tuple[object, object]:
        published.append(kwargs["channel"].id)
        return SimpleNamespace(id=992), object()

    monkeypatch.setattr(executor_module, "upsert_notification_panel", publish)
    executor = _AfterPreflightMutationExecutor(
        bot=bot,
        executor=nested,
        snapshots=snapshots,
        mutate_after_preflight=lambda: setattr(resources, "discord_id", invalid_b.id),
    )
    action = _page_save_action(
        page_revision(await snapshots.build(bot.get_guild(GUILD_ID)), NOTIFICATION_PAGE)
    )

    result = await executor.execute(action)

    assert result["outcome"] == "partial"
    assert result["failed_indices"] == [0]
    assert control.saved is None
    assert published == []
    assert resources.discord_id == invalid_b.id
    assert resources.calls == [
        (GUILD_ID, ResourceKey.ROLE_PANEL),
        (GUILD_ID, ResourceKey.ROLE_PANEL),
    ]


async def test_notification_page_save_rejects_current_invalid_role_after_preflight(
    monkeypatch: Any,
) -> None:
    channel_a = _TextChannel(789)
    role = _Role(5)
    bot, resources, control, nested, snapshots, published = _notification_fixture(
        monkeypatch, channel_a=channel_a, channels={channel_a.id: channel_a}, role=role
    )

    async def publish(**kwargs: Any) -> tuple[object, object]:
        published.append(kwargs["channel"].id)
        return SimpleNamespace(id=993), object()

    monkeypatch.setattr(executor_module, "upsert_notification_panel", publish)

    def invalidate_role() -> None:
        role.managed = True

    executor = _AfterPreflightMutationExecutor(
        bot=bot, executor=nested, snapshots=snapshots, mutate_after_preflight=invalidate_role
    )
    action = _page_save_action(
        page_revision(await snapshots.build(bot.get_guild(GUILD_ID)), NOTIFICATION_PAGE)
    )

    result = await executor.execute(action)

    assert result["outcome"] == "partial"
    assert result["failed_indices"] == [0]
    assert "cannot manage" in result["items"][0]["error"]
    assert control.saved is None
    assert published == []


async def test_notification_page_save_retry_uses_current_mapping_after_publish_failure(
    monkeypatch: Any,
) -> None:
    channel_a = _TextChannel(789)
    channel_b = _TextChannel(790)
    role = _Role(5)
    bot, resources, control, nested, snapshots, published = _notification_fixture(
        monkeypatch,
        channel_a=channel_a,
        channels={channel_a.id: channel_a, channel_b.id: channel_b},
        role=role,
    )
    attempts = 0

    async def publish(**kwargs: Any) -> tuple[object, object]:
        nonlocal attempts
        attempts += 1
        channel = kwargs["channel"]
        published.append(channel.id)
        if attempts == 1:
            raise RuntimeError("simulated Discord publication failure")
        return SimpleNamespace(id=994), object()

    monkeypatch.setattr(executor_module, "upsert_notification_panel", publish)
    executor = PageSaveExecutor(bot=bot, executor=nested, snapshots=snapshots)
    action = _page_save_action(
        page_revision(await snapshots.build(bot.get_guild(GUILD_ID)), NOTIFICATION_PAGE)
    )

    first = await executor.execute(action)
    assert first["outcome"] == "partial"
    assert first["items"][0]["status"] == "failed"
    assert first["items"][0]["error_reference"]
    assert control.saved is not None
    assert control.saved["channel_id"] == channel_a.id
    assert published == [channel_a.id]
    nested_payload = action.payload["changes"][0]["payload"]
    assert "channel_id" not in nested_payload

    resources.discord_id = channel_b.id
    second = await executor.execute(action)

    assert second["outcome"] == "saved"
    assert control.saved is not None
    assert control.saved["channel_id"] == channel_b.id
    assert second["items"][0]["result"]["channel_id"] == channel_b.id
    assert published == [channel_a.id, channel_b.id]
    assert "channel_id" not in nested_payload
