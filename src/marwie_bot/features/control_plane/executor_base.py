from __future__ import annotations

import logging
from typing import Any, Protocol, cast

import discord
from discord.ext import commands

from marwie_bot.config.resources import RESOURCE_TYPES, FeatureName, ResourceKey
from marwie_bot.config.settings import Settings
from marwie_bot.features.ai_updates.cog import AIUpdatesCog
from marwie_bot.features.ai_updates.repository import SQLAlchemyAIUpdatesRepository
from marwie_bot.features.configuration.provisioning import (
    AUTO_SETUP_RESOURCES,
    AutoSetupService,
    ProvisionKind,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService
from marwie_bot.features.control_plane.domain import ControlActionRecord, ControlActionType
from marwie_bot.features.control_plane.mappings import scoped_mapping_plan, serialize_mapping_review
from marwie_bot.features.control_plane.notification_panel import upsert_notification_panel
from marwie_bot.features.control_plane.repository import SQLAlchemyControlRepository
from marwie_bot.features.control_plane.snapshot import serialize_setup_plan
from marwie_bot.features.control_plane.validation import (
    ActionPermission,
    required_permission,
    validate_action_payload,
)
from marwie_bot.features.live_announcements.render import build_live_embed, build_live_view
from marwie_bot.features.live_announcements.service import LiveAnnouncementService
from marwie_bot.features.quizzes.service import QuizService
from marwie_bot.features.reputation.service import ReputationService
from marwie_bot.features.tickets.service import TicketService
from marwie_bot.features.tickets.views import TicketPanelView

logger = logging.getLogger(__name__)

_DEFAULT_THRESHOLDS = {"builder": 50, "contributor": 150, "mentor": 500}
_ROLE_KEYS = {
    "builder": ResourceKey.BUILDER_ROLE,
    "contributor": ResourceKey.CONTRIBUTOR_ROLE,
    "mentor": ResourceKey.MENTOR_ROLE,
}


class ActionRejected(ValueError):
    """A safe operator-facing rejection of a queued browser action."""


class ReputationRoleSync(Protocol):
    async def _sync_roles(self, member: discord.Member, points: int) -> None: ...


def _blueprint_kind(key: ResourceKey) -> ProvisionKind | None:
    blueprint = next((item for item in AUTO_SETUP_RESOURCES if item.key is key), None)
    return blueprint.kind if blueprint is not None else None


def _discord_resource(guild: discord.Guild, key: ResourceKey, discord_id: int) -> Any:
    if key is ResourceKey.SOLVED_TAG:
        for forum in guild.forums:
            tag = next((item for item in forum.available_tags if item.id == discord_id), None)
            if tag is not None:
                return tag
        return None
    kind = _blueprint_kind(key)
    if kind is ProvisionKind.ROLE:
        return guild.get_role(discord_id)
    return guild.get_channel(discord_id)


def _resource_matches_key(key: ResourceKey, resource: Any) -> bool:
    if key is ResourceKey.SOLVED_TAG:
        return isinstance(resource, discord.ForumTag)
    kind = _blueprint_kind(key)
    if kind is ProvisionKind.ROLE:
        return isinstance(resource, discord.Role) and not resource.is_default()
    if kind is ProvisionKind.CATEGORY:
        return isinstance(resource, discord.CategoryChannel)
    if kind is ProvisionKind.VOICE:
        return isinstance(resource, discord.VoiceChannel)
    if kind is ProvisionKind.FORUM:
        return isinstance(resource, discord.ForumChannel)
    if kind is ProvisionKind.TEXT:
        return isinstance(resource, discord.TextChannel)
    return resource is not None


class ControlActionExecutor:
    def __init__(
        self,
        *,
        bot: commands.Bot,
        settings: Settings,
        resources: ResourceService,
        features: FeatureConfigService,
        provisioner: AutoSetupService,
        tickets: TicketService,
        reputation: ReputationService,
        quizzes: QuizService,
        ai_sources: SQLAlchemyAIUpdatesRepository,
        control: SQLAlchemyControlRepository,
    ) -> None:
        self.bot = bot
        self.settings = settings
        self.resources = resources
        self.features = features
        self.provisioner = provisioner
        self.tickets = tickets
        self.reputation = reputation
        self.quizzes = quizzes
        self.ai_sources = ai_sources
        self.control = control

    async def execute(self, action: ControlActionRecord) -> dict[str, Any]:
        guild = self.bot.get_guild(action.guild_id)
        if guild is None:
            raise ActionRejected("Rob-bot is no longer connected to that server.")
        actor = await self._actor(guild, action.actor_id)
        self._require_actor_permission(actor, action.action_type)
        payload = validate_action_payload(action.action_type, action.payload)

        match action.action_type:
            case ControlActionType.SET_RESOURCE:
                return await self._set_resource(guild, actor, payload)
            case ControlActionType.CLEAR_RESOURCE:
                key = ResourceKey(str(payload["key"]))
                changed = await self.resources.clear(guild.id, key)
                return {"key": key.value, "cleared": changed}
            case ControlActionType.APPLY_AUTO_SETUP:
                return await self._apply_auto_setup(guild, actor, payload)
            case ControlActionType.APPLY_MAPPING_SUGGESTIONS:
                return await self._apply_mapping_suggestions(guild, actor, payload)
            case ControlActionType.SET_FEATURE:
                feature = FeatureName(str(payload["feature"]))
                feature_record = await self.features.set_enabled(
                    guild.id, feature, bool(payload["enabled"])
                )
                return {"feature": feature.value, "enabled": feature_record.enabled}
            case ControlActionType.SET_LOG_EXCLUSIONS:
                config = await self.features.update_config(
                    guild.id,
                    FeatureName.MESSAGE_LOGS,
                    {"ignored_channel_ids": list(payload["channel_ids"])},
                )
                return {"channel_ids": list(config.config.get("ignored_channel_ids", []))}
            case ControlActionType.SAVE_NOTIFICATION_PANEL:
                return await self._save_notification_panel(guild, actor, payload)
            case ControlActionType.UPSERT_TICKET_TYPE:
                item = await self.tickets.upsert_type(
                    guild.id,
                    str(payload["key"]),
                    str(payload["label"]),
                    str(payload["description"]),
                )
                return {"key": item.key, "label": item.label, "enabled": item.enabled}
            case ControlActionType.DISABLE_TICKET_TYPE:
                changed = await self.tickets.disable_type(guild.id, str(payload["key"]))
                return {"key": str(payload["key"]), "disabled": changed}
            case ControlActionType.REFRESH_TICKET_PANEL:
                return await self._refresh_ticket_panel(guild)
            case ControlActionType.SET_REPUTATION_THRESHOLDS:
                values = {
                    "builder": int(payload["builder"]),
                    "contributor": int(payload["contributor"]),
                    "mentor": int(payload["mentor"]),
                }
                await self.features.update_config(
                    guild.id, FeatureName.REPUTATION, {"thresholds": values}
                )
                return {"thresholds": values}
            case ControlActionType.ADJUST_REPUTATION:
                return await self._adjust_reputation(guild, actor, payload)
            case ControlActionType.SET_QUIZ_SCHEDULE:
                interval = int(payload["interval_hours"])
                await self.features.update_config(
                    guild.id,
                    FeatureName.QUIZZES,
                    {"interval_hours": interval, "last_posted_at": None},
                )
                return {"interval_hours": interval}
            case ControlActionType.ADD_QUIZ_QUESTION:
                options = cast(list[str], payload["options"])
                question_record = await self.quizzes.add_question(
                    guild.id,
                    str(payload["category"]),
                    str(payload["prompt"]),
                    (options[0], options[1], options[2], options[3]),
                    int(payload["correct"]) - 1,
                    str(payload["explanation"]) or None,
                )
                return {"question_id": question_record.id}
            case ControlActionType.UPSERT_AI_SOURCE:
                source_id = payload.get("source_id")
                if source_id is None:
                    created_source = await self.ai_sources.add_source(
                        guild.id,
                        str(payload["name"]),
                        str(payload["url"]),
                        str(payload["category"]),
                    )
                    return {
                        "source_id": created_source.id,
                        "enabled": created_source.enabled,
                    }

                updated_source = await self.ai_sources.update_source(
                    guild.id,
                    int(source_id),
                    str(payload["name"]),
                    str(payload["url"]),
                    str(payload["category"]),
                )
                if updated_source is None:
                    raise ActionRejected("That AI source no longer exists in this server.")
                return {
                    "source_id": updated_source.id,
                    "enabled": updated_source.enabled,
                }
            case ControlActionType.DISABLE_AI_SOURCE:
                changed = await self.ai_sources.disable_source(guild.id, int(payload["source_id"]))
                return {"source_id": int(payload["source_id"]), "disabled": changed}
            case ControlActionType.POLL_AI_SOURCES:
                return await self._poll_ai_sources(guild)
            case ControlActionType.SEND_ANNOUNCEMENT:
                return await self._send_announcement(guild, payload)
            case ControlActionType.POST_LIVE:
                return await self._post_live(guild, actor, payload)

        raise ActionRejected("That control action is not supported by this Rob-bot version.")

    async def _actor(self, guild: discord.Guild, actor_id: int) -> discord.Member:
        member = guild.get_member(actor_id)
        if member is None:
            try:
                member = await guild.fetch_member(actor_id)
            except (discord.NotFound, discord.Forbidden, discord.HTTPException) as error:
                raise ActionRejected(
                    "Your Discord membership could not be verified. Sign in again and retry."
                ) from error
        return member

    @staticmethod
    def _require_actor_permission(member: discord.Member, action_type: ControlActionType) -> None:
        required = required_permission(action_type)
        permissions = member.guild_permissions
        if permissions.administrator:
            return
        if required is ActionPermission.ADMINISTRATOR:
            raise ActionRejected("Administrator permission is required for that action.")
        if required is ActionPermission.MANAGE_GUILD and not permissions.manage_guild:
            raise ActionRejected("Manage Server permission is required for that action.")

    async def _set_resource(
        self, guild: discord.Guild, actor: discord.Member, payload: dict[str, Any]
    ) -> dict[str, Any]:
        key = ResourceKey(str(payload["key"]))
        discord_id = int(payload["discord_id"])
        resource = _discord_resource(guild, key, discord_id)
        if not _resource_matches_key(key, resource):
            raise ActionRejected(f"The selected Discord resource is not valid for `{key.value}`.")
        record = await self.resources.set_resource(
            guild.id,
            key,
            RESOURCE_TYPES[key],
            discord_id,
            actor.id,
        )
        return {"key": key.value, "discord_id": record.discord_id}

    async def _apply_auto_setup(
        self, guild: discord.Guild, actor: discord.Member, payload: dict[str, Any]
    ) -> dict[str, Any]:
        current = await self.provisioner.discover(guild)
        current_serialized = serialize_setup_plan(current)
        if current_serialized["plan_hash"] != payload["plan_hash"]:
            raise ActionRejected(
                "Server resources changed after review. Review setup again before applying."
            )
        connected = await self.provisioner.connect_existing(guild, actor.id, current)
        changed = await self.provisioner.apply_mutations(guild, actor.id, current)
        return {
            "connected": [item.key.value for item in connected],
            "changed": [item.key.value for item in changed],
        }

    async def _apply_mapping_suggestions(
        self, guild: discord.Guild, actor: discord.Member, payload: dict[str, Any]
    ) -> dict[str, Any]:
        current = await self.provisioner.discover(guild)
        review = serialize_mapping_review(current)
        if review["plan_hash"] != payload["plan_hash"]:
            raise ActionRejected(
                "Server resources changed after review. Review suggested mappings again before applying."
            )

        expected_items = [
            {
                "key": item["key"],
                "action": item["action"],
                "target_id": int(item["target"]["id"]) if item["target"] is not None else None,
            }
            for item in review["proposed"]
        ]
        if payload["items"] != expected_items:
            raise ActionRejected(
                "The mapping review no longer matches the approved resource scope. Review it again."
            )
        if payload["confirmed_keys"] != review["required_confirmations"]:
            raise ActionRejected(
                "Every resource creation or replacement requires confirmation before applying."
            )

        scoped = scoped_mapping_plan(current)
        connected = await self.provisioner.connect_existing(guild, actor.id, scoped)
        changed = await self.provisioner.apply_mutations(guild, actor.id, scoped)
        return {
            "connected": [item.key.value for item in connected],
            "changed": [item.key.value for item in changed],
        }

    async def _save_notification_panel(
        self, guild: discord.Guild, actor: discord.Member, payload: dict[str, Any]
    ) -> dict[str, Any]:
        channel = guild.get_channel(int(payload["channel_id"]))
        if not isinstance(channel, discord.TextChannel):
            raise ActionRejected("Select a text channel for the notification role panel.")
        bot_member = guild.me
        if bot_member is None or not bot_member.guild_permissions.manage_roles:
            raise ActionRejected("Rob-bot needs Manage Roles before this panel can be saved.")
        for item in cast(list[dict[str, Any]], payload["buttons"]):
            role = guild.get_role(int(item["role_id"]))
            if role is None or role.is_default() or role.managed or bot_member.top_role <= role:
                raise ActionRejected(
                    f"Rob-bot cannot manage the configured role for `{item['label']}`."
                )
        panel = await self.control.save_notification_panel(
            guild_id=guild.id,
            channel_id=channel.id,
            title=str(payload["title"]),
            description=str(payload["description"]),
            buttons=cast(list[dict[str, Any]], payload["buttons"]),
            updated_by=actor.id,
        )
        message, view = await upsert_notification_panel(
            channel=channel, panel=panel, repository=self.control
        )
        self.bot.add_view(view, message_id=message.id)
        return {
            "channel_id": channel.id,
            "message_id": message.id,
            "buttons": len(panel.buttons),
        }

    async def _refresh_ticket_panel(self, guild: discord.Guild) -> dict[str, Any]:
        resource = await self.resources.get(guild.id, ResourceKey.TICKET_PANEL)
        channel = guild.get_channel(resource.discord_id) if resource is not None else None
        if not isinstance(channel, discord.TextChannel):
            raise ActionRejected("Configure the ticket panel channel first.")
        types = await self.tickets.list_types(guild.id)
        if not types:
            raise ActionRejected("Add at least one ticket type before posting the ticket panel.")
        embed = discord.Embed(
            title="Support tickets",
            description=(
                "Open a private ticket and choose the topic that best matches what you need."
            ),
            color=discord.Color.blurple(),
        )
        message = await channel.send(embed=embed, view=TicketPanelView())
        return {"channel_id": channel.id, "message_id": message.id}

    async def _adjust_reputation(
        self, guild: discord.Guild, actor: discord.Member, payload: dict[str, Any]
    ) -> dict[str, Any]:
        member_id = int(payload["member_id"])
        member = guild.get_member(member_id)
        if member is None:
            try:
                member = await guild.fetch_member(member_id)
            except (discord.NotFound, discord.Forbidden, discord.HTTPException) as error:
                raise ActionRejected("That member could not be found in this server.") from error
        total = await self.reputation.award(
            guild.id,
            member.id,
            "staff_award",
            int(payload["points"]),
            actor_id=actor.id,
            source_ref=str(payload["reason"]),
        )
        cog = self.bot.get_cog("ReputationCog")
        if cog is not None and hasattr(cog, "_sync_roles"):
            await cast(ReputationRoleSync, cog)._sync_roles(member, total)
        return {"member_id": member.id, "total": total}

    async def _poll_ai_sources(self, guild: discord.Guild) -> dict[str, Any]:
        cog = self.bot.get_cog("AIUpdatesCog")
        if not isinstance(cog, AIUpdatesCog):
            raise ActionRejected("AI feed polling is unavailable right now.")
        posted = 0
        for source in await self.ai_sources.list_sources(guild.id, enabled_only=True):
            posted += await cog._poll_source(source)
        return {"posted": posted}

    async def _send_announcement(
        self, guild: discord.Guild, payload: dict[str, Any]
    ) -> dict[str, Any]:
        if not await self.features.is_enabled(guild.id, FeatureName.ANNOUNCEMENTS):
            raise ActionRejected("Announcements are disabled in this server.")
        channel = guild.get_channel(int(payload["channel_id"]))
        if not isinstance(channel, discord.TextChannel):
            raise ActionRejected("Select a text channel for the announcement.")
        bot_member = guild.me
        if bot_member is None:
            raise ActionRejected("Rob-bot's server member is unavailable.")
        permissions = channel.permissions_for(bot_member)
        if not permissions.send_messages or not permissions.embed_links:
            raise ActionRejected("Rob-bot needs Send Messages and Embed Links in that channel.")

        mentions = cast(dict[str, Any], payload["mentions"])
        role_ids = cast(list[int], mentions["role_ids"])
        user_ids = cast(list[int], mentions["user_ids"])
        roles: list[discord.Role] = []
        for role_id in role_ids:
            role = guild.get_role(role_id)
            if role is None:
                raise ActionRejected("One of the selected mention roles no longer exists.")
            if not role.mentionable and not permissions.mention_everyone:
                raise ActionRejected(
                    f"Rob-bot cannot mention the `{role.name}` role in that channel."
                )
            roles.append(role)
        wants_everyone = bool(mentions["everyone"] or mentions["here"])
        if wants_everyone and not permissions.mention_everyone:
            raise ActionRejected("Rob-bot cannot use @everyone or @here in that channel.")

        embed = discord.Embed(
            title=str(payload["title"]) or None,
            description=str(payload["body"]),
            color=discord.Color(int(str(payload["color"]), 16)),
        )
        if payload["footer"]:
            embed.set_footer(text=str(payload["footer"]))
        allowed_mentions = discord.AllowedMentions(
            everyone=wants_everyone,
            users=[discord.Object(id=user_id) for user_id in user_ids],
            roles=roles,
            replied_user=False,
        )
        message = await channel.send(
            content=str(payload["message"]) or None,
            embed=embed,
            allowed_mentions=allowed_mentions,
        )
        return {"channel_id": channel.id, "message_id": message.id}

    async def _post_live(
        self, guild: discord.Guild, actor: discord.Member, payload: dict[str, Any]
    ) -> dict[str, Any]:
        service = LiveAnnouncementService(
            authorized_user_id=self.settings.mar_wie_user_id,
            tiktok_url=self.settings.mar_wie_tiktok_url,
        )
        try:
            draft = service.create_draft(actor.id, str(payload["topic"]) or None)
        except PermissionError as error:
            raise ActionRejected("Only the configured live host can post a Live notice.") from error
        if not await self.features.is_enabled(guild.id, FeatureName.LIVE_ANNOUNCEMENTS):
            raise ActionRejected("Live announcements are disabled in this server.")

        channel: discord.TextChannel | None = None
        if payload["channel_id"] is not None:
            candidate = guild.get_channel(int(payload["channel_id"]))
            if not isinstance(candidate, discord.TextChannel):
                raise ActionRejected("The selected Live destination is no longer a text channel.")
            channel = candidate
        else:
            for key in (ResourceKey.LIVE_ANNOUNCEMENTS, ResourceKey.ANNOUNCEMENTS):
                resource = await self.resources.get(guild.id, key)
                candidate = guild.get_channel(resource.discord_id) if resource is not None else None
                if isinstance(candidate, discord.TextChannel):
                    channel = candidate
                    break
        if channel is None:
            raise ActionRejected("No live-announcement channel is configured.")

        bot_member = guild.me
        if bot_member is None:
            raise ActionRejected("Rob-bot's server member is unavailable.")
        permissions = channel.permissions_for(bot_member)
        if not permissions.send_messages or not permissions.embed_links:
            raise ActionRejected("Rob-bot needs Send Messages and Embed Links in that channel.")

        content: str | None = None
        allowed = discord.AllowedMentions.none()
        ping_role_id = payload.get("ping_role_id")
        if ping_role_id is not None:
            role = guild.get_role(int(ping_role_id))
            if role is None or role.is_default():
                raise ActionRejected("The selected Live ping role no longer exists.")
            if not role.mentionable and not permissions.mention_everyone:
                raise ActionRejected(
                    f"Rob-bot cannot mention the `{role.name}` role in that channel."
                )
            content = role.mention
            allowed = discord.AllowedMentions(
                everyone=False,
                users=False,
                roles=[role],
                replied_user=False,
            )

        view = build_live_view(draft)
        if view is None:
            message = await channel.send(
                content=content,
                embed=build_live_embed(draft),
                allowed_mentions=allowed,
            )
        else:
            message = await channel.send(
                content=content,
                embed=build_live_embed(draft),
                view=view,
                allowed_mentions=allowed,
            )
        return {
            "channel_id": channel.id,
            "message_id": message.id,
            "pinged": content is not None,
            "ping_role_id": int(ping_role_id) if ping_role_id is not None else None,
        }
