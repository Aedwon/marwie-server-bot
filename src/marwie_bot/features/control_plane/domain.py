from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any


class ControlActionStatus(StrEnum):
    QUEUED = "queued"
    CLAIMED = "claimed"
    COMPLETED = "completed"
    FAILED = "failed"
    REJECTED = "rejected"


class ControlActionType(StrEnum):
    REFRESH_SNAPSHOT = "refresh_snapshot"
    SAVE_PAGE = "save_page"
    SET_RESOURCE = "set_resource"
    CLEAR_RESOURCE = "clear_resource"
    APPLY_AUTO_SETUP = "apply_auto_setup"
    SET_FEATURE = "set_feature"
    SET_LOG_EXCLUSIONS = "set_log_exclusions"
    SAVE_NOTIFICATION_PANEL = "save_notification_panel"
    UPSERT_TICKET_TYPE = "upsert_ticket_type"
    DISABLE_TICKET_TYPE = "disable_ticket_type"
    REFRESH_TICKET_PANEL = "refresh_ticket_panel"
    SET_REPUTATION_THRESHOLDS = "set_reputation_thresholds"
    ADJUST_REPUTATION = "adjust_reputation"
    SET_QUIZ_SCHEDULE = "set_quiz_schedule"
    ADD_QUIZ_QUESTION = "add_quiz_question"
    UPSERT_AI_SOURCE = "upsert_ai_source"
    DISABLE_AI_SOURCE = "disable_ai_source"
    POLL_AI_SOURCES = "poll_ai_sources"
    SEND_ANNOUNCEMENT = "send_announcement"
    POST_LIVE = "post_live"


@dataclass(frozen=True, slots=True)
class ControlActionRecord:
    id: str
    guild_id: int
    actor_id: int
    action_type: ControlActionType
    payload: dict[str, Any]
    idempotency_key: str
    status: ControlActionStatus
    claimed_by: str | None
    result: dict[str, Any] | None
    user_error: str | None
    error_reference: str | None
    created_at: datetime
    claimed_at: datetime | None
    finished_at: datetime | None


@dataclass(frozen=True, slots=True)
class GuildSnapshotRecord:
    guild_id: int
    snapshot: dict[str, Any]
    worker_version: str | None
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class NotificationRoleButtonRecord:
    position: int
    role_id: int
    label: str
    emoji: str | None
    style: str


@dataclass(frozen=True, slots=True)
class NotificationRolePanelRecord:
    guild_id: int
    channel_id: int
    message_id: int | None
    title: str
    description: str
    updated_by: int
    updated_at: datetime
    buttons: tuple[NotificationRoleButtonRecord, ...]
