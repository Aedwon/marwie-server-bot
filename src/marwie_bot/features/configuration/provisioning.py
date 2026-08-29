from __future__ import annotations

import logging
from collections.abc import Collection
from dataclasses import dataclass
from enum import StrEnum

import discord

from marwie_bot.config.resources import RESOURCE_TYPES, ResourceKey
from marwie_bot.features.configuration.service import ResourceService
from marwie_bot.shared.errors import UserFacingCommandError, describe_discord_failure

logger = logging.getLogger(__name__)

_COMMUNITY_REQUIRED_MESSAGE = (
    "The approved setup plan needs to create a Discord Forum Channel, which requires Community "
    "to be enabled. Enable Community in Server Settings, then run `/setup auto` again. No "
    "Discord resources from this mutation plan were created."
)


class ProvisionKind(StrEnum):
    TEXT = "text"
    VOICE = "voice"
    FORUM = "forum"
    CATEGORY = "category"
    ROLE = "role"


class ProvisionAction(StrEnum):
    KEPT = "kept"
    ADOPTED = "connected"
    REMAPPED = "remapped"
    CREATED = "created"


class DiscoveryAction(StrEnum):
    KEEP = "keep"
    BIND = "bind"
    REMAP = "remap"
    CREATE = "create"


@dataclass(frozen=True, slots=True)
class ResourceBlueprint:
    key: ResourceKey
    kind: ProvisionKind
    name: str
    aliases: tuple[str, ...] = ()
    category_key: ResourceKey | None = None
    private: bool = False


@dataclass(frozen=True, slots=True)
class ProvisionResult:
    key: ResourceKey
    action: ProvisionAction
    name: str
    discord_id: int


type DiscordResource = (
    discord.TextChannel
    | discord.VoiceChannel
    | discord.ForumChannel
    | discord.CategoryChannel
    | discord.Role
)


@dataclass(frozen=True, slots=True)
class ResourceDiscovery:
    blueprint: ResourceBlueprint
    action: DiscoveryAction
    target: DiscordResource | None
    current: DiscordResource | None


@dataclass(frozen=True, slots=True)
class AutoSetupPlan:
    resources: tuple[ResourceDiscovery, ...]

    @property
    def resource_mutations(self) -> tuple[ResourceDiscovery, ...]:
        return tuple(
            item
            for item in self.resources
            if item.action in {DiscoveryAction.REMAP, DiscoveryAction.CREATE}
        )

    @property
    def needs_second_confirmation(self) -> bool:
        return bool(self.resource_mutations)


AUTO_SETUP_RESOURCES: tuple[ResourceBlueprint, ...] = (
    ResourceBlueprint(
        ResourceKey.TICKET_CATEGORY,
        ProvisionKind.CATEGORY,
        "TICKETS",
        private=True,
    ),
    ResourceBlueprint(
        ResourceKey.TEMP_VOICE_CATEGORY,
        ProvisionKind.CATEGORY,
        "WORKSPACES",
        aliases=("co-working-space", "coworking-space"),
    ),
    ResourceBlueprint(
        ResourceKey.MODERATION_LOG,
        ProvisionKind.TEXT,
        "moderation-log",
        private=True,
    ),
    ResourceBlueprint(ResourceKey.MESSAGE_LOG, ProvisionKind.TEXT, "bot-logs", private=True),
    ResourceBlueprint(ResourceKey.BOT_LOG, ProvisionKind.TEXT, "bot-logs", private=True),
    ResourceBlueprint(
        ResourceKey.TICKET_PANEL,
        ProvisionKind.TEXT,
        "ticket",
        aliases=("tickets",),
    ),
    ResourceBlueprint(ResourceKey.TICKET_LOGS, ProvisionKind.TEXT, "ticket-logs", private=True),
    ResourceBlueprint(
        ResourceKey.CREATE_WORKSPACE_VOICE,
        ProvisionKind.VOICE,
        "Create Workspace",
        aliases=("create-vc",),
        category_key=ResourceKey.TEMP_VOICE_CATEGORY,
    ),
    ResourceBlueprint(
        ResourceKey.COWORKING_LOUNGE,
        ProvisionKind.VOICE,
        "Coworking Lounge",
        aliases=("coworking",),
        category_key=ResourceKey.TEMP_VOICE_CATEGORY,
    ),
    ResourceBlueprint(ResourceKey.ANNOUNCEMENTS, ProvisionKind.TEXT, "announcements"),
    ResourceBlueprint(
        ResourceKey.LIVE_ANNOUNCEMENTS,
        ProvisionKind.TEXT,
        "live-announcements",
        aliases=("live",),
    ),
    ResourceBlueprint(ResourceKey.ROLE_PANEL, ProvisionKind.TEXT, "roles"),
    ResourceBlueprint(ResourceKey.AI_UPDATES, ProvisionKind.TEXT, "ai-updates"),
    ResourceBlueprint(
        ResourceKey.QUIZ_CHANNEL,
        ProvisionKind.TEXT,
        "quizzes",
        aliases=("quiz",),
    ),
    ResourceBlueprint(
        ResourceKey.ANON_QUESTIONS,
        ProvisionKind.TEXT,
        "anonymous-questions",
        aliases=("anonymous",),
    ),
    ResourceBlueprint(ResourceKey.ANALYTICS, ProvisionKind.TEXT, "analytics", private=True),
    ResourceBlueprint(ResourceKey.SHOWCASE_FORUM, ProvisionKind.FORUM, "showcase"),
    ResourceBlueprint(ResourceKey.APP_OF_WEEK, ProvisionKind.TEXT, "app-of-the-week"),
    ResourceBlueprint(ResourceKey.COLLAB_LFG, ProvisionKind.TEXT, "collab-lfg"),
    ResourceBlueprint(ResourceKey.BUILDER_ROLE, ProvisionKind.ROLE, "Builder"),
    ResourceBlueprint(ResourceKey.CONTRIBUTOR_ROLE, ProvisionKind.ROLE, "Contributor"),
    ResourceBlueprint(ResourceKey.MENTOR_ROLE, ProvisionKind.ROLE, "Mentor"),
    ResourceBlueprint(
        ResourceKey.LIVE_PING_ROLE,
        ProvisionKind.ROLE,
        "Live Notifications",
        aliases=("live-notifications", "live-ping"),
    ),
)


