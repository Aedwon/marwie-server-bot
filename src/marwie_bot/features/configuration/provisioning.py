from __future__ import annotations

import logging
from collections.abc import Collection
from dataclasses import dataclass
from enum import StrEnum

import discord

from marwie_bot.config.resources import RESOURCE_TYPES, ResourceKey, ResourceType
from marwie_bot.features.configuration.service import ResourceService
from marwie_bot.shared.errors import UserFacingCommandError, describe_discord_failure

logger = logging.getLogger(__name__)

_COMMUNITY_REQUIRED_MESSAGE = (
    "Automatic setup requires Discord Community to be enabled because Rob-bot uses the "
    "`build-help` and `showcase` Forum Channels. Enable Community in Server Settings, then run "
    "`/setup auto` again. No setup changes were made."
)


class ProvisionKind(StrEnum):
    TEXT = "text"
    VOICE = "voice"
    FORUM = "forum"
    CATEGORY = "category"
    ROLE = "role"


class ProvisionAction(StrEnum):
    KEPT = "kept"
    ADOPTED = "adopted"
    CREATED = "created"


@dataclass(frozen=True, slots=True)
class ResourceBlueprint:
    key: ResourceKey
    kind: ProvisionKind
    name: str
    category_key: ResourceKey | None = None
    private: bool = False


@dataclass(frozen=True, slots=True)
class ProvisionResult:
    key: ResourceKey
    action: ProvisionAction
    name: str
    discord_id: int


AUTO_SETUP_RESOURCES: tuple[ResourceBlueprint, ...] = (
    ResourceBlueprint(ResourceKey.TICKET_CATEGORY, ProvisionKind.CATEGORY, "TICKETS", private=True),
    ResourceBlueprint(ResourceKey.TEMP_VOICE_CATEGORY, ProvisionKind.CATEGORY, "WORKSPACES"),
    ResourceBlueprint(ResourceKey.MODERATION_LOG, ProvisionKind.TEXT, "moderation-log", private=True),
    ResourceBlueprint(ResourceKey.MESSAGE_LOG, ProvisionKind.TEXT, "bot-logs", private=True),
    ResourceBlueprint(ResourceKey.BOT_LOG, ProvisionKind.TEXT, "bot-logs", private=True),
    ResourceBlueprint(ResourceKey.TICKET_PANEL, ProvisionKind.TEXT, "ticket"),
    ResourceBlueprint(ResourceKey.TICKET_LOGS, ProvisionKind.TEXT, "ticket-logs", private=True),
    ResourceBlueprint(
        ResourceKey.CREATE_WORKSPACE_VOICE,
        ProvisionKind.VOICE,
        "Create Workspace",
        category_key=ResourceKey.TEMP_VOICE_CATEGORY,
    ),
    ResourceBlueprint(
        ResourceKey.COWORKING_LOUNGE,
        ProvisionKind.VOICE,
        "Coworking Lounge",
        category_key=ResourceKey.TEMP_VOICE_CATEGORY,
    ),
    ResourceBlueprint(ResourceKey.ANNOUNCEMENTS, ProvisionKind.TEXT, "announcements"),
    ResourceBlueprint(ResourceKey.LIVE_ANNOUNCEMENTS, ProvisionKind.TEXT, "live-announcements"),
    ResourceBlueprint(ResourceKey.ROLE_PANEL, ProvisionKind.TEXT, "roles"),
    ResourceBlueprint(ResourceKey.AI_UPDATES, ProvisionKind.TEXT, "ai-updates"),
    ResourceBlueprint(ResourceKey.BUILD_HELP_FORUM, ProvisionKind.FORUM, "build-help"),
    ResourceBlueprint(ResourceKey.QUIZ_CHANNEL, ProvisionKind.TEXT, "quizzes"),
    ResourceBlueprint(ResourceKey.ANON_QUESTIONS, ProvisionKind.TEXT, "anonymous-questions"),
    ResourceBlueprint(ResourceKey.ANALYTICS, ProvisionKind.TEXT, "analytics", private=True),
    ResourceBlueprint(ResourceKey.SHOWCASE_FORUM, ProvisionKind.FORUM, "showcase"),
    ResourceBlueprint(ResourceKey.APP_OF_WEEK, ProvisionKind.TEXT, "app-of-the-week"),
    ResourceBlueprint(ResourceKey.COLLAB_LFG, ProvisionKind.TEXT, "collab-lfg"),
    ResourceBlueprint(ResourceKey.BUILDER_ROLE, ProvisionKind.ROLE, "Builder"),
    ResourceBlueprint(ResourceKey.CONTRIBUTOR_ROLE, ProvisionKind.ROLE, "Contributor"),
    ResourceBlueprint(ResourceKey.MENTOR_ROLE, ProvisionKind.ROLE, "Mentor"),
    ResourceBlueprint(ResourceKey.LIVE_PING_ROLE, ProvisionKind.ROLE, "Live Notifications"),
)

