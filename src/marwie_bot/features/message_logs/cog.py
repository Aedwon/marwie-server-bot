from __future__ import annotations

import logging

import discord
from discord.ext import commands

from marwie_bot.config.resources import FeatureName, ResourceKey
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService

logger = logging.getLogger(__name__)


def _clip(value: str, limit: int = 1000) -> str:
    if not value:
        return "*(content unavailable or empty)*"
    return value if len(value) <= limit else f"{value[: limit - 3]}..."


class MessageLogsCog(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        self.bot = bot
        self.resources = resources
        self.features = features

    async def _destination(
        self, guild: discord.Guild, source_channel_id: int
    ) -> discord.TextChannel | None:
        if not await self.features.is_enabled(guild.id, FeatureName.MESSAGE_LOGS):
            return None
        config = await self.features.get(guild.id, FeatureName.MESSAGE_LOGS)
        ignored = {int(value) for value in config.config.get("ignored_channel_ids", [])}
        if source_channel_id in ignored:
            return None
        resource = await self.resources.get(guild.id, ResourceKey.MESSAGE_LOG)
        if resource is None or resource.discord_id == source_channel_id:
            return None
        channel = guild.get_channel(resource.discord_id)
        return channel if isinstance(channel, discord.TextChannel) else None

    @commands.Cog.listener()
    async def on_raw_message_edit(self, payload: discord.RawMessageUpdateEvent) -> None:
        if payload.guild_id is None:
            return
        guild = self.bot.get_guild(payload.guild_id)
        if guild is None:
            return
        destination = await self._destination(guild, payload.channel_id)
        if destination is None:
            return
        cached = payload.cached_message
        channel = guild.get_channel(payload.channel_id)
        author = cached.author if cached is not None else None
        before = cached.content if cached is not None else ""
        after = str(payload.data.get("content", ""))
        if before == after and before:
            return
        embed = discord.Embed(title="Message edited", color=discord.Color.gold())
        embed.add_field(
            name="Channel",
            value=getattr(channel, "mention", f"`{payload.channel_id}`"),
            inline=True,
        )
        embed.add_field(name="Author", value=author.mention if author else "Unknown", inline=True)
        embed.add_field(name="Message ID", value=str(payload.message_id), inline=True)
        embed.add_field(name="Before", value=_clip(before), inline=False)
        embed.add_field(name="After", value=_clip(after), inline=False)
        try:
            await destination.send(embed=embed)
        except discord.HTTPException as error:
            logger.warning("Could not log edited message %s: %s", payload.message_id, error)

    @commands.Cog.listener()
    async def on_raw_message_delete(self, payload: discord.RawMessageDeleteEvent) -> None:
        if payload.guild_id is None:
            return
        guild = self.bot.get_guild(payload.guild_id)
        if guild is None:
            return
        destination = await self._destination(guild, payload.channel_id)
        if destination is None:
            return
        cached = payload.cached_message
        channel = guild.get_channel(payload.channel_id)
        embed = discord.Embed(title="Message deleted", color=discord.Color.red())
        embed.add_field(
            name="Channel",
            value=getattr(channel, "mention", f"`{payload.channel_id}`"),
            inline=True,
        )
        embed.add_field(
            name="Author",
            value=cached.author.mention if cached is not None else "Unknown",
            inline=True,
        )
        embed.add_field(name="Message ID", value=str(payload.message_id), inline=True)
        if cached is not None:
            embed.add_field(name="Content", value=_clip(cached.content), inline=False)
            if cached.attachments:
                names = ", ".join(attachment.filename for attachment in cached.attachments[:10])
                embed.add_field(name="Attachments", value=_clip(names), inline=False)
        try:
            await destination.send(embed=embed)
        except discord.HTTPException as error:
            logger.warning("Could not log deleted message %s: %s", payload.message_id, error)


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading MessageLogsCog")
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    await bot.add_cog(MessageLogsCog(bot, resources, features))
