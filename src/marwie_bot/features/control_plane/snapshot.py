from __future__ import annotations

import asyncio
import hashlib
import json
from typing import Any

import discord

from marwie_bot.config.resources import FeatureName, ResourceKey, ResourceType
from marwie_bot.config.settings import Settings
from marwie_bot.features.ai_updates.repository import SQLAlchemyAIUpdatesRepository
from marwie_bot.features.configuration.provisioning import (
    AutoSetupPlan,
    AutoSetupService,
    DiscoveryAction,
)
from marwie_bot.features.configuration.service import (
    FeatureConfigRecord,
    FeatureConfigService,
    GuildResourceRecord,
    ResourceService,
)
from marwie_bot.features.control_plane.repository import SQLAlchemyControlRepository
from marwie_bot.features.tickets.service import TicketService

_DEFAULT_THRESHOLDS = {"builder": 50, "contributor": 150, "mentor": 500}


class _SnapshotResourceRepository:
    """Read-only resource repository backed by the snapshot's bulk resource read."""

    def __init__(self, records: list[GuildResourceRecord]) -> None:
        self._records = list(records)
        self._by_key = {record.key: record for record in records}

    async def get(self, guild_id: int, key: ResourceKey) -> GuildResourceRecord | None:
        record = self._by_key.get(key)
        if record is None or record.guild_id != guild_id:
            return None
        return record

    async def list_for_guild(self, guild_id: int) -> list[GuildResourceRecord]:
        return [record for record in self._records if record.guild_id == guild_id]

    async def set(
        self,
        guild_id: int,
        key: ResourceKey,
        resource_type: ResourceType,
        discord_id: int,
        updated_by: int,
    ) -> GuildResourceRecord:
        del guild_id, key, resource_type, discord_id, updated_by
        raise RuntimeError("Snapshot resource repository is read-only")

    async def clear(self, guild_id: int, key: ResourceKey) -> bool:
        del guild_id, key
        raise RuntimeError("Snapshot resource repository is read-only")


def _id(value: int | None) -> str | None:
    return str(value) if value is not None else None


def _channel_kind(channel: discord.abc.GuildChannel) -> str:
    if isinstance(channel, discord.ForumChannel):
        return "forum"
    if isinstance(channel, discord.TextChannel):
        return "text"
    if isinstance(channel, discord.VoiceChannel):
        return "voice"
    if isinstance(channel, discord.CategoryChannel):
        return "category"
    return channel.__class__.__name__.lower()


def _resource_value(guild: discord.Guild, key: ResourceKey, discord_id: int) -> dict[str, Any]:
    if key in {
        ResourceKey.LIVE_PING_ROLE,
        ResourceKey.BUILDER_ROLE,
        ResourceKey.CONTRIBUTOR_ROLE,
        ResourceKey.MENTOR_ROLE,
    }:
        role = guild.get_role(discord_id)
        return {
            "id": _id(discord_id),
            "name": role.name if role is not None else None,
            "exists": role is not None,
            "kind": "role",
        }
    if key is ResourceKey.SOLVED_TAG:
        for forum in guild.forums:
            tag = next((item for item in forum.available_tags if item.id == discord_id), None)
            if tag is not None:
                return {
                    "id": _id(discord_id),
                    "name": tag.name,
                    "exists": True,
                    "kind": "forum_tag",
                    "forum_id": _id(forum.id),
                }
        return {"id": _id(discord_id), "name": None, "exists": False, "kind": "forum_tag"}
    guild_channel = guild.get_channel(discord_id)
    return {
        "id": _id(discord_id),
        "name": guild_channel.name if guild_channel is not None else None,
        "exists": guild_channel is not None,
        "kind": _channel_kind(guild_channel) if guild_channel is not None else "channel",
    }


