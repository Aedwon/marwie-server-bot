import pytest
from sqlalchemy import String

from marwie_bot.features.control_plane.domain import ControlActionType
from marwie_bot.features.control_plane.models import NotificationRoleButton
from marwie_bot.features.control_plane.validation import (
    ActionPermission,
    required_permission,
    validate_action_payload,
)


def test_setup_and_ticket_admin_actions_require_administrator() -> None:
    assert required_permission(ControlActionType.SET_RESOURCE) is ActionPermission.ADMINISTRATOR
    assert required_permission(ControlActionType.APPLY_AUTO_SETUP) is ActionPermission.ADMINISTRATOR
    assert (
        required_permission(ControlActionType.SAVE_NOTIFICATION_PANEL)
        is ActionPermission.ADMINISTRATOR
    )
    assert (
        required_permission(ControlActionType.UPSERT_TICKET_TYPE) is ActionPermission.ADMINISTRATOR
    )
    assert (
        required_permission(ControlActionType.REFRESH_TICKET_PANEL)
        is ActionPermission.ADMINISTRATOR
    )
    assert required_permission(ControlActionType.POST_LIVE) is ActionPermission.ADMINISTRATOR


def test_operational_configuration_preserves_manage_guild_permissions() -> None:
    assert (
        required_permission(ControlActionType.SET_REPUTATION_THRESHOLDS)
        is ActionPermission.MANAGE_GUILD
    )
    assert required_permission(ControlActionType.ADD_QUIZ_QUESTION) is ActionPermission.MANAGE_GUILD
    assert required_permission(ControlActionType.UPSERT_AI_SOURCE) is ActionPermission.MANAGE_GUILD
    assert required_permission(ControlActionType.SEND_ANNOUNCEMENT) is ActionPermission.MANAGE_GUILD


def test_internal_snapshot_refresh_requires_manage_guild_and_has_no_payload() -> None:
    assert required_permission(ControlActionType.REFRESH_SNAPSHOT) is ActionPermission.MANAGE_GUILD
    assert validate_action_payload(ControlActionType.REFRESH_SNAPSHOT, {}) == {}


def test_reputation_thresholds_must_strictly_increase() -> None:
    payload = validate_action_payload(
        ControlActionType.SET_REPUTATION_THRESHOLDS,
        {"builder": 50, "contributor": 150, "mentor": 500},
    )
    assert payload == {"builder": 50, "contributor": 150, "mentor": 500}

    with pytest.raises(ValueError, match="increase"):
        validate_action_payload(
            ControlActionType.SET_REPUTATION_THRESHOLDS,
            {"builder": 50, "contributor": 50, "mentor": 500},
        )


def test_reputation_adjustment_rejects_zero_or_out_of_range_points() -> None:
    with pytest.raises(ValueError, match="between -1000 and 1000"):
        validate_action_payload(
            ControlActionType.ADJUST_REPUTATION,
            {"member_id": "123", "points": 0, "reason": "No-op"},
        )
    with pytest.raises(ValueError, match="between -1000 and 1000"):
        validate_action_payload(
            ControlActionType.ADJUST_REPUTATION,
            {"member_id": "123", "points": 1001, "reason": "Too much"},
        )


def test_quiz_question_requires_four_options_and_correct_answer() -> None:
    payload = validate_action_payload(
        ControlActionType.ADD_QUIZ_QUESTION,
        {
            "category": "Python",
            "prompt": "Which value is truthy?",
            "options": ["0", "1", "None", "False"],
            "correct": 2,
            "explanation": "1 is truthy.",
        },
    )
    assert payload["correct"] == 2

    with pytest.raises(ValueError, match="four options"):
        validate_action_payload(
            ControlActionType.ADD_QUIZ_QUESTION,
            {
                "category": "Python",
                "prompt": "Question",
                "options": ["A", "B"],
                "correct": 1,
            },
        )


def test_notification_panel_rejects_duplicate_roles() -> None:
    with pytest.raises(ValueError, match="duplicate role"):
        validate_action_payload(
            ControlActionType.SAVE_NOTIFICATION_PANEL,
            {
                "channel_id": "10",
                "title": "Notifications",
                "description": "Choose roles.",
                "buttons": [
                    {"role_id": "20", "label": "One", "emoji": "", "style": "primary"},
                    {"role_id": "20", "label": "Two", "emoji": "", "style": "secondary"},
                ],
            },
        )


def test_notification_panel_accepts_full_custom_emoji_value() -> None:
    emoji = f"<a:{'x' * 32}:1234567890123456789>"
    assert len(emoji) > 32
    payload = validate_action_payload(
        ControlActionType.SAVE_NOTIFICATION_PANEL,
        {
            "channel_id": "10",
            "title": "Notifications",
            "description": "Choose roles.",
            "buttons": [
                {"role_id": "20", "label": "Updates", "emoji": emoji, "style": "primary"},
            ],
        },
    )
    assert payload["buttons"][0]["emoji"] == emoji
    emoji_type = NotificationRoleButton.__table__.c.emoji.type
    assert isinstance(emoji_type, String)
    assert emoji_type.length is not None
    assert emoji_type.length >= len(emoji)


def test_announcement_mentions_are_explicit_structured_targets() -> None:
    payload = validate_action_payload(
        ControlActionType.SEND_ANNOUNCEMENT,
        {
            "channel_id": "10",
            "message": "Heads up",
            "title": "Release",
            "body": "Deploying now.",
            "footer": "Staff",
            "color": "5865F2",
            "mentions": {
                "everyone": False,
                "here": False,
                "role_ids": ["20"],
                "user_ids": ["30"],
            },
        },
    )
    assert payload["mentions"]["role_ids"] == [20]
    assert payload["mentions"]["user_ids"] == [30]


def test_live_post_preserves_explicit_destination_and_ping_choice() -> None:
    payload = validate_action_payload(
        ControlActionType.POST_LIVE,
        {"channel_id": "10", "ping_role_id": "20", "topic": "Building live"},
    )
    assert payload == {"channel_id": 10, "ping_role_id": 20, "topic": "Building live"}

    no_ping = validate_action_payload(
        ControlActionType.POST_LIVE,
        {"channel_id": None, "ping_role_id": None, "topic": ""},
    )
    assert no_ping == {"channel_id": None, "ping_role_id": None, "topic": ""}


def test_manual_resource_mapping_accepts_compromised_account_trap() -> None:
    payload = validate_action_payload(
        ControlActionType.SET_RESOURCE,
        {"key": "compromised_account_trap", "discord_id": "123456789"},
    )
    assert payload == {"key": "compromised_account_trap", "discord_id": 123456789}


def test_mapping_suggestions_reject_compromised_account_trap_item() -> None:
    with pytest.raises(ValueError, match="manual-only"):
        validate_action_payload(
            ControlActionType.APPLY_MAPPING_SUGGESTIONS,
            {
                "plan_hash": "a" * 64,
                "items": [
                    {
                        "key": "compromised_account_trap",
                        "action": "bind",
                        "target_id": "123456789",
                    }
                ],
                "confirmed_keys": [],
            },
        )


def test_mapping_suggestions_reject_compromised_account_trap_confirmation() -> None:
    with pytest.raises(ValueError, match="manual-only"):
        validate_action_payload(
            ControlActionType.APPLY_MAPPING_SUGGESTIONS,
            {
                "plan_hash": "a" * 64,
                "items": [],
                "confirmed_keys": ["compromised_account_trap"],
            },
        )
