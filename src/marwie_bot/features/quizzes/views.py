from __future__ import annotations

import discord
from discord.ext import commands


class QuizAnswerView(discord.ui.View):
    def __init__(self) -> None:
        super().__init__(timeout=None)

    async def _answer(self, interaction: discord.Interaction, index: int) -> None:
        cog = (
            interaction.client.get_cog("QuizzesCog")
            if isinstance(interaction.client, commands.Bot)
            else None
        )
        if cog is None or not hasattr(cog, "answer_quiz"):
            await interaction.response.send_message("Quiz service is unavailable.", ephemeral=True)
            return
        await cog.answer_quiz(interaction, index)

    @discord.ui.button(
        label="A",
        style=discord.ButtonStyle.secondary,
        custom_id="marwie:quiz:a",
    )
    async def answer_a(
        self, interaction: discord.Interaction, _: discord.ui.Button[discord.ui.View]
    ) -> None:
        await self._answer(interaction, 0)

    @discord.ui.button(
        label="B",
        style=discord.ButtonStyle.secondary,
        custom_id="marwie:quiz:b",
    )
    async def answer_b(
        self, interaction: discord.Interaction, _: discord.ui.Button[discord.ui.View]
    ) -> None:
        await self._answer(interaction, 1)

    @discord.ui.button(
        label="C",
        style=discord.ButtonStyle.secondary,
        custom_id="marwie:quiz:c",
    )
    async def answer_c(
        self, interaction: discord.Interaction, _: discord.ui.Button[discord.ui.View]
    ) -> None:
        await self._answer(interaction, 2)

    @discord.ui.button(
        label="D",
        style=discord.ButtonStyle.secondary,
        custom_id="marwie:quiz:d",
    )
    async def answer_d(
        self, interaction: discord.Interaction, _: discord.ui.Button[discord.ui.View]
    ) -> None:
        await self._answer(interaction, 3)
