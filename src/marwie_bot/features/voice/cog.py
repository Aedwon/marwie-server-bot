from __future__ import annotations

import logging

import discord
from discord.ext import commands, tasks

from marwie_bot.config.resources import FeatureName, ResourceKey
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService
from marwie_bot.features.voice.repository import SQLAlchemyVoiceRepository

logger = logging.getLogger(__name__)


class VoiceCog(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
        repository: SQLAlchemyVoiceRepository,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        self.bot = bot
        self.repository = repository
        self.resources = resources
        self.features = features
        if getattr(getattr(bot, "settings", None), "enable_background_tasks", True):
            self.reconcile.start()

    def cog_unload(self) -> None:
        self.reconcile.cancel()

    @commands.Cog.listener()
    async def on_voice_state_update(
        self,
        member: discord.Member,
        before: discord.VoiceState,
        after: discord.VoiceState,
    ) -> None:
        guild = member.guild
        if after.channel is not None and await self.features.is_enabled(
            guild.id, FeatureName.VOICE
        ):
            creator_resource = await self.resources.get(
                guild.id, ResourceKey.CREATE_WORKSPACE_VOICE
            )
            if creator_resource is not None and after.channel.id == creator_resource.discord_id:
                await self._create_workspace(member, after.channel)
        if before.channel is not None:
            record = await self.repository.get(before.channel.id)
            if record is not None and not before.channel.members:
                await self._delete_temp(before.channel)

    async def _create_workspace(
        self, member: discord.Member, creator: discord.VoiceChannel | discord.StageChannel
    ) -> None:
        guild = member.guild
        category_resource = await self.resources.get(guild.id, ResourceKey.TEMP_VOICE_CATEGORY)
        category = (
            guild.get_channel(category_resource.discord_id)
            if category_resource
            else creator.category
        )
        if category is not None and not isinstance(category, discord.CategoryChannel):
            category = creator.category
        name = f"{member.display_name}'s workspace"[:100]
        try:
            channel = await guild.create_voice_channel(
                name, category=category, reason="Temporary workspace"
            )
            await channel.set_permissions(
                member,
                view_channel=True,
                connect=True,
                speak=True,
                manage_channels=True,
                move_members=True,
            )
            await self.repository.add(guild.id, channel.id, member.id)
            await member.move_to(channel, reason="Created temporary workspace")
        except discord.HTTPException as error:
            logger.warning("Could not create workspace for guild %s: %s", guild.id, error)

    async def _delete_temp(self, channel: discord.VoiceChannel | discord.StageChannel) -> None:
        try:
            await channel.delete(reason="Temporary workspace empty")
        except discord.NotFound:
            pass
        except discord.HTTPException as error:
            logger.warning("Could not delete temporary voice channel %s: %s", channel.id, error)
            return
        await self.repository.remove(channel.id)

    @tasks.loop(minutes=5)
    async def reconcile(self) -> None:
        for record in await self.repository.list_all():
            guild = self.bot.get_guild(record.guild_id)
            if guild is None:
                continue
            channel = guild.get_channel(record.channel_id)
            if channel is None:
                await self.repository.remove(record.channel_id)
            elif (
                isinstance(channel, (discord.VoiceChannel, discord.StageChannel))
                and not channel.members
            ):
                await self._delete_temp(channel)

    @reconcile.before_loop
    async def before_reconcile(self) -> None:
        await self.bot.wait_until_ready()

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel: discord.abc.GuildChannel) -> None:
        if await self.repository.get(channel.id) is not None:
            await self.repository.remove(channel.id)


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading VoiceCog")
    repository = SQLAlchemyVoiceRepository(database)
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    await bot.add_cog(VoiceCog(bot, repository, resources, features))
