from __future__ import annotations

import logging
from urllib.parse import urlparse

import aiohttp
import discord
from discord import app_commands
from discord.ext import commands, tasks

from marwie_bot.config.resources import FeatureName, ResourceKey
from marwie_bot.db.session import Database
from marwie_bot.features.ai_updates.repository import AISourceRecord, SQLAlchemyAIUpdatesRepository
from marwie_bot.features.ai_updates.service import parse_feed
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService

logger = logging.getLogger(__name__)


class AIUpdatesCog(commands.Cog):
    ai_source_group = app_commands.Group(
        name="ai-source",
        description="Manage authoritative AI update feeds.",
        default_permissions=discord.Permissions(manage_guild=True),
        guild_only=True,
    )

    def __init__(
        self,
        bot: commands.Bot,
        repository: SQLAlchemyAIUpdatesRepository,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        self.bot = bot
        self.repository = repository
        self.resources = resources
        self.features = features
        self.http: aiohttp.ClientSession | None = None
        if getattr(getattr(bot, "settings", None), "enable_background_tasks", True):
            self.poll_loop.start()

    async def cog_load(self) -> None:
        self.http = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20))

    async def cog_unload(self) -> None:
        self.poll_loop.cancel()
        if self.http is not None:
            await self.http.close()
            self.http = None

    @ai_source_group.command(name="add", description="Add or update an RSS/Atom source.")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def add_source(
        self,
        interaction: discord.Interaction,
        name: app_commands.Range[str, 1, 100],
        url: app_commands.Range[str, 8, 1000],
        category: app_commands.Range[str, 1, 50],
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        parsed = urlparse(str(url))
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            await interaction.response.send_message(
                "Source URL must be HTTP or HTTPS.", ephemeral=True
            )
            return
        source = await self.repository.add_source(
            interaction.guild_id, str(name).strip(), str(url).strip(), str(category).strip()
        )
        await interaction.response.send_message(
            f"AI source `#{source.id}` `{source.name}` is enabled.", ephemeral=True
        )

    @ai_source_group.command(name="list", description="List configured AI update sources.")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def list_sources(self, interaction: discord.Interaction) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        sources = await self.repository.list_sources(interaction.guild_id)
        lines = [
            f"`#{item.id}` **{item.name}** · `{item.category}` · {'on' if item.enabled else 'off'}\n{item.url}"
            for item in sources
        ]
        await interaction.response.send_message(
            "\n".join(lines) or "No AI update sources configured.", ephemeral=True
        )

    @ai_source_group.command(name="disable", description="Disable an AI update source by ID.")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def disable_source(
        self, interaction: discord.Interaction, source_id: app_commands.Range[int, 1]
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        changed = await self.repository.disable_source(interaction.guild_id, int(source_id))
        await interaction.response.send_message(
            "Source disabled." if changed else "Source not found.", ephemeral=True
        )

    @ai_source_group.command(name="poll", description="Poll configured AI sources now.")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def poll_now(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        await interaction.response.defer(ephemeral=True)
        posted = 0
        for source in await self.repository.list_sources(guild.id, enabled_only=True):
            posted += await self._poll_source(source)
        await interaction.followup.send(
            f"AI source poll complete. Posted {posted} new item(s).", ephemeral=True
        )

    async def _poll_source(self, source: AISourceRecord) -> int:
        guild = self.bot.get_guild(source.guild_id)
        if guild is None or not await self.features.is_enabled(guild.id, FeatureName.AI_UPDATES):
            return 0
        destination_resource = await self.resources.get(guild.id, ResourceKey.AI_UPDATES)
        destination = (
            guild.get_channel(destination_resource.discord_id) if destination_resource else None
        )
        if not isinstance(destination, discord.TextChannel) or self.http is None:
            return 0
        try:
            async with self.http.get(source.url, allow_redirects=True) as response:
                response.raise_for_status()
                xml_text = await response.text()
            parsed_items = parse_feed(xml_text)
        except (aiohttp.ClientError, TimeoutError, ValueError) as error:
            logger.warning("AI feed failed source=%s url=%s error=%s", source.id, source.url, error)
            return 0
        posted = 0
        for item in parsed_items[-10:]:
            stored = await self.repository.store_item(source, item)
            if stored is None:
                continue
            embed = discord.Embed(
                title=stored.title,
                url=stored.url,
                description=f"**{source.name}** · `{source.category}`",
                color=discord.Color.blurple(),
                timestamp=stored.published_at,
            )
            try:
                message = await destination.send(embed=embed)
            except discord.HTTPException as error:
                logger.warning("Could not post AI update item %s: %s", stored.id, error)
                continue
            await self.repository.mark_posted(stored.id, message.id)
            posted += 1
        await self.repository.mark_checked(source.id)
        return posted

    @tasks.loop(minutes=30)
    async def poll_loop(self) -> None:
        for source in await self.repository.list_sources(enabled_only=True):
            await self._poll_source(source)

    @poll_loop.before_loop
    async def before_poll_loop(self) -> None:
        await self.bot.wait_until_ready()


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading AIUpdatesCog")
    repository = SQLAlchemyAIUpdatesRepository(database)
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    await bot.add_cog(AIUpdatesCog(bot, repository, resources, features))
