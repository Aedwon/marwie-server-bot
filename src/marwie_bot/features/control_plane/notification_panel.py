from __future__ import annotations

import logging
from typing import Protocol

import discord

from marwie_bot.features.control_plane.domain import NotificationRolePanelRecord

logger = logging.getLogger(__name__)

_CUSTOM_ID_PREFIX = "rob:self-role:"


class PanelMessageRepository(Protocol):
    async def set_notification_panel_message(
        self, guild_id: int, message_id: int
    ) -> NotificationRolePanelRecord | None: ...


def button_custom_id(guild_id: int, role_id: int) -> str:
    return f"{_CUSTOM_ID_PREFIX}{guild_id}:{role_id}"


def parse_button_custom_id(custom_id: str) -> tuple[int, int] | None:
    if not custom_id.startswith(_CUSTOM_ID_PREFIX):
        return None
    parts = custom_id.removeprefix(_CUSTOM_ID_PREFIX).split(":")
    if len(parts) != 2:
        return None
    try:
        guild_id, role_id = (int(part) for part in parts)
    except ValueError:
        return None
    if guild_id <= 0 or role_id <= 0:
        return None
    return guild_id, role_id


def button_style(value: str) -> discord.ButtonStyle:
    styles = {
        "primary": discord.ButtonStyle.primary,
        "secondary": discord.ButtonStyle.secondary,
        "success": discord.ButtonStyle.success,
        "danger": discord.ButtonStyle.danger,
    }
    try:
        return styles[value]
    except KeyError as error:
        raise ValueError(f"Unsupported notification button style: {value}") from error


class NotificationRoleButton(discord.ui.Button[discord.ui.View]):
    def __init__(
        self,
        *,
        guild_id: int,
        role_id: int,
        label: str,
        emoji: str | None,
        style: str,
    ) -> None:
        super().__init__(
            label=label,
            emoji=emoji or None,
            style=button_style(style),
            custom_id=button_custom_id(guild_id, role_id),
        )
        self.guild_id = guild_id
        self.role_id = role_id

    async def callback(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        member = interaction.user
        if guild is None or guild.id != self.guild_id or not isinstance(member, discord.Member):
            await interaction.response.send_message(
                "This notification-role button is unavailable here.", ephemeral=True
            )
            return

        role = guild.get_role(self.role_id)
        if role is None or role.is_default():
            await interaction.response.send_message(
                "That notification role is no longer available. Ask an administrator to refresh the panel.",
                ephemeral=True,
            )
            return

        bot_member = guild.me
        if (
            bot_member is None
            or not bot_member.guild_permissions.manage_roles
            or role.managed
            or bot_member.top_role <= role
        ):
            await interaction.response.send_message(
                "I cannot manage that role. Ask an administrator to check my role hierarchy and Manage Roles permission.",
                ephemeral=True,
            )
            return

        try:
            if role in member.roles:
                await member.remove_roles(role, reason="Notification self-role opt-out")
                response = f"Removed {role.mention}."
            else:
                await member.add_roles(role, reason="Notification self-role opt-in")
                response = f"Added {role.mention}."
        except discord.Forbidden:
            await interaction.response.send_message(
                "Discord blocked that role update because of permissions or role hierarchy.",
                ephemeral=True,
            )
            return
        except discord.HTTPException:
            logger.exception(
                "Notification role toggle failed guild_id=%s user_id=%s role_id=%s",
                guild.id,
                member.id,
                role.id,
            )
            await interaction.response.send_message(
                "Discord rejected the role update. The error has been logged.", ephemeral=True
            )
            return

        await interaction.response.send_message(response, ephemeral=True)


class NotificationRoleView(discord.ui.View):
    def __init__(self, panel: NotificationRolePanelRecord) -> None:
        super().__init__(timeout=None)
        for item in panel.buttons:
            self.add_item(
                NotificationRoleButton(
                    guild_id=panel.guild_id,
                    role_id=item.role_id,
                    label=item.label,
                    emoji=item.emoji,
                    style=item.style,
                )
            )


def build_notification_panel_embed(panel: NotificationRolePanelRecord) -> discord.Embed:
    return discord.Embed(
        title=panel.title,
        description=panel.description,
        color=discord.Color.blurple(),
    )


async def upsert_notification_panel(
    *,
    channel: discord.TextChannel,
    panel: NotificationRolePanelRecord,
    repository: PanelMessageRepository,
) -> tuple[discord.Message, NotificationRoleView]:
    view = NotificationRoleView(panel)
    embed = build_notification_panel_embed(panel)
    message: discord.Message | None = None

    if panel.message_id is not None:
        try:
            message = await channel.fetch_message(panel.message_id)
        except (discord.NotFound, discord.Forbidden):
            message = None

    if message is None:
        message = await channel.send(embed=embed, view=view)
    else:
        await message.edit(embed=embed, view=view)

    if panel.message_id != message.id:
        await repository.set_notification_panel_message(panel.guild_id, message.id)
    return message, view
