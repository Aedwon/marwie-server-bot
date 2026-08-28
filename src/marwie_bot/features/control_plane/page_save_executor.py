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


_DB_ONLY_ACTIONS = frozenset(
    {
        ControlActionType.SET_RESOURCE,
        ControlActionType.CLEAR_RESOURCE,
        ControlActionType.SET_FEATURE,
        ControlActionType.SET_LOG_EXCLUSIONS,
        ControlActionType.UPSERT_TICKET_TYPE,
        ControlActionType.DISABLE_TICKET_TYPE,
        ControlActionType.SET_REPUTATION_THRESHOLDS,
        ControlActionType.SET_QUIZ_SCHEDULE,
        ControlActionType.ADD_QUIZ_QUESTION,
        ControlActionType.UPSERT_AI_SOURCE,
        ControlActionType.DISABLE_AI_SOURCE,
    }
)


class _PageSaveMutationFailed(Exception):
    def __init__(
        self,
        *,
        index: int,
        user_error: str,
        error_reference: str | None,
    ) -> None:
        super().__init__(user_error)
        self.index = index
        self.user_error = user_error
        self.error_reference = error_reference


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
        normalized_type = ControlActionType(action_type)
        if normalized_type is ControlActionType.SAVE_NOTIFICATION_PANEL:
            # The legacy single-action contract still requires channel_id. Canonical
            # page-save owns only panel behavior, so validate the shared shape with a
            # temporary valid snowflake and restore the destination to unresolved.
            data = dict(payload)
            if data.get("channel_id") in {None, ""}:
                data["channel_id"] = 1
                validated = validate_action_payload(normalized_type, data)
                validated["channel_id"] = None
                return validated
        return validate_action_payload(normalized_type, payload)

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
                resource = await self.executor.resources.get(guild.id, ResourceKey.ROLE_PANEL)
                channel = guild.get_channel(resource.discord_id) if resource is not None else None
                if not isinstance(channel, discord.TextChannel):
                    raise ActionRejected(
                        "Configure the notification role panel destination in Mappings first."
                    )
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
                # The destination is injected only after all page-save ownership and
                # Discord prerequisites have passed. The nested legacy action can then
                # execute through its existing validated contract.
                payload["channel_id"] = channel.id

    async def _execute_change(
        self,
        action: ControlActionRecord,
        index: int,
        change: dict[str, Any],
    ) -> dict[str, Any]:
        nested = replace(
            action,
            action_type=ControlActionType(str(change["action_type"])),
            payload=cast(dict[str, Any], change["payload"]),
        )
        try:
            return await self.executor.execute(nested)
        except (ActionRejected, ValueError) as error:
            raise _PageSaveMutationFailed(
                index=index,
                user_error=str(error),
                error_reference=None,
            ) from error
        except Exception as error:
            reference = secrets.token_hex(4).upper()
            logger.exception(
                "Page save item failed "
                "action_id=%s guild_id=%s actor_id=%s "
                "index=%s error_reference=%s",
                action.id,
                action.guild_id,
                action.actor_id,
                index,
                reference,
            )
            raise _PageSaveMutationFailed(
                index=index,
                user_error="That change failed unexpectedly.",
                error_reference=reference,
            ) from error

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

        items_by_index: dict[int, dict[str, Any]] = {}
        applied_indices: list[int] = []
        failed_indices: list[int] = []

        database_indices: list[int] = []
        external_indices: list[int] = []

        for index, change in enumerate(changes):
            action_type = ControlActionType(str(change["action_type"]))
            if action_type in _DB_ONLY_ACTIONS:
                database_indices.append(index)
            else:
                external_indices.append(index)

        if database_indices:
            try:
                async with self.executor.control.database.transaction():
                    for index in database_indices:
                        result = await self._execute_change(
                            action,
                            index,
                            changes[index],
                        )
                        items_by_index[index] = {
                            "index": index,
                            "action_type": changes[index]["action_type"],
                            "status": "applied",
                            "result": result,
                        }
            except _PageSaveMutationFailed as failure:
                failed_indices.append(failure.index)
                failure_position = database_indices.index(failure.index)

                for position, index in enumerate(database_indices):
                    change = changes[index]
                    if position < failure_position:
                        items_by_index[index] = {
                            "index": index,
                            "action_type": change["action_type"],
                            "status": "rolled_back",
                        }
                    elif index == failure.index:
                        items_by_index[index] = {
                            "index": index,
                            "action_type": change["action_type"],
                            "status": "failed",
                            "error": failure.user_error,
                            "error_reference": failure.error_reference,
                        }
                    else:
                        items_by_index[index] = {
                            "index": index,
                            "action_type": change["action_type"],
                            "status": "not_attempted",
                        }

                for index in external_indices:
                    change = changes[index]
                    items_by_index[index] = {
                        "index": index,
                        "action_type": change["action_type"],
                        "status": "not_attempted",
                    }

                after = await self.snapshots.build(guild)
                revision = page_revision(
                    after,
                    str(payload["page_key"]),
                )
                return {
                    "outcome": "partial",
                    "page_key": payload["page_key"],
                    "base_revision": payload["base_revision"],
                    "revision": revision,
                    "items": [items_by_index[index] for index in range(len(changes))],
                    "applied_indices": [],
                    "failed_indices": failed_indices,
                }
            except Exception:
                reference = secrets.token_hex(4).upper()
                logger.exception(
                    "Page save database transaction failed "
                    "action_id=%s guild_id=%s actor_id=%s "
                    "error_reference=%s",
                    action.id,
                    action.guild_id,
                    action.actor_id,
                    reference,
                )
                failed_indices.extend(database_indices)

                for index in database_indices:
                    change = changes[index]
                    items_by_index[index] = {
                        "index": index,
                        "action_type": change["action_type"],
                        "status": "rolled_back",
                        "error": ("The database changes could not be saved atomically."),
                        "error_reference": reference,
                    }

                for index in external_indices:
                    change = changes[index]
                    items_by_index[index] = {
                        "index": index,
                        "action_type": change["action_type"],
                        "status": "not_attempted",
                    }

                after = await self.snapshots.build(guild)
                revision = page_revision(
                    after,
                    str(payload["page_key"]),
                )
                return {
                    "outcome": "partial",
                    "page_key": payload["page_key"],
                    "base_revision": payload["base_revision"],
                    "revision": revision,
                    "items": [items_by_index[index] for index in range(len(changes))],
                    "applied_indices": [],
                    "failed_indices": failed_indices,
                }
            else:
                applied_indices.extend(database_indices)

        external_failed = False
        for index in external_indices:
            change = changes[index]

            if external_failed:
                items_by_index[index] = {
                    "index": index,
                    "action_type": change["action_type"],
                    "status": "not_attempted",
                }
                continue

            try:
                result = await self._execute_change(
                    action,
                    index,
                    change,
                )
            except _PageSaveMutationFailed as failure:
                external_failed = True
                failed_indices.append(index)
                items_by_index[index] = {
                    "index": index,
                    "action_type": change["action_type"],
                    "status": "failed",
                    "error": failure.user_error,
                    "error_reference": failure.error_reference,
                }
            else:
                applied_indices.append(index)
                items_by_index[index] = {
                    "index": index,
                    "action_type": change["action_type"],
                    "status": "applied",
                    "result": result,
                }

        items = [
            items_by_index.get(
                index,
                {
                    "index": index,
                    "action_type": change["action_type"],
                    "status": "not_attempted",
                },
            )
            for index, change in enumerate(changes)
        ]

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