def normalize_resource_name(name: str) -> str:
    folded = name.casefold()
    separated = "".join(character if character.isalnum() else " " for character in folded)
    return "-".join(separated.split())


def blueprint_names(blueprint: ResourceBlueprint) -> frozenset[str]:
    return frozenset(normalize_resource_name(name) for name in (blueprint.name, *blueprint.aliases))


def resource_name_matches(name: str, blueprint: ResourceBlueprint) -> bool:
    return normalize_resource_name(name) in blueprint_names(blueprint)


def require_auto_setup_community(features: Collection[str]) -> None:
    if "COMMUNITY" not in features:
        raise UserFacingCommandError(_COMMUNITY_REQUIRED_MESSAGE)


class AutoSetupService:
    def __init__(self, resources: ResourceService) -> None:
        self.resources = resources

    async def discover(self, guild: discord.Guild) -> AutoSetupPlan:
        discoveries: list[ResourceDiscovery] = []

        for blueprint in AUTO_SETUP_RESOURCES:
            configured = await self.resources.get(guild.id, blueprint.key)
            current = (
                self._get_by_id(guild, blueprint.kind, configured.discord_id)
                if configured is not None
                else None
            )
            matches = self._find_matches(guild, blueprint)
            target = min(matches, key=lambda resource: resource.id) if matches else None

            if current is not None and not resource_name_matches(current.name, blueprint):
                discoveries.append(
                    ResourceDiscovery(blueprint, DiscoveryAction.KEEP, current, current)
                )
                continue

            if target is None:
                if current is not None:
                    discoveries.append(
                        ResourceDiscovery(blueprint, DiscoveryAction.KEEP, current, current)
                    )
                else:
                    discoveries.append(
                        ResourceDiscovery(blueprint, DiscoveryAction.CREATE, None, None)
                    )
                continue

            if current is None:
                discoveries.append(ResourceDiscovery(blueprint, DiscoveryAction.BIND, target, None))
            elif current.id == target.id:
                discoveries.append(
                    ResourceDiscovery(blueprint, DiscoveryAction.KEEP, current, current)
                )
            else:
                discoveries.append(
                    ResourceDiscovery(blueprint, DiscoveryAction.REMAP, target, current)
                )

        return AutoSetupPlan(tuple(discoveries))

    async def connect_existing(
        self,
        guild: discord.Guild,
        actor_id: int,
        plan: AutoSetupPlan,
    ) -> list[ProvisionResult]:
        results: list[ProvisionResult] = []
        for discovery in plan.resources:
            if discovery.action != DiscoveryAction.BIND or discovery.target is None:
                continue
            await self.resources.set_resource(
                guild.id,
                discovery.blueprint.key,
                RESOURCE_TYPES[discovery.blueprint.key],
                discovery.target.id,
                actor_id,
            )
            results.append(
                ProvisionResult(
                    discovery.blueprint.key,
                    ProvisionAction.ADOPTED,
                    discovery.target.name,
                    discovery.target.id,
                )
            )

        return results

    async def apply_mutations(
        self,
        guild: discord.Guild,
        actor_id: int,
        plan: AutoSetupPlan,
    ) -> list[ProvisionResult]:
        if any(
            item.action == DiscoveryAction.CREATE and item.blueprint.kind == ProvisionKind.FORUM
            for item in plan.resources
        ):
            require_auto_setup_community(guild.features)

        ensured: dict[ResourceKey, DiscordResource] = {}
        results: list[ProvisionResult] = []

        for discovery in plan.resources:
            blueprint = discovery.blueprint
            if discovery.action in {DiscoveryAction.KEEP, DiscoveryAction.BIND}:
                resource = discovery.target or discovery.current
                if resource is not None:
                    ensured[blueprint.key] = resource
                continue

            if discovery.action == DiscoveryAction.REMAP:
                if discovery.target is None:
                    raise RuntimeError(f"Missing remap target for {blueprint.key.value}")
                await self.resources.set_resource(
                    guild.id,
                    blueprint.key,
                    RESOURCE_TYPES[blueprint.key],
                    discovery.target.id,
                    actor_id,
                )
                ensured[blueprint.key] = discovery.target
                results.append(
                    ProvisionResult(
                        blueprint.key,
                        ProvisionAction.REMAPPED,
                        discovery.target.name,
                        discovery.target.id,
                    )
                )
                continue

            try:
                existing = self._find_ensured_match(blueprint, ensured)
                if existing is None:
                    matches = self._find_matches(guild, blueprint)
                    existing = min(matches, key=lambda resource: resource.id) if matches else None
                if existing is not None:
                    resource = existing
                    action = ProvisionAction.ADOPTED
                else:
                    resource = await self._create(guild, blueprint, ensured)
                    action = ProvisionAction.CREATED
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
                raise UserFacingCommandError(
                    describe_discord_failure(f"Could not configure `{blueprint.key.value}`", error)
                ) from error

            ensured[blueprint.key] = resource
            results.append(ProvisionResult(blueprint.key, action, resource.name, resource.id))

        return results

    def _find_matches(
        self,
        guild: discord.Guild,
        blueprint: ResourceBlueprint,
    ) -> list[DiscordResource]:
        if blueprint.kind == ProvisionKind.ROLE:
            return [
                role
                for role in guild.roles
                if not role.is_default()
                and resource_name_matches(role.name, blueprint)
                and self._matches_kind(role, blueprint.kind)
            ]

        matches: list[DiscordResource] = []
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
            if self._matches_kind(channel, blueprint.kind) and resource_name_matches(
                channel.name, blueprint
            ):
                matches.append(channel)
        return matches

    def _find_ensured_match(
        self,
        blueprint: ResourceBlueprint,
        ensured: dict[ResourceKey, DiscordResource],
    ) -> DiscordResource | None:
        candidates = [
            resource
            for resource in ensured.values()
            if self._matches_kind(resource, blueprint.kind)
            and resource_name_matches(resource.name, blueprint)
        ]
        return min(candidates, key=lambda resource: resource.id) if candidates else None

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
            (
                discord.TextChannel,
                discord.VoiceChannel,
                discord.ForumChannel,
                discord.CategoryChannel,
            ),
        ) and self._matches_kind(channel, kind):
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

        overwrites: dict[
            discord.Role | discord.Member | discord.Object,
            discord.PermissionOverwrite,
        ] = self._private_overwrites(guild) if blueprint.private else {}

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
    ) -> dict[
        discord.Role | discord.Member | discord.Object,
        discord.PermissionOverwrite,
    ]:
        overwrites: dict[
            discord.Role | discord.Member | discord.Object,
            discord.PermissionOverwrite,
        ] = {guild.default_role: discord.PermissionOverwrite(view_channel=False)}
        bot_member = guild.me
        if bot_member is not None:
            overwrites[bot_member] = discord.PermissionOverwrite(
                view_channel=True,
                send_messages=True,
                read_message_history=True,
                manage_channels=True,
            )
        return overwrites
