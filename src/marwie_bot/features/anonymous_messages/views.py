from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

import discord

from marwie_bot.config.resources import FeatureName, ResourceKey
from marwie_bot.features.anonymous_messages.render import (
    build_audit_embed,
    build_message_embed,
    build_reply_embed,
)
from marwie_bot.features.anonymous_messages.service import AnonymousMessageService
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class AnonymousMessageDestinations:
    panel: discord.TextChannel
    submissions: discord.TextChannel
    audit_log: discord.TextChannel


def audit_channel_is_private(
    guild: discord.Guild,
    destinations: AnonymousMessageDestinations,
) -> bool:
    if destinations.audit_log.id in {
        destinations.panel.id,
        destinations.submissions.id,
    }:
        return False
    permissions = destinations.audit_log.permissions_for(guild.default_role)
    return not permissions.view_channel


def _destinations_from_records(
    guild: discord.Guild,
    records: list[Any],
) -> AnonymousMessageDestinations | None:
    by_key = {record.key: record for record in records}
    panel_record = by_key.get(ResourceKey.ANON_MESSAGES_PANEL)
    submissions_record = by_key.get(ResourceKey.ANON_MESSAGES_SUBMISSIONS)
    audit_record = by_key.get(ResourceKey.ANON_MESSAGES_AUDIT_LOG)
    if panel_record is None or submissions_record is None or audit_record is None:
        return None

    panel = guild.get_channel(panel_record.discord_id)
    submissions = guild.get_channel(submissions_record.discord_id)
    audit_log = guild.get_channel(audit_record.discord_id)
    if not isinstance(panel, discord.TextChannel):
        return None
    if not isinstance(submissions, discord.TextChannel):
        return None
    if not isinstance(audit_log, discord.TextChannel):
        return None
    destinations = AnonymousMessageDestinations(panel, submissions, audit_log)
    if not audit_channel_is_private(guild, destinations):
        return None
    return destinations


async def resolve_destinations(
    guild: discord.Guild,
    resources: ResourceService,
) -> AnonymousMessageDestinations | None:
    panel_record, submissions_record, audit_record = await asyncio.gather(
        resources.get(guild.id, ResourceKey.ANON_MESSAGES_PANEL),
        resources.get(guild.id, ResourceKey.ANON_MESSAGES_SUBMISSIONS),
        resources.get(guild.id, ResourceKey.ANON_MESSAGES_AUDIT_LOG),
    )
    if panel_record is None or submissions_record is None or audit_record is None:
        return None

    panel = guild.get_channel(panel_record.discord_id)
    submissions = guild.get_channel(submissions_record.discord_id)
    audit_log = guild.get_channel(audit_record.discord_id)
    if not isinstance(panel, discord.TextChannel):
        return None
    if not isinstance(submissions, discord.TextChannel):
        return None
    if not isinstance(audit_log, discord.TextChannel):
        return None
    destinations = AnonymousMessageDestinations(panel, submissions, audit_log)
    if not audit_channel_is_private(guild, destinations):
        return None
    return destinations


def channel_allows_bot_output(channel: discord.TextChannel, guild: discord.Guild) -> bool:
    member = guild.me
    if member is None:
        return False
    permissions = channel.permissions_for(member)
    return permissions.view_channel and permissions.send_messages and permissions.embed_links


def member_can_use_public_channels(
    member: discord.Member,
    destinations: AnonymousMessageDestinations,
) -> bool:
    panel_permissions = destinations.panel.permissions_for(member)
    submissions_permissions = destinations.submissions.permissions_for(member)
    return panel_permissions.view_channel and submissions_permissions.view_channel


async def send_ephemeral(interaction: discord.Interaction, message: str) -> None:
    if interaction.response.is_done():
        await interaction.followup.send(message, ephemeral=True)
    else:
        await interaction.response.send_message(message, ephemeral=True)


async def send_audit_log(
    destinations: AnonymousMessageDestinations,
    *,
    user: discord.User | discord.Member,
    action_type: str,
    content: str,
    reference_label: str,
) -> None:
    embed = build_audit_embed(
        user=user,
        action_type=action_type,
        content=content,
        public_channel=destinations.submissions,
        reference_label=reference_label,
    )
    try:
        await destinations.audit_log.send(
            embed=embed,
            allowed_mentions=discord.AllowedMentions.none(),
        )
    except discord.HTTPException:
        logger.exception(
            "Failed to send anonymous audit log guild_id=%s channel_id=%s user_id=%s",
            destinations.audit_log.guild.id,
            destinations.audit_log.id,
            user.id,
        )


