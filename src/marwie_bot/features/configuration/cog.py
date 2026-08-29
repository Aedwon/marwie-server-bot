from __future__ import annotations

import logging
import secrets
from collections.abc import Awaitable, Callable

import discord
from discord import app_commands
from discord.ext import commands

from marwie_bot.config.resources import FeatureName, ResourceKey, ResourceType
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.provisioning import (
    AutoSetupPlan,
    AutoSetupService,
    DiscordResource,
    DiscoveryAction,
    ProvisionResult,
)
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.role_panel import (
    LiveNotificationRoleView,
    upsert_role_panel,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService
from marwie_bot.shared.confirmations import confirmation_detail
from marwie_bot.shared.errors import build_failure_message

logger = logging.getLogger(__name__)

_AUTO_SETUP_CONFIRMATION_DETAIL = (
    "Rob-bot will scan existing channels, forums, categories, voice channels, and roles first. "
    "Decorative emoji and separators are ignored when matching names, and known server aliases "
    "such as `live`, `Create VC`, and `Coworking` are recognized. Clear existing matches can be "
    "connected without changing the Discord objects. If anything needs to be created, remapped, "
    "tagged, or refreshed, Rob-bot will show a second confirmation listing those exact changes "
    "before applying them. It will never delete, rename, move, or merge existing resources."
)


def _display_resource(resource: DiscordResource | None) -> str:
    if resource is None:
        return "not configured"
    if isinstance(
        resource,
        (discord.TextChannel, discord.VoiceChannel, discord.ForumChannel, discord.Role),
    ):
        return resource.mention
    return f"`{resource.name}`"


def _role_panel_should_refresh(plan: AutoSetupPlan) -> bool:
    watched = {ResourceKey.ROLE_PANEL, ResourceKey.LIVE_PING_ROLE}
    return any(
        item.blueprint.key in watched and item.action != DiscoveryAction.KEEP
        for item in plan.resources
    )


def _mutation_lines(plan: AutoSetupPlan) -> list[str]:
    lines: list[str] = []
    for item in plan.resource_mutations:
        if item.action == DiscoveryAction.REMAP:
            lines.append(
                f"- Remap `{item.blueprint.key.value}` from "
                f"{_display_resource(item.current)} to {_display_resource(item.target)}."
            )
        elif item.action == DiscoveryAction.CREATE:
            lines.append(
                f"- Create {item.blueprint.kind.value} resource `{item.blueprint.name}` for "
                f"`{item.blueprint.key.value}`."
            )

    if _role_panel_should_refresh(plan):
        lines.append(
            "- Post or refresh the Live Notifications self-role panel in the selected roles channel."
        )
    return lines


def _connected_lines(plan: AutoSetupPlan) -> list[str]:
    lines: list[str] = []
    for item in plan.resources:
        if item.action == DiscoveryAction.BIND:
            lines.append(f"- `{item.blueprint.key.value}` → {_display_resource(item.target)}")

    return lines


def _build_discovery_embed(plan: AutoSetupPlan) -> discord.Embed:
    connected = _connected_lines(plan)
    mutations = _mutation_lines(plan)
    parts = ["Rob-bot searched the existing server before proposing any Discord changes."]
    if connected:
        parts.extend(["", "**Existing resources connected**", *connected])
    else:
        parts.extend(["", "**Existing resources connected**", "No new safe bindings were needed."])
    if mutations:
        parts.extend(["", "**Proposed changes — requires another approval**", *mutations])
        parts.extend(
            [
                "",
                "Approve to apply only the changes above. Decline to keep the existing-resource "
                "connections without creating or modifying Discord resources.",
            ]
        )
    embed = discord.Embed(
        title="Automatic setup discovery",
        description="\n".join(parts)[:4096],
        color=discord.Color.blurple(),
    )
    embed.set_footer(
        text="No existing channels, roles, categories, forums, or voice channels are deleted."
    )
    return embed


def _build_completion_embed(
    connected: list[ProvisionResult],
    mutations: list[ProvisionResult],
    role_channel: discord.TextChannel | None = None,
) -> discord.Embed:
    lines = [
        f"`{result.key.value}`: {result.action.value} `{result.name}`"
        for result in [*connected, *mutations]
    ]
    if role_channel is not None:
        lines.append(f"`role_panel_message`: refreshed in {role_channel.mention}")
    if not lines:
        lines.append("No setup changes were needed; existing mappings remain valid.")
    embed = discord.Embed(
        title="Automatic setup complete",
        description="\n".join(lines)[:4096],
        color=discord.Color.blurple(),
    )
    embed.set_footer(
        text="Discovery prefers existing server resources. Unrelated and duplicate resources are never deleted automatically."
    )
    return embed


type RolePanelCallback = Callable[[discord.Guild], Awaitable[discord.TextChannel]]


class AutoSetupMutationView(discord.ui.View):
    def __init__(
        self,
        *,
        invoker_id: int,
        guild_id: int,
        provisioner: AutoSetupService,
        plan: AutoSetupPlan,
        connected_results: list[ProvisionResult],
        role_panel_callback: RolePanelCallback,
    ) -> None:
        super().__init__(timeout=60)
        self.invoker_id = invoker_id
        self.guild_id = guild_id
        self.provisioner = provisioner
        self.plan = plan
        self.connected_results = connected_results
        self.role_panel_callback = role_panel_callback
        self.message: discord.WebhookMessage | None = None
        self.completed = False

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id == self.invoker_id:
            return True
        await interaction.response.send_message(
            "Only the person who ran `/setup auto` can approve or decline these setup changes.",
            ephemeral=True,
        )
        return False

    @discord.ui.button(label="Approve changes", style=discord.ButtonStyle.success)
    async def approve(
        self,
        interaction: discord.Interaction,
        _button: discord.ui.Button[AutoSetupMutationView],
    ) -> None:
        if self.completed:
            await interaction.response.send_message(
                "This setup plan has already been decided.", ephemeral=True
            )
            return
        guild = interaction.guild
        if guild is None or guild.id != self.guild_id:
            await interaction.response.send_message(
                "The original server is no longer available for this setup plan.", ephemeral=True
            )
            return

        self.completed = True
        await interaction.response.defer(ephemeral=True, thinking=True)
        completion = "Approved `/setup auto` changes."
        try:
            mutation_results = await self.provisioner.apply_mutations(
                guild, interaction.user.id, self.plan
            )
            role_channel = None
            if _role_panel_should_refresh(self.plan):
                role_channel = await self.role_panel_callback(guild)
            await interaction.followup.send(
                embed=_build_completion_embed(
                    self.connected_results, mutation_results, role_channel
                ),
                ephemeral=True,
            )
        except Exception as error:
            error_reference = secrets.token_hex(4).upper()
            logger.exception(
                "Approved auto-setup mutation plan failed guild_id=%s user_id=%s error_reference=%s",
                guild.id,
                interaction.user.id,
                error_reference,
            )
            completion = (
                f"Approved `/setup auto` changes, but execution failed (`{error_reference}`)."
            )
            await interaction.followup.send(
                build_failure_message(error, error_reference), ephemeral=True
            )
        finally:
            self.stop()
            if self.message is not None:
                try:
                    await self.message.edit(content=completion, embed=None, view=None)
                except discord.HTTPException:
                    logger.debug("Could not update the auto-setup mutation prompt")

    @discord.ui.button(label="Decline changes", style=discord.ButtonStyle.secondary)
    async def decline(
        self,
        interaction: discord.Interaction,
        _button: discord.ui.Button[AutoSetupMutationView],
    ) -> None:
        if self.completed:
            await interaction.response.send_message(
                "This setup plan has already been decided.", ephemeral=True
            )
            return
        self.completed = True
        self.stop()
        await interaction.response.edit_message(
            content=(
                "Declined the proposed `/setup auto` changes. Existing resources discovered and "
                "safely connected remain bound; no proposed Discord resources were created or modified."
            ),
            embed=None,
            view=None,
        )

    async def on_timeout(self) -> None:
        if self.completed or self.message is None:
            return
        try:
            await self.message.edit(
                content=(
                    "The `/setup auto` change confirmation expired. Existing resources discovered "
                    "and safely connected remain bound; no proposed changes were applied."
                ),
                embed=None,
                view=None,
            )
        except discord.HTTPException:
            logger.debug("Could not expire the auto-setup mutation prompt")


class ConfigurationCog(commands.Cog):
    setup_group = app_commands.Group(
        name="setup",
        description="Configure server resources and bot features.",
        default_permissions=discord.Permissions(administrator=True),
        guild_only=True,
    )

    def __init__(
        self,
        bot: commands.Bot,
        resources: ResourceService,
        features: FeatureConfigService,
        provisioner: AutoSetupService,
        role_view: LiveNotificationRoleView,
    ) -> None:
        self.bot = bot
        self.resources = resources
        self.features = features
        self.provisioner = provisioner
        self.role_view = role_view

    async def _set_resource(
        self,
        interaction: discord.Interaction,
        key: ResourceKey,
        resource_type: ResourceType,
        discord_id: int,
        display: str,
    ) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        try:
            record = await self.resources.set_resource(
                guild.id, key, resource_type, discord_id, interaction.user.id
            )
        except ValueError as error:
            await interaction.response.send_message(str(error), ephemeral=True)
            return
        await interaction.response.send_message(
            f"Set `{record.key.value}` to {display}.", ephemeral=True
        )

    async def _post_role_panel(self, guild: discord.Guild) -> discord.TextChannel:
        channel_record = await self.resources.get(guild.id, ResourceKey.ROLE_PANEL)
        role_record = await self.resources.get(guild.id, ResourceKey.LIVE_PING_ROLE)
        channel = (
            guild.get_channel(channel_record.discord_id) if channel_record is not None else None
        )
        role = guild.get_role(role_record.discord_id) if role_record is not None else None

        if not isinstance(channel, discord.TextChannel):
            raise ValueError(
                "The `role_panel` channel is not configured. Run `/setup auto` or set it with "
                "`/setup text-channel`."
            )
        if role is None:
            raise ValueError(
                "The `live_ping_role` role is not configured. Run `/setup auto` or set it with "
                "`/setup role`."
            )
        if self.bot.user is None:
            raise RuntimeError("Bot user is unavailable while posting the role panel")

        await upsert_role_panel(channel, role, self.role_view, self.bot.user.id)
        return channel

    @setup_group.command(
        name="auto",
        description="Discover and connect existing resources before proposing missing ones.",
    )
    @app_commands.checks.has_permissions(administrator=True)
    @app_commands.checks.bot_has_permissions(
        view_channel=True,
        send_messages=True,
        embed_links=True,
        read_message_history=True,
        manage_channels=True,
        manage_roles=True,
    )
    @confirmation_detail(_AUTO_SETUP_CONFIRMATION_DETAIL)
    async def auto_setup(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return

        await interaction.response.defer(ephemeral=True, thinking=True)
        plan = await self.provisioner.discover(guild)
        connected_results = await self.provisioner.connect_existing(
            guild, interaction.user.id, plan
        )
        mutation_lines = _mutation_lines(plan)
        if mutation_lines:
            view = AutoSetupMutationView(
                invoker_id=interaction.user.id,
                guild_id=guild.id,
                provisioner=self.provisioner,
                plan=plan,
                connected_results=connected_results,
                role_panel_callback=self._post_role_panel,
            )
            message = await interaction.followup.send(
                embed=_build_discovery_embed(plan),
                view=view,
                ephemeral=True,
                wait=True,
            )
            if isinstance(message, discord.WebhookMessage):
                view.message = message
            return

        await interaction.followup.send(
            embed=_build_completion_embed(connected_results, []), ephemeral=True
        )

    @setup_group.command(
        name="role-panel",
        description="Post or refresh the member self-role panel.",
    )
    @app_commands.checks.has_permissions(administrator=True)
    @app_commands.checks.bot_has_permissions(
        view_channel=True,
        send_messages=True,
        embed_links=True,
        read_message_history=True,
        manage_roles=True,
    )
    async def role_panel(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        try:
            channel = await self._post_role_panel(guild)
        except ValueError as error:
            await interaction.response.send_message(str(error), ephemeral=True)
            return
        await interaction.response.send_message(
            f"Role panel is ready in {channel.mention}.", ephemeral=True
        )

    @setup_group.command(name="text-channel", description="Set a text-channel resource.")
    @app_commands.checks.has_permissions(administrator=True)
    async def set_text_channel(
        self,
        interaction: discord.Interaction,
        key: ResourceKey,
        channel: discord.TextChannel,
    ) -> None:
        await self._set_resource(
            interaction, key, ResourceType.CHANNEL, channel.id, channel.mention
        )

    @setup_group.command(name="voice-channel", description="Set a voice-channel resource.")
    @app_commands.checks.has_permissions(administrator=True)
    async def set_voice_channel(
        self,
        interaction: discord.Interaction,
        key: ResourceKey,
        channel: discord.VoiceChannel,
    ) -> None:
        await self._set_resource(
            interaction, key, ResourceType.CHANNEL, channel.id, channel.mention
        )

    @setup_group.command(name="forum", description="Set a forum-channel resource.")
    @app_commands.checks.has_permissions(administrator=True)
    async def set_forum(
        self,
        interaction: discord.Interaction,
        key: ResourceKey,
        forum: discord.ForumChannel,
    ) -> None:
        await self._set_resource(interaction, key, ResourceType.CHANNEL, forum.id, forum.mention)

    @setup_group.command(name="category", description="Set a category resource.")
    @app_commands.checks.has_permissions(administrator=True)
    async def set_category(
        self,
        interaction: discord.Interaction,
        key: ResourceKey,
        category: discord.CategoryChannel,
    ) -> None:
        await self._set_resource(
            interaction, key, ResourceType.CATEGORY, category.id, f"`{category.name}`"
        )

    @setup_group.command(name="role", description="Set a role resource.")
    @app_commands.checks.has_permissions(administrator=True)
    async def set_role(
        self,
        interaction: discord.Interaction,
        key: ResourceKey,
        role: discord.Role,
    ) -> None:
        await self._set_resource(interaction, key, ResourceType.ROLE, role.id, role.mention)

    @setup_group.command(
        name="feature", description="Enable or disable a bot feature for this server."
    )
    @app_commands.checks.has_permissions(administrator=True)
    async def set_feature(
        self,
        interaction: discord.Interaction,
        feature: FeatureName,
        enabled: bool,
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        record = await self.features.set_enabled(interaction.guild_id, feature, enabled)
        state = "enabled" if record.enabled else "disabled"
        await interaction.response.send_message(
            f"`{record.feature.value}` is now {state}.", ephemeral=True
        )

    @setup_group.command(
        name="log-ignore", description="Include or ignore a channel in message logs."
    )
    @app_commands.checks.has_permissions(administrator=True)
    async def set_log_ignore(
        self,
        interaction: discord.Interaction,
        channel: discord.TextChannel,
        ignored: bool = True,
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        current = await self.features.get(interaction.guild_id, FeatureName.MESSAGE_LOGS)
        ignored_ids = {int(value) for value in current.config.get("ignored_channel_ids", [])}
        if ignored:
            ignored_ids.add(channel.id)
        else:
            ignored_ids.discard(channel.id)
        await self.features.update_config(
            interaction.guild_id,
            FeatureName.MESSAGE_LOGS,
            {"ignored_channel_ids": sorted(ignored_ids)},
        )
        state = "ignored" if ignored else "included"
        await interaction.response.send_message(
            f"{channel.mention} is now {state} by message logging.", ephemeral=True
        )

    @setup_group.command(
        name="status", description="Show configured resources and feature overrides."
    )
    @app_commands.checks.has_permissions(administrator=True)
    async def status(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        records = await self.resources.list_for_guild(guild.id)
        lines: list[str] = []
        for record in records:
            if record.resource_type == ResourceType.ROLE:
                role = guild.get_role(record.discord_id)
                value = role.mention if role is not None else f"`{record.discord_id}` (stale)"
            elif record.resource_type == ResourceType.FORUM_TAG:
                value = f"tag `{record.discord_id}`"
            else:
                channel = guild.get_channel(record.discord_id)
                value = channel.mention if channel is not None else f"`{record.discord_id}` (stale)"
            lines.append(f"`{record.key.value}`: {value}")
        if not lines:
            lines.append("No Discord resources configured yet.")
        embed = discord.Embed(
            title="Bot setup",
            description="\n".join(lines),
            color=discord.Color.blurple(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading ConfigurationCog")
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    provisioner = AutoSetupService(resources)
    role_view = LiveNotificationRoleView(resources)
    bot.add_view(role_view)
    await bot.add_cog(ConfigurationCog(bot, resources, features, provisioner, role_view))
