from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from marwie_bot.config.resources import FeatureName, ResourceKey
from marwie_bot.db.session import Database
from marwie_bot.features.anonymous_questions.repository import SQLAlchemyAnonymousQuestionRepository
from marwie_bot.features.anonymous_questions.service import AnonymousQuestionService
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService


class AnonymousQuestionsCog(commands.Cog):
    def __init__(
        self,
        service: AnonymousQuestionService,
        repository: SQLAlchemyAnonymousQuestionRepository,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        self.service = service
        self.repository = repository
        self.resources = resources
        self.features = features

    @app_commands.command(
        name="anonask",
        description="Ask an educational or technical question without showing your identity publicly.",
    )
    @app_commands.guild_only()
    async def anonask(
        self,
        interaction: discord.Interaction,
        question: app_commands.Range[str, 10, 4000],
    ) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message("This command only works in a server.", ephemeral=True)
            return
        if not await self.features.is_enabled(guild.id, FeatureName.ANONYMOUS_QUESTIONS):
            await interaction.response.send_message("Anonymous questions are disabled here.", ephemeral=True)
            return
        resource = await self.resources.get(guild.id, ResourceKey.ANON_QUESTIONS)
        channel = guild.get_channel(resource.discord_id) if resource else None
        if not isinstance(channel, discord.TextChannel):
            await interaction.response.send_message(
                "The anonymous-question channel has not been configured.", ephemeral=True
            )
            return
        config = await self.features.get(guild.id, FeatureName.ANONYMOUS_QUESTIONS)
        daily_limit = int(config.config.get("daily_limit", 3))
        cooldown = int(config.config.get("cooldown_minutes", 10))
        try:
            record = await self.service.create(
                guild.id,
                interaction.user.id,
                channel.id,
                str(question),
                daily_limit=max(1, min(daily_limit, 20)),
                cooldown_minutes=max(1, min(cooldown, 1440)),
            )
        except ValueError as error:
            await interaction.response.send_message(str(error), ephemeral=True)
            return
        embed = discord.Embed(
            title=f"Anonymous question #{record.id}",
            description=record.question,
            color=discord.Color.blurple(),
        )
        embed.set_footer(text="For educational and technical questions. Identity is visible to authorized staff for abuse review.")
        message = await channel.send(embed=embed, allowed_mentions=discord.AllowedMentions.none())
        await self.repository.attach_message(record.id, message.id)
        await interaction.response.send_message(
            f"Question #{record.id} posted anonymously in {channel.mention}.", ephemeral=True
        )

    @app_commands.command(name="anonwho", description="Reveal an anonymous question author for staff audit.")
    @app_commands.default_permissions(moderate_members=True)
    @app_commands.checks.has_permissions(moderate_members=True)
    @app_commands.guild_only()
    async def anonwho(
        self, interaction: discord.Interaction, question_id: app_commands.Range[int, 1]
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message("This command only works in a server.", ephemeral=True)
            return
        record = await self.service.get(interaction.guild_id, int(question_id))
        if record is None:
            await interaction.response.send_message("Anonymous question not found.", ephemeral=True)
            return
        await interaction.response.send_message(
            f"Question `#{record.id}` was submitted by <@{record.user_id}> (`{record.user_id}`).",
            ephemeral=True,
            allowed_mentions=discord.AllowedMentions.none(),
        )


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading AnonymousQuestionsCog")
    repository = SQLAlchemyAnonymousQuestionRepository(database)
    service = AnonymousQuestionService(repository)
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    await bot.add_cog(AnonymousQuestionsCog(service, repository, resources, features))