def serialize_setup_plan(plan: AutoSetupPlan) -> dict[str, Any]:
    resources: list[dict[str, Any]] = []
    counts = {"matched": 0, "review": 0, "missing": 0}
    for item in plan.resources:
        target = item.target
        current = item.current
        if item.action in {DiscoveryAction.KEEP, DiscoveryAction.BIND}:
            counts["matched"] += 1
        elif item.action is DiscoveryAction.REMAP:
            counts["review"] += 1
        else:
            counts["missing"] += 1
        resources.append(
            {
                "key": item.blueprint.key.value,
                "kind": item.blueprint.kind.value,
                "canonical_name": item.blueprint.name,
                "action": item.action.value,
                "target": (
                    {"id": _id(target.id), "name": target.name} if target is not None else None
                ),
                "current": (
                    {"id": _id(current.id), "name": current.name} if current is not None else None
                ),
            }
        )

    solved = {
        "action": plan.solved_tag.action.value,
        "tag": (
            {"id": _id(plan.solved_tag.tag.id), "name": plan.solved_tag.tag.name}
            if plan.solved_tag.tag is not None
            else None
        ),
        "forum_id": _id(plan.solved_tag.forum.id) if plan.solved_tag.forum is not None else None,
    }
    if plan.solved_tag.action in {DiscoveryAction.REMAP, DiscoveryAction.CREATE}:
        counts["review"] += 1
    elif plan.solved_tag.action is DiscoveryAction.BIND:
        counts["matched"] += 1

    canonical = {"resources": resources, "solved_tag": solved}
    plan_hash = hashlib.sha256(
        json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return {
        **canonical,
        "plan_hash": plan_hash,
        "counts": counts,
        "needs_confirmation": plan.needs_second_confirmation,
    }


class GuildSnapshotBuilder:
    def __init__(
        self,
        *,
        resources: ResourceService,
        features: FeatureConfigService,
        tickets: TicketService,
        ai_sources: SQLAlchemyAIUpdatesRepository,
        control: SQLAlchemyControlRepository,
        provisioner: AutoSetupService,
        settings: Settings,
    ) -> None:
        self.resources = resources
        self.features = features
        self.tickets = tickets
        self.ai_sources = ai_sources
        self.control = control
        self.provisioner = provisioner
        self.settings = settings

    async def _load_features(self, guild_id: int) -> list[FeatureConfigRecord]:
        return list(
            await asyncio.gather(
                *(self.features.get(guild_id, feature) for feature in FeatureName)
            )
        )

    async def build(self, guild: discord.Guild) -> dict[str, Any]:
        resource_records, loaded_features, ticket_types, sources, panel = await asyncio.gather(
            self.resources.list_for_guild(guild.id),
            self._load_features(guild.id),
            self.tickets.list_types(guild.id, enabled_only=False),
            self.ai_sources.list_sources(guild.id),
            self.control.get_notification_panel(guild.id),
        )

        resource_by_key = {record.key: record for record in resource_records}
        resources = []
        for key in ResourceKey:
            resource_record = resource_by_key.get(key)
            resolved = (
                _resource_value(guild, key, resource_record.discord_id)
                if resource_record is not None
                else {"id": None, "name": None, "exists": False, "kind": None}
            )
            resources.append(
                {
                    "key": key.value,
                    "resource_type": (
                        resource_record.resource_type.value if resource_record is not None else None
                    ),
                    "updated_by": (
                        _id(resource_record.updated_by) if resource_record is not None else None
                    ),
                    **resolved,
                }
            )

        feature_rows = []
        feature_records: dict[FeatureName, dict[str, Any]] = {}
        for feature_record in loaded_features:
            feature_records[feature_record.feature] = dict(feature_record.config)
            feature_rows.append(
                {
                    "name": feature_record.feature.value,
                    "enabled": feature_record.enabled,
                    "config": dict(feature_record.config),
                }
            )

        cached_resources = ResourceService(_SnapshotResourceRepository(resource_records))
        cached_provisioner = AutoSetupService(cached_resources)
        setup = serialize_setup_plan(await cached_provisioner.discover(guild))

        reputation_config = feature_records[FeatureName.REPUTATION]
        thresholds_raw = reputation_config.get("thresholds", {})
        thresholds = {
            name: int(thresholds_raw.get(name, default))
            for name, default in _DEFAULT_THRESHOLDS.items()
        }
        quiz_config = feature_records[FeatureName.QUIZZES]
        message_log_config = feature_records[FeatureName.MESSAGE_LOGS]

        bot_member = guild.me
        bot_permissions = (
            bot_member.guild_permissions if bot_member is not None else discord.Permissions.none()
        )
        channels = [
            {
                "id": _id(channel.id),
                "name": channel.name,
                "kind": _channel_kind(channel),
                "category_id": _id(getattr(channel, "category_id", None)),
            }
            for channel in guild.channels
            if isinstance(
                channel,
                (
                    discord.TextChannel,
                    discord.VoiceChannel,
                    discord.ForumChannel,
                    discord.CategoryChannel,
                ),
            )
        ]
        roles = [
            {
                "id": _id(role.id),
                "name": role.name,
                "position": role.position,
                "managed": role.managed,
                "mentionable": role.mentionable,
            }
            for role in guild.roles
            if not role.is_default()
        ]
        members = [
            {"id": _id(member.id), "name": member.display_name}
            for member in guild.members
            if not member.bot
        ]

        return {
            "guild": {
                "id": _id(guild.id),
                "name": guild.name,
                "icon_url": str(guild.icon.url) if guild.icon is not None else None,
                "owner_id": _id(guild.owner_id),
                "community": "COMMUNITY" in guild.features,
            },
            "bot": {
                "online": True,
                "user_id": _id(bot_member.id) if bot_member is not None else None,
                "permissions": {
                    "administrator": bot_permissions.administrator,
                    "manage_guild": bot_permissions.manage_guild,
                    "manage_channels": bot_permissions.manage_channels,
                    "manage_roles": bot_permissions.manage_roles,
                    "send_messages": bot_permissions.send_messages,
                    "embed_links": bot_permissions.embed_links,
                    "mention_everyone": bot_permissions.mention_everyone,
                },
                "top_role_position": bot_member.top_role.position if bot_member is not None else 0,
            },
            "setup": setup,
            "resources": resources,
            "features": feature_rows,
            "channels": channels,
            "roles": roles,
            "members": members,
            "member_directory_complete": guild.chunked,
            "ticket_types": [
                {
                    "key": item.key,
                    "label": item.label,
                    "description": item.description,
                    "enabled": item.enabled,
                }
                for item in ticket_types
            ],
            "reputation": {"thresholds": thresholds},
            "quiz": {
                "interval_hours": quiz_config.get("interval_hours"),
                "last_posted_at": quiz_config.get("last_posted_at"),
            },
            "ai_sources": [
                {
                    "id": item.id,
                    "name": item.name,
                    "url": item.url,
                    "category": item.category,
                    "enabled": item.enabled,
                    "last_checked_at": (
                        item.last_checked_at.isoformat()
                        if item.last_checked_at is not None
                        else None
                    ),
                }
                for item in sources
            ],
            "log_exclusions": [
                str(item) for item in message_log_config.get("ignored_channel_ids", [])
            ],
            "notification_panel": (
                {
                    "channel_id": _id(panel.channel_id),
                    "message_id": _id(panel.message_id),
                    "title": panel.title,
                    "description": panel.description,
                    "buttons": [
                        {
                            "role_id": _id(item.role_id),
                            "label": item.label,
                            "emoji": item.emoji or "",
                            "style": item.style,
                        }
                        for item in panel.buttons
                    ],
                }
                if panel is not None
                else None
            ),
            "advanced": {
                "environment": self.settings.environment,
                "database_backend": "postgresql"
                if self.settings.database_url.strip().startswith(("postgres://", "postgresql://"))
                else "sqlite",
                "background_tasks": self.settings.enable_background_tasks,
                "message_content": self.settings.enable_message_content,
                "tiktok_url_configured": self.settings.mar_wie_tiktok_url is not None,
            },
        }