async def interaction_destinations(
    interaction: discord.Interaction,
    resources: ResourceService,
    features: FeatureConfigService,
) -> AnonymousMessageDestinations | None:
    guild = interaction.guild
    if guild is None:
        await send_ephemeral(interaction, "❌ This can only be used in a server.")
        return None

    enabled, resource_records = await asyncio.gather(
        features.is_enabled(guild.id, FeatureName.ANONYMOUS_MESSAGES),
        resources.list_for_guild(guild.id),
    )
    if not enabled:
        await send_ephemeral(interaction, "Anonymous messages are disabled here.")
        return None

    destinations = _destinations_from_records(guild, resource_records)
    if destinations is None:
        await send_ephemeral(
            interaction,
            "Anonymous messages are not safely configured. Ask a server administrator to check the panel and submissions mappings and make sure the audit log is a separate private channel.",
        )
        return None
    if not isinstance(interaction.user, discord.Member) or not member_can_use_public_channels(
        interaction.user,
        destinations,
    ):
        await send_ephemeral(
            interaction,
            "You need access to both the anonymous-message panel and submissions channels to use this feature.",
        )
        return None
    if not channel_allows_bot_output(destinations.submissions, guild):
        await send_ephemeral(
            interaction,
            "❌ I do not have permission to send anonymous messages in the configured submissions channel.",
        )
        return None
    if not channel_allows_bot_output(destinations.audit_log, guild):
        await send_ephemeral(
            interaction,
            "❌ I do not have permission to write the staff audit log, so anonymous posting is temporarily unavailable.",
        )
        return None
    return destinations


