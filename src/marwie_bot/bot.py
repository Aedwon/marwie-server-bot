from __future__ import annotations

import logging

import discord
from discord import app_commands
from discord.ext import commands

from marwie_bot.config.settings import Settings
from marwie_bot.db.migrations import upgrade_database
from marwie_bot.db.session import Database
from marwie_bot.shared.confirmations import install_command_confirmations

logger = logging.getLogger(__name__)

EXTENSIONS = (
    "marwie_bot.features.system",
    "marwie_bot.features.configuration.cog",
    "marwie_bot.features.moderation.cog",
    "marwie_bot.features.message_logs.cog",
    "marwie_bot.features.tickets.cog",
    "marwie_bot.features.voice.cog",
    "marwie_bot.features.announcements.cog",
    "marwie_bot.features.live_announcements.cog",
    "marwie_bot.features.reputation.cog",
    "marwie_bot.features.build_help.cog",
    "marwie_bot.features.quizzes.cog",
    "marwie_bot.features.anonymous_questions.cog",
    "marwie_bot.features.coworking.cog",
    "marwie_bot.features.ai_updates.cog",
    "marwie_bot.features.analytics.cog",
    "marwie_bot.features.showcase.cog",
    "marwie_bot.features.control_plane.cog",
)


async def send_ephemeral_error(interaction: discord.Interaction, message: str) -> None:
    if interaction.response.is_done():
        await interaction.followup.send(message, ephemeral=True)
    else:
        await interaction.response.send_message(message, ephemeral=True)


class MarwieCommandTree(app_commands.CommandTree):
    async def on_error(
        self,
        interaction: discord.Interaction,
        error: app_commands.AppCommandError,
    ) -> None:
        if isinstance(error, app_commands.MissingPermissions):
            await send_ephemeral_error(
                interaction, "You do not have permission to use this command."
            )
            return
        if isinstance(error, app_commands.BotMissingPermissions):
            missing = ", ".join(error.missing_permissions)
            await send_ephemeral_error(interaction, f"I am missing permissions: `{missing}`.")
            return
        original = error.original if isinstance(error, app_commands.CommandInvokeError) else error
        command_name = (
            interaction.command.qualified_name if interaction.command is not None else "unknown"
        )
        logger.error(
            "Application command failed command=%s guild_id=%s user_id=%s",
            command_name,
            interaction.guild_id,
            interaction.user.id,
            exc_info=(type(original), original, original.__traceback__),
        )
        await send_ephemeral_error(
            interaction,
            "The command failed. The error has been logged for the bot operator.",
        )


class MarwieBot(commands.Bot):
    database: Database | None

    def __init__(self, settings: Settings) -> None:
        intents = discord.Intents.default()
        intents.members = False
        intents.presences = False
        intents.message_content = settings.enable_message_content
        intents.voice_states = True

        super().__init__(
            command_prefix=commands.when_mentioned,
            intents=intents,
            help_command=None,
            tree_cls=MarwieCommandTree,
        )
        self.settings = settings
        self.database = None

    async def setup_hook(self) -> None:
        logger.info("Applying database migrations")
        await upgrade_database(self.settings.database_url)
        logger.info("Database migrations are current")

        self.database = Database(self.settings.database_url)
        for extension in EXTENSIONS:
            await self.load_extension(extension)
            logger.info("Loaded extension %s", extension)

        wrapped = install_command_confirmations(self.tree)
        logger.info("Installed confirmation flow for %s application commands", wrapped)

        if not self.settings.sync_commands:
            logger.info("Command sync disabled")
            return

        if self.settings.command_guild_id is not None:
            guild = discord.Object(id=self.settings.command_guild_id)
            self.tree.copy_global_to(guild=guild)
            synced = await self.tree.sync(guild=guild)
            logger.info(
                "Synced %s commands to guild %s",
                len(synced),
                self.settings.command_guild_id,
            )
        else:
            synced = await self.tree.sync()
            logger.info("Synced %s global commands", len(synced))

    async def on_ready(self) -> None:
        logger.info("Bot ready as %s", self.user)

    async def close(self) -> None:
        if self.database is not None:
            await self.database.close()
            self.database = None
        await super().close()
