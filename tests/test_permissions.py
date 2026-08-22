import pytest

from marwie_bot.shared.permissions import (
    ModerationHierarchy,
    ModerationTargetError,
    validate_moderation_target,
)


def context(**overrides: int) -> ModerationHierarchy:
    values = {
        "caller_id": 10,
        "target_id": 20,
        "guild_owner_id": 1,
        "caller_top_role_position": 50,
        "target_top_role_position": 10,
        "bot_top_role_position": 60,
    }
    values.update(overrides)
    return ModerationHierarchy(**values)


def test_rejects_self_target() -> None:
    with pytest.raises(ModerationTargetError, match="yourself"):
        validate_moderation_target(context(target_id=10))


def test_rejects_guild_owner() -> None:
    with pytest.raises(ModerationTargetError, match="owner"):
        validate_moderation_target(context(target_id=1))


def test_rejects_target_at_or_above_moderator() -> None:
    with pytest.raises(ModerationTargetError, match="equal or higher"):
        validate_moderation_target(context(target_top_role_position=50))


def test_owner_bypasses_caller_role_comparison() -> None:
    validate_moderation_target(
        context(
            caller_id=1,
            caller_top_role_position=1,
            target_top_role_position=50,
            bot_top_role_position=60,
        )
    )


def test_owner_does_not_bypass_bot_hierarchy() -> None:
    with pytest.raises(ModerationTargetError, match="above mine"):
        validate_moderation_target(
            context(
                caller_id=1,
                caller_top_role_position=1,
                target_top_role_position=60,
                bot_top_role_position=60,
            )
        )
