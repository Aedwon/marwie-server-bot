from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

MAX_CHANGES = 50
MAX_PAYLOAD_BYTES = 64 * 1024

PAGE_SAVE_ACTIONS_BY_PAGE: dict[str, frozenset[str]] = {
    "/control/community/reputation": frozenset(
        {"set_feature", "set_reputation_thresholds"}
    ),
    "/control/community/quizzes": frozenset(
        {"set_feature", "set_quiz_schedule", "add_quiz_question"}
    ),
    "/control/community/voice-coworking": frozenset({"set_feature"}),
    "/control/community/showcase": frozenset({"set_feature"}),
    "/control/content/feeds": frozenset(
        {"set_feature", "upsert_ai_source", "disable_ai_source"}
    ),
    "/control/content/announcements": frozenset({"set_feature"}),
    "/control/content/live": frozenset({"set_feature"}),
    "/control/utilities/ticket-configuration": frozenset(
        {"set_feature", "upsert_ticket_type", "disable_ticket_type"}
    ),
    "/control/utilities/notification-roles": frozenset({"save_notification_panel"}),
    "/control/utilities/anonymous-questions": frozenset({"set_feature"}),
    "/control/analytics": frozenset({"set_feature"}),
    "/control/workflows/moderation": frozenset({"set_feature"}),
    "/control/workflows/ticket-handling": frozenset(),
    "/control/workflows/events": frozenset(),
    "/control/mappings/channels": frozenset({"set_resource", "clear_resource"}),
    "/control/mappings/roles": frozenset({"set_resource", "clear_resource"}),
    "/control/mappings/categories": frozenset({"set_resource", "clear_resource"}),
}

FEATURE_OWNER: dict[str, frozenset[str]] = {
    "/control/community/reputation": frozenset({"reputation"}),
    "/control/community/quizzes": frozenset({"quizzes"}),
    "/control/community/voice-coworking": frozenset({"voice", "coworking"}),
    "/control/community/showcase": frozenset({"showcase"}),
    "/control/content/feeds": frozenset({"ai_updates"}),
    "/control/content/announcements": frozenset({"announcements"}),
    "/control/content/live": frozenset({"live_announcements"}),
    "/control/utilities/ticket-configuration": frozenset({"tickets"}),
    "/control/utilities/anonymous-questions": frozenset({"anonymous_questions"}),
    "/control/analytics": frozenset({"analytics"}),
    "/control/workflows/moderation": frozenset({"moderation"}),
}

ROLE_RESOURCE_KEYS = frozenset(
    {"live_ping_role", "builder_role", "contributor_role", "mentor_role"}
)
CATEGORY_RESOURCE_KEYS = frozenset({"ticket_category", "temp_voice_category"})
CHANNEL_RESOURCE_KEYS = frozenset(
    {
        "moderation_log",
        "ticket_panel",
        "ticket_logs",
        "create_workspace_voice",
        "coworking_lounge",
        "announcements",
        "live_announcements",
        "role_panel",
        "ai_updates",
        "quiz_channel",
        "anon_questions",
        "analytics",
        "showcase_forum",
        "app_of_the_week",
        "collab_lfg",
        "bot_log",
    }
)


def _mapping(value: Any, field: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{field} must be an object.")
    return dict(value)


def _require_ownership(page_key: str, action_type: str, payload: dict[str, Any]) -> None:
    allowed = PAGE_SAVE_ACTIONS_BY_PAGE.get(page_key)
    if allowed is None or action_type not in allowed:
        raise ValueError("That change does not belong to this Control page.")

    if action_type == "set_feature":
        if str(payload.get("feature", "")) not in FEATURE_OWNER.get(page_key, frozenset()):
            raise ValueError("That feature is owned by a different Control page.")

    if action_type in {"set_resource", "clear_resource"}:
        expected = (
            ROLE_RESOURCE_KEYS
            if page_key == "/control/mappings/roles"
            else CATEGORY_RESOURCE_KEYS
            if page_key == "/control/mappings/categories"
            else CHANNEL_RESOURCE_KEYS
        )
        if str(payload.get("key", "")) not in expected:
            raise ValueError("That Discord mapping is not owned by this Mappings page.")


def normalize_page_save_payload(
    raw_payload: dict[str, Any] | None,
    *,
    normalize_action_type: Callable[[str], str],
    validate_action_payload: Callable[[str, dict[str, Any]], dict[str, Any]],
) -> dict[str, Any]:
    data = _mapping(raw_payload, "Page save payload")
    try:
        encoded = json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    except (TypeError, ValueError) as error:
        raise ValueError("Page save payload must be valid JSON data.") from error
    if len(encoded) > MAX_PAYLOAD_BYTES:
        raise ValueError(f"Page save payload must be at most {MAX_PAYLOAD_BYTES} bytes.")

    page_key = str(data.get("page_key") or "").strip()
    if page_key not in PAGE_SAVE_ACTIONS_BY_PAGE:
        raise ValueError("Unknown Control page.")
    base_revision = str(data.get("base_revision") or "").strip().lower()
    if len(base_revision) != 64 or any(
        character not in "0123456789abcdef" for character in base_revision
    ):
        raise ValueError("Page revision must be a SHA-256 value.")

    raw_changes = data.get("changes")
    if not isinstance(raw_changes, list) or not 1 <= len(raw_changes) <= MAX_CHANGES:
        raise ValueError(f"Page save requires between 1 and {MAX_CHANGES} changes.")

    changes: list[dict[str, Any]] = []
    for index, raw in enumerate(raw_changes):
        change = _mapping(raw, f"Change {index + 1}")
        action_type = normalize_action_type(str(change.get("action_type") or ""))
        if action_type in {"save_page", "refresh_snapshot"}:
            raise ValueError("Nested internal control actions are not allowed.")
        payload = validate_action_payload(
            action_type,
            _mapping(change.get("payload") or {}, f"Change {index + 1} payload"),
        )
        _require_ownership(page_key, action_type, payload)
        changes.append({"action_type": action_type, "payload": payload})

    return {"page_key": page_key, "base_revision": base_revision, "changes": changes}
