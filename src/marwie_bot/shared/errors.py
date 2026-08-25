from __future__ import annotations

import re

import discord

_ERROR_TEXT_LIMIT = 160
_WHITESPACE_RE = re.compile(r"\s+")


class UserFacingCommandError(Exception):
    """An operational error whose message is safe to show to the command invoker."""

    def __init__(self, user_message: str) -> None:
        super().__init__(user_message)
        self.user_message = user_message


def build_failure_message(error: Exception, error_reference: str) -> str:
    if isinstance(error, UserFacingCommandError):
        lead = error.user_message
    else:
        lead = "The command failed unexpectedly."
    return f"{lead}\nError reference: `{error_reference}`."


def describe_discord_failure(context: str, error: discord.HTTPException) -> str:
    if isinstance(error, discord.Forbidden):
        return (
            f"{context}: Discord denied the action. Check the bot's permissions and role hierarchy."
        )
    if isinstance(error, discord.NotFound):
        return f"{context}: the Discord resource no longer exists."

    raw_text = str(getattr(error, "text", "")).strip()
    clean_text = _WHITESPACE_RE.sub(" ", raw_text)
    if len(clean_text) > _ERROR_TEXT_LIMIT:
        clean_text = f"{clean_text[: _ERROR_TEXT_LIMIT - 1]}…"

    code = getattr(error, "code", 0)
    if clean_text:
        return f"{context}: Discord API error {code} ({clean_text})."
    return f"{context}: Discord rejected the request with API error {code}."
