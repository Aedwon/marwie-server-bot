from __future__ import annotations

import logging

import discord
from discord import app_commands
from discord.ext import commands

from marwie_bot.config.resources import ResourceKey
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.repository import SQLAlchemyResourceRepository
from marwie_bot.features.configuration.service import ResourceService
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
        moderation_service: ModerationService,
        resource_service: ResourceService,
    ) -> None:
        self.bot = bot
        self.moderation_service = moderation_service
        self.resource_service = resource_service

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
        guild = interaction.guild
        moderator = interaction.user
        if guild is None or not isinstance(moderator, discord.Member):
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return

        bot_member = guild.me
        if bot_member is None:
            await interaction.response.send_message(
                "I could not resolve my server member state. Try again shortly.", ephemeral=True
            )
            return

        guild_owner_id = guild.owner_id
        if guild_owner_id is None:
            await interaction.response.send_message(
                "I could not resolve the server owner. Try again shortly.", ephemeral=True
            )
            return

        try:
            validate_moderation_target(
                ModerationHierarchy(
                    caller_id=moderator.id,
                    target_id=member.id,
                    guild_owner_id=guild_owner_id,
                    caller_top_role_position=moderator.top_role.position,
                    target_top_role_position=member.top_role.position,
                    bot_top_role_position=bot_member.top_role.position,
                )
            )
        except ModerationTargetError as error:
            await interaction.response.send_message(str(error), ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)
        case = await self.moderation_service.warn(
            guild_id=guild.id,
            target_id=member.id,
            moderator_id=moderator.id,
            reason=str(reason),
        )

        dm_delivered = await self._notify_member(member, guild.name, case)
        audit_delivered = await self._post_audit_log(guild, case)

        dm_status = "DM sent" if dm_delivered else "DM unavailable"
        audit_status = "audit posted" if audit_delivered else "audit log unavailable"
        await interaction.followup.send(
            f"Warning recorded as case `#{case.id}`. {dm_status}. {audit_status}.",
            ephemeral=True,
        )

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

        await interaction.response.defer(ephemeral=True)
        cases = await self.moderation_service.history(guild.id, member.id, limit=10)
        if not cases:
            await interaction.followup.send(
                f"No moderation cases found for {member.mention}.", ephemeral=True
            )
            return

        embed = discord.Embed(
            title=f"Moderation history: {member.display_name}",
            color=discord.Color.orange(),
        )
        for case in cases:
            reason = case.reason if len(case.reason) <= 700 else f"{case.reason[:697]}..."
            embed.add_field(
                name=f"Case #{case.id} · {case.action}",
                value=(
                    f"**Moderator:** <@{case.moderator_id}>\n"
                    f"**Reason:** {reason}\n"
                    f"**When:** <t:{int(case.created_at.timestamp())}:R>"
                ),
                inline=False,
            )
        await interaction.followup.send(embed=embed, ephemeral=True)

    async def _notify_member(
        self,
        member: discord.Member,
        guild_name: str,
        case: ModerationCaseRecord,
    ) -> bool:
        embed = discord.Embed(
            title="You received a warning",
            description=f"**Server:** {guild_name}\n**Reason:** {case.reason}",
            color=discord.Color.orange(),
        )
        embed.set_footer(text=f"Case #{case.id}")
        try:
            await member.send(embed=embed)
        except discord.Forbidden:
            return False
        except discord.HTTPException as error:
            logger.warning("Could not DM warned member %s: %s", member.id, error)
            return False
        return True

    async def _post_audit_log(
        self,
        guild: discord.Guild,
        case: ModerationCaseRecord,
    ) -> bool:
        resource = await self.resource_service.get(guild.id, ResourceKey.MODERATION_LOG)
        if resource is None:
            return False

        channel = guild.get_channel(resource.discord_id)
        if not isinstance(channel, discord.TextChannel):
            logger.warning(
                "Moderation log resource is stale for guild %s: %s",
                guild.id,
                resource.discord_id,
            )
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
        try:
            await channel.send(embed=embed)
        except (discord.Forbidden, discord.HTTPException) as error:
            logger.warning(
                "Could not post moderation case %s in guild %s: %s",
                case.id,
                guild.id,
                error,
            )
            return False
        return True


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading ModerationCog")

    moderation_service = ModerationService(SQLAlchemyModerationRepository(database))
    resource_service = ResourceService(SQLAlchemyResourceRepository(database))
    await bot.add_cog(ModerationCog(bot, moderation_service, resource_service))
