from __future__ import annotations

import logging
from collections import defaultdict
from urllib.parse import urlparse

import aiohttp
import discord
from discord import app_commands
from discord.ext import commands, tasks

from marwie_bot.config.resources import FeatureName, ResourceKey
from marwie_bot.db.session import Database
from marwie_bot.features.ai_updates.manual_polling import (
    ManualFeedCandidate,
    ManualFeedPollingService,
    ManualFeedPreview,
    ManualFeedPreviewInvalid,
    manual_preview_line,
)
from marwie_bot.features.ai_updates.repository import AISourceRecord, SQLAlchemyAIUpdatesRepository
from marwie_bot.features.ai_updates.service import FeedItem, parse_feed
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService

logger = logging.getLogger(__name__)


def _preview_embed(preview: ManualFeedPreview) -> discord.Embed:
    lines = [manual_preview_line(candidate) for candidate in preview.candidates]
    if not lines:
        lines.append("No new feed candidates were found.")
    embed = discord.Embed(
        title="AI feed poll preview",
        description="\n".join(lines),
        color=discord.Color.blurple(),
    )
    embed.set_footer(
        text=(
            "Nothing has been posted. Post rechecks permissions, source state, destination, "
            "dedupe state, and the exact candidate set."
        )
    )
    return embed


