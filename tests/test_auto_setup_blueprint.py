from marwie_bot.config.resources import ResourceKey
from marwie_bot.features.configuration.provisioning import (
    AUTO_SETUP_RESOURCES,
    ProvisionKind,
)
from marwie_bot.shared.confirmations import build_confirmation_prompt


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


def test_confirmation_prompt_names_the_exact_command() -> None:
    assert build_confirmation_prompt("setup auto") == "Run `/setup auto`?"
