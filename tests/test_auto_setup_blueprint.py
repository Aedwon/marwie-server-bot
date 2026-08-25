from marwie_bot.config.resources import ResourceKey
from marwie_bot.features.configuration.provisioning import (
    AUTO_SETUP_RESOURCES,
    ProvisionKind,
)
from marwie_bot.shared.confirmations import build_confirmation_prompt
from marwie_bot.shared.errors import UserFacingCommandError, build_failure_message


def test_auto_setup_blueprint_covers_every_non_tag_resource() -> None:
    configured_keys = {item.key for item in AUTO_SETUP_RESOURCES}
    assert configured_keys == set(ResourceKey) - {ResourceKey.SOLVED_TAG}


def test_auto_setup_reuses_bot_logs_for_both_log_resource_keys() -> None:
    by_key = {item.key: item for item in AUTO_SETUP_RESOURCES}
    assert by_key[ResourceKey.MESSAGE_LOG].name == "bot-logs"
    assert by_key[ResourceKey.BOT_LOG].name == "bot-logs"
    assert by_key[ResourceKey.MESSAGE_LOG].kind == ProvisionKind.TEXT
    assert by_key[ResourceKey.BOT_LOG].kind == ProvisionKind.TEXT


def test_auto_setup_role_semantics_are_explicit() -> None:
    by_key = {item.key: item for item in AUTO_SETUP_RESOURCES}
    assert by_key[ResourceKey.BUILDER_ROLE].name == "Builder"
    assert by_key[ResourceKey.CONTRIBUTOR_ROLE].name == "Contributor"
    assert by_key[ResourceKey.MENTOR_ROLE].name == "Mentor"
    assert by_key[ResourceKey.LIVE_PING_ROLE].name == "Live Notifications"
    assert by_key[ResourceKey.ROLE_PANEL].name == "roles"


def test_confirmation_prompt_includes_command_description_and_options() -> None:
    prompt = build_confirmation_prompt(
        "setup feature",
        "Enable or disable a bot feature for this server.",
        {"feature": "ai_updates", "enabled": False},
    )

    assert "**Confirm `/setup feature`**" in prompt
    assert "Enable or disable a bot feature for this server." in prompt
    assert "`feature`: `ai_updates`" in prompt
    assert "`enabled`: `false`" in prompt


def test_confirmation_prompt_includes_custom_side_effect_detail() -> None:
    prompt = build_confirmation_prompt(
        "setup auto",
        "Discover or create the standard resources needed by the bot.",
        {},
        detail=(
            "Keep valid bindings, adopt matching existing resources, create missing resources, "
            "and never delete unrelated server resources."
        ),
    )

    assert "Keep valid bindings" in prompt
    assert "create missing resources" in prompt
    assert "never delete unrelated server resources" in prompt


def test_confirmation_prompt_truncates_long_option_values() -> None:
    prompt = build_confirmation_prompt(
        "announce",
        "Post an announcement.",
        {"message": "x" * 1_000},
    )

    assert "x" * 200 not in prompt
    assert "…" in prompt


def test_user_facing_command_error_preserves_safe_message_and_reference() -> None:
    error = UserFacingCommandError("Could not configure `moderation_log`: Discord denied the action.")

    message = build_failure_message(error, "AB12CD34")

    assert "Could not configure `moderation_log`: Discord denied the action." in message
    assert "`AB12CD34`" in message


def test_generic_failure_does_not_expose_exception_text() -> None:
    error = RuntimeError("postgresql://secret-user:secret-password@example.invalid/database")

    message = build_failure_message(error, "EF56AB78")

    assert "secret-password" not in message
    assert "`EF56AB78`" in message
