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
    TrapExecutionResult,
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


def _failed_scope_ids(values: Any) -> list[int]:
    result: list[int] = []
    for value in values or ():
        if isinstance(value, dict):
            scope_id = value.get("scope_id")
        else:
            scope_id = getattr(value, "scope_id", None)
        if isinstance(scope_id, int):
            result.append(scope_id)
    return result


class DiscordTrapEnforcer:
    def __init__(self, guild: Any) -> None:
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
        bot: Any,
        resources: Any,
        trap_service: Any,
        moderation: Any | None = None,
        incidents: Any | None = None,
    ) -> None:
        self.bot = bot
        self.resources = resources
        self.trap_service = trap_service
        self.moderation = moderation
        self.incidents = incidents

    async def _post_summary(
        self,
        guild: Any,
        *,
        target_id: int,
        trigger_channel_id: int,
        trigger_message_id: int,
        incident_id: int,
        case_id: int | None,
        ban_status: str,
        cleanup_path: str,
        deleted_message_count: int,
        failed_scope_ids: list[int],
        containment_status: str,
    ) -> bool:
        resource = await self.resources.get(guild.id, ResourceKey.MODERATION_LOG)
        if resource is None:
            return False
        channel = guild.get_channel(resource.discord_id)
        if not isinstance(channel, discord.TextChannel):
            return False

        embed = discord.Embed(
            title="Compromised account trap incident",
            color=discord.Color.orange(),
            timestamp=datetime.now(UTC),
        )
        embed.add_field(name="Target", value=f"<@{target_id}>", inline=True)
        embed.add_field(name="Trap channel", value=f"<#{trigger_channel_id}>", inline=True)
        embed.add_field(name="Trigger message", value=str(trigger_message_id), inline=True)
        embed.add_field(name="Ban result", value=ban_status, inline=True)
        embed.add_field(name="Cleanup path", value=cleanup_path, inline=True)
        embed.add_field(name="Deleted messages", value=str(deleted_message_count), inline=True)
        embed.add_field(
            name="Failed/inaccessible scopes",
            value=", ".join(str(scope_id) for scope_id in failed_scope_ids) or "None",
            inline=False,
        )
        embed.add_field(name="Containment", value=containment_status, inline=True)
        embed.add_field(name="Incident", value=str(incident_id), inline=True)
        embed.add_field(
            name="Case",
            value=str(case_id) if case_id is not None else "Unavailable",
            inline=True,
        )

        try:
            await channel.send(embed=embed)
        except discord.HTTPException as error:
            logger.warning(
                "Could not post compromise trap summary guild_id=%s user_id=%s channel_id=%s message_id=%s incident_id=%s error_class=%s containment_status=%s",
                guild.id,
                target_id,
                trigger_channel_id,
                trigger_message_id,
                incident_id,
                type(error).__name__,
                containment_status,
            )
            return False
        return True

    async def _audit_full_incident(
        self,
        guild: Any,
        message: Any,
        result: TrapExecutionResult,
        moderator_id: int,
    ) -> None:
        if result.incident_id is None:
            logger.error(
                "Completed compromise trap result missing incident id guild_id=%s user_id=%s channel_id=%s message_id=%s",
                guild.id,
                message.author.id,
                message.channel.id,
                message.id,
            )
            return

        case_id: int | None = None
        if self.moderation is None:
            logger.error(
                "Compromise trap moderation service unavailable guild_id=%s user_id=%s channel_id=%s message_id=%s incident_id=%s",
                guild.id,
                message.author.id,
                message.channel.id,
                message.id,
                result.incident_id,
            )
        else:
            try:
                case = await self.moderation.create_case(
                    guild.id,
                    "ban",
                    message.author.id,
                    moderator_id,
                    result.reason,
                    metadata=result.metadata,
                )
            except Exception as error:
                logger.error(
                    "Could not persist compromise trap moderation case guild_id=%s user_id=%s channel_id=%s message_id=%s incident_id=%s error_class=%s containment_status=%s",
                    guild.id,
                    message.author.id,
                    message.channel.id,
                    message.id,
                    result.incident_id,
                    type(error).__name__,
                    result.containment_status.value
                    if result.containment_status is not None
                    else None,
                    exc_info=(type(error), error, error.__traceback__),
                )
            else:
                case_id = case.id

        await self._post_summary(
            guild,
            target_id=message.author.id,
            trigger_channel_id=message.channel.id,
            trigger_message_id=message.id,
            incident_id=result.incident_id,
            case_id=case_id,
            ban_status=result.ban_status.value
            if result.ban_status is not None
            else "not_attempted",
            cleanup_path=str(result.metadata.get("cleanup_path", "none")),
            deleted_message_count=result.deleted_message_count,
            failed_scope_ids=_failed_scope_ids(result.failed_scopes),
            containment_status=(
                result.containment_status.value
                if result.containment_status is not None
                else "unknown"
            ),
        )

    @commands.Cog.listener()
    async def on_message(self, message: Any) -> None:
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
        if result.delete_trigger_only:
            try:
                await message.delete()
            except discord.HTTPException as error:
                logger.warning(
                    "Could not delete duplicate/cooldown compromise trap message guild_id=%s user_id=%s channel_id=%s message_id=%s error=%s",
                    guild.id,
                    message.author.id,
                    message.channel.id,
                    message.id,
                    _discord_error(error),
                )
            return

        if result.full_incident:
            await self._audit_full_incident(guild, message, result, bot_user.id)

    @commands.Cog.listener()
    async def on_ready(self) -> None:
        if self.incidents is None:
            return

        interrupted = await self.incidents.mark_in_progress_interrupted(datetime.now(UTC))
        for incident in interrupted:
            guild = self.bot.get_guild(incident.guild_id)
            if guild is None:
                logger.warning(
                    "Interrupted compromise trap incident guild unavailable guild_id=%s user_id=%s channel_id=%s message_id=%s incident_id=%s containment_status=interrupted",
                    incident.guild_id,
                    incident.target_id,
                    incident.trigger_channel_id,
                    incident.trigger_message_id,
                    incident.id,
                )
                continue

            await self._post_summary(
                guild,
                target_id=incident.target_id,
                trigger_channel_id=incident.trigger_channel_id,
                trigger_message_id=incident.trigger_message_id,
                incident_id=incident.id,
                case_id=None,
                ban_status=incident.ban_status or "not_attempted",
                cleanup_path=("fallback" if incident.fallback_cleanup_run else "none"),
                deleted_message_count=incident.deleted_message_count,
                failed_scope_ids=_failed_scope_ids(incident.failed_scopes),
                containment_status=incident.containment_status or "interrupted",
            )


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading CompromisedAccountTrapCog")

    resources = ResourceService(SQLAlchemyResourceRepository(database))
    incidents = SQLAlchemyCompromiseTrapRepository(database)
    trap_service = CompromiseTrapService(incidents)
    moderation = ModerationService(SQLAlchemyModerationRepository(database))
    await bot.add_cog(
        CompromisedAccountTrapCog(bot, resources, trap_service, moderation, incidents)
    )
