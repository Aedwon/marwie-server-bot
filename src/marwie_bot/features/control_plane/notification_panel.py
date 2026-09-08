from __future__ import annotations

import logging
from typing import Protocol

import discord

from marwie_bot.config.resources import ResourceKey
from marwie_bot.features.configuration.service import ResourceService
from marwie_bot.features.control_plane.domain import NotificationRolePanelRecord

logger = logging.getLogger(__name__)

_CUSTOM_ID_PREFIX = "rob:self-role:"
_LEGACY_PANEL_TITLE = "Notification roles"
_LEGACY_PANEL_DESCRIPTION = (
    "Use the button below to toggle optional community notifications. "
    "You can press it again at any time to remove the role."
)
_LEGACY_BUTTON_LABEL = "Live Notifications"


class PanelMessageRepository(Protocol):
    async def set_notification_panel_message(
        self, guild_id: int, message_id: int
    ) -> NotificationRolePanelRecord | None: ...


class NotificationPanelRepository(PanelMessageRepository, Protocol):
    async def get_notification_panel(self, guild_id: int) -> NotificationRolePanelRecord | None: ...

    async def save_notification_panel(
        self,
        *,
        guild_id: int,
        channel_id: int,
        title: str,
        description: str,
        buttons: list[dict[str, object]],
        updated_by: int,
        message_id: int | None = None,
    ) -> NotificationRolePanelRecord: ...


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


async def adopt_legacy_notification_panel(
    *,
    guild: discord.Guild,
    bot_user_id: int,
    resources: ResourceService,
    repository: NotificationPanelRepository,
) -> NotificationRolePanelRecord | None:
    existing = await repository.get_notification_panel(guild.id)
    if existing is not None:
        return existing

    channel_record = await resources.get(guild.id, ResourceKey.ROLE_PANEL)
    role_record = await resources.get(guild.id, ResourceKey.LIVE_PING_ROLE)
    if channel_record is None or role_record is None:
        return None

    channel = guild.get_channel(channel_record.discord_id)
    role = guild.get_role(role_record.discord_id)
    if not isinstance(channel, discord.TextChannel) or role is None:
        return None

    legacy_message: discord.Message | None = None
    legacy_embed: discord.Embed | None = None
    async for message in channel.history(limit=50):
        if message.author.id != bot_user_id:
            continue
        embed = next(
            (item for item in message.embeds if item.title == _LEGACY_PANEL_TITLE),
            None,
        )
        if embed is not None:
            legacy_message = message
            legacy_embed = embed
            break

    if legacy_message is None or legacy_embed is None:
        return None

    panel = await repository.save_notification_panel(
        guild_id=guild.id,
        channel_id=channel.id,
        message_id=legacy_message.id,
        title=legacy_embed.title or _LEGACY_PANEL_TITLE,
        description=legacy_embed.description or _LEGACY_PANEL_DESCRIPTION,
        buttons=[
            {
                "role_id": role.id,
                "label": _LEGACY_BUTTON_LABEL,
                "emoji": "",
                "style": "primary",
            }
        ],
        updated_by=bot_user_id,
    )
    logger.info(
        "Adopted legacy notification role panel guild_id=%s channel_id=%s message_id=%s",
        guild.id,
        channel.id,
        legacy_message.id,
    )
    return panel


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
