from __future__ import annotations

import hashlib
import json
from typing import Any

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


def _feature_enabled(snapshot: dict[str, Any], name: str) -> dict[str, Any] | None:
    for item in snapshot.get("features", []):
        if isinstance(item, dict) and item.get("name") == name:
            return {"name": name, "enabled": bool(item.get("enabled", False))}
    return None


def _features_enabled(snapshot: dict[str, Any], *names: str) -> list[dict[str, Any] | None]:
    return [_feature_enabled(snapshot, name) for name in names]


def _sorted_dict_rows(rows: Any, *keys: str) -> list[dict[str, Any]]:
    values = [dict(item) for item in rows or [] if isinstance(item, dict)]
    values.sort(key=lambda item: tuple(str(item.get(key, "")) for key in keys))
    return values


def _resources(snapshot: dict[str, Any], allowed: frozenset[str]) -> list[dict[str, Any]]:
    rows = [
        {"key": str(item.get("key", "")), "id": item.get("id")}
        for item in snapshot.get("resources", [])
        if isinstance(item, dict) and str(item.get("key", "")) in allowed
    ]
    rows.sort(key=lambda item: str(item["key"]))
    return rows


def _ai_sources(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for item in snapshot.get("ai_sources", []) or []:
        if not isinstance(item, dict):
            continue
        rows.append(
            {
                "id": item.get("id"),
                "name": item.get("name"),
                "url": item.get("url"),
                "category": item.get("category"),
                "enabled": bool(item.get("enabled", False)),
            }
        )
    rows.sort(key=lambda item: (str(item.get("id", "")), str(item.get("name", ""))))
    return rows


def _notification_panel(snapshot: dict[str, Any]) -> dict[str, Any] | None:
    panel = snapshot.get("notification_panel")
    if not isinstance(panel, dict):
        return None
    buttons = []
    for item in panel.get("buttons", []) or []:
        if not isinstance(item, dict):
            continue
        buttons.append(
            {
                "role_id": item.get("role_id"),
                "label": item.get("label"),
                "emoji": item.get("emoji") or "",
                "style": item.get("style"),
            }
        )
    return {
        "channel_id": panel.get("channel_id"),
        "title": panel.get("title"),
        "description": panel.get("description"),
        "buttons": buttons,
    }


def _material(snapshot: dict[str, Any], page_key: str) -> Any:
    if page_key == "/control/community/reputation":
        return {
            "feature": _feature_enabled(snapshot, "reputation"),
            "thresholds": (snapshot.get("reputation") or {}).get("thresholds"),
        }
    if page_key == "/control/community/quizzes":
        return {
            "feature": _feature_enabled(snapshot, "quizzes"),
            "interval_hours": (snapshot.get("quiz") or {}).get("interval_hours"),
        }
    if page_key == "/control/community/voice-coworking":
        return {"features": _features_enabled(snapshot, "voice", "coworking")}
    if page_key == "/control/community/showcase":
        return {"feature": _feature_enabled(snapshot, "showcase")}
    if page_key == "/control/content/feeds":
        return {
            "feature": _feature_enabled(snapshot, "ai_updates"),
            "sources": _ai_sources(snapshot),
        }
    if page_key == "/control/content/announcements":
        return {"feature": _feature_enabled(snapshot, "announcements")}
    if page_key == "/control/content/live":
        return {"feature": _feature_enabled(snapshot, "live_announcements")}
    if page_key == "/control/utilities/ticket-configuration":
        return {
            "feature": _feature_enabled(snapshot, "tickets"),
            "ticket_types": _sorted_dict_rows(snapshot.get("ticket_types"), "key"),
        }
    if page_key == "/control/utilities/notification-roles":
        return {"notification_panel": _notification_panel(snapshot)}
    if page_key == "/control/utilities/anonymous-questions":
        return {"feature": _feature_enabled(snapshot, "anonymous_questions")}
    if page_key == "/control/analytics":
        return {"feature": _feature_enabled(snapshot, "analytics")}
    if page_key == "/control/workflows/moderation":
        return {"feature": _feature_enabled(snapshot, "moderation")}
    if page_key in {"/control/workflows/ticket-handling", "/control/workflows/events"}:
        return {}
    if page_key == "/control/mappings/channels":
        return {"resources": _resources(snapshot, CHANNEL_RESOURCE_KEYS)}
    if page_key == "/control/mappings/roles":
        return {"resources": _resources(snapshot, ROLE_RESOURCE_KEYS)}
    if page_key == "/control/mappings/categories":
        return {"resources": _resources(snapshot, CATEGORY_RESOURCE_KEYS)}
    raise KeyError(page_key)


PAGE_REVISION_KEYS = (
    "/control/community/reputation",
    "/control/community/quizzes",
    "/control/community/voice-coworking",
    "/control/community/showcase",
    "/control/content/feeds",
    "/control/content/announcements",
    "/control/content/live",
    "/control/utilities/ticket-configuration",
    "/control/utilities/notification-roles",
    "/control/utilities/anonymous-questions",
    "/control/analytics",
    "/control/workflows/moderation",
    "/control/workflows/ticket-handling",
    "/control/workflows/events",
    "/control/mappings/channels",
    "/control/mappings/roles",
    "/control/mappings/categories",
)


def page_revision(snapshot: dict[str, Any], page_key: str) -> str:
    material = _material(snapshot, page_key)
    canonical = json.dumps(material, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_page_revisions(snapshot: dict[str, Any]) -> dict[str, str]:
    return {key: page_revision(snapshot, key) for key in PAGE_REVISION_KEYS}
