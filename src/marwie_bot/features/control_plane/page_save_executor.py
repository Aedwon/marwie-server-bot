from __future__ import annotations

import logging
import secrets
from dataclasses import replace
from typing import Any, cast

import discord

from marwie_bot.config.resources import ResourceKey
from marwie_bot.features.control_plane.domain import ControlActionRecord, ControlActionType
from marwie_bot.features.control_plane.executor import (
    ActionRejected,
    ControlActionExecutor,
    _discord_resource,
    _resource_matches_key,
)
from marwie_bot.features.control_plane.page_revisions import page_revision
from marwie_bot.features.control_plane.page_save_contract import normalize_page_save_payload
from marwie_bot.features.control_plane.snapshot import GuildSnapshotBuilder
from marwie_bot.features.control_plane.validation import validate_action_payload

logger = logging.getLogger(__name__)


class PageSaveExecutor:
    def __init__(
        self,
        *,
        bot: Any,
        executor: ControlActionExecutor,
        snapshots: GuildSnapshotBuilder,
    ) -> None:
        self.bot = bot
        self.executor = executor
        self.snapshots = snapshots

    @staticmethod
    def _normalize_action_type(value: str) -> str:
        action_type = ControlActionType(value)
        if action_type in {ControlActionType.SAVE_PAGE, ControlActionType.REFRESH_SNAPSHOT}:
            raise ValueError("Nested internal control actions are not allowed.")
        return action_type.value

    @staticmethod
    def _validate_action_payload(action_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        return validate_action_payload(ControlActionType(action_type), payload)

    async def _preflight(
        self,
        guild: discord.Guild,
        actor: discord.Member,
        changes: list[dict[str, Any]],
    ) -> None:
        for change in changes:
            action_type = ControlActionType(str(change["action_type"]))
            payload = cast(dict[str, Any], change["payload"])
            self.executor._require_actor_permission(actor, action_type)

            if action_type is ControlActionType.SET_RESOURCE:
                key = ResourceKey(str(payload["key"]))
                resource = _discord_resource(guild, key, int(payload["discord_id"]))
                if not _resource_matches_key(key, resource):
                    raise ActionRejected(
                        f"The selected Discord resource is not valid for `{key.value}`."
                    )

            if action_type is ControlActionType.SAVE_NOTIFICATION_PANEL:
                channel = guild.get_channel(int(payload["channel_id"]))
                if not isinstance(channel, discord.TextChannel):
                    raise ActionRejected("Select a text channel for the notification role panel.")
                bot_member = guild.me
                if bot_member is None or not bot_member.guild_permissions.manage_roles:
                    raise ActionRejected(
                        "Rob-bot needs Manage Roles before this panel can be saved."
                    )
                permissions = channel.permissions_for(bot_member)
                if not permissions.send_messages or not permissions.embed_links:
                    raise ActionRejected(
                        "Rob-bot needs Send Messages and Embed Links in the panel channel."
                    )
                for item in cast(list[dict[str, Any]], payload["buttons"]):
                    role = guild.get_role(int(item["role_id"]))
                    if (
                        role is None
                        or role.is_default()
                        or role.managed
                        or bot_member.top_role <= role
                    ):
                        raise ActionRejected(
                            f"Rob-bot cannot manage the configured role for `{item['label']}`."
                        )

    async def execute(self, action: ControlActionRecord) -> dict[str, Any]:
        guild = self.bot.get_guild(action.guild_id)
        if guild is None:
            raise ActionRejected("Rob-bot is no longer connected to that server.")
        actor = await self.executor._actor(guild, action.actor_id)
        payload = normalize_page_save_payload(
            action.payload,
            normalize_action_type=self._normalize_action_type,
            validate_action_payload=self._validate_action_payload,
        )
        changes = cast(list[dict[str, Any]], payload["changes"])

        for change in changes:
            self.executor._require_actor_permission(
                actor, ControlActionType(str(change["action_type"]))
            )

        before = await self.snapshots.build(guild)
        current_revision = page_revision(before, str(payload["page_key"]))
        if current_revision != payload["base_revision"]:
            return {
                "outcome": "conflict",
                "page_key": payload["page_key"],
                "base_revision": payload["base_revision"],
                "current_revision": current_revision,
                "items": [],
                "applied_indices": [],
                "failed_indices": [],
            }

        # All known validation and Discord prerequisites are checked before the first mutation.
        await self._preflight(guild, actor, changes)

        items: list[dict[str, Any]] = []
        applied_indices: list[int] = []
        failed_indices: list[int] = []
        failed = False
        for index, change in enumerate(changes):
            if failed:
                items.append(
                    {
                        "index": index,
                        "action_type": change["action_type"],
                        "status": "not_attempted",
                    }
                )
                continue

            nested = replace(
                action,
                action_type=ControlActionType(str(change["action_type"])),
                payload=cast(dict[str, Any], change["payload"]),
            )
            try:
                result = await self.executor.execute(nested)
            except (ActionRejected, ValueError) as error:
                failed = True
                failed_indices.append(index)
                items.append(
                    {
                        "index": index,
                        "action_type": change["action_type"],
                        "status": "failed",
                        "error": str(error),
                        "error_reference": None,
                    }
                )
            except Exception:
                failed = True
                failed_indices.append(index)
                reference = secrets.token_hex(4).upper()
                logger.exception(
                    "Page save item failed action_id=%s guild_id=%s actor_id=%s index=%s error_reference=%s",
                    action.id,
                    action.guild_id,
                    action.actor_id,
                    index,
                    reference,
                )
                items.append(
                    {
                        "index": index,
                        "action_type": change["action_type"],
                        "status": "failed",
                        "error": "That change failed unexpectedly.",
                        "error_reference": reference,
                    }
                )
            else:
                applied_indices.append(index)
                items.append(
                    {
                        "index": index,
                        "action_type": change["action_type"],
                        "status": "applied",
                        "result": result,
                    }
                )

        after = await self.snapshots.build(guild)
        revision = page_revision(after, str(payload["page_key"]))
        return {
            "outcome": "partial" if failed_indices else "saved",
            "page_key": payload["page_key"],
            "base_revision": payload["base_revision"],
            "revision": revision,
            "items": items,
            "applied_indices": applied_indices,
            "failed_indices": failed_indices,
        }
