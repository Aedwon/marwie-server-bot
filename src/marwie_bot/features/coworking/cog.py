from __future__ import annotations

import logging
from datetime import UTC, datetime

import discord
from discord import app_commands
from discord.ext import commands, tasks

from marwie_bot.config.resources import FeatureName, ResourceKey
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService
from marwie_bot.features.coworking.repository import SQLAlchemyPomodoroRepository
from marwie_bot.features.coworking.service import CoworkingService

logger = logging.getLogger(__name__)


class CoworkingCog(commands.Cog):
    pomodoro_group = app_commands.Group(name="pomodoro", description="Run a focused coworking timer.", guild_only=True)

    def __init__(
        self,
        bot: commands.Bot,
        service: CoworkingService,
        repository: SQLAlchemyPomodoroRepository,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        self.bot = bot
        self.service = service
        self.repository = repository
        self.resources = resources
        self.features = features
        if getattr(getattr(bot, "settings", None), "enable_background_tasks", True):
            self.timer_loop.start()

    def cog_unload(self) -> None:
        self.timer_loop.cancel()

    @pomodoro_group.command(name="start", description="Start a focused work timer.")
    async def pomodoro_start(
        self,
        interaction: discord.Interaction,
        minutes: app_commands.Range[int, 5, 180] = 25,
    ) -> None:
        if interaction.guild_id is None or interaction.channel_id is None:
            await interaction.response.send_message("This command only works in a server channel.", ephemeral=True)
            return
        if not await self.features.is_enabled(interaction.guild_id, FeatureName.COWORKING):
            await interaction.response.send_message("Coworking utilities are disabled here.", ephemeral=True)
            return
        try:
            record = await self.service.start(
                interaction.guild_id, interaction.user.id, interaction.channel_id, int(minutes)
            )
        except ValueError as error:
            await interaction.response.send_message(str(error), ephemeral=True)
            return
        await interaction.response.send_message(
            f"Focus session started. Ends <t:{int(record.ends_at.timestamp())}:R>.", ephemeral=True
        )

    @pomodoro_group.command(name="status", description="Show your active focus timer.")
    async def pomodoro_status(self, interaction: discord.Interaction) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message("This command only works in a server.", ephemeral=True)
            return
        record = await self.service.active(interaction.guild_id, interaction.user.id)
        if record is None:
            await interaction.response.send_message("You do not have an active Pomodoro session.", ephemeral=True)
            return
        await interaction.response.send_message(
            f"Your focus session ends <t:{int(record.ends_at.timestamp())}:R>.", ephemeral=True
        )

    @pomodoro_group.command(name="stop", description="Stop your active focus timer.")
    async def pomodoro_stop(self, interaction: discord.Interaction) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message("This command only works in a server.", ephemeral=True)
            return
        record = await self.service.stop(interaction.guild_id, interaction.user.id)
        await interaction.response.send_message(
            "Focus session stopped." if record else "You do not have an active Pomodoro session.",
            ephemeral=True,
        )

    @app_commands.command(name="lfg", description="Post a structured collaboration request.")
    @app_commands.guild_only()
    async def lfg(
        self,
        interaction: discord.Interaction,
        project: app_commands.Range[str, 3, 120],
        looking_for: app_commands.Range[str, 3, 500],
        link: app_commands.Range[str, 1, 500] | None = None,
    ) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message("This command only works in a server.", ephemeral=True)
            return
        resource = await self.resources.get(guild.id, ResourceKey.COLLAB_LFG)
        channel = guild.get_channel(resource.discord_id) if resource else None
        if not isinstance(channel, discord.TextChannel):
            await interaction.response.send_message("The collaboration channel is not configured.", ephemeral=True)
            return
        embed = discord.Embed(title=str(project), color=discord.Color.blurple())
        embed.add_field(name="Builder", value=interaction.user.mention, inline=True)
        embed.add_field(name="Looking for", value=str(looking_for), inline=False)
        if link:
            embed.add_field(name="Project link", value=str(link), inline=False)
        message = await channel.send(embed=embed, allowed_mentions=discord.AllowedMentions.none())
        await interaction.response.send_message(f"Collaboration post created: {message.jump_url}", ephemeral=True)

    @tasks.loop(minutes=1)
    async def timer_loop(self) -> None:
        for record in await self.repository.due(datetime.now(UTC)):
            guild = self.bot.get_guild(record.guild_id)
            channel = guild.get_channel(record.channel_id) if guild else None
            if isinstance(channel, discord.abc.Messageable):
                try:
                    await channel.send(f"<@{record.user_id}> focus session complete.")
                except discord.HTTPException as error:
                    logger.warning("Could not post Pomodoro completion %s: %s", record.id, error)
            await self.repository.stop(record.id, "completed")

    @timer_loop.before_loop
    async def before_timer_loop(self) -> None:
        await self.bot.wait_until_ready()


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading CoworkingCog")
    repository = SQLAlchemyPomodoroRepository(database)
    service = CoworkingService(repository)
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    await bot.add_cog(CoworkingCog(bot, service, repository, resources, features))
