from copy import deepcopy
from typing import Any

from marwie_bot.features.control_plane.page_revisions import build_page_revisions


def snapshot() -> dict[str, Any]:
    return {
        "features": [
            {
                "name": "reputation",
                "enabled": True,
                "config": {"thresholds": {"builder": 50}},
            },
            {"name": "quizzes", "enabled": True, "config": {"interval_hours": 24}},
        ],
        "reputation": {"thresholds": {"builder": 50, "contributor": 150, "mentor": 500}},
        "quiz": {"interval_hours": 24},
        "resources": [
            {"key": "builder_role", "id": "1"},
            {"key": "announcements", "id": "2"},
            {"key": "ticket_category", "id": "3"},
            {"key": "build_help_forum", "id": "4"},
        ],
        "ai_sources": [],
        "ticket_types": [],
        "notification_panel": None,
        "log_exclusions": [],
    }


def test_page_revisions_are_deterministic_and_page_scoped() -> None:
    first = snapshot()
    second = deepcopy(first)
    second["features"].reverse()
    assert build_page_revisions(first) == build_page_revisions(second)

    before = build_page_revisions(first)
    second["quiz"]["interval_hours"] = 48
    after = build_page_revisions(second)
    assert before["/control/community/reputation"] == after["/control/community/reputation"]
    assert before["/control/community/quizzes"] != after["/control/community/quizzes"]


def test_legacy_build_help_state_does_not_become_canonical_mappings_ownership() -> None:
    first = snapshot()
    second = deepcopy(first)
    second["resources"][-1]["id"] = "99"
    first_revision = build_page_revisions(first)["/control/mappings/channels"]
    second_revision = build_page_revisions(second)["/control/mappings/channels"]
    assert first_revision == second_revision


def test_reputation_change_updates_only_own_revision_contract() -> None:
    first = snapshot()
    second = deepcopy(first)
    second["reputation"]["thresholds"]["builder"] = 60
    before = build_page_revisions(first)
    after = build_page_revisions(second)
    assert before["/control/community/reputation"] != after["/control/community/reputation"]
    assert before["/control/community/quizzes"] == after["/control/community/quizzes"]


def test_runtime_observation_fields_do_not_create_configuration_conflicts() -> None:
    first = snapshot()
    first["quiz"]["last_posted_at"] = "2026-08-28T00:00:00Z"
    first["ai_sources"] = [
        {
            "id": 1,
            "name": "News",
            "url": "https://example.com",
            "category": "ai",
            "enabled": True,
            "last_checked_at": "2026-08-28T00:00:00Z",
        }
    ]
    first["notification_panel"] = {
        "channel_id": "9",
        "message_id": "10",
        "title": "Roles",
        "description": "Pick",
        "buttons": [
            {
                "role_id": "1",
                "label": "Builder",
                "emoji": "",
                "style": "primary",
            }
        ],
    }
    first["resources"][0].update(
        {
            "name": "Builder",
            "exists": True,
            "kind": "role",
            "updated_by": "55",
            "resource_type": "role",
        }
    )
    second = deepcopy(first)
    second["quiz"]["last_posted_at"] = "2026-08-28T01:00:00Z"
    second["ai_sources"][0]["last_checked_at"] = "2026-08-28T01:00:00Z"
    second["notification_panel"]["message_id"] = "11"
    second["resources"][0].update({"name": "Renamed Builder", "exists": False, "updated_by": "77"})
    before = build_page_revisions(first)
    after = build_page_revisions(second)
    assert before["/control/community/quizzes"] == after["/control/community/quizzes"]
    assert before["/control/content/feeds"] == after["/control/content/feeds"]
    assert (
        before["/control/utilities/notification-roles"]
        == after["/control/utilities/notification-roles"]
    )
    assert before["/control/mappings/roles"] == after["/control/mappings/roles"]
