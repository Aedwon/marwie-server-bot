from typing import Any

import pytest

from marwie_bot.features.control_plane.page_save_contract import normalize_page_save_payload


def normalize_action_type(value: str) -> str:
    return value


def validate_action_payload(action_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    del action_type
    return dict(payload)


def normalize(raw: dict[str, Any]) -> dict[str, Any]:
    return normalize_page_save_payload(
        raw,
        normalize_action_type=normalize_action_type,
        validate_action_payload=validate_action_payload,
    )


def test_reputation_page_accepts_owned_changes_in_one_logical_save() -> None:
    payload = normalize(
        {
            "page_key": "/control/community/reputation",
            "base_revision": "a" * 64,
            "changes": [
                {
                    "action_type": "set_feature",
                    "payload": {"feature": "reputation", "enabled": True},
                },
                {
                    "action_type": "set_reputation_thresholds",
                    "payload": {"builder": 50, "contributor": 150, "mentor": 500},
                },
            ],
        }
    )
    assert [item["action_type"] for item in payload["changes"]] == [
        "set_feature",
        "set_reputation_thresholds",
    ]


def test_page_save_rejects_commands_only_and_cross_page_actions() -> None:
    with pytest.raises(ValueError, match="does not belong"):
        normalize(
            {
                "page_key": "/control/content/feeds",
                "base_revision": "a" * 64,
                "changes": [{"action_type": "poll_ai_sources", "payload": {}}],
            }
        )
    with pytest.raises(ValueError, match="different Control page"):
        normalize(
            {
                "page_key": "/control/content/feeds",
                "base_revision": "a" * 64,
                "changes": [
                    {
                        "action_type": "set_feature",
                        "payload": {"feature": "reputation", "enabled": True},
                    }
                ],
            }
        )


def test_revision_count_and_payload_limits_are_enforced() -> None:
    with pytest.raises(ValueError, match="SHA-256"):
        normalize(
            {
                "page_key": "/control/community/reputation",
                "base_revision": "bad",
                "changes": [{"action_type": "set_feature", "payload": {}}],
            }
        )
    with pytest.raises(ValueError, match="between 1 and 50"):
        normalize(
            {
                "page_key": "/control/community/reputation",
                "base_revision": "a" * 64,
                "changes": [],
            }
        )
    with pytest.raises(ValueError, match="at most"):
        normalize(
            {
                "page_key": "/control/community/reputation",
                "base_revision": "a" * 64,
                "changes": [
                    {
                        "action_type": "set_feature",
                        "payload": {
                            "feature": "reputation",
                            "enabled": True,
                            "x": "z" * 70000,
                        },
                    }
                ],
            }
        )
