from __future__ import annotations

import logging

import discord
from discord import app_commands
from discord.ext import commands

from marwie_bot.config.resources import FeatureName, ResourceKey
from marwie_bot.config.settings import Settings
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService
from marwie_bot.features.live_announcements.render import build_live_embed, build_live_view
from marwie_bot.features.live_announcements.service import LiveAnnouncementService

logger = logging.getLogger(__name__)


class LiveAnnouncementsCog(commands.Cog):
    def __init__(
        self,
        resources: ResourceService,
        features: FeatureConfigService,
        service: LiveAnnouncementService,
    ) -> None:
        self.resources = resources
        self.features = features
        self.service = service

    async def _resolve_destination(
        self, guild: discord.Guild
    ) -> tuple[discord.TextChannel | None, ResourceKey | None]:
        for key in (ResourceKey.LIVE_ANNOUNCEMENTS, ResourceKey.ANNOUNCEMENTS):
            record = await self.resources.get(guild.id, key)
            if record is None:
                continue
            channel = guild.get_channel(record.discord_id)
            if isinstance(channel, discord.TextChannel):
                return channel, key
            logger.warning(
                "Live announcement channel resource is stale guild_id=%s key=%s channel_id=%s",
                guild.id,
                key.value,
                record.discord_id,
            )
        return None, None

    async def _resolve_ping_role(self, guild: discord.Guild) -> discord.Role | None:
        record = await self.resources.get(guild.id, ResourceKey.LIVE_PING_ROLE)
        if record is None:
            return None
        role = guild.get_role(record.discord_id)
        if role is None:
            logger.warning(
                "Live ping role resource is stale guild_id=%s role_id=%s",
                guild.id,
                record.discord_id,
            )
            return None
        if role.is_default():
            logger.warning(
                "Live ping role cannot be @everyone guild_id=%s role_id=%s",
                guild.id,
                role.id,
            )
            return None
        return role

    @app_commands.command(name="live", description="Announce that Mar Wie is live on TikTok.")
    @app_commands.default_permissions(administrator=True)
    @app_commands.checks.has_permissions(administrator=True)
    @app_commands.guild_only()
    @app_commands.describe(topic="Optional topic for the current livestream.")
    async def live(self, interaction: discord.Interaction, topic: str | None = None) -> None:
        guild = interaction.guild
        if guild is None or interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return

        try:
            draft = self.service.create_draft(interaction.user.id, topic)
        except PermissionError:
            logger.warning(
                "Unauthorized live announcement attempt guild_id=%s user_id=%s",
                guild.id,
                interaction.user.id,
            )
            await interaction.response.send_message("Only Mar Wie can use `/live`.", ephemeral=True)
            return

        if not await self.features.is_enabled(guild.id, FeatureName.LIVE_ANNOUNCEMENTS):
            await interaction.response.send_message(
                "Live announcements are disabled here.", ephemeral=True
            )
            return

        channel, resource_key = await self._resolve_destination(guild)
        if channel is None or resource_key is None:
            await interaction.response.send_message(
                "No live-announcement channel is configured. Set `live_announcements` with "
                "`/setup text-channel`, or configure the existing `announcements` channel.",
                ephemeral=True,
            )
            return

        bot_member = guild.me
        if bot_member is not None:
            permissions = channel.permissions_for(bot_member)
            missing: list[str] = []
            if not permissions.send_messages:
                missing.append("Send Messages")
            if not permissions.embed_links:
                missing.append("Embed Links")
            if missing:
                await interaction.response.send_message(
                    f"I am missing permissions in {channel.mention}: {', '.join(missing)}.",
                    ephemeral=True,
                )
                return

        role = await self._resolve_ping_role(guild)
        ping_content: str | None = None
        ping_skipped = False
        allowed_mentions = discord.AllowedMentions.none()
        if role is not None:
            can_mention_role = role.mentionable
            if bot_member is not None:
                can_mention_role = (
                    can_mention_role or channel.permissions_for(bot_member).mention_everyone
                )
            if can_mention_role:
                ping_content = role.mention
                allowed_mentions = discord.AllowedMentions(
                    everyone=False,
                    users=False,
                    roles=[role],
                    replied_user=False,
                )
            else:
                ping_skipped = True

        try:
            await channel.send(
                content=ping_content,
                embed=build_live_embed(draft),
                view=build_live_view(draft),
                allowed_mentions=allowed_mentions,
            )
        except (discord.Forbidden, discord.NotFound) as error:
            logger.error(
                "Failed to send live announcement guild_id=%s channel_id=%s user_id=%s",
                guild.id,
                channel.id,
                interaction.user.id,
                exc_info=(type(error), error, error.__traceback__),
            )
            await interaction.response.send_message(
                "I could not post the live announcement in the configured channel.",
                ephemeral=True,
            )
            return

        logger.info(
            "Live announcement sent guild_id=%s channel_id=%s user_id=%s resource_key=%s",
            guild.id,
            channel.id,
            interaction.user.id,
            resource_key.value,
        )

        message = f"Live announcement posted in {channel.mention}."
        if ping_skipped:
            message += " The configured Live Ping role was not pinged because I cannot mention it."
        await interaction.response.send_message(message, ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading LiveAnnouncementsCog")
    settings = getattr(bot, "settings", None)
    if not isinstance(settings, Settings):
        raise RuntimeError("Settings are not initialized before loading LiveAnnouncementsCog")

    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    service = LiveAnnouncementService(
        authorized_user_id=settings.mar_wie_user_id,
        tiktok_url=settings.mar_wie_tiktok_url,
    )
    await bot.add_cog(LiveAnnouncementsCog(resources, features, service))
