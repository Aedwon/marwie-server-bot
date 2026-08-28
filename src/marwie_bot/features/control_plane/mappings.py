from __future__ import annotations

import hashlib
import json
from typing import Any

from marwie_bot.config.resources import ResourceKey
from marwie_bot.features.configuration.provisioning import (
    AutoSetupPlan,
    DiscoveryAction,
    ResourceDiscovery,
    SolvedTagDiscovery,
)

CHANNEL_MAPPING_KEYS: tuple[ResourceKey, ...] = (
    ResourceKey.MODERATION_LOG,
    ResourceKey.TICKET_PANEL,
    ResourceKey.TICKET_LOGS,
    ResourceKey.CREATE_WORKSPACE_VOICE,
    ResourceKey.COWORKING_LOUNGE,
    ResourceKey.ANNOUNCEMENTS,
    ResourceKey.LIVE_ANNOUNCEMENTS,
    ResourceKey.ROLE_PANEL,
    ResourceKey.AI_UPDATES,
    ResourceKey.QUIZ_CHANNEL,
    ResourceKey.ANON_QUESTIONS,
    ResourceKey.ANALYTICS,
    ResourceKey.SHOWCASE_FORUM,
    ResourceKey.APP_OF_WEEK,
    ResourceKey.COLLAB_LFG,
)
ROLE_MAPPING_KEYS: tuple[ResourceKey, ...] = (
    ResourceKey.LIVE_PING_ROLE,
    ResourceKey.BUILDER_ROLE,
    ResourceKey.CONTRIBUTOR_ROLE,
    ResourceKey.MENTOR_ROLE,
)
CATEGORY_MAPPING_KEYS: tuple[ResourceKey, ...] = (
    ResourceKey.TICKET_CATEGORY,
    ResourceKey.TEMP_VOICE_CATEGORY,
)
APPROVED_MAPPING_KEYS: tuple[ResourceKey, ...] = (
    *CHANNEL_MAPPING_KEYS,
    *ROLE_MAPPING_KEYS,
    *CATEGORY_MAPPING_KEYS,
)
_APPROVED_MAPPING_KEY_SET = frozenset(APPROVED_MAPPING_KEYS)


def mapping_group(key: ResourceKey) -> str:
    if key in CHANNEL_MAPPING_KEYS:
        return "channels"
    if key in ROLE_MAPPING_KEYS:
        return "roles"
    if key in CATEGORY_MAPPING_KEYS:
        return "categories"
    raise ValueError(f"Resource `{key.value}` is not owned by Mappings.")


def _resource_ref(resource: Any | None) -> dict[str, str] | None:
    if resource is None:
        return None
    return {"id": str(resource.id), "name": str(resource.name)}


def _serialize_discovery(item: ResourceDiscovery) -> dict[str, Any]:
    action = item.action.value
    return {
        "key": item.blueprint.key.value,
        "group": mapping_group(item.blueprint.key),
        "kind": item.blueprint.kind.value,
        "canonical_name": item.blueprint.name,
        "action": action,
        "target": _resource_ref(item.target),
        "current": _resource_ref(item.current),
        "requires_confirmation": item.action in {DiscoveryAction.REMAP, DiscoveryAction.CREATE},
    }


def serialize_mapping_review(plan: AutoSetupPlan) -> dict[str, Any]:
    resources = [
        _serialize_discovery(item)
        for item in plan.resources
        if item.blueprint.key in _APPROVED_MAPPING_KEY_SET
    ]
    proposed = [item for item in resources if item["action"] != DiscoveryAction.KEEP.value]
    required_confirmations = [
        str(item["key"]) for item in proposed if bool(item["requires_confirmation"])
    ]
    canonical = {"resources": resources}
    plan_hash = hashlib.sha256(
        json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return {
        **canonical,
        "proposed": proposed,
        "required_confirmations": required_confirmations,
        "plan_hash": plan_hash,
        "quiet": not proposed,
    }


def scoped_mapping_plan(plan: AutoSetupPlan) -> AutoSetupPlan:
    return AutoSetupPlan(
        tuple(
            item
            for item in plan.resources
            if item.blueprint.key in _APPROVED_MAPPING_KEY_SET
        ),
        SolvedTagDiscovery(DiscoveryAction.KEEP, None, None),
    )
