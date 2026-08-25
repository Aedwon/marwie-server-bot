from __future__ import annotations

import logging
import secrets
from collections.abc import Awaitable, Callable, Mapping
from enum import Enum
from typing import Any, ParamSpec, TypeVar

import discord
from discord import app_commands

from marwie_bot.shared.errors import build_failure_message

logger = logging.getLogger(__name__)

_CONFIRMATION_EXTRA_KEY = "marwie_confirmation_wrapped"
_CONFIRMATION_DETAIL_ATTR = "__marwie_confirmation_detail__"
_OPTION_VALUE_LIMIT = 120

_P = ParamSpec("_P")
_R = TypeVar("_R")

type CommandCallback = Callable[..., Awaitable[Any]]


def confirmation_detail(text: str) -> Callable[[Callable[_P, _R]], Callable[_P, _R]]:
    detail = text.strip()

    def decorator(callback: Callable[_P, _R]) -> Callable[_P, _R]:
        setattr(callback, _CONFIRMATION_DETAIL_ATTR, detail)
        return callback

    return decorator


def _truncate_option_value(text: str) -> str:
    clean = " ".join(text.split()).replace("`", "'")
    if len(clean) <= _OPTION_VALUE_LIMIT:
        return clean
    return f"{clean[: _OPTION_VALUE_LIMIT - 1]}…"


def _format_option_value(value: Any) -> str:
    if value is None:
        return "not set"
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, Enum):
        return _truncate_option_value(str(value.value))
    if isinstance(value, discord.Attachment):
        return _truncate_option_value(value.filename)
    if isinstance(value, discord.abc.Snowflake):
        name = getattr(value, "display_name", None) or getattr(value, "name", None)
        if name is not None:
            return _truncate_option_value(f"{name} ({value.id})")
        return str(value.id)
    return _truncate_option_value(str(value))


def build_confirmation_prompt(
    command_name: str,
    description: str,
    options: Mapping[str, Any],
    *,
    detail: str | None = None,
) -> str:
    parts = [f"**Confirm `/{command_name}`**", description.strip()]

    if detail:
        parts.extend(["", "**What will happen**", detail.strip()])

    if options:
        parts.extend(["", "**Options**"])
        parts.extend(
            f"- `{name}`: `{_format_option_value(value)}`" for name, value in options.items()
        )

    parts.extend(["", "Approve to continue. Decline to cancel."])
    return "\n".join(parts)


class CommandConfirmationView(discord.ui.View):
    def __init__(
        self,
        *,
        invoker_id: int,
        command_name: str,
        original_callback: CommandCallback,
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
        completion_message = f"Approved `/{self.command_name}`."

        try:
            await self.original_callback(*args, **self.callback_kwargs)
        except Exception as error:
            error_reference = secrets.token_hex(4).upper()
            logger.exception(
                "Approved application command failed command=%s guild_id=%s user_id=%s "
                "error_reference=%s",
                self.command_name,
                interaction.guild_id,
                interaction.user.id,
                error_reference,
            )
            message = build_failure_message(error, error_reference)
            completion_message = (
                f"Approved `/{self.command_name}`, but execution failed. "
                f"Error reference: `{error_reference}`."
            )
            if interaction.response.is_done():
                await interaction.followup.send(message, ephemeral=True)
            else:
                await interaction.response.send_message(message, ephemeral=True)
        finally:
            self.stop()
            if self.message is not None:
                try:
                    await self.message.edit(
                        content=completion_message,
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
        command_description = command.description
        custom_detail = getattr(original_callback, _CONFIRMATION_DETAIL_ATTR, None)

        async def confirmed_callback(
            *args: Any,
            __original_callback: CommandCallback = original_callback,
            __interaction_index: int = interaction_index,
            __command_name: str = command_name,
            __command_description: str = command_description,
            __custom_detail: str | None = custom_detail,
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
                build_confirmation_prompt(
                    __command_name,
                    __command_description,
                    kwargs,
                    detail=__custom_detail,
                ),
                view=view,
                ephemeral=True,
            )
            view.message = await slash_interaction.original_response()

        command._callback = confirmed_callback
        command.extras[_CONFIRMATION_EXTRA_KEY] = True
        wrapped += 1

    return wrapped
