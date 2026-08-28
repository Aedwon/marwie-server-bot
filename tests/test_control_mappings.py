from __future__ import annotations

import importlib
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import pytest

from marwie_bot.config.resources import ResourceKey
from marwie_bot.features.configuration.provisioning import (
    AUTO_SETUP_RESOURCES,
    AutoSetupPlan,
    DiscoveryAction,
    ResourceDiscovery,
    SolvedTagDiscovery,
)
from marwie_bot.features.control_plane.domain import ControlActionType
from marwie_bot.features.control_plane.executor import ActionRejected, ControlActionExecutor
from marwie_bot.features.control_plane.page_revisions import page_revision
from marwie_bot.features.control_plane.page_save_contract import normalize_page_save_payload
from marwie_bot.features.control_plane.snapshot import serialize_setup_plan
from marwie_bot.features.control_plane.validation import (
    ActionPermission,
    required_permission,
    validate_action_payload,
)

CHANNEL_KEYS = {
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
}
ROLE_KEYS = {
    ResourceKey.LIVE_PING_ROLE,
    ResourceKey.BUILDER_ROLE,
    ResourceKey.CONTRIBUTOR_ROLE,
    ResourceKey.MENTOR_ROLE,
}
CATEGORY_KEYS = {ResourceKey.TICKET_CATEGORY, ResourceKey.TEMP_VOICE_CATEGORY}
APPROVED_KEYS = CHANNEL_KEYS | ROLE_KEYS | CATEGORY_KEYS
EXCLUDED_KEYS = {
    ResourceKey.MESSAGE_LOG,
    ResourceKey.BOT_LOG,
    ResourceKey.BUILD_HELP_FORUM,
    ResourceKey.SOLVED_TAG,
}
MAPPINGS_MODULE = Path("src/marwie_bot/features/control_plane/mappings.py")


def mappings_module() -> Any:
    assert MAPPINGS_MODULE.exists(), "Wave 5 must provide the scoped Mappings backend module."
    return importlib.import_module("marwie_bot.features.control_plane.mappings")


def _blueprint(key: ResourceKey) -> Any:
    return next(item for item in AUTO_SETUP_RESOURCES if item.key is key)


def _resource(discord_id: int, name: str) -> SimpleNamespace:
    return SimpleNamespace(id=discord_id, name=name)


def _guild() -> Any:
    return SimpleNamespace(id=1)


def _actor() -> Any:
    return SimpleNamespace(id=42)


def _discovery(
    key: ResourceKey,
    action: DiscoveryAction,
    *,
    target: Any | None = None,
    current: Any | None = None,
) -> ResourceDiscovery:
    return ResourceDiscovery(_blueprint(key), action, target, current)


def _plan(
    *discoveries: ResourceDiscovery,
    solved_action: DiscoveryAction = DiscoveryAction.CREATE,
) -> AutoSetupPlan:
    return AutoSetupPlan(
        tuple(discoveries),
        SolvedTagDiscovery(solved_action, None, None),
    )


def _review_plan() -> AutoSetupPlan:
    return _plan(
        _discovery(
            ResourceKey.TICKET_PANEL,
            DiscoveryAction.BIND,
            target=_resource(101, "ticket"),
        ),
        _discovery(
            ResourceKey.TICKET_LOGS,
            DiscoveryAction.BIND,
            target=_resource(102, "ticket-logs"),
        ),
        _discovery(
            ResourceKey.ANNOUNCEMENTS,
            DiscoveryAction.REMAP,
            target=_resource(103, "announcements"),
            current=_resource(104, "old-announcements"),
        ),
        _discovery(ResourceKey.SHOWCASE_FORUM, DiscoveryAction.CREATE),
        _discovery(
            ResourceKey.LIVE_PING_ROLE,
            DiscoveryAction.KEEP,
            target=_resource(201, "Live Notifications"),
            current=_resource(201, "Live Notifications"),
        ),
        _discovery(
            ResourceKey.TICKET_CATEGORY,
            DiscoveryAction.KEEP,
            target=_resource(301, "TICKETS"),
            current=_resource(301, "TICKETS"),
        ),
        _discovery(
            ResourceKey.MESSAGE_LOG,
            DiscoveryAction.BIND,
            target=_resource(901, "bot-logs"),
        ),
        _discovery(ResourceKey.BOT_LOG, DiscoveryAction.CREATE),
        _discovery(ResourceKey.BUILD_HELP_FORUM, DiscoveryAction.CREATE),
    )


