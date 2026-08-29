from __future__ import annotations

from copy import deepcopy
from typing import Any

import pytest

from marwie_bot.features.control_plane.page_revisions import build_page_revisions
from marwie_bot.features.control_plane.page_save_contract import normalize_page_save_payload


def _normalize_action_type(value: str) -> str:
    return value


def _validate_action_payload(
    action_type: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    del action_type
    return dict(payload)


def normalize(
    page_key: str,
    action_type: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    return normalize_page_save_payload(
        {
            "page_key": page_key,
            "base_revision": "a" * 64,
            "changes": [
                {
                    "action_type": action_type,
                    "payload": payload,
                }
            ],
        },
        normalize_action_type=_normalize_action_type,
        validate_action_payload=_validate_action_payload,
    )


def test_all_workflows_pages_are_read_only_guidance() -> None:
    cases = (
        "/control/workflows/moderation",
        "/control/workflows/ticket-handling",
        "/control/workflows/events",
    )
    for page_key in cases:
        with pytest.raises(ValueError, match="does not belong"):
            normalize(
                page_key,
                "set_feature",
                {
                    "feature": "moderation",
                    "enabled": False,
                },
            )


def test_read_only_workflows_do_not_receive_editable_page_revisions() -> None:
    revisions = build_page_revisions(
        {
            "features": [
                {
                    "name": "moderation",
                    "enabled": True,
                }
            ],
            "resources": [],
        }
    )

    assert "/control/workflows/moderation" not in revisions
    assert "/control/workflows/ticket-handling" not in revisions
    assert "/control/workflows/events" not in revisions


def test_mappings_channels_rejects_removed_ownership_and_accepts_real_channels() -> None:
    for key in ("bot_log",):
        with pytest.raises(ValueError, match="not owned"):
            normalize(
                "/control/mappings/channels",
                "set_resource",
                {
                    "key": key,
                    "discord_id": 123,
                },
            )

    accepted = normalize(
        "/control/mappings/channels",
        "set_resource",
        {
            "key": "moderation_log",
            "discord_id": 123,
        },
    )
    assert accepted["changes"][0]["payload"]["key"] == "moderation_log"


def test_bot_log_changes_do_not_change_mappings_channel_revision() -> None:
    first = {
        "features": [],
        "resources": [
            {
                "key": "moderation_log",
                "id": "10",
            },
            {
                "key": "bot_log",
                "id": "20",
            },
        ],
    }

    bot_log_changed = deepcopy(first)
    bot_log_changed["resources"][1]["id"] = "21"

    before = build_page_revisions(first)
    after_bot_log = build_page_revisions(bot_log_changed)

    assert before["/control/mappings/channels"] == after_bot_log["/control/mappings/channels"]

    real_mapping_changed = deepcopy(first)
    real_mapping_changed["resources"][0]["id"] = "11"
    after_real_mapping = build_page_revisions(real_mapping_changed)

    assert before["/control/mappings/channels"] != after_real_mapping["/control/mappings/channels"]


@pytest.mark.parametrize(
    ("page_key", "action_type", "payload"),
    [
        (
            "/control/community/reputation",
            "adjust_reputation",
            {
                "member_id": 1,
                "points": 10,
                "reason": "manual",
            },
        ),
        (
            "/control/utilities/ticket-configuration",
            "refresh_ticket_panel",
            {},
        ),
        (
            "/control/content/feeds",
            "poll_ai_sources",
            {},
        ),
    ],
)
def test_commands_only_actions_are_rejected_by_real_page_save_contract(
    page_key: str,
    action_type: str,
    payload: dict[str, Any],
) -> None:
    with pytest.raises(ValueError, match="does not belong"):
        normalize(page_key, action_type, payload)
