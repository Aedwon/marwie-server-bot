from __future__ import annotations

from dataclasses import dataclass


class ModerationTargetError(ValueError):
    """Raised when Discord hierarchy rules make a moderation target invalid."""


@dataclass(frozen=True, slots=True)
class ModerationHierarchy:
    caller_id: int
    target_id: int
    guild_owner_id: int
    caller_top_role_position: int
    target_top_role_position: int
    bot_top_role_position: int


def validate_moderation_target(context: ModerationHierarchy) -> None:
    if context.caller_id == context.target_id:
        raise ModerationTargetError("You cannot moderate yourself.")

    if context.target_id == context.guild_owner_id:
        raise ModerationTargetError("The server owner cannot be targeted.")

    caller_is_owner = context.caller_id == context.guild_owner_id
    if not caller_is_owner and (
        context.target_top_role_position >= context.caller_top_role_position
    ):
        raise ModerationTargetError(
            "You cannot target a member with an equal or higher top role."
        )

    if context.target_top_role_position >= context.bot_top_role_position:
        raise ModerationTargetError(
            "I cannot target that member because their top role is equal to or above mine."
        )
