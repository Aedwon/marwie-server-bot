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
