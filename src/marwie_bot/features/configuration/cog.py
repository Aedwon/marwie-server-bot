from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands

from marwie_bot.config.resources import ResourceKey
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.repository import SQLAlchemyResourceRepository
from marwie_bot.features.configuration.service import ResourceService


class ConfigurationCog(commands.Cog):
    setup_group = app_commands.Group(
        name="setup",
        description="Configure server resources used by the bot.",
        default_permissions=discord.Permissions(administrator=True),
        guild_only=True,
    )

    def __init__(self, bot: commands.Bot, service: ResourceService) -> None:
        self.bot = bot
        self.service = service

    @setup_group.command(name="resource", description="Set a Discord resource used by the bot.")
    @app_commands.choices(
        key=[app_commands.Choice(name="Moderation log", value=ResourceKey.MODERATION_LOG.value)]
    )
    @app_commands.checks.has_permissions(administrator=True)
    async def set_resource(
        self,
        interaction: discord.Interaction,
        key: app_commands.Choice[str],
        channel: discord.TextChannel,
    ) -> None:
        if interaction.guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return

        record = await self.service.set_channel(
            guild_id=interaction.guild.id,
            key=ResourceKey(key.value),
            channel_id=channel.id,
            updated_by=interaction.user.id,
        )
        await interaction.response.send_message(
            f"Set `{record.key.value}` to {channel.mention}.", ephemeral=True
        )

    @setup_group.command(name="status", description="Show configured Discord resources.")
    @app_commands.checks.has_permissions(administrator=True)
    async def status(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return

        records = await self.service.list_for_guild(guild.id)
        if not records:
            await interaction.response.send_message(
                "No server resources are configured yet.", ephemeral=True
            )
            return

        lines: list[str] = []
        for record in records:
            resource = guild.get_channel(record.discord_id)
            value = resource.mention if resource is not None else f"`{record.discord_id}` (stale)"
            lines.append(f"`{record.key.value}`: {value}")

        embed = discord.Embed(
            title="Bot setup",
            description="\n".join(lines),
            color=discord.Color.blurple(),
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading ConfigurationCog")
    service = ResourceService(SQLAlchemyResourceRepository(database))
    await bot.add_cog(ConfigurationCog(bot, service))
