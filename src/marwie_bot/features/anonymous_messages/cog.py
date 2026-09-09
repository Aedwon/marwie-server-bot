from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

import discord
from discord import app_commands
from discord.ext import commands, tasks

from marwie_bot.config.resources import ResourceKey
from marwie_bot.db.session import Database
from marwie_bot.features.anonymous_messages.render import build_panel_embed
from marwie_bot.features.anonymous_messages.repository import SQLAlchemyAnonymousMessageRepository
from marwie_bot.features.anonymous_messages.service import AnonymousMessageService
from marwie_bot.features.anonymous_messages.views import (
    AnonPanelView,
    AnonReplyView,
    resolve_destinations,
    send_ephemeral,
)
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class SyncResult:
    total: int
    corrected: int


class AnonymousMessagesCog(commands.Cog, name="AnonMessages"):
    anon_group = app_commands.Group(
        name="anon",
        description="Anonymous messages system.",
        guild_only=True,
        default_permissions=discord.Permissions(administrator=True),
    )

    def __init__(
        self,
        bot: commands.Bot,
        service: AnonymousMessageService,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        self.bot = bot
        self.service = service
        self.resources = resources
        self.features = features
        self.pending_sync_guilds: set[int] = set()

    async def cog_load(self) -> None:
        self.bot.add_view(AnonPanelView(self.service, self.resources, self.features))
        self.bot.add_view(AnonReplyView(self.service, self.resources, self.features))

        enabled = bool(
            getattr(getattr(self.bot, "settings", None), "enable_background_tasks", True)
        )
        if enabled:
            if not self.sticky_repost.is_running():
                self.sticky_repost.start()
            if not self.sync_queue_worker.is_running():
                self.sync_queue_worker.start()
        logger.info("Anonymous message persistent views registered background_tasks=%s", enabled)

    async def cog_unload(self) -> None:
        if self.sticky_repost.is_running():
            self.sticky_repost.cancel()
        if self.sync_queue_worker.is_running():
            self.sync_queue_worker.cancel()

    async def _submissions_channel(self, guild: discord.Guild) -> discord.TextChannel | None:
        resource = await self.resources.get(guild.id, ResourceKey.ANON_MESSAGES_SUBMISSIONS)
        if resource is None:
            return None
        channel = guild.get_channel(resource.discord_id)
        return channel if isinstance(channel, discord.TextChannel) else None

    @commands.Cog.listener()
    async def on_raw_message_delete(self, payload: discord.RawMessageDeleteEvent) -> None:
        if payload.guild_id is None:
            return
        guild = self.bot.get_guild(payload.guild_id)
        if guild is None:
            return
        channel = await self._submissions_channel(guild)
        if channel is None or channel.id != payload.channel_id:
            return
        tracked = await self.service.mark_deleted_by_message(payload.guild_id, payload.message_id)
        if tracked:
            self.pending_sync_guilds.add(payload.guild_id)

    @commands.Cog.listener()
    async def on_raw_bulk_message_delete(self, payload: discord.RawBulkMessageDeleteEvent) -> None:
        if payload.guild_id is None:
            return
        guild = self.bot.get_guild(payload.guild_id)
        if guild is None:
            return
        channel = await self._submissions_channel(guild)
        if channel is None or channel.id != payload.channel_id:
            return

        tracked_any = False
        for message_id in payload.message_ids:
            tracked = await self.service.mark_deleted_by_message(payload.guild_id, message_id)
            tracked_any = tracked_any or tracked
        if tracked_any:
            self.pending_sync_guilds.add(payload.guild_id)

    @tasks.loop(seconds=5)
    async def sync_queue_worker(self) -> None:
        if not self.pending_sync_guilds:
            return
        guild_id = min(self.pending_sync_guilds)
        self.pending_sync_guilds.discard(guild_id)
        guild = self.bot.get_guild(guild_id)
        if guild is None:
            return
        try:
            await self._run_full_sync(guild)
        except Exception:
            logger.exception("Anonymous message queued sync failed guild_id=%s", guild_id)

    @sync_queue_worker.before_loop
    async def before_sync_queue_worker(self) -> None:
        await self.bot.wait_until_ready()

    async def _run_full_sync(self, guild: discord.Guild) -> SyncResult:
        channel = await self._submissions_channel(guild)
        if channel is None:
            return SyncResult(total=0, corrected=0)

        corrected = 0
        total = 0
        for _pass in range(2):
            plan = await self.service.renumber_plan(guild.id)
            total = len(plan)
            found_missing = False

            for item in plan:
                if item.current_number == item.expected_number:
                    continue
                try:
                    message = await channel.fetch_message(item.message_id)
                except discord.NotFound:
                    await self.service.mark_deleted_by_message(guild.id, item.message_id)
                    found_missing = True
                    continue
                except discord.HTTPException:
                    logger.exception(
                        "Could not fetch anonymous message during sync guild_id=%s message_id=%s",
                        guild.id,
                        item.message_id,
                    )
                    continue

                if not message.embeds:
                    logger.warning(
                        "Tracked anonymous message has no embed guild_id=%s message_id=%s",
                        guild.id,
                        item.message_id,
                    )
                    continue
                embed = discord.Embed.from_dict(message.embeds[0].to_dict())
                embed.title = f"Anonymous Message #{item.expected_number}"
                try:
                    await message.edit(embed=embed)
                except discord.HTTPException:
                    logger.exception(
                        "Could not edit anonymous message number guild_id=%s message_id=%s",
                        guild.id,
                        item.message_id,
                    )
                    continue
                await self.service.set_display_number(item.record_id, item.expected_number)
                corrected += 1
                await asyncio.sleep(2)

            if not found_missing:
                break

        return SyncResult(total=total, corrected=corrected)

    @tasks.loop(minutes=10)
    async def sticky_repost(self) -> None:
        for guild in tuple(self.bot.guilds):
            try:
                await self._ensure_panel(guild)
            except Exception:
                logger.exception("Anonymous panel reconciliation failed guild_id=%s", guild.id)

    @sticky_repost.before_loop
    async def before_sticky_repost(self) -> None:
        await self.bot.wait_until_ready()

    @staticmethod
    def _panel_permissions_ok(channel: discord.TextChannel, guild: discord.Guild) -> bool:
        member = getattr(guild, "me", None)
        if member is None:
            return False
        permissions = channel.permissions_for(member)
        return bool(
            permissions.send_messages
            and permissions.embed_links
            and permissions.manage_messages
        )

    async def _ensure_panel(self, guild: discord.Guild, *, force: bool = False) -> bool:
        if not force:
            from marwie_bot.config.resources import FeatureName

            if not await self.features.is_enabled(guild.id, FeatureName.ANONYMOUS_MESSAGES):
                return False

        destinations = await resolve_destinations(guild, self.resources)
        if destinations is None:
            return False
        panel_channel = destinations.panel
        if not self._panel_permissions_ok(panel_channel, guild):
            logger.warning(
                "Anonymous panel permissions missing guild_id=%s channel_id=%s",
                guild.id,
                panel_channel.id,
            )
            return False

        stored = await self.service.get_panel(guild.id)
        if stored is not None and not force and stored.channel_id == panel_channel.id:
            try:
                latest = [message async for message in panel_channel.history(limit=1)]
            except discord.HTTPException:
                logger.exception(
                    "Could not inspect anonymous panel channel guild_id=%s channel_id=%s",
                    guild.id,
                    panel_channel.id,
                )
            else:
                if latest and latest[0].id == stored.message_id:
                    return False

        if stored is not None:
            old_channel = guild.get_channel(stored.channel_id)
            if old_channel is not None and hasattr(old_channel, "fetch_message"):
                try:
                    old_message = await old_channel.fetch_message(stored.message_id)  # type: ignore[attr-defined]
                    await old_message.delete()
                except discord.NotFound:
                    pass
                except discord.HTTPException:
                    logger.exception(
                        "Could not remove previous anonymous panel guild_id=%s channel_id=%s message_id=%s",
                        guild.id,
                        stored.channel_id,
                        stored.message_id,
                    )

        try:
            message = await panel_channel.send(
                embed=build_panel_embed(guild),
                view=AnonPanelView(self.service, self.resources, self.features),
                allowed_mentions=discord.AllowedMentions.none(),
            )
        except discord.HTTPException:
            logger.exception(
                "Could not post anonymous panel guild_id=%s channel_id=%s",
                guild.id,
                panel_channel.id,
            )
            return False

        await self.service.save_panel(guild.id, panel_channel.id, message.id)
        return True

    @anon_group.command(name="deploy", description="Deploy the anonymous messages panel now.")
    @app_commands.default_permissions(administrator=True)
    @app_commands.checks.has_permissions(administrator=True)
    async def deploy_panel(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        await interaction.response.defer(ephemeral=True)
        destinations = await resolve_destinations(guild, self.resources)
        if destinations is None:
            await send_ephemeral(
                interaction,
                "Configure `anon_messages_panel`, `anon_messages_submissions`, and `anon_messages_audit_log` in Mappings first.",
            )
            return
        deployed = await self._ensure_panel(guild, force=True)
        if not deployed:
            await send_ephemeral(
                interaction,
                "❌ I could not deploy the panel. Check my permissions in the mapped panel channel.",
            )
            return
        await send_ephemeral(
            interaction,
            (
                "✅ Anonymous messages panel deployed.\n"
                f"Panel: {destinations.panel.mention}\n"
                f"Submissions: {destinations.submissions.mention}\n"
                f"Staff audit: {destinations.audit_log.mention}"
            ),
        )

    @anon_group.command(
        name="sync",
        description="Force re-number all anonymous messages sequentially.",
    )
    @app_commands.default_permissions(administrator=True)
    @app_commands.checks.has_permissions(administrator=True)
    async def sync_messages(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        await interaction.response.defer(ephemeral=True)
        channel = await self._submissions_channel(guild)
        if channel is None:
            await send_ephemeral(
                interaction,
                "Configure `anon_messages_submissions` in Mappings first.",
            )
            return
        result = await self._run_full_sync(guild)
        if result.total == 0:
            await send_ephemeral(
                interaction,
                f"ℹ️ No anonymous messages found in {channel.mention}. Nothing to sync.",
            )
            return
        await send_ephemeral(
            interaction,
            (
                f"✅ Sync complete. {result.corrected} message(s) renumbered "
                f"out of {result.total} tracked top-level messages in {channel.mention}."
            ),
        )


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading AnonymousMessagesCog")
    repository = SQLAlchemyAnonymousMessageRepository(database)
    service = AnonymousMessageService(repository)
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    await bot.add_cog(AnonymousMessagesCog(bot, service, resources, features))