def _browser_review_payload(review: dict[str, Any]) -> dict[str, Any]:
    return {
        "plan_hash": review["plan_hash"],
        "items": [
            {
                "key": item["key"],
                "action": item["action"],
                "target_id": item["target"]["id"] if item["target"] is not None else None,
            }
            for item in review["proposed"]
        ],
        "confirmed_keys": list(review["required_confirmations"]),
    }


class FakeProvisioner:
    def __init__(self, plan: AutoSetupPlan) -> None:
        self.plan = plan
        self.connected_plan: AutoSetupPlan | None = None
        self.applied_plan: AutoSetupPlan | None = None

    async def discover(self, guild: Any) -> AutoSetupPlan:
        del guild
        return self.plan

    async def connect_existing(self, guild: Any, actor_id: int, plan: AutoSetupPlan) -> list[Any]:
        del guild, actor_id
        self.connected_plan = plan
        return []

    async def apply_mutations(self, guild: Any, actor_id: int, plan: AutoSetupPlan) -> list[Any]:
        del guild, actor_id
        self.applied_plan = plan
        return []


def _executor(provisioner: FakeProvisioner) -> ControlActionExecutor:
    executor = object.__new__(ControlActionExecutor)
    executor.provisioner = cast(Any, provisioner)
    return executor


def _scoped_action_type() -> ControlActionType:
    action = getattr(ControlActionType, "APPLY_MAPPING_SUGGESTIONS", None)
    assert action is not None, "Wave 5 requires a scoped reviewed-Mappings action type."
    return cast(ControlActionType, action)


def test_mapping_backend_owns_exact_approved_resources_only() -> None:
    module = mappings_module()
    assert set(module.APPROVED_MAPPING_KEYS) == APPROVED_KEYS
    assert not set(module.APPROVED_MAPPING_KEYS) & EXCLUDED_KEYS
    assert module.mapping_group(ResourceKey.TICKET_PANEL) == "channels"
    assert module.mapping_group(ResourceKey.LIVE_PING_ROLE) == "roles"
    assert module.mapping_group(ResourceKey.TICKET_CATEGORY) == "categories"


def test_mapping_review_projects_only_approved_resources_and_groups_them() -> None:
    module = mappings_module()
    review = module.serialize_mapping_review(_review_plan())
    all_keys = {item["key"] for item in review["resources"]}
    proposed = {item["key"]: item for item in review["proposed"]}

    assert all_keys <= {key.value for key in APPROVED_KEYS}
    assert not all_keys & {key.value for key in EXCLUDED_KEYS}
    assert proposed["ticket_panel"]["group"] == "channels"
    assert proposed["live_ping_role"] if "live_ping_role" in proposed else True
    assert proposed["announcements"]["group"] == "channels"
    assert proposed["showcase_forum"]["kind"] == "forum"
    assert review["quiet"] is False


def test_mapping_review_consequence_model_distinguishes_bind_remap_and_create() -> None:
    module = mappings_module()
    review = module.serialize_mapping_review(_review_plan())
    proposed = {item["key"]: item for item in review["proposed"]}

    assert proposed["ticket_panel"]["action"] == "bind"
    assert proposed["ticket_panel"]["requires_confirmation"] is False
    assert proposed["ticket_logs"]["action"] == "bind"
    assert proposed["ticket_logs"]["requires_confirmation"] is False
    assert proposed["announcements"]["action"] == "remap"
    assert proposed["announcements"]["requires_confirmation"] is True
    assert proposed["showcase_forum"]["action"] == "create"
    assert proposed["showcase_forum"]["requires_confirmation"] is True
    assert set(review["required_confirmations"]) == {"announcements", "showcase_forum"}


def test_mapping_review_hash_ignores_message_logging_build_help_and_solved_tag_changes() -> None:
    module = mappings_module()
    first = _review_plan()
    second = _plan(
        *first.resources[:-3],
        _discovery(
            ResourceKey.MESSAGE_LOG,
            DiscoveryAction.BIND,
            target=_resource(9991, "different-bot-logs"),
        ),
        _discovery(
            ResourceKey.BOT_LOG,
            DiscoveryAction.BIND,
            target=_resource(9992, "other-bot-logs"),
        ),
        _discovery(
            ResourceKey.BUILD_HELP_FORUM,
            DiscoveryAction.BIND,
            target=_resource(9993, "general-questions"),
        ),
        solved_action=DiscoveryAction.BIND,
    )

    assert (
        module.serialize_mapping_review(first)["plan_hash"]
        == module.serialize_mapping_review(second)["plan_hash"]
    )


