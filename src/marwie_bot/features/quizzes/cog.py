from __future__ import annotations

import logging
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
from marwie_bot.features.quizzes.repository import SQLAlchemyQuizRepository
from marwie_bot.features.quizzes.service import QuizQuestionRecord, QuizService
from marwie_bot.features.quizzes.views import QuizAnswerView
from marwie_bot.features.reputation.repository import SQLAlchemyReputationRepository
from marwie_bot.features.reputation.service import ReputationService

logger = logging.getLogger(__name__)


class QuizzesCog(commands.Cog):
    quiz_group = app_commands.Group(
        name="quiz",
        description="Manage and run programming/AI quizzes.",
        guild_only=True,
    )

    def __init__(
        self,
        bot: commands.Bot,
        service: QuizService,
        repository: SQLAlchemyQuizRepository,
        reputation: ReputationService,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        self.bot = bot
        self.service = service
        self.repository = repository
        self.reputation = reputation
        self.resources = resources
        self.features = features
        if getattr(
            getattr(bot, "settings", None), "enable_background_tasks", True
        ):
            self.scheduler.start()

    def cog_unload(self) -> None:
        self.scheduler.cancel()

    @quiz_group.command(name="add", description="Add a quiz question.")
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.checks.has_permissions(manage_guild=True)
    async def add_question(
        self,
        interaction: discord.Interaction,
        category: app_commands.Range[str, 1, 50],
        prompt: app_commands.Range[str, 1, 2000],
        option_a: app_commands.Range[str, 1, 300],
        option_b: app_commands.Range[str, 1, 300],
        option_c: app_commands.Range[str, 1, 300],
        option_d: app_commands.Range[str, 1, 300],
        correct: app_commands.Range[int, 1, 4],
        explanation: app_commands.Range[str, 1, 2000] | None = None,
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        record = await self.service.add_question(
            interaction.guild_id,
            str(category),
            str(prompt),
            (str(option_a), str(option_b), str(option_c), str(option_d)),
            int(correct) - 1,
            str(explanation) if explanation else None,
        )
        await interaction.response.send_message(
            f"Quiz question `#{record.id}` added.", ephemeral=True
        )

    @quiz_group.command(
        name="start", description="Start a quiz in the configured channel."
    )
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.checks.has_permissions(manage_guild=True)
    async def start(self, interaction: discord.Interaction) -> None:
        if interaction.guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        channel = await self._quiz_channel(interaction.guild)
        if channel is None:
            await interaction.response.send_message(
                "Configure `quiz_channel` with `/setup text-channel` first.",
                ephemeral=True,
            )
            return
        message = await self._start_quiz(interaction.guild, channel)
        await interaction.response.send_message(
            f"Quiz started: {message.jump_url}"
            if message
            else "No active quiz questions are configured.",
            ephemeral=True,
        )

    @quiz_group.command(
        name="schedule", description="Set automatic quiz interval in hours."
    )
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.checks.has_permissions(manage_guild=True)
    async def schedule(
        self,
        interaction: discord.Interaction,
        interval_hours: app_commands.Range[int, 1, 720],
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        await self.features.update_config(
            interaction.guild_id,
            FeatureName.QUIZZES,
            {"interval_hours": int(interval_hours), "last_posted_at": None},
        )
        await interaction.response.send_message(
            f"Automatic quizzes set to every {int(interval_hours)} hours.",
            ephemeral=True,
        )

    async def _quiz_channel(
        self, guild: discord.Guild
    ) -> discord.TextChannel | None:
        resource = await self.resources.get(guild.id, ResourceKey.QUIZ_CHANNEL)
        channel = guild.get_channel(resource.discord_id) if resource else None
        return channel if isinstance(channel, discord.TextChannel) else None

    async def _start_quiz(
        self, guild: discord.Guild, channel: discord.TextChannel
    ) -> discord.Message | None:
        created = await self.service.new_session(guild.id, channel.id)
        if created is None:
            return None
        session, question = created
        embed = self._question_embed(question, session.closes_at)
        message = await channel.send(embed=embed, view=QuizAnswerView())
        await self.repository.attach_message(session.id, message.id)
        return message

    @staticmethod
    def _question_embed(
        question: QuizQuestionRecord, closes_at: datetime
    ) -> discord.Embed:
        labels = "ABCD"
        options = "\n".join(
            f"**{labels[index]}.** {value}"
            for index, value in enumerate(question.options)
        )
        embed = discord.Embed(
            title=f"{question.category} quiz",
            description=f"{question.prompt}\n\n{options}",
            color=discord.Color.blurple(),
        )
        embed.set_footer(text=f"Answers close at {closes_at.isoformat()}")
        return embed

    async def answer_quiz(
        self, interaction: discord.Interaction, answer_index: int
    ) -> None:
        if interaction.guild_id is None or interaction.message is None:
            await interaction.response.send_message(
                "This quiz is unavailable.", ephemeral=True
            )
            return
        result = await self.service.record_answer(
            interaction.message.id,
            interaction.guild_id,
            interaction.user.id,
            answer_index,
        )
        if result is None:
            await interaction.response.send_message(
                "This quiz is closed or unavailable.", ephemeral=True
            )
            return
        stored, correct = result
        if not stored:
            await interaction.response.send_message(
                "You already answered this quiz.", ephemeral=True
            )
            return
        if correct:
            await self.reputation.award(
                interaction.guild_id,
                interaction.user.id,
                "quiz_correct",
                2,
                source_ref=f"quiz:{interaction.message.id}",
            )
        await interaction.response.send_message("Answer recorded.", ephemeral=True)

    @tasks.loop(minutes=5)
    async def scheduler(self) -> None:
        now = datetime.now(UTC)
        for session in await self.repository.due_sessions(now):
            total, correct = await self.repository.close_session(session.id)
            guild = self.bot.get_guild(session.guild_id)
            channel = guild.get_channel(session.channel_id) if guild else None
            question = await self.repository.get_question(session.question_id)
            if isinstance(channel, discord.TextChannel) and question is not None:
                explanation = (
                    f"\n{question.explanation}" if question.explanation else ""
                )
                await channel.send(
                    f"Quiz closed. {correct}/{total} correct. "
                    f"Answer: **{'ABCD'[question.correct_index]}**.{explanation}"
                )
        for guild in self.bot.guilds:
            if not await self.features.is_enabled(guild.id, FeatureName.QUIZZES):
                continue
            config = await self.features.get(guild.id, FeatureName.QUIZZES)
            interval = config.config.get("interval_hours")
            if interval is None:
                continue
            last_raw = config.config.get("last_posted_at")
            last = datetime.fromisoformat(str(last_raw)) if last_raw else None
            if last is not None and now - last < timedelta(hours=int(interval)):
                continue
            channel = await self._quiz_channel(guild)
            if channel is None:
                continue
            message = await self._start_quiz(guild, channel)
            if message is not None:
                await self.features.update_config(
                    guild.id,
                    FeatureName.QUIZZES,
                    {"last_posted_at": now.isoformat()},
                )

    @scheduler.before_loop
    async def before_scheduler(self) -> None:
        await self.bot.wait_until_ready()


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading QuizzesCog")
    repository = SQLAlchemyQuizRepository(database)
    service = QuizService(repository)
    reputation = ReputationService(SQLAlchemyReputationRepository(database))
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    bot.add_view(QuizAnswerView())
    await bot.add_cog(
        QuizzesCog(bot, service, repository, reputation, resources, features)
    )
