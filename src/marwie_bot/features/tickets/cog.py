from __future__ import annotations

import io
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
from marwie_bot.features.tickets.repository import SQLAlchemyTicketRepository
from marwie_bot.features.tickets.service import TicketRecord, TicketService
from marwie_bot.features.tickets.views import TicketControlsView, TicketPanelView, TicketTypeView

logger = logging.getLogger(__name__)


class TicketsCog(commands.Cog):
    ticket_type_group = app_commands.Group(
        name="ticket-type",
        description="Manage ticket types.",
        default_permissions=discord.Permissions(administrator=True),
        guild_only=True,
    )
    ticket_panel_group = app_commands.Group(
        name="ticket-panel",
        description="Manage the ticket panel.",
        default_permissions=discord.Permissions(administrator=True),
        guild_only=True,
    )

    def __init__(
        self,
        bot: commands.Bot,
        tickets: TicketService,
        resources: ResourceService,
        features: FeatureConfigService,
    ) -> None:
        self.bot = bot
        self.tickets = tickets
        self.resources = resources
        self.features = features

    @ticket_type_group.command(name="add", description="Add or update a ticket type.")
    @app_commands.checks.has_permissions(administrator=True)
    async def ticket_type_add(
        self,
        interaction: discord.Interaction,
        key: app_commands.Range[str, 1, 32],
        label: app_commands.Range[str, 1, 80],
        description: app_commands.Range[str, 1, 200],
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        try:
            record = await self.tickets.upsert_type(
                interaction.guild_id, str(key), str(label), str(description)
            )
        except ValueError as error:
            await interaction.response.send_message(str(error), ephemeral=True)
            return
        await interaction.response.send_message(
            f"Ticket type `{record.key}` is ready.", ephemeral=True
        )

    @ticket_type_group.command(name="disable", description="Disable a ticket type.")
    @app_commands.checks.has_permissions(administrator=True)
    async def ticket_type_disable(
        self, interaction: discord.Interaction, key: app_commands.Range[str, 1, 32]
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        changed = await self.tickets.disable_type(interaction.guild_id, str(key))
        message = f"Disabled `{key}`." if changed else f"No ticket type `{key}` was found."
        await interaction.response.send_message(message, ephemeral=True)

    @ticket_type_group.command(name="list", description="List enabled ticket types.")
    @app_commands.checks.has_permissions(administrator=True)
    async def ticket_type_list(self, interaction: discord.Interaction) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        items = await self.tickets.list_types(interaction.guild_id)
        text = "\n".join(f"`{item.key}` · **{item.label}** — {item.description}" for item in items)
        await interaction.response.send_message(
            text or "No ticket types configured.", ephemeral=True
        )

    @ticket_panel_group.command(
        name="post", description="Post or refresh the configured ticket panel."
    )
    @app_commands.checks.has_permissions(administrator=True)
    async def post_panel(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        resource = await self.resources.get(guild.id, ResourceKey.TICKET_PANEL)
        channel = guild.get_channel(resource.discord_id) if resource else None
        if not isinstance(channel, discord.TextChannel):
            await interaction.response.send_message(
                "Configure `ticket_panel` with `/setup text-channel` first.", ephemeral=True
            )
            return
        types = await self.tickets.list_types(guild.id)
        if not types:
            await interaction.response.send_message(
                "Add at least one ticket type before posting the panel.", ephemeral=True
            )
            return
        embed = discord.Embed(
            title="Support tickets",
            description="Open a private ticket and choose the topic that best matches what you need.",
            color=discord.Color.blurple(),
        )
        await channel.send(embed=embed, view=TicketPanelView())
        await interaction.response.send_message(
            f"Ticket panel posted in {channel.mention}.", ephemeral=True
        )

    async def show_ticket_types(self, interaction: discord.Interaction) -> None:
        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "Tickets only work in a server.", ephemeral=True
            )
            return
        if not await self.features.is_enabled(guild.id, FeatureName.TICKETS):
            await interaction.response.send_message("Tickets are disabled here.", ephemeral=True)
            return
        active = await self.tickets.active_for_user(guild.id, interaction.user.id)
        if active is not None:
            existing = guild.get_channel(active.channel_id)
            if existing is not None:
                await interaction.response.send_message(
                    f"You already have an active ticket: {existing.mention}", ephemeral=True
                )
                return
            await self.tickets.mark_deleted(active.channel_id)
        types = await self.tickets.list_types(guild.id)
        if not types:
            await interaction.response.send_message(
                "No ticket types are available.", ephemeral=True
            )
            return
        await interaction.response.send_message(
            "Choose a ticket type:", view=TicketTypeView(types), ephemeral=True
        )

    async def create_ticket(self, interaction: discord.Interaction, type_key: str) -> None:
        guild = interaction.guild
        if guild is None or not isinstance(interaction.user, discord.Member):
            await interaction.response.send_message(
                "Tickets only work in a server.", ephemeral=True
            )
            return
        active = await self.tickets.active_for_user(guild.id, interaction.user.id)
        if active is not None:
            existing = guild.get_channel(active.channel_id)
            if existing is not None:
                await interaction.response.send_message(
                    f"You already have an active ticket: {existing.mention}", ephemeral=True
                )
                return
            await self.tickets.mark_deleted(active.channel_id)
        types = {item.key: item for item in await self.tickets.list_types(guild.id)}
        ticket_type = types.get(type_key)
        if ticket_type is None:
            await interaction.response.send_message(
                "That ticket type is no longer available.", ephemeral=True
            )
            return
        category_resource = await self.resources.get(guild.id, ResourceKey.TICKET_CATEGORY)
        category = guild.get_channel(category_resource.discord_id) if category_resource else None
        if not isinstance(category, discord.CategoryChannel):
            await interaction.response.send_message(
                "Ticket category is not configured. Please contact staff.", ephemeral=True
            )
            return
        await interaction.response.defer(ephemeral=True)
        safe_name = f"ticket-{interaction.user.name}".lower().replace(" ", "-")[:90]
        channel = await guild.create_text_channel(
            safe_name, category=category, reason="Ticket opened"
        )
        await channel.set_permissions(
            interaction.user,
            view_channel=True,
            send_messages=True,
            read_message_history=True,
        )
        ticket = await self.tickets.create(guild.id, channel.id, interaction.user.id, type_key)
        embed = discord.Embed(
            title=f"{ticket_type.label} · Ticket #{ticket.id}",
            description=(
                f"Opened by {interaction.user.mention}.\n\n{ticket_type.description}\n\n"
                "Staff can claim or close this ticket with the controls below."
            ),
            color=discord.Color.blurple(),
        )
        await channel.send(content=interaction.user.mention, embed=embed, view=TicketControlsView())
        await interaction.followup.send(f"Created {channel.mention}.", ephemeral=True)

    @staticmethod
    def _staff(interaction: discord.Interaction) -> bool:
        user = interaction.user
        return isinstance(user, discord.Member) and (
            user.guild_permissions.manage_channels or user.guild_permissions.moderate_members
        )

    async def claim_ticket(self, interaction: discord.Interaction) -> None:
        if interaction.channel_id is None or not self._staff(interaction):
            await interaction.response.send_message("Staff permission is required.", ephemeral=True)
            return
        ticket = await self.tickets.get_by_channel(interaction.channel_id)
        if ticket is None or ticket.status not in {"open", "claimed"}:
            await interaction.response.send_message("This is not an active ticket.", ephemeral=True)
            return
        updated = await self.tickets.claim(interaction.channel_id, interaction.user.id)
        await interaction.response.send_message(
            f"Claimed by {interaction.user.mention}." if updated else "Ticket not found."
        )

    async def close_ticket(self, interaction: discord.Interaction, reason: str) -> None:
        channel = interaction.channel
        if not isinstance(channel, discord.TextChannel) or not self._staff(interaction):
            await interaction.response.send_message("Staff permission is required.", ephemeral=True)
            return
        ticket = await self.tickets.get_by_channel(channel.id)
        if ticket is None or ticket.status == "closed":
            await interaction.response.send_message(
                "This ticket is already closed or unavailable.", ephemeral=True
            )
            return
        await interaction.response.defer(ephemeral=True)
        transcript = await self._transcript(channel)
        updated = await self.tickets.close(channel.id, interaction.user.id, reason)
        if updated is None:
            await interaction.followup.send("Ticket record was not found.", ephemeral=True)
            return
        opener = channel.guild.get_member(updated.opener_id)
        if opener is not None:
            await channel.set_permissions(opener, view_channel=False, send_messages=False)
        await channel.edit(name=f"closed-{channel.name}"[:100], reason="Ticket closed")
        await self._send_transcript(channel.guild, updated, transcript)
        await interaction.followup.send("Ticket closed and transcript logged.", ephemeral=True)

    async def reopen_ticket(self, interaction: discord.Interaction) -> None:
        channel = interaction.channel
        if not isinstance(channel, discord.TextChannel) or not self._staff(interaction):
            await interaction.response.send_message("Staff permission is required.", ephemeral=True)
            return
        ticket = await self.tickets.get_by_channel(channel.id)
        if ticket is None or ticket.status != "closed":
            await interaction.response.send_message("This ticket is not closed.", ephemeral=True)
            return
        opener = channel.guild.get_member(ticket.opener_id)
        if opener is not None:
            await channel.set_permissions(
                opener, view_channel=True, send_messages=True, read_message_history=True
            )
        updated = await self.tickets.reopen(channel.id, interaction.user.id)
        if updated is not None:
            await channel.edit(
                name=channel.name.removeprefix("closed-")[:100], reason="Ticket reopened"
            )
        await interaction.response.send_message("Ticket reopened.")

    async def _transcript(self, channel: discord.TextChannel) -> bytes:
        lines: list[str] = []
        async for message in channel.history(limit=500, oldest_first=True):
            timestamp = message.created_at.isoformat()
            content = message.content.replace("\n", " ") if message.content else "[no text content]"
            attachments = " ".join(attachment.url for attachment in message.attachments)
            lines.append(
                f"[{timestamp}] {message.author} ({message.author.id}): {content} {attachments}".rstrip()
            )
        return ("\n".join(lines) + "\n").encode("utf-8")

    async def _send_transcript(
        self, guild: discord.Guild, ticket: TicketRecord, transcript: bytes
    ) -> None:
        resource = await self.resources.get(guild.id, ResourceKey.TICKET_LOGS)
        channel = guild.get_channel(resource.discord_id) if resource else None
        if not isinstance(channel, discord.TextChannel):
            return
        file = discord.File(io.BytesIO(transcript), filename=f"ticket-{ticket.id}.txt")
        embed = discord.Embed(title=f"Ticket #{ticket.id} closed", color=discord.Color.dark_grey())
        embed.add_field(name="Opener", value=f"<@{ticket.opener_id}>")
        embed.add_field(name="Type", value=ticket.type_key)
        embed.add_field(name="Closed by", value=f"<@{ticket.closed_by}>")
        embed.add_field(
            name="Reason", value=(ticket.close_reason or "No reason")[:1024], inline=False
        )
        try:
            await channel.send(embed=embed, file=file)
        except discord.HTTPException as error:
            logger.warning("Could not send transcript for ticket %s: %s", ticket.id, error)

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel: discord.abc.GuildChannel) -> None:
        ticket = await self.tickets.get_by_channel(channel.id)
        if ticket is None or ticket.status == "deleted":
            return
        await self.tickets.mark_deleted(channel.id)
        resource = await self.resources.get(channel.guild.id, ResourceKey.TICKET_LOGS)
        log_channel = channel.guild.get_channel(resource.discord_id) if resource else None
        if isinstance(log_channel, discord.TextChannel):
            await log_channel.send(f"Ticket `#{ticket.id}` channel was deleted manually.")


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading TicketsCog")
    tickets = TicketService(SQLAlchemyTicketRepository(database))
    resources = ResourceService(SQLAlchemyResourceRepository(database))
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    bot.add_view(TicketPanelView())
    bot.add_view(TicketControlsView())
    await bot.add_cog(TicketsCog(bot, tickets, resources, features))
