from __future__ import annotations

import discord

from marwie_bot.features.control_plane.executor_base import (
    ActionRejected,
    ReputationRoleSync,
    _blueprint_kind,
    _discord_resource,
    _resource_matches_key,
)
from marwie_bot.features.control_plane.executor_base import (
    ControlActionExecutor as _ControlActionExecutorBase,
)


class ControlActionExecutor(_ControlActionExecutorBase):
    """Control executor with Commands-only ownership for manual feed polling."""

    async def _poll_ai_sources(self, guild: discord.Guild) -> dict[str, object]:
        del guild
        raise ActionRejected(
            "Manual feed polling is Commands-only. Use the `/ai-source poll` command to preview "
            "candidates before choosing Post or Cancel."
        )


__all__ = [
    "ActionRejected",
    "ControlActionExecutor",
    "ReputationRoleSync",
    "_blueprint_kind",
    "_discord_resource",
    "_resource_matches_key",
]