class ManualFeedPollView(discord.ui.View):
    def __init__(
        self,
        *,
        service: ManualFeedPollingService,
        preview: ManualFeedPreview,
    ) -> None:
        super().__init__(timeout=60)
        self.service = service
        self.preview = preview
        self.message: discord.WebhookMessage | None = None
        self.completed = False

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id == self.preview.actor_id:
            return True
        await interaction.response.send_message(
            "Only the person who ran `/ai-source poll` can post or cancel this preview.",
            ephemeral=True,
        )
        return False

    @discord.ui.button(label="Post", style=discord.ButtonStyle.success)
    async def post(
        self,
        interaction: discord.Interaction,
        _button: discord.ui.Button[ManualFeedPollView],
    ) -> None:
        if self.completed:
            await interaction.response.send_message(
                "This feed preview has already been decided.", ephemeral=True
            )
            return
        guild = interaction.guild
        if guild is None or guild.id != self.preview.guild_id:
            await interaction.response.send_message(
                "The original server is no longer available for this preview.", ephemeral=True
            )
            return

        self.completed = True
        await interaction.response.defer(ephemeral=True, thinking=True)
        completion = "AI feed poll failed unexpectedly. Fetch a new preview before trying again."
        try:
            posted = await self.service.post(
                self.preview.token,
                guild_id=guild.id,
                actor_id=interaction.user.id,
            )
            await interaction.followup.send(
                f"AI feed poll posted {posted} reviewed item(s).",
                ephemeral=True,
            )
            completion = f"Posted {posted} reviewed AI feed item(s)."
        except ManualFeedPreviewInvalid as error:
            completion = "Feed preview expired or changed; nothing was posted."
            await interaction.followup.send(str(error), ephemeral=True)
        except Exception:
            logger.exception(
                "Unexpected manual feed publication failure "
                "guild_id=%s actor_id=%s candidate_count=%s",
                guild.id,
                interaction.user.id,
                len(self.preview.candidates),
            )
            await interaction.followup.send(
                "The AI feed poll failed unexpectedly. Fetch a new preview before trying again.",
                ephemeral=True,
            )
        finally:
            self.stop()
            if self.message is not None:
                try:
                    await self.message.edit(content=completion, embed=None, view=None)
                except discord.HTTPException:
                    logger.debug("Could not update the manual feed preview prompt")

    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.secondary)
    async def cancel(
        self,
        interaction: discord.Interaction,
        _button: discord.ui.Button[ManualFeedPollView],
    ) -> None:
        if self.completed:
            await interaction.response.send_message(
                "This feed preview has already been decided.", ephemeral=True
            )
            return
        self.completed = True
        self.stop()
        try:
            await self.service.cancel(
                self.preview.token,
                guild_id=self.preview.guild_id,
                actor_id=interaction.user.id,
            )
        except ManualFeedPreviewInvalid:
            pass
        await interaction.response.edit_message(
            content="Cancelled the AI feed poll preview. Nothing was posted.",
            embed=None,
            view=None,
        )

    async def on_timeout(self) -> None:
        if self.completed:
            return
        self.completed = True
        try:
            await self.service.cancel(
                self.preview.token,
                guild_id=self.preview.guild_id,
                actor_id=self.preview.actor_id,
            )
        except ManualFeedPreviewInvalid:
            pass
        if self.message is not None:
            try:
                await self.message.edit(
                    content="The AI feed poll preview expired. Nothing was posted.",
                    embed=None,
                    view=None,
                )
            except discord.HTTPException:
                logger.debug("Could not expire the manual feed preview prompt")


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
        self.manual_polling = ManualFeedPollingService(
            repository=repository,
            fetch_items=self._fetch_feed_items,
            resolve_destination=self._resolve_destination_id,
            is_feature_enabled=self._ai_updates_enabled,
            can_manage_guild=self._can_manage_guild,
            publish_candidates=self._publish_manual_candidates,
        )
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

    @ai_source_group.command(
        name="poll",
        description="Fetch a preview of new AI feed items before choosing Post or Cancel.",
    )
    @app_commands.checks.has_permissions(manage_guild=True)
    async def poll_now(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        await interaction.response.defer(ephemeral=True, thinking=True)
        try:
            preview = await self.manual_polling.preview(
                guild_id=guild.id,
                actor_id=interaction.user.id,
            )
        except ManualFeedPreviewInvalid as error:
            await interaction.followup.send(str(error), ephemeral=True)
            return

        if not preview.candidates:
            await self.manual_polling.cancel(
                preview.token,
                guild_id=guild.id,
                actor_id=interaction.user.id,
            )
            await interaction.followup.send(
                "AI feed poll preview found no new items. Nothing was posted.", ephemeral=True
            )
            return

        view = ManualFeedPollView(service=self.manual_polling, preview=preview)
        message = await interaction.followup.send(
            embed=_preview_embed(preview),
            view=view,
            ephemeral=True,
            wait=True,
        )
        if isinstance(message, discord.WebhookMessage):
            view.message = message

    async def _ai_updates_enabled(self, guild_id: int) -> bool:
        return await self.features.is_enabled(guild_id, FeatureName.AI_UPDATES)

    async def _can_manage_guild(self, guild_id: int, actor_id: int) -> bool:
        guild = self.bot.get_guild(guild_id)
        if guild is None:
            return False
        member = guild.get_member(actor_id)
        if member is None:
            try:
                member = await guild.fetch_member(actor_id)
            except (discord.NotFound, discord.Forbidden, discord.HTTPException):
                return False
        permissions = member.guild_permissions
        return permissions.administrator or permissions.manage_guild

    async def _resolve_destination(self, guild_id: int) -> discord.TextChannel | None:
        guild = self.bot.get_guild(guild_id)
        if guild is None:
            return None
        destination_resource = await self.resources.get(guild_id, ResourceKey.AI_UPDATES)
        destination = (
            guild.get_channel(destination_resource.discord_id) if destination_resource else None
        )
        return destination if isinstance(destination, discord.TextChannel) else None

    async def _resolve_destination_id(self, guild_id: int) -> int | None:
        destination = await self._resolve_destination(guild_id)
        return destination.id if destination is not None else None

    async def _fetch_feed_items(self, source: AISourceRecord) -> list[FeedItem]:
        if self.http is None:
            return []
        try:
            async with self.http.get(source.url, allow_redirects=True) as response:
                response.raise_for_status()
                xml_text = await response.text()
            return parse_feed(xml_text)
        except (aiohttp.ClientError, TimeoutError, ValueError) as error:
            logger.warning("AI feed failed source=%s url=%s error=%s", source.id, source.url, error)
            return []

    async def _publish_candidates(
        self,
        source: AISourceRecord,
        destination: discord.TextChannel,
        candidates: list[FeedItem] | tuple[FeedItem, ...],
    ) -> int:
        posted = 0
        for item in candidates:
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
        return posted

    async def _poll_source(self, source: AISourceRecord) -> int:
        guild = self.bot.get_guild(source.guild_id)
        if guild is None or not await self.features.is_enabled(guild.id, FeatureName.AI_UPDATES):
            return 0
        destination = await self._resolve_destination(guild.id)
        if destination is None:
            return 0
        candidates = await self._fetch_feed_items(source)
        posted = await self._publish_candidates(source, destination, candidates[-10:])
        await self.repository.mark_checked(source.id)
        return posted

    async def _publish_manual_candidates(
        self,
        guild_id: int,
        destination_id: int,
        candidates: tuple[ManualFeedCandidate, ...],
    ) -> int:
        guild = self.bot.get_guild(guild_id)
        if guild is None:
            raise ManualFeedPreviewInvalid("Rob-bot is no longer connected to that server.")
        destination = guild.get_channel(destination_id)
        if not isinstance(destination, discord.TextChannel):
            raise ManualFeedPreviewInvalid("The AI updates destination is no longer available.")
        bot_member = guild.me
        if bot_member is None:
            raise ManualFeedPreviewInvalid("Rob-bot's server member is unavailable.")
        permissions = destination.permissions_for(bot_member)
        if not permissions.send_messages or not permissions.embed_links:
            raise ManualFeedPreviewInvalid(
                "Rob-bot no longer has permission to publish in the AI updates destination."
            )

        sources = {
            source.id: source
            for source in await self.repository.list_sources(guild_id, enabled_only=True)
        }
        grouped: dict[int, list[FeedItem]] = defaultdict(list)
        for candidate in candidates:
            if candidate.source_id not in sources:
                raise ManualFeedPreviewInvalid(
                    "An AI source changed before publishing. Fetch a new preview."
                )
            grouped[candidate.source_id].append(candidate.feed_item())

        posted = 0
        for source_id, items in grouped.items():
            source = sources[source_id]
            posted += await self._publish_candidates(source, destination, items)
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
