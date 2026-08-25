from __future__ import annotations

import logging

import discord

from marwie_bot.config.resources import ResourceKey
from marwie_bot.features.configuration.service import ResourceService

logger = logging.getLogger(__name__)

ROLE_PANEL_TITLE = "Notification roles"


class LiveNotificationRoleView(discord.ui.View):
    def __init__(self, resources: ResourceService) -> None:
        super().__init__(timeout=None)
        self.resources = resources

    @discord.ui.button(
        label="Live Notifications",
        style=discord.ButtonStyle.primary,
        custom_id="marwie:self-role:live-notifications",
    )
    async def toggle_live_notifications(
        self,
        interaction: discord.Interaction,
        _button: discord.ui.Button[discord.ui.View],
    ) -> None:
        guild = interaction.guild
        member = interaction.user
        if guild is None or not isinstance(member, discord.Member):
            await interaction.response.send_message(
                "This role button only works in a server.", ephemeral=True
            )
            return

        record = await self.resources.get(guild.id, ResourceKey.LIVE_PING_ROLE)
        role = guild.get_role(record.discord_id) if record is not None else None
        if role is None:
            await interaction.response.send_message(
                "The Live Notifications role is not configured. Ask an administrator to run "
                "`/setup auto` or configure `live_ping_role` manually.",
                ephemeral=True,
            )
            return

        bot_member = guild.me
        if (
            bot_member is None
            or not bot_member.guild_permissions.manage_roles
            or role.managed
            or not bot_member.top_role > role
        ):
            await interaction.response.send_message(
                "I cannot manage the Live Notifications role. Move my bot role above it and "
                "make sure I have Manage Roles.",
                ephemeral=True,
            )
            return

        try:
            if role in member.roles:
                await member.remove_roles(role, reason="Self-role notification opt-out")
                message = f"Removed {role.mention}."
            else:
                await member.add_roles(role, reason="Self-role notification opt-in")
                message = f"Added {role.mention}."
        except discord.Forbidden:
            await interaction.response.send_message(
                "I could not update that role because of Discord permissions or role hierarchy.",
                ephemeral=True,
            )
            return
        except discord.HTTPException as error:
            logger.error(
                "Could not toggle live notification role guild_id=%s user_id=%s role_id=%s",
                guild.id,
                member.id,
                role.id,
                exc_info=(type(error), error, error.__traceback__),
            )
            await interaction.response.send_message(
                "Discord rejected the role update. The error has been logged.", ephemeral=True
            )
            return

        await interaction.response.send_message(message, ephemeral=True)


def build_role_panel_embed(role: discord.Role) -> discord.Embed:
    embed = discord.Embed(
        title=ROLE_PANEL_TITLE,
        description=(
            "Use the button below to toggle optional community notifications. "
            "You can press it again at any time to remove the role."
        ),
        color=discord.Color.blurple(),
    )
    embed.add_field(
        name="Live Notifications",
        value=f"Get {role.mention} when Mar Wie goes live on TikTok.",
        inline=False,
    )
    return embed


async def upsert_role_panel(
    channel: discord.TextChannel,
    role: discord.Role,
    view: LiveNotificationRoleView,
    bot_user_id: int,
) -> discord.Message:
    embed = build_role_panel_embed(role)
    async for message in channel.history(limit=50):
        if message.author.id != bot_user_id:
            continue
        if any(existing.title == ROLE_PANEL_TITLE for existing in message.embeds):
            await message.edit(embed=embed, view=view)
            return message
    return await channel.send(embed=embed, view=view)
