from __future__ import annotations

from enum import StrEnum
from typing import Any
from urllib.parse import urlparse

from marwie_bot.config.resources import FeatureName, ResourceKey
from marwie_bot.features.control_plane.domain import ControlActionType
from marwie_bot.features.control_plane.mappings import APPROVED_MAPPING_KEYS


class ActionPermission(StrEnum):
    ADMINISTRATOR = "administrator"
    MANAGE_GUILD = "manage_guild"


_ADMIN_ACTIONS = {
    ControlActionType.SET_RESOURCE,
    ControlActionType.CLEAR_RESOURCE,
    ControlActionType.APPLY_AUTO_SETUP,
    ControlActionType.APPLY_MAPPING_SUGGESTIONS,
    ControlActionType.SET_FEATURE,
    ControlActionType.SET_LOG_EXCLUSIONS,
    ControlActionType.SAVE_NOTIFICATION_PANEL,
    ControlActionType.UPSERT_TICKET_TYPE,
    ControlActionType.DISABLE_TICKET_TYPE,
    ControlActionType.REFRESH_TICKET_PANEL,
    ControlActionType.POST_LIVE,
}
_APPROVED_MAPPING_KEY_SET = frozenset(APPROVED_MAPPING_KEYS)
_MAPPING_SUGGESTION_ACTIONS = frozenset({"bind", "remap", "create"})


def required_permission(action_type: ControlActionType) -> ActionPermission:
    return (
        ActionPermission.ADMINISTRATOR
        if action_type in _ADMIN_ACTIONS
        else ActionPermission.MANAGE_GUILD
    )


def _mapping(payload: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Action payload must be an object.")
    return dict(payload)


def _text(value: Any, *, field: str, max_length: int, required: bool = True) -> str:
    result = str(value or "").strip()
    if required and not result:
        raise ValueError(f"{field} is required.")
    if len(result) > max_length:
        raise ValueError(f"{field} must be at most {max_length} characters.")
    return result


def _snowflake(value: Any, *, field: str) -> int:
    try:
        result = int(str(value).strip())
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field} must be a Discord ID.") from error
    if result <= 0:
        raise ValueError(f"{field} must be a Discord ID.")
    return result


def _optional_snowflake(value: Any, *, field: str) -> int | None:
    if value in {None, ""}:
        return None
    return _snowflake(value, field=field)


def _integer(value: Any, *, field: str, minimum: int, maximum: int) -> int:
    try:
        result = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field} must be a number.") from error
    if result < minimum or result > maximum:
        raise ValueError(f"{field} must be between {minimum} and {maximum}.")
    return result


def _mentions(value: Any) -> dict[str, Any]:
    data = dict(value) if isinstance(value, dict) else {}
    role_ids = list(
        dict.fromkeys(_snowflake(item, field="Mention role") for item in data.get("role_ids", []))
    )
    user_ids = list(
        dict.fromkeys(_snowflake(item, field="Mention user") for item in data.get("user_ids", []))
    )
    if len(role_ids) > 20 or len(user_ids) > 20:
        raise ValueError("At most 20 roles and 20 users can be mentioned at once.")
    return {
        "everyone": bool(data.get("everyone", False)),
        "here": bool(data.get("here", False)),
        "role_ids": role_ids,
        "user_ids": user_ids,
    }


def _mapping_plan_hash(value: Any) -> str:
    plan_hash = _text(value, field="Mapping review", max_length=128)
    if len(plan_hash) != 64 or any(
        character not in "0123456789abcdefABCDEF" for character in plan_hash
    ):
        raise ValueError("Mapping review is invalid.")
    return plan_hash.lower()


