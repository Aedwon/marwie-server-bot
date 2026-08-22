from __future__ import annotations

from datetime import UTC, datetime, timedelta

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
from marwie_bot.features.showcase.repository import SQLAlchemyShowcaseRepository


class ShowcaseCog(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
        repository: SQLAlchemyShowcaseRepository,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        self.bot = bot
        self.repository = repository
        self.resources = resources
        self.features = features
        if getattr(getattr(bot, "settings", None), "enable_background_tasks", True):
            self.weekly_loop.start()

    async def cog_unload(self) -> None:
        self.weekly_loop.cancel()

    async def _resources(
        self, guild: discord.Guild
    ) -> tuple[discord.ForumChannel, discord.TextChannel] | None:
        forum_resource = await self.resources.get(guild.id, ResourceKey.SHOWCASE_FORUM)
        destination_resource = await self.resources.get(guild.id, ResourceKey.APP_OF_WEEK)
        forum = guild.get_channel(forum_resource.discord_id) if forum_resource else None
        destination = (
            guild.get_channel(destination_resource.discord_id) if destination_resource else None
        )
        if not isinstance(forum, discord.ForumChannel) or not isinstance(
            destination, discord.TextChannel
        ):
            return None
        return forum, destination

    async def _post_spotlight(
        self,
        guild: discord.Guild,
        thread: discord.Thread,
        selected_by: int,
    ) -> discord.Message | None:
        resolved = await self._resources(guild)
        if resolved is None:
            return None
        forum, destination = resolved
        if thread.parent_id != forum.id:
            return None
        already = await self.repository.spotlighted_thread_ids(guild.id)
        if thread.id in already:
            return None
        embed = discord.Embed(
            title="App of the Week",
            description=f"{thread.mention}\n\n**{thread.name}**",
            color=discord.Color.blurple(),
        )
        embed.add_field(name="Discussion activity", value=str(thread.message_count or 0))
        message = await destination.send(embed=embed)
        await self.repository.create(guild.id, thread.id, selected_by, message.id)
        return message

    @app_commands.command(
        name="app-of-week", description="Spotlight a showcase thread as App of the Week."
    )
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.checks.has_permissions(manage_guild=True)
    @app_commands.guild_only()
    async def app_of_week(self, interaction: discord.Interaction, thread: discord.Thread) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        message = await self._post_spotlight(guild, thread, interaction.user.id)
        if message is None:
            await interaction.response.send_message(
                "Could not spotlight that thread. Check showcase configuration or whether it was already selected.",
                ephemeral=True,
            )
            return
        await self.features.update_config(
            guild.id, FeatureName.SHOWCASE, {"last_posted_at": datetime.now(UTC).isoformat()}
        )
        await interaction.response.send_message(
            f"App of the Week posted: {message.jump_url}", ephemeral=True
        )

    @tasks.loop(hours=12)
    async def weekly_loop(self) -> None:
        now = datetime.now(UTC)
        for guild in self.bot.guilds:
            if not await self.features.is_enabled(guild.id, FeatureName.SHOWCASE):
                continue
            config = await self.features.get(guild.id, FeatureName.SHOWCASE)
            last_raw = config.config.get("last_posted_at")
            last = datetime.fromisoformat(str(last_raw)) if last_raw else None
            if last is not None and now - last < timedelta(days=7):
                continue
            resolved = await self._resources(guild)
            if resolved is None:
                continue
            forum, _ = resolved
            spotlighted = await self.repository.spotlighted_thread_ids(guild.id)
            candidates = [thread for thread in forum.threads if thread.id not in spotlighted]
            if not candidates:
                continue
            candidate = max(candidates, key=lambda thread: thread.message_count or 0)
            message = await self._post_spotlight(
                guild, candidate, self.bot.user.id if self.bot.user else 0
            )
            if message is not None:
                await self.features.update_config(
                    guild.id, FeatureName.SHOWCASE, {"last_posted_at": now.isoformat()}
                )

    @weekly_loop.before_loop
    async def before_weekly_loop(self) -> None:
        await self.bot.wait_until_ready()


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading ShowcaseCog")
    repository = SQLAlchemyShowcaseRepository(database)
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    await bot.add_cog(ShowcaseCog(bot, repository, resources, features))
