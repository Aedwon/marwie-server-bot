from __future__ import annotations

from enum import StrEnum


class ResourceKey(StrEnum):
    MODERATION_LOG = "moderation_log"


class ResourceType(StrEnum):
    CHANNEL = "channel"
    ROLE = "role"
