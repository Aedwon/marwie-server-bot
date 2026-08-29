from __future__ import annotations

from datetime import UTC, datetime, timedelta

import discord
from discord import app_commands
from discord.ext import commands, tasks

from marwie_bot.config.resources import FeatureName, ResourceKey
from marwie_bot.db.session import Database
from marwie_bot.features.analytics.service import AnalyticsService, WeeklyAnalytics
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService


class AnalyticsCog(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
        analytics: AnalyticsService,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        self.bot = bot
        self.analytics = analytics
        self.resources = resources
        self.features = features
        if getattr(getattr(bot, "settings", None), "enable_background_tasks", True):
            self.automation_loop.start()

    async def cog_unload(self) -> None:
        self.automation_loop.cancel()

    @staticmethod
    def _embed(report: WeeklyAnalytics) -> discord.Embed:
        embed = discord.Embed(title="Weekly community operations", color=discord.Color.blurple())
        embed.add_field(name="Moderation cases", value=str(report.moderation_cases))
        embed.add_field(name="Tickets opened", value=str(report.tickets_opened))
        embed.add_field(name="Tickets closed", value=str(report.tickets_closed))
        embed.add_field(name="Quiz answers", value=str(report.quiz_answers))
        embed.add_field(
            name="Quiz accuracy",
            value=(
                f"{report.quiz_accuracy:.0%}"
                if report.quiz_accuracy is not None
                else "No answers in this period"
            ),
        )
        embed.add_field(name="Anonymous questions", value=str(report.anonymous_questions))
        embed.add_field(name="Reputation events", value=str(report.reputation_events))
        embed.set_footer(text="Aggregate activity from the previous 7 days")
        return embed

    async def _channel(self, guild: discord.Guild) -> discord.TextChannel | None:
        resource = await self.resources.get(guild.id, ResourceKey.ANALYTICS)
        channel = guild.get_channel(resource.discord_id) if resource else None
        return channel if isinstance(channel, discord.TextChannel) else None

    @app_commands.command(
        name="analytics", description="Show the previous 7 days of aggregate bot activity."
    )
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.checks.has_permissions(manage_guild=True)
    @app_commands.guild_only()
    async def analytics_command(self, interaction: discord.Interaction) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        report = await self.analytics.weekly(interaction.guild_id)
        await interaction.response.send_message(embed=self._embed(report), ephemeral=True)

    async def _post_weekly_if_due(self, guild: discord.Guild, now: datetime) -> None:
        if not await self.features.is_enabled(guild.id, FeatureName.ANALYTICS):
            return
        channel = await self._channel(guild)
        if channel is None:
            return
        config = await self.features.get(guild.id, FeatureName.ANALYTICS)
        last_raw = config.config.get("last_reported_at")
        last = datetime.fromisoformat(str(last_raw)) if last_raw else None
        if last is not None and now - last < timedelta(days=7):
            return
        report = await self.analytics.weekly(guild.id, now)
        await channel.send(embed=self._embed(report))
        await self.features.update_config(
            guild.id, FeatureName.ANALYTICS, {"last_reported_at": now.isoformat()}
        )

    @tasks.loop(hours=6)
    async def automation_loop(self) -> None:
        now = datetime.now(UTC)
        for guild in self.bot.guilds:
            await self._post_weekly_if_due(guild, now)

    @automation_loop.before_loop
    async def before_automation_loop(self) -> None:
        await self.bot.wait_until_ready()


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading AnalyticsCog")
    analytics = AnalyticsService(database)
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    await bot.add_cog(AnalyticsCog(bot, analytics, resources, features))
