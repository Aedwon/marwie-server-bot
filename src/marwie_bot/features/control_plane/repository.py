from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from marwie_bot.db.session import Database
from marwie_bot.features.control_plane.domain import (
    ControlActionRecord,
    ControlActionStatus,
    ControlActionType,
    GuildSnapshotRecord,
    NotificationRoleButtonRecord,
    NotificationRolePanelRecord,
)
from marwie_bot.features.control_plane.models import (
    ControlAction,
    ControlGuildSnapshot,
    NotificationRoleButton,
    NotificationRolePanel,
)


class SQLAlchemyControlRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _action_record(model: ControlAction) -> ControlActionRecord:
        return ControlActionRecord(
            id=model.id,
            guild_id=model.guild_id,
            actor_id=model.actor_id,
            action_type=ControlActionType(model.action_type),
            payload=dict(model.payload_json or {}),
            idempotency_key=model.idempotency_key,
            status=ControlActionStatus(model.status),
            claimed_by=model.claimed_by,
            result=dict(model.result_json) if model.result_json is not None else None,
            user_error=model.user_error,
            error_reference=model.error_reference,
            created_at=model.created_at,
            claimed_at=model.claimed_at,
            finished_at=model.finished_at,
        )

    async def enqueue(
        self,
        guild_id: int,
        actor_id: int,
        action_type: ControlActionType,
        payload: dict[str, Any],
        idempotency_key: str,
    ) -> ControlActionRecord:
        normalized_key = idempotency_key.strip()
        if not normalized_key or len(normalized_key) > 100:
            raise ValueError("Idempotency key must be between 1 and 100 characters.")
        async with self.database.session() as session:
            model = ControlAction(
                id=uuid4().hex,
                guild_id=guild_id,
                actor_id=actor_id,
                action_type=action_type.value,
                payload_json=dict(payload),
                idempotency_key=normalized_key,
                status=ControlActionStatus.QUEUED.value,
            )
            session.add(model)
            try:
                await session.commit()
            except IntegrityError:
                await session.rollback()
                statement = select(ControlAction).where(
                    ControlAction.guild_id == guild_id,
                    ControlAction.actor_id == actor_id,
                    ControlAction.idempotency_key == normalized_key,
                )
                existing = (await session.execute(statement)).scalar_one()
                return self._action_record(existing)
            await session.refresh(model)
            return self._action_record(model)

    async def get_action(self, action_id: str) -> ControlActionRecord | None:
        async with self.database.session() as session:
            model = await session.get(ControlAction, action_id)
            return self._action_record(model) if model is not None else None

    async def claim_next(self, worker_id: str) -> ControlActionRecord | None:
        for _attempt in range(3):
            async with self.database.session() as session:
                statement = (
                    select(ControlAction)
                    .where(ControlAction.status == ControlActionStatus.QUEUED.value)
                    .order_by(ControlAction.created_at, ControlAction.id)
                    .limit(1)
                    .with_for_update(skip_locked=True)
                )
                model = (await session.execute(statement)).scalar_one_or_none()
                if model is None:
                    return None
                if model.status != ControlActionStatus.QUEUED.value:
                    continue
                model.status = ControlActionStatus.CLAIMED.value
                model.claimed_by = worker_id[:100]
                model.claimed_at = datetime.now(UTC)
                await session.commit()
                return self._action_record(model)
        return None

    async def complete(
        self, action_id: str, result: dict[str, Any] | None = None
    ) -> ControlActionRecord | None:
        return await self._finish(
            action_id,
            status=ControlActionStatus.COMPLETED,
            result=result or {},
            user_error=None,
            error_reference=None,
        )

    async def reject(
        self,
        action_id: str,
        user_error: str,
        *,
        error_reference: str | None = None,
    ) -> ControlActionRecord | None:
        return await self._finish(
            action_id,
            status=ControlActionStatus.REJECTED,
            result=None,
            user_error=user_error,
            error_reference=error_reference,
        )

    async def fail(
        self,
        action_id: str,
        user_error: str,
        error_reference: str,
    ) -> ControlActionRecord | None:
        return await self._finish(
            action_id,
            status=ControlActionStatus.FAILED,
            result=None,
            user_error=user_error,
            error_reference=error_reference,
        )

    async def _finish(
        self,
        action_id: str,
        *,
        status: ControlActionStatus,
        result: dict[str, Any] | None,
        user_error: str | None,
        error_reference: str | None,
    ) -> ControlActionRecord | None:
        async with self.database.session() as session:
            model = await session.get(ControlAction, action_id)
            if model is None:
                return None
            model.status = status.value
            model.result_json = dict(result) if result is not None else None
            model.user_error = user_error
            model.error_reference = error_reference
            model.finished_at = datetime.now(UTC)
            await session.commit()
            return self._action_record(model)

    async def upsert_snapshot(
        self, guild_id: int, snapshot: dict[str, Any], worker_version: str | None
    ) -> GuildSnapshotRecord:
        async with self.database.session() as session:
            model = await session.get(ControlGuildSnapshot, guild_id)
            updated_at = datetime.now(UTC)
            if model is None:
                model = ControlGuildSnapshot(
                    guild_id=guild_id,
                    snapshot_json=dict(snapshot),
                    worker_version=worker_version,
                    updated_at=updated_at,
                )
                session.add(model)
            else:
                model.snapshot_json = dict(snapshot)
                model.worker_version = worker_version
                model.updated_at = updated_at
            await session.commit()
            return GuildSnapshotRecord(
                guild_id=model.guild_id,
                snapshot=dict(model.snapshot_json or {}),
                worker_version=model.worker_version,
                updated_at=model.updated_at,
            )

    async def get_snapshot(self, guild_id: int) -> GuildSnapshotRecord | None:
        async with self.database.session() as session:
            model = await session.get(ControlGuildSnapshot, guild_id)
            if model is None:
                return None
            return GuildSnapshotRecord(
                guild_id=model.guild_id,
                snapshot=dict(model.snapshot_json or {}),
                worker_version=model.worker_version,
                updated_at=model.updated_at,
            )

    async def get_notification_panel(self, guild_id: int) -> NotificationRolePanelRecord | None:
        async with self.database.session() as session:
            panel = await session.get(NotificationRolePanel, guild_id)
            if panel is None:
                return None
            statement = (
                select(NotificationRoleButton)
                .where(NotificationRoleButton.guild_id == guild_id)
                .order_by(NotificationRoleButton.position)
            )
            buttons = (await session.execute(statement)).scalars().all()
            return NotificationRolePanelRecord(
                guild_id=panel.guild_id,
                channel_id=panel.channel_id,
                message_id=panel.message_id,
                title=panel.title,
                description=panel.description,
                updated_by=panel.updated_by,
                updated_at=panel.updated_at,
                buttons=tuple(
                    NotificationRoleButtonRecord(
                        position=button.position,
                        role_id=button.role_id,
                        label=button.label,
                        emoji=button.emoji,
                        style=button.style,
                    )
                    for button in buttons
                ),
            )

    async def save_notification_panel(
        self,
        *,
        guild_id: int,
        channel_id: int,
        title: str,
        description: str,
        buttons: list[dict[str, Any]],
        updated_by: int,
        message_id: int | None = None,
    ) -> NotificationRolePanelRecord:
        async with self.database.session() as session:
            panel = await session.get(NotificationRolePanel, guild_id)
            if panel is None:
                panel = NotificationRolePanel(
                    guild_id=guild_id,
                    channel_id=channel_id,
                    message_id=message_id,
                    title=title,
                    description=description,
                    updated_by=updated_by,
                )
                session.add(panel)
            else:
                panel.channel_id = channel_id
                panel.title = title
                panel.description = description
                panel.updated_by = updated_by
                if message_id is not None:
                    panel.message_id = message_id
                panel.updated_at = datetime.now(UTC)

            await session.execute(
                delete(NotificationRoleButton).where(NotificationRoleButton.guild_id == guild_id)
            )
            for position, button in enumerate(buttons):
                session.add(
                    NotificationRoleButton(
                        guild_id=guild_id,
                        position=position,
                        role_id=int(button["role_id"]),
                        label=str(button["label"]),
                        emoji=str(button.get("emoji") or "") or None,
                        style=str(button.get("style") or "primary"),
                    )
                )
            await session.commit()

        saved = await self.get_notification_panel(guild_id)
        if saved is None:
            raise RuntimeError("Notification role panel was not saved.")
        return saved

    async def set_notification_panel_message(
        self, guild_id: int, message_id: int
    ) -> NotificationRolePanelRecord | None:
        async with self.database.session() as session:
            panel = await session.get(NotificationRolePanel, guild_id)
            if panel is None:
                return None
            panel.message_id = message_id
            panel.updated_at = datetime.now(UTC)
            await session.commit()
        return await self.get_notification_panel(guild_id)