def _mapping_suggestion_items(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise ValueError("Mapping review items must be a list.")
    if len(value) > len(APPROVED_MAPPING_KEYS):
        raise ValueError("Mapping review contains too many resources.")

    result: list[dict[str, Any]] = []
    seen: set[ResourceKey] = set()
    for raw in value:
        if not isinstance(raw, dict):
            raise ValueError("Each mapping review item must be an object.")
        key = ResourceKey(_text(raw.get("key"), field="Resource key", max_length=100))
        if key not in _APPROVED_MAPPING_KEY_SET:
            raise ValueError(f"Resource `{key.value}` is not managed by Mappings.")
        if key in seen:
            raise ValueError("Mapping review contains a duplicate resource.")
        seen.add(key)
        action = _text(raw.get("action"), field="Mapping action", max_length=16).lower()
        if action not in _MAPPING_SUGGESTION_ACTIONS:
            raise ValueError("Mapping review action is invalid.")
        target_id = raw.get("target_id")
        if action == "create":
            if target_id not in {None, ""}:
                raise ValueError("Created mapping resources cannot include a target ID.")
            normalized_target: int | None = None
        else:
            normalized_target = _snowflake(target_id, field="Mapping target")
        result.append(
            {
                "key": key.value,
                "action": action,
                "target_id": normalized_target,
            }
        )
    return result


def _mapping_confirmations(value: Any) -> list[str]:
    if not isinstance(value, list):
        raise ValueError("Mapping confirmations must be a list.")
    result: list[str] = []
    seen: set[ResourceKey] = set()
    for raw in value:
        key = ResourceKey(_text(raw, field="Confirmed resource", max_length=100))
        if key not in _APPROVED_MAPPING_KEY_SET:
            raise ValueError(f"Resource `{key.value}` is not managed by Mappings.")
        if key in seen:
            raise ValueError("Mapping confirmations contain a duplicate resource.")
        seen.add(key)
        result.append(key.value)
    return result


def _quiz_question_payload(data: dict[str, Any]) -> dict[str, Any]:
    options_raw = data.get("options")
    if not isinstance(options_raw, list) or len(options_raw) != 4:
        raise ValueError("Quiz questions require exactly four options.")
    options = [
        _text(value, field=f"Option {index + 1}", max_length=300)
        for index, value in enumerate(options_raw)
    ]
    return {
        "category": _text(data.get("category"), field="Category", max_length=50),
        "prompt": _text(data.get("prompt"), field="Prompt", max_length=2000),
        "options": options,
        "correct": _integer(data.get("correct"), field="Correct answer", minimum=1, maximum=4),
        "explanation": _text(
            data.get("explanation"), field="Explanation", max_length=2000, required=False
        ),
    }


def validate_action_payload(
    action_type: ControlActionType,
    payload: dict[str, Any] | None,
) -> dict[str, Any]:
    data = _mapping(payload)

    if action_type is ControlActionType.REFRESH_SNAPSHOT:
        return {}

    if action_type is ControlActionType.SET_RESOURCE:
        key = ResourceKey(_text(data.get("key"), field="Resource key", max_length=100))
        return {
            "key": key.value,
            "discord_id": _snowflake(data.get("discord_id"), field="Resource"),
        }

    if action_type is ControlActionType.CLEAR_RESOURCE:
        key = ResourceKey(_text(data.get("key"), field="Resource key", max_length=100))
        return {"key": key.value}

    if action_type is ControlActionType.APPLY_AUTO_SETUP:
        plan_hash = _text(data.get("plan_hash"), field="Setup plan", max_length=128)
        if len(plan_hash) != 64 or any(
            character not in "0123456789abcdefABCDEF" for character in plan_hash
        ):
            raise ValueError("Setup plan is invalid.")
        return {"plan_hash": plan_hash.lower()}

    if action_type is ControlActionType.APPLY_MAPPING_SUGGESTIONS:
        return {
            "plan_hash": _mapping_plan_hash(data.get("plan_hash")),
            "items": _mapping_suggestion_items(data.get("items")),
            "confirmed_keys": _mapping_confirmations(data.get("confirmed_keys")),
        }

    if action_type is ControlActionType.SET_FEATURE:
        feature = FeatureName(_text(data.get("feature"), field="Feature", max_length=100))
        enabled = data.get("enabled")
        if not isinstance(enabled, bool):
            raise ValueError("Enabled must be true or false.")
        return {"feature": feature.value, "enabled": enabled}

    if action_type is ControlActionType.SET_LOG_EXCLUSIONS:
        values = data.get("channel_ids", [])
        if not isinstance(values, list):
            raise ValueError("Log exclusions must be a list of channel IDs.")
        ids = list(dict.fromkeys(_snowflake(value, field="Log exclusion") for value in values))
        if len(ids) > 100:
            raise ValueError("At most 100 log exclusions can be configured.")
        return {"channel_ids": ids}

    if action_type is ControlActionType.SAVE_NOTIFICATION_PANEL:
        buttons_raw = data.get("buttons")
        if not isinstance(buttons_raw, list) or not buttons_raw:
            raise ValueError("At least one notification role button is required.")
        if len(buttons_raw) > 25:
            raise ValueError("At most 25 notification role buttons are supported.")
        buttons: list[dict[str, Any]] = []
        seen_roles: set[int] = set()
        for index, raw in enumerate(buttons_raw):
            if not isinstance(raw, dict):
                raise ValueError("Each notification role button must be an object.")
            role_id = _snowflake(raw.get("role_id"), field=f"Button {index + 1} role")
            if role_id in seen_roles:
                raise ValueError("Notification role panel contains a duplicate role.")
            seen_roles.add(role_id)
            style = _text(raw.get("style", "primary"), field="Button style", max_length=16).lower()
            if style not in {"primary", "secondary", "success", "danger"}:
                raise ValueError("Notification button style is invalid.")
            buttons.append(
                {
                    "role_id": role_id,
                    "label": _text(raw.get("label"), field="Button label", max_length=80),
                    "emoji": _text(
                        raw.get("emoji"), field="Button emoji", max_length=32, required=False
                    ),
                    "style": style,
                }
            )
        return {
            "channel_id": _snowflake(data.get("channel_id"), field="Panel channel"),
            "title": _text(data.get("title"), field="Panel title", max_length=256),
            "description": _text(
                data.get("description"), field="Panel description", max_length=2000
            ),
            "buttons": buttons,
        }

    if action_type is ControlActionType.UPSERT_TICKET_TYPE:
        return {
            "key": _text(data.get("key"), field="Ticket type key", max_length=32).lower(),
            "label": _text(data.get("label"), field="Ticket type label", max_length=80),
            "description": _text(
                data.get("description"), field="Ticket type description", max_length=200
            ),
        }

    if action_type is ControlActionType.DISABLE_TICKET_TYPE:
        return {"key": _text(data.get("key"), field="Ticket type key", max_length=32).lower()}

    if action_type in {
        ControlActionType.REFRESH_TICKET_PANEL,
        ControlActionType.POLL_AI_SOURCES,
    }:
        return {}

    if action_type is ControlActionType.SET_REPUTATION_THRESHOLDS:
        builder = _integer(
            data.get("builder"), field="Builder threshold", minimum=1, maximum=100000
        )
        contributor = _integer(
            data.get("contributor"), field="Contributor threshold", minimum=1, maximum=100000
        )
        mentor = _integer(data.get("mentor"), field="Mentor threshold", minimum=1, maximum=100000)
        if not builder < contributor < mentor:
            raise ValueError("Thresholds must increase from Builder to Contributor to Mentor.")
        return {"builder": builder, "contributor": contributor, "mentor": mentor}

    if action_type is ControlActionType.ADJUST_REPUTATION:
        points = _integer(
            data.get("points"), field="Reputation points", minimum=-1000, maximum=1000
        )
        if points == 0:
            raise ValueError("Reputation points must be between -1000 and 1000 and cannot be zero.")
        return {
            "member_id": _snowflake(data.get("member_id"), field="Member"),
            "points": points,
            "reason": _text(data.get("reason"), field="Reason", max_length=200),
        }

    if action_type is ControlActionType.SET_QUIZ_SCHEDULE:
        return {
            "interval_hours": _integer(
                data.get("interval_hours"), field="Quiz interval", minimum=1, maximum=720
            )
        }

    if action_type is ControlActionType.ADD_QUIZ_QUESTION:
        return _quiz_question_payload(data)

    if action_type is ControlActionType.UPDATE_QUIZ_QUESTION:
        return {
            "question_id": _integer(
                data.get("question_id"),
                field="Question ID",
                minimum=1,
                maximum=2_147_483_647,
            ),
            **_quiz_question_payload(data),
        }

    if action_type is ControlActionType.SET_QUIZ_QUESTION_ENABLED:
        enabled = data.get("enabled")
        if not isinstance(enabled, bool):
            raise ValueError("Enabled must be true or false.")
        return {
            "question_id": _integer(
                data.get("question_id"),
                field="Question ID",
                minimum=1,
                maximum=2_147_483_647,
            ),
            "enabled": enabled,
        }

    if action_type is ControlActionType.UPSERT_AI_SOURCE:
        url = _text(data.get("url"), field="Source URL", max_length=1000)
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Source URL must be HTTP or HTTPS.")
        result: dict[str, Any] = {
            "name": _text(data.get("name"), field="Source name", max_length=100),
            "url": url,
            "category": _text(data.get("category"), field="Source category", max_length=50),
        }
        if data.get("source_id") not in {None, ""}:
            result["source_id"] = _integer(
                data.get("source_id"), field="Source ID", minimum=1, maximum=2_147_483_647
            )
        return result

    if action_type is ControlActionType.DISABLE_AI_SOURCE:
        return {
            "source_id": _integer(
                data.get("source_id"), field="Source ID", minimum=1, maximum=2_147_483_647
            )
        }

    if action_type is ControlActionType.SEND_ANNOUNCEMENT:
        color = _text(data.get("color", "5865F2"), field="Embed color", max_length=7).removeprefix(
            "#"
        )
        if len(color) != 6:
            raise ValueError("Color must be a six-digit hex value such as 5865F2.")
        try:
            int(color, 16)
        except ValueError as error:
            raise ValueError("Color must be a six-digit hex value such as 5865F2.") from error
        return {
            "channel_id": _snowflake(data.get("channel_id"), field="Announcement channel"),
            "message": _text(data.get("message"), field="Message", max_length=2000, required=False),
            "title": _text(data.get("title"), field="Title", max_length=256, required=False),
            "body": _text(data.get("body"), field="Announcement body", max_length=4000),
            "footer": _text(data.get("footer"), field="Footer", max_length=2048, required=False),
            "color": color.upper(),
            "mentions": _mentions(data.get("mentions")),
        }

    if action_type is ControlActionType.POST_LIVE:
        return {
            "channel_id": _optional_snowflake(data.get("channel_id"), field="Live channel"),
            "ping_role_id": _optional_snowflake(data.get("ping_role_id"), field="Live ping role"),
            "topic": _text(data.get("topic"), field="Topic", max_length=500, required=False),
        }

    raise ValueError(f"Unsupported control action: {action_type.value}")
