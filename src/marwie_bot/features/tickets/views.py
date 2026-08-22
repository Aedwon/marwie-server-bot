from __future__ import annotations

import discord
from discord.ext import commands

from marwie_bot.features.tickets.service import TicketTypeRecord


class TicketTypeSelect(discord.ui.Select):
    def __init__(self, ticket_types: list[TicketTypeRecord]) -> None:
        options = [
            discord.SelectOption(
                label=item.label, value=item.key, description=item.description[:100]
            )
            for item in ticket_types[:25]
        ]
        super().__init__(
            placeholder="Choose a ticket type", min_values=1, max_values=1, options=options
        )

    async def callback(self, interaction: discord.Interaction) -> None:
        cog = (
            interaction.client.get_cog("TicketsCog")
            if isinstance(interaction.client, commands.Bot)
            else None
        )
        if cog is None or not hasattr(cog, "create_ticket"):
            await interaction.response.send_message(
                "Ticket service is unavailable.", ephemeral=True
            )
            return
        await cog.create_ticket(interaction, self.values[0])


class TicketTypeView(discord.ui.View):
    def __init__(self, ticket_types: list[TicketTypeRecord]) -> None:
        super().__init__(timeout=120)
        self.add_item(TicketTypeSelect(ticket_types))


class TicketPanelView(discord.ui.View):
    def __init__(self) -> None:
        super().__init__(timeout=None)

    @discord.ui.button(
        label="Open ticket",
        style=discord.ButtonStyle.primary,
        custom_id="marwie:ticket:open",
    )
    async def open_ticket(
        self, interaction: discord.Interaction, _: discord.ui.Button[discord.ui.View]
    ) -> None:
        cog = (
            interaction.client.get_cog("TicketsCog")
            if isinstance(interaction.client, commands.Bot)
            else None
        )
        if cog is None or not hasattr(cog, "show_ticket_types"):
            await interaction.response.send_message(
                "Ticket service is unavailable.", ephemeral=True
            )
            return
        await cog.show_ticket_types(interaction)


class TicketCloseModal(discord.ui.Modal, title="Close ticket"):
    reason = discord.ui.TextInput(  # type: ignore[var-annotated]
        label="Reason", max_length=1000, required=False
    )

    async def on_submit(self, interaction: discord.Interaction) -> None:
        cog = (
            interaction.client.get_cog("TicketsCog")
            if isinstance(interaction.client, commands.Bot)
            else None
        )
        if cog is None or not hasattr(cog, "close_ticket"):
            await interaction.response.send_message(
                "Ticket service is unavailable.", ephemeral=True
            )
            return
        await cog.close_ticket(interaction, str(self.reason))


class TicketControlsView(discord.ui.View):
    def __init__(self) -> None:
        super().__init__(timeout=None)

    @discord.ui.button(
        label="Claim",
        style=discord.ButtonStyle.secondary,
        custom_id="marwie:ticket:claim",
    )
    async def claim(
        self, interaction: discord.Interaction, _: discord.ui.Button[discord.ui.View]
    ) -> None:
        cog = (
            interaction.client.get_cog("TicketsCog")
            if isinstance(interaction.client, commands.Bot)
            else None
        )
        if cog is None or not hasattr(cog, "claim_ticket"):
            await interaction.response.send_message(
                "Ticket service is unavailable.", ephemeral=True
            )
            return
        await cog.claim_ticket(interaction)

    @discord.ui.button(
        label="Close",
        style=discord.ButtonStyle.danger,
        custom_id="marwie:ticket:close",
    )
    async def close(
        self, interaction: discord.Interaction, _: discord.ui.Button[discord.ui.View]
    ) -> None:
        await interaction.response.send_modal(TicketCloseModal())

    @discord.ui.button(
        label="Reopen",
        style=discord.ButtonStyle.success,
        custom_id="marwie:ticket:reopen",
    )
    async def reopen(
        self, interaction: discord.Interaction, _: discord.ui.Button[discord.ui.View]
    ) -> None:
        cog = (
            interaction.client.get_cog("TicketsCog")
            if isinstance(interaction.client, commands.Bot)
            else None
        )
        if cog is None or not hasattr(cog, "reopen_ticket"):
            await interaction.response.send_message(
                "Ticket service is unavailable.", ephemeral=True
            )
            return
        await cog.reopen_ticket(interaction)