def test_scoped_mapping_plan_cannot_mutate_excluded_resources_or_solved_tag() -> None:
    module = mappings_module()
    scoped = module.scoped_mapping_plan(_review_plan())

    assert {item.blueprint.key for item in scoped.resources} <= APPROVED_KEYS
    assert not {item.blueprint.key for item in scoped.resources} & EXCLUDED_KEYS
    assert scoped.solved_tag.action is DiscoveryAction.KEEP
    assert scoped.solved_tag.tag is None
    assert scoped.solved_tag.forum is None


def test_mapping_review_is_quiet_when_all_approved_mappings_are_kept() -> None:
    module = mappings_module()
    plan = _plan(
        _discovery(
            ResourceKey.TICKET_PANEL,
            DiscoveryAction.KEEP,
            target=_resource(101, "ticket"),
            current=_resource(101, "ticket"),
        ),
        _discovery(
            ResourceKey.LIVE_PING_ROLE,
            DiscoveryAction.KEEP,
            target=_resource(201, "Live Notifications"),
            current=_resource(201, "Live Notifications"),
        ),
    )
    review = module.serialize_mapping_review(plan)

    assert review["proposed"] == []
    assert review["required_confirmations"] == []
    assert review["quiet"] is True


def test_scoped_action_is_administrator_only_and_validates_exact_review_intent() -> None:
    action = _scoped_action_type()
    assert required_permission(action) is ActionPermission.ADMINISTRATOR

    payload = validate_action_payload(
        action,
        {
            "plan_hash": "a" * 64,
            "items": [
                {"key": "ticket_panel", "action": "bind", "target_id": "1234567890123456789"},
                {"key": "showcase_forum", "action": "create", "target_id": None},
            ],
            "confirmed_keys": ["showcase_forum"],
        },
    )
    assert payload["items"][0]["target_id"] == 1234567890123456789
    assert payload["confirmed_keys"] == ["showcase_forum"]


def test_scoped_action_validation_rejects_disallowed_unreviewed_resources() -> None:
    action = _scoped_action_type()
    with pytest.raises(ValueError):
        validate_action_payload(
            action,
            {
                "plan_hash": "b" * 64,
                "items": [
                    {
                        "key": "message_log",
                        "action": "bind",
                        "target_id": "1234567890123456789",
                    }
                ],
                "confirmed_keys": [],
            },
        )


@pytest.mark.asyncio
async def test_scoped_apply_rediscovery_then_mutates_only_the_reviewed_approved_plan() -> None:
    module = mappings_module()
    plan = _review_plan()
    review = module.serialize_mapping_review(plan)
    provisioner = FakeProvisioner(plan)
    executor = _executor(provisioner)
    assert hasattr(executor, "_apply_mapping_suggestions")
    action = _scoped_action_type()
    payload = validate_action_payload(action, _browser_review_payload(review))

    result = await executor._apply_mapping_suggestions(
        _guild(),
        _actor(),
        payload,
    )

    assert result == {"connected": [], "changed": []}
    assert provisioner.connected_plan is not None
    assert provisioner.applied_plan is not None
    connected_keys = {
        item.blueprint.key for item in cast(AutoSetupPlan, provisioner.connected_plan).resources
    }
    applied_keys = {
        item.blueprint.key for item in cast(AutoSetupPlan, provisioner.applied_plan).resources
    }
    assert connected_keys <= APPROVED_KEYS
    assert applied_keys <= APPROVED_KEYS
    assert not connected_keys & EXCLUDED_KEYS
    assert not applied_keys & EXCLUDED_KEYS
    assert provisioner.connected_plan.solved_tag.action is DiscoveryAction.KEEP
    assert provisioner.applied_plan.solved_tag.action is DiscoveryAction.KEEP


