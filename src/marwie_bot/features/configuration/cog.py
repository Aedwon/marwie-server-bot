from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from marwie_bot.config.resources import FeatureName, ResourceKey, ResourceType
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.provisioning import AutoSetupService
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
from marwie_bot.shared.errors import UserFacingCommandError, describe_discord_failure

_AUTO_SETUP_CONFIRMATION_DETAIL = (
    "Rob-bot will inspect the server's existing setup bindings, keep valid bindings, adopt "
    "matching standard resources, create any missing standard channels, forums, categories, "
    "voice channels, roles, and the Solved tag, save the selected resource IDs, and post or "
    "refresh the Live Notifications self-role panel. It will not delete, rename, or move "
    "unrelated server resources. Discord Community must be enabled because `build-help` and "
    "`showcase` are Forum Channels."
)


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
        description="Discover or create the standard resources needed by the bot.",
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
        results = await self.provisioner.ensure(guild, interaction.user.id)
        try:
            role_channel = await self._post_role_panel(guild)
        except discord.HTTPException as error:
            raise UserFacingCommandError(
                describe_discord_failure(
                    "Resources were configured, but the Live Notifications role panel could not "
                    "be refreshed",
                    error,
                )
            ) from error
        except ValueError as error:
            raise UserFacingCommandError(
                "Resources were configured, but the Live Notifications role panel could not be "
                "refreshed. Run `/setup status` to inspect the saved role and channel mappings."
            ) from error

        lines = [
            f"`{result.key.value}`: {result.action.value} `{result.name}`" for result in results
        ]
        lines.append(f"`role_panel_message`: refreshed in {role_channel.mention}")
        embed = discord.Embed(
            title="Automatic setup complete",
            description="\n".join(lines),
            color=discord.Color.blurple(),
        )
        embed.set_footer(
            text="Existing resources were kept or adopted. Unrelated server resources were not deleted."
        )
        await interaction.followup.send(embed=embed, ephemeral=True)

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
        name="solved-tag", description="Set the Solved tag from the build-help forum."
    )
    @app_commands.checks.has_permissions(administrator=True)
    async def set_solved_tag(
        self,
        interaction: discord.Interaction,
        forum: discord.ForumChannel,
        tag_name: app_commands.Range[str, 1, 100],
    ) -> None:
        tag = next((item for item in forum.available_tags if item.name == str(tag_name)), None)
        if tag is None:
            await interaction.response.send_message(
                f"No tag named `{tag_name}` exists in {forum.mention}.", ephemeral=True
            )
            return
        await self._set_resource(
            interaction,
            ResourceKey.SOLVED_TAG,
            ResourceType.FORUM_TAG,
            tag.id,
            f"`{tag.name}`",
        )

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
