from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

import discord
from discord import app_commands

logger = logging.getLogger(__name__)

_CONFIRMATION_EXTRA_KEY = "marwie_confirmation_wrapped"


def build_confirmation_prompt(command_name: str) -> str:
    return f"Run `/{command_name}`?"


class CommandConfirmationView(discord.ui.View):
    def __init__(
        self,
        *,
        invoker_id: int,
        command_name: str,
        original_callback: Callable[..., Awaitable[Any]],
        callback_args: tuple[Any, ...],
        callback_kwargs: dict[str, Any],
        interaction_index: int,
    ) -> None:
        super().__init__(timeout=60)
        self.invoker_id = invoker_id
        self.command_name = command_name
        self.original_callback = original_callback
        self.callback_args = callback_args
        self.callback_kwargs = callback_kwargs
        self.interaction_index = interaction_index
        self.message: discord.InteractionMessage | None = None
        self.completed = False

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id == self.invoker_id:
            return True
        await interaction.response.send_message(
            "Only the person who ran this command can approve or decline it.",
            ephemeral=True,
        )
        return False

    @discord.ui.button(label="Approve", style=discord.ButtonStyle.success)
    async def approve(
        self,
        interaction: discord.Interaction,
        _button: discord.ui.Button[CommandConfirmationView],
    ) -> None:
        if self.completed:
            await interaction.response.send_message(
                "This command has already been decided.", ephemeral=True
            )
            return

        self.completed = True
        args = list(self.callback_args)
        args[self.interaction_index] = interaction

        try:
            await self.original_callback(*args, **self.callback_kwargs)
        except Exception as error:
            logger.error(
                "Approved application command failed command=%s guild_id=%s user_id=%s",
                self.command_name,
                interaction.guild_id,
                interaction.user.id,
                exc_info=(type(error), error, error.__traceback__),
            )
            message = "The command failed. The error has been logged for the bot operator."
            if interaction.response.is_done():
                await interaction.followup.send(message, ephemeral=True)
            else:
                await interaction.response.send_message(message, ephemeral=True)
        finally:
            self.stop()
            if self.message is not None:
                try:
                    await self.message.edit(
                        content=f"Approved `/{self.command_name}`.",
                        view=None,
                    )
                except discord.HTTPException:
                    logger.debug(
                        "Could not update approval prompt command=%s user_id=%s",
                        self.command_name,
                        self.invoker_id,
                    )

    @discord.ui.button(label="Decline", style=discord.ButtonStyle.secondary)
    async def decline(
        self,
        interaction: discord.Interaction,
        _button: discord.ui.Button[CommandConfirmationView],
    ) -> None:
        if self.completed:
            await interaction.response.send_message(
                "This command has already been decided.", ephemeral=True
            )
            return

        self.completed = True
        self.stop()
        await interaction.response.edit_message(
            content=f"Declined `/{self.command_name}`.",
            view=None,
        )

    async def on_timeout(self) -> None:
        if self.completed or self.message is None:
            return
        try:
            await self.message.edit(
                content=f"Confirmation expired for `/{self.command_name}`.",
                view=None,
            )
        except discord.HTTPException:
            logger.debug(
                "Could not expire confirmation prompt command=%s user_id=%s",
                self.command_name,
                self.invoker_id,
            )


def install_command_confirmations(tree: app_commands.CommandTree[Any]) -> int:
    wrapped = 0
    for command in tree.walk_commands():
        if not isinstance(command, app_commands.Command):
            continue
        if command.extras.get(_CONFIRMATION_EXTRA_KEY):
            continue

        original_callback = command.callback
        interaction_index = 1 if command.binding is not None else 0
        command_name = command.qualified_name

        async def confirmed_callback(
            *args: Any,
            __original_callback: Callable[..., Awaitable[Any]] = original_callback,
            __interaction_index: int = interaction_index,
            __command_name: str = command_name,
            **kwargs: Any,
        ) -> None:
            if len(args) <= __interaction_index or not isinstance(
                args[__interaction_index], discord.Interaction
            ):
                raise TypeError(f"Could not locate interaction for /{__command_name}")

            slash_interaction = args[__interaction_index]
            view = CommandConfirmationView(
                invoker_id=slash_interaction.user.id,
                command_name=__command_name,
                original_callback=__original_callback,
                callback_args=args,
                callback_kwargs=kwargs,
                interaction_index=__interaction_index,
            )
            await slash_interaction.response.send_message(
                build_confirmation_prompt(__command_name),
                view=view,
                ephemeral=True,
            )
            view.message = await slash_interaction.original_response()

        command._callback = confirmed_callback
        command.extras[_CONFIRMATION_EXTRA_KEY] = True
        wrapped += 1

    return wrapped