@pytest.mark.asyncio
async def test_scoped_apply_rejects_stale_plan_before_any_mutation() -> None:
    module = mappings_module()
    plan = _review_plan()
    review = module.serialize_mapping_review(plan)
    provisioner = FakeProvisioner(plan)
    executor = _executor(provisioner)
    assert hasattr(executor, "_apply_mapping_suggestions")
    action = _scoped_action_type()
    raw = _browser_review_payload(review)
    raw["plan_hash"] = "0" * 64
    payload = validate_action_payload(action, raw)

    with pytest.raises(ActionRejected, match="changed after review"):
        await executor._apply_mapping_suggestions(_guild(), _actor(), payload)

    assert provisioner.connected_plan is None
    assert provisioner.applied_plan is None


@pytest.mark.asyncio
async def test_scoped_apply_rejects_missing_consequence_confirmation_before_mutation() -> None:
    module = mappings_module()
    plan = _review_plan()
    review = module.serialize_mapping_review(plan)
    provisioner = FakeProvisioner(plan)
    executor = _executor(provisioner)
    assert hasattr(executor, "_apply_mapping_suggestions")
    action = _scoped_action_type()
    raw = _browser_review_payload(review)
    raw["confirmed_keys"] = []
    payload = validate_action_payload(action, raw)

    with pytest.raises(ActionRejected, match="confirmation"):
        await executor._apply_mapping_suggestions(_guild(), _actor(), payload)

    assert provisioner.connected_plan is None
    assert provisioner.applied_plan is None


@pytest.mark.asyncio
async def test_scoped_apply_rejects_review_scope_mismatch_before_mutation() -> None:
    module = mappings_module()
    plan = _review_plan()
    review = module.serialize_mapping_review(plan)
    provisioner = FakeProvisioner(plan)
    executor = _executor(provisioner)
    assert hasattr(executor, "_apply_mapping_suggestions")
    action = _scoped_action_type()
    raw = _browser_review_payload(review)
    raw["items"] = raw["items"][:-1]
    raw["confirmed_keys"] = [key for key in raw["confirmed_keys"] if key != "showcase_forum"]
    payload = validate_action_payload(action, raw)

    with pytest.raises(ActionRejected, match="review"):
        await executor._apply_mapping_suggestions(_guild(), _actor(), payload)

    assert provisioner.connected_plan is None
    assert provisioner.applied_plan is None


@pytest.mark.asyncio
async def test_legacy_apply_auto_setup_remains_full_plan_compatible() -> None:
    plan = _review_plan()
    provisioner = FakeProvisioner(plan)
    executor = _executor(provisioner)
    plan_hash = serialize_setup_plan(plan)["plan_hash"]

    await executor._apply_auto_setup(
        _guild(),
        _actor(),
        {"plan_hash": plan_hash},
    )

    assert provisioner.connected_plan is plan
    assert provisioner.applied_plan is plan
    assert ResourceKey.MESSAGE_LOG in {item.blueprint.key for item in plan.resources}
    assert ResourceKey.BUILD_HELP_FORUM in {item.blueprint.key for item in plan.resources}


def test_mappings_page_save_rejects_message_logging_and_build_help_resources() -> None:
    for key in ("message_log", "bot_log", "build_help_forum", "solved_tag"):
        with pytest.raises(ValueError, match="not owned"):
            normalize_page_save_payload(
                {
                    "page_key": "/control/mappings/channels",
                    "base_revision": "c" * 64,
                    "changes": [{"action_type": "clear_resource", "payload": {"key": key}}],
                },
                normalize_action_type=lambda value: ControlActionType(value).value,
                validate_action_payload=lambda action, payload: validate_action_payload(
                    ControlActionType(action), payload
                ),
            )


def test_mappings_page_revision_ignores_excluded_resource_changes() -> None:
    base = {
        "resources": [
            {"key": "ticket_panel", "id": "100"},
            {"key": "message_log", "id": "900"},
            {"key": "bot_log", "id": "901"},
            {"key": "build_help_forum", "id": "902"},
            {"key": "solved_tag", "id": "903"},
        ]
    }
    changed = {
        "resources": [
            {"key": "ticket_panel", "id": "100"},
            {"key": "message_log", "id": "990"},
            {"key": "bot_log", "id": "991"},
            {"key": "build_help_forum", "id": "992"},
            {"key": "solved_tag", "id": "993"},
        ]
    }

    assert page_revision(base, "/control/mappings/channels") == page_revision(
        changed, "/control/mappings/channels"
    )
