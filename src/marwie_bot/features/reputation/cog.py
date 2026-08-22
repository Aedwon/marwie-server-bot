from __future__ import annotations

import logging

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
from marwie_bot.features.reputation.repository import SQLAlchemyReputationRepository
from marwie_bot.features.reputation.service import ReputationProfile, ReputationService

logger = logging.getLogger(__name__)

_DEFAULT_THRESHOLDS = {"builder": 50, "contributor": 150, "mentor": 500}
_ROLE_KEYS = {
    "builder": ResourceKey.BUILDER_ROLE,
    "contributor": ResourceKey.CONTRIBUTOR_ROLE,
    "mentor": ResourceKey.MENTOR_ROLE,
}


class ReputationCog(commands.Cog):
    reputation_group = app_commands.Group(
        name="reputation",
        description="Manage reputation settings and awards.",
        default_permissions=discord.Permissions(manage_guild=True),
        guild_only=True,
    )

    def __init__(
        self,
        service: ReputationService,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        self.service = service
        self.resources = resources
        self.features = features

    async def _thresholds(self, guild_id: int) -> dict[str, int]:
        config = await self.features.get(guild_id, FeatureName.REPUTATION)
        values = config.config.get("thresholds", {})
        return {key: int(values.get(key, default)) for key, default in _DEFAULT_THRESHOLDS.items()}

    async def _sync_roles(self, member: discord.Member, points: int) -> None:
        thresholds = await self._thresholds(member.guild.id)
        for tier, key in _ROLE_KEYS.items():
            resource = await self.resources.get(member.guild.id, key)
            role = member.guild.get_role(resource.discord_id) if resource else None
            if role is None:
                continue
            should_have = points >= thresholds[tier]
            try:
                if should_have and role not in member.roles:
                    await member.add_roles(role, reason="Reputation threshold reached")
                elif not should_have and role in member.roles:
                    await member.remove_roles(role, reason="Reputation threshold no longer met")
            except discord.HTTPException as error:
                logger.warning(
                    "Could not sync reputation role %s for %s: %s",
                    role.id,
                    member.id,
                    error,
                )

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        if (
            message.guild is None
            or message.author.bot
            or not isinstance(message.author, discord.Member)
        ):
            return
        if not await self.features.is_enabled(message.guild.id, FeatureName.REPUTATION):
            return
        points = await self.service.award_message(
            message.guild.id, message.author.id, f"message:{message.id}"
        )
        if points is not None:
            await self._sync_roles(message.author, points)

    async def _send_profile(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        profile: ReputationProfile,
        *,
        title: str,
    ) -> None:
        thresholds = await self._thresholds(member.guild.id)
        tier = "Member"
        for name in ("builder", "contributor", "mentor"):
            if profile.points >= thresholds[name]:
                tier = name.title()
        counts = (
            "\n".join(f"`{kind}`: {count}" for kind, count in sorted(profile.event_counts.items()))
            or "No reputation events yet."
        )
        embed = discord.Embed(title=title, color=discord.Color.blurple())
        embed.add_field(name="Member", value=member.mention, inline=True)
        embed.add_field(name="Points", value=str(profile.points), inline=True)
        embed.add_field(name="Rank", value=f"#{profile.rank}", inline=True)
        embed.add_field(name="Tier", value=tier, inline=True)
        embed.add_field(name="Activity", value=counts[:1024], inline=False)
        await interaction.response.send_message(embed=embed)

    @app_commands.command(name="rank", description="Show a member's reputation rank.")
    @app_commands.guild_only()
    async def rank(
        self, interaction: discord.Interaction, member: discord.Member | None = None
    ) -> None:
        if interaction.guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        target = member or interaction.user
        if not isinstance(target, discord.Member):
            await interaction.response.send_message(
                "Could not resolve that member.", ephemeral=True
            )
            return
        profile = await self.service.profile(interaction.guild.id, target.id)
        await self._send_profile(interaction, target, profile, title="Reputation rank")

    @app_commands.command(name="profile", description="Show a member's community profile.")
    @app_commands.guild_only()
    async def profile(
        self, interaction: discord.Interaction, member: discord.Member | None = None
    ) -> None:
        if interaction.guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        target = member or interaction.user
        if not isinstance(target, discord.Member):
            await interaction.response.send_message(
                "Could not resolve that member.", ephemeral=True
            )
            return
        profile = await self.service.profile(interaction.guild.id, target.id)
        await self._send_profile(interaction, target, profile, title="Community profile")

    @app_commands.command(name="leaderboard", description="Show the reputation leaderboard.")
    @app_commands.guild_only()
    async def leaderboard(self, interaction: discord.Interaction) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        rows = await self.service.leaderboard(interaction.guild_id, 10)
        lines = [
            f"**{index}.** <@{user_id}> — {points} points"
            for index, (user_id, points) in enumerate(rows, 1)
        ]
        await interaction.response.send_message("\n".join(lines) or "No reputation data yet.")

    @reputation_group.command(name="award", description="Award or deduct reputation points.")
    @app_commands.checks.has_permissions(manage_guild=True)
    async def award(
        self,
        interaction: discord.Interaction,
        member: discord.Member,
        points: app_commands.Range[int, -1000, 1000],
        reason: app_commands.Range[str, 1, 200],
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        try:
            total = await self.service.award(
                interaction.guild_id,
                member.id,
                "staff_award",
                int(points),
                actor_id=interaction.user.id,
                source_ref=str(reason),
            )
        except ValueError as error:
            await interaction.response.send_message(str(error), ephemeral=True)
            return
        await self._sync_roles(member, total)
        await interaction.response.send_message(
            f"{member.mention} now has {total} reputation points.", ephemeral=True
        )

    @reputation_group.command(
        name="thresholds", description="Set Builder/Contributor/Mentor thresholds."
    )
    @app_commands.checks.has_permissions(manage_guild=True)
    async def thresholds(
        self,
        interaction: discord.Interaction,
        builder: app_commands.Range[int, 1, 100000],
        contributor: app_commands.Range[int, 1, 100000],
        mentor: app_commands.Range[int, 1, 100000],
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        values = [int(builder), int(contributor), int(mentor)]
        if values != sorted(values) or len(set(values)) != 3:
            await interaction.response.send_message(
                "Thresholds must increase from Builder to Contributor to Mentor.",
                ephemeral=True,
            )
            return
        await self.features.update_config(
            interaction.guild_id,
            FeatureName.REPUTATION,
            {
                "thresholds": {
                    "builder": values[0],
                    "contributor": values[1],
                    "mentor": values[2],
                }
            },
        )
        await interaction.response.send_message("Reputation thresholds updated.", ephemeral=True)


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading ReputationCog")
    service = ReputationService(SQLAlchemyReputationRepository(database))
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    await bot.add_cog(ReputationCog(service, resources, features))
