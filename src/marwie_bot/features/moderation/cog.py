from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

import discord
from discord import app_commands
from discord.ext import commands

from marwie_bot.config.resources import FeatureName, ResourceKey
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService
from marwie_bot.features.moderation.repository import SQLAlchemyModerationRepository
from marwie_bot.features.moderation.service import ModerationCaseRecord, ModerationService
from marwie_bot.shared.permissions import (
    ModerationHierarchy,
    ModerationTargetError,
    validate_moderation_target,
)

logger = logging.getLogger(__name__)


class ModerationCog(commands.Cog):
    def __init__(
        self,
        bot: commands.Bot,
        moderation: ModerationService,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        self.bot = bot
        self.moderation = moderation
        self.resources = resources
        self.features = features

    async def _ready_member_action(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        bot_permission: str,
    ) -> tuple[discord.Guild, discord.Member, discord.Member] | None:
        guild = interaction.guild
        moderator = interaction.user
        if guild is None or not isinstance(moderator, discord.Member):
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return None
        if not await self.features.is_enabled(guild.id, FeatureName.MODERATION):
            await interaction.response.send_message(
                "Moderation commands are disabled here.", ephemeral=True
            )
            return None
        bot_member = guild.me
        if bot_member is None:
            await interaction.response.send_message(
                "I could not resolve my server member state. Try again shortly.", ephemeral=True
            )
            return None
        if not getattr(bot_member.guild_permissions, bot_permission, False):
            await interaction.response.send_message(
                f"I am missing the `{bot_permission}` permission.", ephemeral=True
            )
            return None
        owner_id = guild.owner_id
        if owner_id is None:
            await interaction.response.send_message(
                "I could not resolve the server owner. Try again shortly.", ephemeral=True
            )
            return None
        try:
            validate_moderation_target(
                ModerationHierarchy(
                    caller_id=moderator.id,
                    target_id=member.id,
                    guild_owner_id=owner_id,
                    caller_top_role_position=moderator.top_role.position,
                    target_top_role_position=member.top_role.position,
                    bot_top_role_position=bot_member.top_role.position,
                )
            )
        except ModerationTargetError as error:
            await interaction.response.send_message(str(error), ephemeral=True)
            return None
        return guild, moderator, bot_member

    async def _record_and_log(
        self,
        guild: discord.Guild,
        action: str,
        target_id: int,
        moderator_id: int,
        reason: str,
        *,
        expires_at: datetime | None = None,
    ) -> ModerationCaseRecord:
        case = await self.moderation.create_case(
            guild.id,
            action,
            target_id,
            moderator_id,
            reason,
            expires_at=expires_at,
        )
        await self._post_audit_log(guild, case)
        return case

    @app_commands.command(name="warn", description="Record a formal warning for a member.")
    @app_commands.default_permissions(moderate_members=True)
    @app_commands.checks.has_permissions(moderate_members=True)
    @app_commands.guild_only()
    async def warn(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        reason: app_commands.Range[str, 1, 1000],
    ) -> None:
        context = await self._ready_member_action(interaction, member, "moderate_members")
        if context is None:
            return
        guild, moderator, _ = context
        await interaction.response.defer(ephemeral=True)
        case = await self._record_and_log(guild, "warn", member.id, moderator.id, str(reason))
        dm_sent = await self._notify_member(member, guild.name, case)
        suffix = "DM sent." if dm_sent else "DM unavailable."
        await interaction.followup.send(
            f"Warning recorded as case `#{case.id}`. {suffix}", ephemeral=True
        )

    @app_commands.command(name="timeout", description="Temporarily timeout a member.")
    @app_commands.default_permissions(moderate_members=True)
    @app_commands.checks.has_permissions(moderate_members=True)
    @app_commands.guild_only()
    async def timeout(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        minutes: app_commands.Range[int, 1, 40320],
        reason: app_commands.Range[str, 1, 1000],
    ) -> None:
        context = await self._ready_member_action(interaction, member, "moderate_members")
        if context is None:
            return
        guild, moderator, _ = context
        await interaction.response.defer(ephemeral=True)
        until = datetime.now(UTC) + timedelta(minutes=int(minutes))
        await member.timeout(until, reason=str(reason))
        case = await self._record_and_log(
            guild, "timeout", member.id, moderator.id, str(reason), expires_at=until
        )
        await self._notify_member(member, guild.name, case)
        await interaction.followup.send(f"Timeout applied. Case `#{case.id}`.", ephemeral=True)

    @app_commands.command(name="kick", description="Kick a member from the server.")
    @app_commands.default_permissions(kick_members=True)
    @app_commands.checks.has_permissions(kick_members=True)
    @app_commands.guild_only()
    async def kick(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        reason: app_commands.Range[str, 1, 1000],
    ) -> None:
        context = await self._ready_member_action(interaction, member, "kick_members")
        if context is None:
            return
        guild, moderator, _ = context
        await interaction.response.defer(ephemeral=True)
        pending = ModerationCaseRecord(
            0, guild.id, "kick", member.id, moderator.id, str(reason), datetime.now(UTC)
        )
        await self._notify_member(member, guild.name, pending)
        await member.kick(reason=str(reason))
        case = await self._record_and_log(guild, "kick", member.id, moderator.id, str(reason))
        await interaction.followup.send(f"Member kicked. Case `#{case.id}`.", ephemeral=True)

    @app_commands.command(name="ban", description="Ban a member from the server.")
    @app_commands.default_permissions(ban_members=True)
    @app_commands.checks.has_permissions(ban_members=True)
    @app_commands.guild_only()
    async def ban(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        reason: app_commands.Range[str, 1, 1000],
        delete_message_seconds: app_commands.Range[int, 0, 604800] = 0,
    ) -> None:
        context = await self._ready_member_action(interaction, member, "ban_members")
        if context is None:
            return
        guild, moderator, _ = context
        await interaction.response.defer(ephemeral=True)
        pending = ModerationCaseRecord(
            0, guild.id, "ban", member.id, moderator.id, str(reason), datetime.now(UTC)
        )
        await self._notify_member(member, guild.name, pending)
        await guild.ban(
            member, reason=str(reason), delete_message_seconds=int(delete_message_seconds)
        )
        case = await self._record_and_log(guild, "ban", member.id, moderator.id, str(reason))
        await interaction.followup.send(f"Member banned. Case `#{case.id}`.", ephemeral=True)

    @app_commands.command(name="unban", description="Unban a user by Discord user ID.")
    @app_commands.default_permissions(ban_members=True)
    @app_commands.checks.has_permissions(ban_members=True)
    @app_commands.guild_only()
    async def unban(
        self,
        interaction: discord.Interaction,
        user_id: str,
        reason: app_commands.Range[str, 1, 1000],
    ) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        bot_member = guild.me
        if bot_member is None or not bot_member.guild_permissions.ban_members:
            await interaction.response.send_message(
                "I am missing the `ban_members` permission.", ephemeral=True
            )
            return
        try:
            target_id = int(user_id)
        except ValueError:
            await interaction.response.send_message(
                "`user_id` must be a Discord numeric user ID.", ephemeral=True
            )
            return
        await interaction.response.defer(ephemeral=True)
        user = await self.bot.fetch_user(target_id)
        await guild.unban(user, reason=str(reason))
        case = await self._record_and_log(
            guild, "unban", target_id, interaction.user.id, str(reason)
        )
        await interaction.followup.send(f"User unbanned. Case `#{case.id}`.", ephemeral=True)

    @app_commands.command(name="history", description="View a member's moderation history.")
    @app_commands.default_permissions(moderate_members=True)
    @app_commands.checks.has_permissions(moderate_members=True)
    @app_commands.guild_only()
    async def history(self, interaction: discord.Interaction, member: discord.Member) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        cases = await self.moderation.history(guild.id, member.id, limit=10)
        if not cases:
            await interaction.response.send_message(
                f"No moderation cases found for {member.mention}.", ephemeral=True
            )
            return
        embed = discord.Embed(
            title=f"Moderation history: {member.display_name}", color=discord.Color.orange()
        )
        for case in cases:
            reason = case.reason if len(case.reason) <= 700 else f"{case.reason[:697]}..."
            expiry = (
                f"\n**Expires:** <t:{int(case.expires_at.timestamp())}:R>"
                if case.expires_at
                else ""
            )
            embed.add_field(
                name=f"Case #{case.id} · {case.action}",
                value=(
                    f"**Moderator:** <@{case.moderator_id}>\n"
                    f"**Reason:** {reason}\n"
                    f"**When:** <t:{int(case.created_at.timestamp())}:R>{expiry}"
                ),
                inline=False,
            )
        await interaction.response.send_message(embed=embed, ephemeral=True)

    async def _notify_member(
        self, member: discord.Member, guild_name: str, case: ModerationCaseRecord
    ) -> bool:
        embed = discord.Embed(
            title=f"Moderation action: {case.action}",
            description=f"**Server:** {guild_name}\n**Reason:** {case.reason}",
            color=discord.Color.orange(),
        )
        if case.id:
            embed.set_footer(text=f"Case #{case.id}")
        try:
            await member.send(embed=embed)
        except discord.Forbidden:
            return False
        except discord.HTTPException as error:
            logger.warning("Could not DM moderated member %s: %s", member.id, error)
            return False
        return True

    async def _post_audit_log(self, guild: discord.Guild, case: ModerationCaseRecord) -> bool:
        resource = await self.resources.get(guild.id, ResourceKey.MODERATION_LOG)
        if resource is None:
            return False
        channel = guild.get_channel(resource.discord_id)
        if not isinstance(channel, discord.TextChannel):
            return False
        embed = discord.Embed(
            title=f"Moderation case #{case.id}",
            color=discord.Color.orange(),
            timestamp=case.created_at,
        )
        embed.add_field(name="Action", value=case.action, inline=True)
        embed.add_field(name="Target", value=f"<@{case.target_id}>", inline=True)
        embed.add_field(name="Moderator", value=f"<@{case.moderator_id}>", inline=True)
        embed.add_field(name="Reason", value=case.reason[:1024], inline=False)
        if case.expires_at:
            embed.add_field(
                name="Expires", value=f"<t:{int(case.expires_at.timestamp())}:R>", inline=False
            )
        try:
            await channel.send(embed=embed)
        except (discord.Forbidden, discord.HTTPException) as error:
            logger.warning("Could not post moderation case %s: %s", case.id, error)
            return False
        return True


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading ModerationCog")
    moderation = ModerationService(SQLAlchemyModerationRepository(database))
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    await bot.add_cog(ModerationCog(bot, moderation, resources, features))