type DiscordResource = (
    discord.TextChannel
    | discord.VoiceChannel
    | discord.ForumChannel
    | discord.CategoryChannel
    | discord.Role
)


def require_auto_setup_community(features: Collection[str]) -> None:
    if "COMMUNITY" not in features:
        raise UserFacingCommandError(_COMMUNITY_REQUIRED_MESSAGE)


class AutoSetupService:
    def __init__(self, resources: ResourceService) -> None:
        self.resources = resources

    async def ensure(self, guild: discord.Guild, actor_id: int) -> list[ProvisionResult]:
        require_auto_setup_community(guild.features)

        ensured: dict[ResourceKey, DiscordResource] = {}
        results: list[ProvisionResult] = []

        for blueprint in AUTO_SETUP_RESOURCES:
            logger.info(
                "Auto setup ensuring resource guild_id=%s key=%s kind=%s",
                guild.id,
                blueprint.key.value,
                blueprint.kind.value,
            )
            try:
                resource, action = await self._ensure_resource(guild, blueprint, ensured)
                ensured[blueprint.key] = resource
                await self.resources.set_resource(
                    guild.id,
                    blueprint.key,
                    RESOURCE_TYPES[blueprint.key],
                    resource.id,
                    actor_id,
                )
            except discord.HTTPException as error:
                logger.exception(
                    "Auto setup Discord failure guild_id=%s key=%s",
                    guild.id,
                    blueprint.key.value,
                )
                message = describe_discord_failure(
                    f"Could not configure `{blueprint.key.value}`",
                    error,
                )
                raise UserFacingCommandError(
                    f"{message} Setup stopped; resources configured earlier in this run are safe "
                    "to reuse when you run `/setup auto` again."
                ) from error

            logger.info(
                "Auto setup resolved resource guild_id=%s key=%s action=%s discord_id=%s",
                guild.id,
                blueprint.key.value,
                action.value,
                resource.id,
            )
            results.append(
                ProvisionResult(
                    key=blueprint.key,
                    action=action,
                    name=resource.name,
                    discord_id=resource.id,
                )
            )

        logger.info("Auto setup ensuring resource guild_id=%s key=solved_tag", guild.id)
        try:
            solved = await self._ensure_solved_tag(guild, actor_id, ensured)
        except discord.HTTPException as error:
            logger.exception("Auto setup Discord failure guild_id=%s key=solved_tag", guild.id)
            message = describe_discord_failure("Could not configure `solved_tag`", error)
            raise UserFacingCommandError(
                f"{message} Setup stopped; resources configured earlier in this run are safe "
                "to reuse when you run `/setup auto` again."
            ) from error
        except RuntimeError as error:
            logger.exception("Auto setup internal failure guild_id=%s key=solved_tag", guild.id)
            raise UserFacingCommandError(
                "Could not finish configuring `solved_tag`. Earlier setup changes are safe to "
                "reuse when you run `/setup auto` again."
            ) from error

        logger.info(
            "Auto setup resolved resource guild_id=%s key=solved_tag action=%s discord_id=%s",
            guild.id,
            solved.action.value,
            solved.discord_id,
        )
        results.append(solved)
        return results

    async def _ensure_resource(
        self,
        guild: discord.Guild,
        blueprint: ResourceBlueprint,
        ensured: dict[ResourceKey, DiscordResource],
    ) -> tuple[DiscordResource, ProvisionAction]:
        configured = await self.resources.get(guild.id, blueprint.key)
        if configured is not None:
            current = self._get_by_id(guild, blueprint.kind, configured.discord_id)
            if current is not None:
                return current, ProvisionAction.KEPT

        same_run = next(
            (
                resource
                for resource in ensured.values()
                if self._matches_kind(resource, blueprint.kind)
                and resource.name.casefold() == blueprint.name.casefold()
            ),
            None,
        )
        if same_run is not None:
            return same_run, ProvisionAction.ADOPTED

        matching = self._find_by_name(guild, blueprint.kind, blueprint.name)
        if matching is not None:
            return matching, ProvisionAction.ADOPTED

        created = await self._create(guild, blueprint, ensured)
        return created, ProvisionAction.CREATED

    def _matches_kind(self, resource: DiscordResource, kind: ProvisionKind) -> bool:
        return (
            (kind == ProvisionKind.TEXT and isinstance(resource, discord.TextChannel))
            or (kind == ProvisionKind.VOICE and isinstance(resource, discord.VoiceChannel))
            or (kind == ProvisionKind.FORUM and isinstance(resource, discord.ForumChannel))
            or (kind == ProvisionKind.CATEGORY and isinstance(resource, discord.CategoryChannel))
            or (kind == ProvisionKind.ROLE and isinstance(resource, discord.Role))
        )

    def _get_by_id(
        self, guild: discord.Guild, kind: ProvisionKind, discord_id: int
    ) -> DiscordResource | None:
        if kind == ProvisionKind.ROLE:
            role = guild.get_role(discord_id)
            if role is not None and not role.is_default():
                return role
            return None

        channel = guild.get_channel(discord_id)
        if isinstance(
            channel,
            (discord.TextChannel, discord.VoiceChannel, discord.ForumChannel, discord.CategoryChannel),
        ) and self._matches_kind(channel, kind):
            return channel
        return None

    def _find_by_name(
        self, guild: discord.Guild, kind: ProvisionKind, name: str
    ) -> DiscordResource | None:
        wanted = name.casefold()
        if kind == ProvisionKind.ROLE:
            return next(
                (
                    role
                    for role in guild.roles
                    if not role.is_default() and role.name.casefold() == wanted
                ),
                None,
            )

        for channel in guild.channels:
            if not isinstance(
                channel,
                (
                    discord.TextChannel,
                    discord.VoiceChannel,
                    discord.ForumChannel,
                    discord.CategoryChannel,
                ),
            ):
                continue
            if channel.name.casefold() == wanted and self._matches_kind(channel, kind):
                return channel
        return None

    async def _create(
        self,
        guild: discord.Guild,
        blueprint: ResourceBlueprint,
        ensured: dict[ResourceKey, DiscordResource],
    ) -> DiscordResource:
        reason = f"Rob-bot auto setup: {blueprint.key.value}"
        category: discord.CategoryChannel | None = None
        if blueprint.category_key is not None:
            possible_category = ensured.get(blueprint.category_key)
            if isinstance(possible_category, discord.CategoryChannel):
                category = possible_category

        overwrites = self._private_overwrites(guild) if blueprint.private else None

        if blueprint.kind == ProvisionKind.CATEGORY:
            return await guild.create_category(
                blueprint.name,
                overwrites=overwrites,
                reason=reason,
            )
        if blueprint.kind == ProvisionKind.TEXT:
            return await guild.create_text_channel(
                blueprint.name,
                category=category,
                overwrites=overwrites,
                reason=reason,
            )
        if blueprint.kind == ProvisionKind.VOICE:
            return await guild.create_voice_channel(
                blueprint.name,
                category=category,
                reason=reason,
            )
        if blueprint.kind == ProvisionKind.FORUM:
            return await guild.create_forum(
                blueprint.name,
                category=category,
                overwrites=overwrites,
                reason=reason,
            )
        if blueprint.kind == ProvisionKind.ROLE:
            return await guild.create_role(
                name=blueprint.name,
                mentionable=False,
                reason=reason,
            )
        raise ValueError(f"Unsupported setup resource kind: {blueprint.kind}")

    def _private_overwrites(
        self, guild: discord.Guild
    ) -> dict[discord.Role | discord.Member, discord.PermissionOverwrite]:
        overwrites: dict[discord.Role | discord.Member, discord.PermissionOverwrite] = {
            guild.default_role: discord.PermissionOverwrite(view_channel=False)
        }
        bot_member = guild.me
        if bot_member is not None:
            overwrites[bot_member] = discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                read_message_history=True,
                manage_channels=True,
            )
        return overwrites

    async def _ensure_solved_tag(
        self,
        guild: discord.Guild,
        actor_id: int,
        ensured: dict[ResourceKey, DiscordResource],
    ) -> ProvisionResult:
        forum_resource = ensured.get(ResourceKey.BUILD_HELP_FORUM)
        if not isinstance(forum_resource, discord.ForumChannel):
            raise RuntimeError("Auto setup did not resolve the build-help forum")
        forum = forum_resource

        configured = await self.resources.get(guild.id, ResourceKey.SOLVED_TAG)
        if configured is not None:
            current = next(
                (tag for tag in forum.available_tags if tag.id == configured.discord_id),
                None,
            )
            if current is not None:
                await self.resources.set_resource(
                    guild.id,
                    ResourceKey.SOLVED_TAG,
                    ResourceType.FORUM_TAG,
                    current.id,
                    actor_id,
                )
                return ProvisionResult(
                    ResourceKey.SOLVED_TAG,
                    ProvisionAction.KEPT,
                    current.name,
                    current.id,
                )

        existing = next(
            (tag for tag in forum.available_tags if tag.name.casefold() == "solved"),
            None,
        )
        action = ProvisionAction.ADOPTED
        if existing is None:
            updated_forum = await forum.edit(
                available_tags=[*forum.available_tags, discord.ForumTag(name="Solved")],
                reason="Rob-bot auto setup: solved_tag",
            )
            existing = next(
                (tag for tag in updated_forum.available_tags if tag.name.casefold() == "solved"),
                None,
            )
            action = ProvisionAction.CREATED

        if existing is None:
            raise RuntimeError("Discord did not return the Solved forum tag after creating it")

        await self.resources.set_resource(
            guild.id,
            ResourceKey.SOLVED_TAG,
            ResourceType.FORUM_TAG,
            existing.id,
            actor_id,
        )
        return ProvisionResult(
            ResourceKey.SOLVED_TAG,
            action,
            existing.name,
            existing.id,
        )