class AnonMessageModal(discord.ui.Modal, title="📨 Send Anonymous Message"):
    message_input: discord.ui.TextInput[AnonMessageModal] = discord.ui.TextInput(
        label="Your Message",
        style=discord.TextStyle.paragraph,
        placeholder="Write your anonymous message here...",
        required=True,
        min_length=10,
        max_length=2000,
    )

    def __init__(
        self,
        service: AnonymousMessageService,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        super().__init__()
        self.service = service
        self.resources = resources
        self.features = features

    async def on_submit(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        destinations = await interaction_destinations(interaction, self.resources, self.features)
        guild = interaction.guild
        if destinations is None or guild is None:
            return
        if interaction.channel_id != destinations.panel.id:
            await send_ephemeral(
                interaction,
                "This anonymous-message panel is no longer active. Use the current panel instead.",
            )
            return

        try:
            record = await self.service.create_message(
                guild.id,
                interaction.user.id,
                destinations.submissions.id,
                str(self.message_input.value),
            )
        except ValueError as error:
            await send_ephemeral(interaction, str(error))
            return

        if record.display_number is None:
            await self.service.discard_unposted(record.id)
            logger.error(
                "Top-level anonymous message missing display number guild_id=%s record_id=%s",
                guild.id,
                record.id,
            )
            await send_ephemeral(interaction, "❌ Something went wrong. Please try again later.")
            return

        try:
            public_message = await destinations.submissions.send(
                embed=build_message_embed(guild, record.display_number, record.content),
                view=AnonReplyView(self.service, self.resources, self.features),
                allowed_mentions=discord.AllowedMentions.none(),
            )
        except discord.Forbidden:
            await self.service.discard_unposted(record.id)
            await send_ephemeral(
                interaction,
                "❌ I do not have permission to send messages in the configured submissions channel.",
            )
            return
        except discord.HTTPException:
            await self.service.discard_unposted(record.id)
            logger.exception(
                "Failed to post anonymous message guild_id=%s record_id=%s",
                guild.id,
                record.id,
            )
            await send_ephemeral(interaction, "❌ Something went wrong. Please try again later.")
            return

        try:
            await self.service.attach_message(record.id, public_message.id)
        except Exception:
            logger.exception(
                "Failed to attach Discord message to anonymous record guild_id=%s record_id=%s message_id=%s",
                guild.id,
                record.id,
                public_message.id,
            )
            try:
                await public_message.delete()
            except discord.HTTPException:
                logger.exception(
                    "Failed to roll back unattached anonymous Discord message guild_id=%s message_id=%s",
                    guild.id,
                    public_message.id,
                )
            await self.service.discard_unposted(record.id)
            await send_ephemeral(interaction, "❌ Something went wrong. Please try again later.")
            return

        await send_audit_log(
            destinations,
            user=interaction.user,
            action_type="Anon Message",
            content=record.content,
            reference_label=f"Message #{record.display_number}",
        )
        await send_ephemeral(
            interaction,
            f"✅ Your anonymous message (#{record.display_number}) has been posted in {destinations.submissions.mention}.",
        )

    async def on_error(
        self,
        interaction: discord.Interaction,
        error: Exception,
        item: discord.ui.Item[Any] | None = None,
        /,
    ) -> None:
        del item
        logger.exception(
            "Anonymous message modal failed guild_id=%s user_id=%s",
            interaction.guild_id,
            interaction.user.id,
            exc_info=(type(error), error, error.__traceback__),
        )
        try:
            await send_ephemeral(interaction, "❌ An unexpected error occurred.")
        except discord.HTTPException:
            return


class AnonReplyModal(discord.ui.Modal, title="💬 Anonymous Reply"):
    reply_input: discord.ui.TextInput[AnonReplyModal] = discord.ui.TextInput(
        label="Your Reply",
        style=discord.TextStyle.paragraph,
        placeholder="Write your anonymous reply here...",
        required=True,
        min_length=5,
        max_length=2000,
    )

    def __init__(
        self,
        service: AnonymousMessageService,
        resources: ResourceService,
        features: FeatureConfigService,
        original_message: discord.Message,
    ) -> None:
        super().__init__()
        self.service = service
        self.resources = resources
        self.features = features
        self.original_message = original_message

    async def on_submit(self, interaction: discord.Interaction) -> None:
        await interaction.response.defer(ephemeral=True)
        destinations = await interaction_destinations(interaction, self.resources, self.features)
        guild = interaction.guild
        if destinations is None or guild is None:
            return
        if interaction.channel_id != destinations.submissions.id:
            await send_ephemeral(
                interaction,
                "This anonymous reply button is no longer in the active submissions channel.",
            )
            return

        try:
            record = await self.service.create_reply(
                guild.id,
                interaction.user.id,
                destinations.submissions.id,
                self.original_message.id,
                str(self.reply_input.value),
            )
        except ValueError as error:
            await send_ephemeral(interaction, str(error))
            return

        try:
            public_message = await destinations.submissions.send(
                embed=build_reply_embed(guild, record.content),
                view=AnonReplyView(self.service, self.resources, self.features),
                reference=self.original_message,
                allowed_mentions=discord.AllowedMentions.none(),
            )
        except discord.Forbidden:
            await self.service.discard_unposted(record.id)
            await send_ephemeral(
                interaction,
                "❌ I do not have permission to send messages in the configured submissions channel.",
            )
            return
        except discord.HTTPException:
            await self.service.discard_unposted(record.id)
            logger.exception(
                "Failed to post anonymous reply guild_id=%s record_id=%s",
                guild.id,
                record.id,
            )
            await send_ephemeral(interaction, "❌ Something went wrong. Please try again later.")
            return

        try:
            await self.service.attach_message(record.id, public_message.id)
        except Exception:
            logger.exception(
                "Failed to attach Discord reply to anonymous record guild_id=%s record_id=%s message_id=%s",
                guild.id,
                record.id,
                public_message.id,
            )
            try:
                await public_message.delete()
            except discord.HTTPException:
                logger.exception(
                    "Failed to roll back unattached anonymous reply guild_id=%s message_id=%s",
                    guild.id,
                    public_message.id,
                )
            await self.service.discard_unposted(record.id)
            await send_ephemeral(interaction, "❌ Something went wrong. Please try again later.")
            return

        await send_audit_log(
            destinations,
            user=interaction.user,
            action_type="Anon Reply",
            content=record.content,
            reference_label=f"Reply to message in #{destinations.submissions.name}",
        )
        await send_ephemeral(interaction, "✅ Your anonymous reply has been posted!")

    async def on_error(
        self,
        interaction: discord.Interaction,
        error: Exception,
        item: discord.ui.Item[Any] | None = None,
        /,
    ) -> None:
        del item
        logger.exception(
            "Anonymous reply modal failed guild_id=%s user_id=%s",
            interaction.guild_id,
            interaction.user.id,
            exc_info=(type(error), error, error.__traceback__),
        )
        try:
            await send_ephemeral(interaction, "❌ An unexpected error occurred.")
        except discord.HTTPException:
            return


class AnonPanelView(discord.ui.View):
    def __init__(
        self,
        service: AnonymousMessageService,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        super().__init__(timeout=None)
        self.service = service
        self.resources = resources
        self.features = features

    @discord.ui.button(
        label="Send Message",
        style=discord.ButtonStyle.primary,
        emoji="✉️",
        custom_id="anon_messages:send_button",
    )
    async def send_button(
        self,
        interaction: discord.Interaction,
        button: discord.ui.Button[discord.ui.View],
    ) -> None:
        del button
        await interaction.response.send_modal(
            AnonMessageModal(self.service, self.resources, self.features)
        )


class AnonReplyView(discord.ui.View):
    def __init__(
        self,
        service: AnonymousMessageService,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        super().__init__(timeout=None)
        self.service = service
        self.resources = resources
        self.features = features

    @discord.ui.button(
        label="Reply Anonymously",
        style=discord.ButtonStyle.secondary,
        emoji="💬",
        custom_id="anon_messages:reply_button",
    )
    async def reply_button(
        self,
        interaction: discord.Interaction,
        button: discord.ui.Button[discord.ui.View],
    ) -> None:
        del button
        original_message = interaction.message
        if original_message is None:
            await send_ephemeral(interaction, "❌ The message to reply to is unavailable.")
            return
        await interaction.response.send_modal(
            AnonReplyModal(
                self.service,
                self.resources,
                self.features,
                original_message,
            )
        )
