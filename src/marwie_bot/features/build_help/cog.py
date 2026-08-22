from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from marwie_bot.config.resources import FeatureName, ResourceKey
from marwie_bot.db.session import Database
from marwie_bot.features.build_help.repository import SQLAlchemySolutionRepository
from marwie_bot.features.build_help.service import BuildHelpService
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService
from marwie_bot.features.reputation.repository import SQLAlchemyReputationRepository
from marwie_bot.features.reputation.service import ReputationService


class BuildHelpCog(commands.Cog):
    def __init__(
        self,
        service: BuildHelpService,
        reputation: ReputationService,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        self.service = service
        self.reputation = reputation
        self.resources = resources
        self.features = features

    @app_commands.command(name="solve", description="Mark an answer as the accepted solution.")
    @app_commands.guild_only()
    async def solve(
        self,
        interaction: discord.Interaction,
        answer_message_id: str,
    ) -> None:
        guild = interaction.guild
        thread = interaction.channel
        if guild is None or not isinstance(thread, discord.Thread):
            await interaction.response.send_message(
                "Use this command inside a build-help forum thread.", ephemeral=True
            )
            return
        if not await self.features.is_enabled(guild.id, FeatureName.BUILD_HELP):
            await interaction.response.send_message(
                "Build-help solving is disabled here.", ephemeral=True
            )
            return
        forum_resource = await self.resources.get(guild.id, ResourceKey.BUILD_HELP_FORUM)
        if forum_resource is None or thread.parent_id != forum_resource.discord_id:
            await interaction.response.send_message(
                "This thread is not in the configured build-help forum.", ephemeral=True
            )
            return
        user = interaction.user
        can_moderate = (
            isinstance(user, discord.Member) and user.guild_permissions.manage_threads
        )
        if thread.owner_id != user.id and not can_moderate:
            await interaction.response.send_message(
                "Only the thread author or a moderator can mark the solution.", ephemeral=True
            )
            return
        try:
            message_id = int(answer_message_id)
        except ValueError:
            await interaction.response.send_message(
                "Provide a numeric Discord message ID.", ephemeral=True
            )
            return
        try:
            answer = await thread.fetch_message(message_id)
        except discord.NotFound:
            await interaction.response.send_message(
                "That message was not found in this thread.", ephemeral=True
            )
            return
        if answer.author.bot:
            await interaction.response.send_message(
                "A bot message cannot be the accepted solution.", ephemeral=True
            )
            return
        try:
            record = await self.service.solve(
                guild.id,
                thread.id,
                answer.id,
                answer.author.id,
                interaction.user.id,
                thread.name,
                answer.content or None,
            )
        except ValueError as error:
            await interaction.response.send_message(str(error), ephemeral=True)
            return
        tag_resource = await self.resources.get(guild.id, ResourceKey.SOLVED_TAG)
        parent = thread.parent
        if tag_resource is not None and isinstance(parent, discord.ForumChannel):
            tag = next(
                (
                    item
                    for item in parent.available_tags
                    if item.id == tag_resource.discord_id
                ),
                None,
            )
            if tag is not None and tag not in thread.applied_tags:
                await thread.edit(
                    applied_tags=[*thread.applied_tags, tag], reason="Accepted solution"
                )
        await self.reputation.award(
            guild.id,
            answer.author.id,
            "solution_accepted",
            10,
            actor_id=interaction.user.id,
            source_ref=f"thread:{thread.id}:message:{answer.id}",
        )
        await interaction.response.send_message(
            f"Solved. {answer.author.mention} received helper reputation. "
            f"Solution `#{record.id}`."
        )


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading BuildHelpCog")
    service = BuildHelpService(SQLAlchemySolutionRepository(database))
    reputation = ReputationService(SQLAlchemyReputationRepository(database))
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    await bot.add_cog(BuildHelpCog(service, reputation, resources, features))
