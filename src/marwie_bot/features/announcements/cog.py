from __future__ import annotations

from dataclasses import dataclass

import discord
from discord import app_commands
from discord.ext import commands

from marwie_bot.config.resources import FeatureName
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.repository import SQLAlchemyFeatureConfigRepository
from marwie_bot.features.configuration.service import FeatureConfigService


@dataclass(frozen=True, slots=True)
class AnnouncementDraft:
    title: str
    body: str
    footer: str
    color: int


def _parse_color(value: str) -> int:
    raw = value.strip().removeprefix("#")
    if not raw:
        return discord.Color.blurple().value
    if len(raw) != 6:
        raise ValueError("Color must be a six-digit hex value such as `5865F2`.")
    try:
        return int(raw, 16)
    except ValueError as error:
        raise ValueError("Color must be a six-digit hex value such as `5865F2`.") from error


def _embed(draft: AnnouncementDraft) -> discord.Embed:
    embed = discord.Embed(
        title=draft.title or None,
        description=draft.body,
        color=discord.Color(draft.color),
    )
    if draft.footer:
        embed.set_footer(text=draft.footer)
    return embed


class AnnouncementModal(discord.ui.Modal, title="Compose announcement"):
    announcement_title = discord.ui.TextInput(label="Title", max_length=256, required=False)
    body = discord.ui.TextInput(
        label="Body", style=discord.TextStyle.paragraph, max_length=4000, required=True
    )
    footer = discord.ui.TextInput(label="Footer", max_length=2048, required=False)
    color = discord.ui.TextInput(
        label="Hex color", placeholder="5865F2", max_length=7, required=False
    )

    def __init__(
        self,
        channel: discord.TextChannel,
        author_id: int,
        draft: AnnouncementDraft | None = None,
    ) -> None:
        super().__init__()
        self.channel = channel
        self.author_id = author_id
        if draft is not None:
            self.announcement_title.default = draft.title
            self.body.default = draft.body
            self.footer.default = draft.footer
            self.color.default = f"{draft.color:06X}"

    async def on_submit(self, interaction: discord.Interaction) -> None:
        if interaction.user.id != self.author_id:
            await interaction.response.send_message(
                "This composer belongs to another user.", ephemeral=True
            )
            return
        try:
            color = _parse_color(str(self.color))
        except ValueError as error:
            await interaction.response.send_message(str(error), ephemeral=True)
            return
        draft = AnnouncementDraft(
            title=str(self.announcement_title).strip(),
            body=str(self.body).strip(),
            footer=str(self.footer).strip(),
            color=color,
        )
        await interaction.response.send_message(
            content=f"Preview for {self.channel.mention}",
            embed=_embed(draft),
            view=AnnouncementPreviewView(self.channel, self.author_id, draft),
            ephemeral=True,
        )


class AnnouncementPreviewView(discord.ui.View):
    def __init__(
        self,
        channel: discord.TextChannel,
        author_id: int,
        draft: AnnouncementDraft,
    ) -> None:
        super().__init__(timeout=600)
        self.channel = channel
        self.author_id = author_id
        self.draft = draft

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id == self.author_id:
            return True
        await interaction.response.send_message(
            "This preview belongs to another user.", ephemeral=True
        )
        return False

    @discord.ui.button(label="Send", style=discord.ButtonStyle.success)
    async def send(
        self, interaction: discord.Interaction, _: discord.ui.Button[discord.ui.View]
    ) -> None:
        await self.channel.send(
            embed=_embed(self.draft),
            allowed_mentions=discord.AllowedMentions.none(),
        )
        await interaction.response.edit_message(
            content="Announcement sent.", embed=None, view=None
        )

    @discord.ui.button(label="Edit", style=discord.ButtonStyle.secondary)
    async def edit(
        self, interaction: discord.Interaction, _: discord.ui.Button[discord.ui.View]
    ) -> None:
        await interaction.response.send_modal(
            AnnouncementModal(self.channel, self.author_id, self.draft)
        )

    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.danger)
    async def cancel(
        self, interaction: discord.Interaction, _: discord.ui.Button[discord.ui.View]
    ) -> None:
        await interaction.response.edit_message(
            content="Announcement cancelled.", embed=None, view=None
        )


class AnnouncementsCog(commands.Cog):
    def __init__(self, features: FeatureConfigService) -> None:
        self.features = features

    @app_commands.command(name="announce", description="Compose and preview an announcement.")
    @app_commands.default_permissions(manage_guild=True)
    @app_commands.checks.has_permissions(manage_guild=True)
    @app_commands.guild_only()
    async def announce(
        self, interaction: discord.Interaction, channel: discord.TextChannel
    ) -> None:
        if interaction.guild_id is None:
            await interaction.response.send_message(
                "This command only works in a server.", ephemeral=True
            )
            return
        if not await self.features.is_enabled(
            interaction.guild_id, FeatureName.ANNOUNCEMENTS
        ):
            await interaction.response.send_message(
                "Announcements are disabled here.", ephemeral=True
            )
            return
        await interaction.response.send_modal(
            AnnouncementModal(channel, interaction.user.id)
        )


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading AnnouncementsCog")
    features = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
    await bot.add_cog(AnnouncementsCog(features))
