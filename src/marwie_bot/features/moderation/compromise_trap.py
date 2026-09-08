from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

import discord
from discord.ext import commands

from marwie_bot.config.resources import ResourceKey
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.repository import SQLAlchemyResourceRepository
from marwie_bot.features.configuration.service import ResourceService
from marwie_bot.features.moderation.compromise_trap_repository import (
    SQLAlchemyCompromiseTrapRepository,
)
from marwie_bot.features.moderation.compromise_trap_service import (
    TRAP_REASON,
    BanAttempt,
    CleanupFailure,
    CleanupResult,
    CompromiseTrapService,
    TrapTrigger,
)
from marwie_bot.features.moderation.repository import SQLAlchemyModerationRepository
from marwie_bot.features.moderation.service import ModerationService

logger = logging.getLogger(__name__)

_REQUIRED_CLEANUP_PERMISSIONS = (
    "view_channel",
    "read_message_history",
    "manage_messages",
)


def _discord_error(error: discord.HTTPException) -> str:
    detail = str(error).strip()
    value = type(error).__name__ if not detail else f"{type(error).__name__}: {detail}"
    return value[:300]


class DiscordTrapEnforcer:
    def __init__(self, guild: discord.Guild) -> None:
        self.guild = guild

    async def ban(
        self,
        user_id: int,
        reason: str,
        delete_message_seconds: int,
    ) -> BanAttempt:
        try:
            await self.guild.ban(
                discord.Object(id=user_id),
                reason=reason,
                delete_message_seconds=delete_message_seconds,
            )
        except discord.HTTPException as error:
            return BanAttempt(succeeded=False, error=_discord_error(error))
        return BanAttempt(succeeded=True)

    async def cleanup(self, user_id: int, since: datetime) -> CleanupResult:
        bot_member = self.guild.me
        if bot_member is None:
            return CleanupResult(
                deleted_count=0,
                scanned_scopes=0,
                failures=(
                    CleanupFailure(
                        scope_id=self.guild.id,
                        scope_name="guild",
                        error="Bot member state is unavailable.",
                    ),
                ),
            )

        deleted_count = 0
        scanned_scopes = 0
        failures: list[CleanupFailure] = []
        seen_scope_ids: set[int] = set()

        def record_failure(scope: Any, error: str) -> None:
            failures.append(
                CleanupFailure(
                    scope_id=int(scope.id),
                    scope_name=str(getattr(scope, "name", scope.id))[:100],
                    error=error[:300],
                )
            )

        async def scan_scope(scope: Any) -> None:
            nonlocal deleted_count, scanned_scopes

            scope_id = int(scope.id)
            if scope_id in seen_scope_ids:
                return
            seen_scope_ids.add(scope_id)

            permissions = scope.permissions_for(bot_member)
            missing = [
                permission
                for permission in _REQUIRED_CLEANUP_PERMISSIONS
                if not bool(getattr(permissions, permission, False))
            ]
            if missing:
                record_failure(scope, f"Missing permissions: {', '.join(missing)}")
                return

            try:
                async for message in scope.history(limit=None, after=since):
                    if message.author.id != user_id:
                        continue
                    try:
                        await message.delete(reason=TRAP_REASON)
                    except discord.HTTPException as error:
                        record_failure(scope, _discord_error(error))
                    else:
                        deleted_count += 1
            except discord.HTTPException as error:
                record_failure(scope, _discord_error(error))
                return

            scanned_scopes += 1

        for channel in self.guild.text_channels:
            await scan_scope(channel)
            for thread in channel.threads:
                await scan_scope(thread)

            for private in (False, True):
                try:
                    async for thread in channel.archived_threads(private=private, limit=None):
                        await scan_scope(thread)
                except discord.HTTPException as error:
                    label = "private archived threads" if private else "archived threads"
                    record_failure(channel, f"{label}: {_discord_error(error)}")

        return CleanupResult(
            deleted_count=deleted_count,
            scanned_scopes=scanned_scopes,
            failures=tuple(failures),
        )


class CompromisedAccountTrapCog(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
        resources: ResourceService,
        trap_service: CompromiseTrapService,
        moderation: ModerationService | None = None,
    ) -> None:
        self.bot = bot
        self.resources = resources
        self.trap_service = trap_service
        self.moderation = moderation

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        guild = message.guild
        if guild is None:
            return
        if message.author.bot or message.webhook_id is not None:
            return
        if message.type not in (discord.MessageType.default, discord.MessageType.reply):
            return

        mapping = await self.resources.get(guild.id, ResourceKey.COMPROMISED_ACCOUNT_TRAP)
        if mapping is None:
            return
        mapped_channel = guild.get_channel(mapping.discord_id)
        if not isinstance(mapped_channel, discord.TextChannel):
            return
        if message.channel.id != mapping.discord_id:
            return

        bot_user = self.bot.user
        if bot_user is None:
            logger.error(
                "Compromise trap trigger ignored because bot user is unavailable guild_id=%s channel_id=%s message_id=%s",
                guild.id,
                message.channel.id,
                message.id,
            )
            return

        result = await self.trap_service.execute(
            TrapTrigger(
                guild_id=guild.id,
                user_id=message.author.id,
                channel_id=message.channel.id,
                message_id=message.id,
                triggered_at=message.created_at.astimezone(UTC),
            ),
            DiscordTrapEnforcer(guild),
            moderator_id=bot_user.id,
        )
        if not result.delete_trigger_only:
            return

        try:
            await message.delete(reason=TRAP_REASON)
        except discord.HTTPException as error:
            logger.warning(
                "Could not delete duplicate/cooldown compromise trap message guild_id=%s user_id=%s channel_id=%s message_id=%s error=%s",
                guild.id,
                message.author.id,
                message.channel.id,
                message.id,
                _discord_error(error),
            )


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading CompromisedAccountTrapCog")

    resources = ResourceService(SQLAlchemyResourceRepository(database))
    trap_service = CompromiseTrapService(SQLAlchemyCompromiseTrapRepository(database))
    moderation = ModerationService(SQLAlchemyModerationRepository(database))
    await bot.add_cog(CompromisedAccountTrapCog(bot, resources, trap_service, moderation))
