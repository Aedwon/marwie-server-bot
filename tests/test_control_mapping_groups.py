from __future__ import annotations

import importlib
from pathlib import Path
from types import SimpleNamespace

from marwie_bot.config.resources import ResourceKey
from marwie_bot.features.configuration.provisioning import (
    AUTO_SETUP_RESOURCES,
    AutoSetupPlan,
    DiscoveryAction,
    ResourceDiscovery,
    SolvedTagDiscovery,
)

MODULE_PATH = Path("src/marwie_bot/features/control_plane/mappings.py")


def _module():
    assert MODULE_PATH.exists(), "Wave 5 must provide the scoped Mappings backend module."
    return importlib.import_module("marwie_bot.features.control_plane.mappings")


def _discovery(key: ResourceKey, action: DiscoveryAction, target_id: int | None = None):
    blueprint = next(item for item in AUTO_SETUP_RESOURCES if item.key is key)
    target = SimpleNamespace(id=target_id, name=blueprint.name) if target_id is not None else None
    return ResourceDiscovery(blueprint, action, target, None)


def test_scoped_review_groups_real_channel_role_and_category_proposals() -> None:
    review = _module().serialize_mapping_review(
        AutoSetupPlan(
            (
                _discovery(ResourceKey.TICKET_PANEL, DiscoveryAction.BIND, 101),
                _discovery(ResourceKey.BUILDER_ROLE, DiscoveryAction.BIND, 201),
                _discovery(ResourceKey.TEMP_VOICE_CATEGORY, DiscoveryAction.CREATE),
                _discovery(ResourceKey.BUILD_HELP_FORUM, DiscoveryAction.CREATE),
            ),
            SolvedTagDiscovery(DiscoveryAction.CREATE, None, None),
        )
    )

    by_group = {
        group: [item["key"] for item in review["proposed"] if item["group"] == group]
        for group in ("channels", "roles", "categories")
    }
    assert by_group == {
        "channels": ["ticket_panel"],
        "roles": ["builder_role"],
        "categories": ["temp_voice_category"],
    }
    assert "build_help_forum" not in {item["key"] for item in review["resources"]}
    assert "solved_tag" not in {item["key"] for item in review["resources"]}
