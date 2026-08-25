import pytest

from marwie_bot.config.resources import ResourceKey
from marwie_bot.features.configuration.provisioning import (
    AUTO_SETUP_RESOURCES,
    ProvisionKind,
    normalize_resource_name,
    require_auto_setup_community,
    resource_name_matches,
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


def test_auto_setup_keeps_ticket_category_private() -> None:
    by_key = {item.key: item for item in AUTO_SETUP_RESOURCES}
    assert by_key[ResourceKey.TICKET_CATEGORY].private is True


def test_auto_setup_normalizes_decorative_discord_names() -> None:
    assert normalize_resource_name("🚨-announcements") == "announcements"
    assert normalize_resource_name("📱-app-of-the-week") == "app-of-the-week"
    assert normalize_resource_name("AI_UPDATES") == "ai-updates"
    assert normalize_resource_name("CO-WORKING SPACE") == "co-working-space"


def test_auto_setup_matches_existing_server_aliases() -> None:
    by_key = {item.key: item for item in AUTO_SETUP_RESOURCES}

    assert resource_name_matches("🔴-live", by_key[ResourceKey.LIVE_ANNOUNCEMENTS])
    assert resource_name_matches("🎫-tickets", by_key[ResourceKey.TICKET_PANEL])
    assert resource_name_matches("Create VC", by_key[ResourceKey.CREATE_WORKSPACE_VOICE])
    assert resource_name_matches("Coworking", by_key[ResourceKey.COWORKING_LOUNGE])
    assert resource_name_matches("🎭-anonymous", by_key[ResourceKey.ANON_QUESTIONS])
    assert resource_name_matches("general-questions", by_key[ResourceKey.BUILD_HELP_FORUM])
    assert resource_name_matches("🤖-ai-updates", by_key[ResourceKey.AI_UPDATES])
    assert resource_name_matches("🤝-collab-lfg", by_key[ResourceKey.COLLAB_LFG])
    assert resource_name_matches("📱-app-of-the-week", by_key[ResourceKey.APP_OF_WEEK])
    assert resource_name_matches("🤓-roles", by_key[ResourceKey.ROLE_PANEL])


def test_auto_setup_does_not_semantically_guess_unlisted_names() -> None:
    by_key = {item.key: item for item in AUTO_SETUP_RESOURCES}

    assert not resource_name_matches("support", by_key[ResourceKey.BUILD_HELP_FORUM])
    assert not resource_name_matches("updates", by_key[ResourceKey.ANNOUNCEMENTS])
    assert not resource_name_matches("stream-ping", by_key[ResourceKey.LIVE_PING_ROLE])


def test_auto_setup_requires_community_only_for_forum_creation() -> None:
    with pytest.raises(UserFacingCommandError, match="Community") as exc_info:
        require_auto_setup_community([])

    assert "mutation plan" in exc_info.value.user_message
    assert "were created" in exc_info.value.user_message


def test_auto_setup_accepts_community_enabled_guild() -> None:
    require_auto_setup_community(["COMMUNITY", "NEWS"])


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
    error = UserFacingCommandError(
        "Could not configure `moderation_log`: Discord denied the action."
    )

    message = build_failure_message(error, "AB12CD34")

    assert "Could not configure `moderation_log`: Discord denied the action." in message
    assert "`AB12CD34`" in message


def test_generic_failure_does_not_expose_exception_text() -> None:
    error = RuntimeError("postgresql://secret-user:secret-password@example.invalid/database")

    message = build_failure_message(error, "EF56AB78")

    assert "secret-password" not in message
    assert "`EF56AB78`" in message
