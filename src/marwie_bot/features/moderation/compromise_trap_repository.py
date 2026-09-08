from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from marwie_bot.db.models import CompromisedAccountIncident
from marwie_bot.db.session import Database


class ClaimDisposition(StrEnum):
    CLAIMED = "claimed"
    IN_FLIGHT = "in_flight"
    COOLDOWN = "cooldown"


@dataclass(frozen=True, slots=True)
class IncidentRecord:
    id: int
    guild_id: int
    target_id: int
    trigger_channel_id: int
    trigger_message_id: int
    triggered_at: datetime
    status: str
    containment_status: str | None
    ban_status: str | None
    ban_error: str | None
    native_delete_requested: bool
    fallback_cleanup_run: bool
    deleted_message_count: int
    failed_scopes: tuple[dict[str, Any], ...]
    active_key: str | None
    cooldown_until: datetime | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class ClaimResult:
    disposition: ClaimDisposition
    incident: IncidentRecord | None


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


class SQLAlchemyCompromiseTrapRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _record(model: CompromisedAccountIncident) -> IncidentRecord:
        return IncidentRecord(
            id=model.id,
            guild_id=model.guild_id,
            target_id=model.target_id,
            trigger_channel_id=model.trigger_channel_id,
            trigger_message_id=model.trigger_message_id,
            triggered_at=_utc(model.triggered_at) or model.triggered_at,
            status=model.status,
            containment_status=model.containment_status,
            ban_status=model.ban_status,
            ban_error=model.ban_error,
            native_delete_requested=model.native_delete_requested,
            fallback_cleanup_run=model.fallback_cleanup_run,
            deleted_message_count=model.deleted_message_count,
            failed_scopes=tuple(dict(item) for item in model.failed_scopes_json or []),
            active_key=model.active_key,
            cooldown_until=_utc(model.cooldown_until),
            created_at=_utc(model.created_at) or model.created_at,
            updated_at=_utc(model.updated_at) or model.updated_at,
        )

    async def claim_incident(
        self,
        *,
        guild_id: int,
        target_id: int,
        trigger_channel_id: int,
        trigger_message_id: int,
        triggered_at: datetime,
        now: datetime,
    ) -> ClaimResult:
        active_key = f"{guild_id}:{target_id}"
        now_utc = _utc(now) or now

        async with self.database.session() as session:
            latest_statement = (
                select(CompromisedAccountIncident)
                .where(
                    CompromisedAccountIncident.guild_id == guild_id,
                    CompromisedAccountIncident.target_id == target_id,
                )
                .order_by(CompromisedAccountIncident.id.desc())
                .limit(1)
            )
            latest = (await session.execute(latest_statement)).scalar_one_or_none()
            if latest is not None:
                cooldown_until = _utc(latest.cooldown_until)
                if cooldown_until is not None and cooldown_until > now_utc:
                    return ClaimResult(ClaimDisposition.COOLDOWN, self._record(latest))

            active_statement = select(CompromisedAccountIncident).where(
                CompromisedAccountIncident.active_key == active_key
            )
            active = (await session.execute(active_statement)).scalar_one_or_none()
            if active is not None:
                return ClaimResult(ClaimDisposition.IN_FLIGHT, self._record(active))

            model = CompromisedAccountIncident(
                guild_id=guild_id,
                target_id=target_id,
                trigger_channel_id=trigger_channel_id,
                trigger_message_id=trigger_message_id,
                triggered_at=triggered_at,
                status="in_progress",
                containment_status=None,
                ban_status=None,
                ban_error=None,
                native_delete_requested=False,
                fallback_cleanup_run=False,
                deleted_message_count=0,
                failed_scopes_json=None,
                active_key=active_key,
                cooldown_until=None,
            )
            session.add(model)
            try:
                await session.commit()
            except IntegrityError:
                await session.rollback()
                duplicate_statement = select(CompromisedAccountIncident).where(
                    CompromisedAccountIncident.trigger_message_id == trigger_message_id
                )
                existing = (await session.execute(duplicate_statement)).scalar_one_or_none()
                if existing is None:
                    existing = (
                        await session.execute(
                            select(CompromisedAccountIncident).where(
                                CompromisedAccountIncident.active_key == active_key
                            )
                        )
                    ).scalar_one_or_none()
                return ClaimResult(
                    ClaimDisposition.IN_FLIGHT,
                    self._record(existing) if existing is not None else None,
                )

            await session.refresh(model)
            return ClaimResult(ClaimDisposition.CLAIMED, self._record(model))

    async def finalize_incident(
        self,
        incident_id: int,
        *,
        containment_status: str,
        ban_status: str,
        ban_error: str | None,
        native_delete_requested: bool,
        fallback_cleanup_run: bool,
        deleted_message_count: int,
        failed_scopes: list[dict[str, Any]],
        finalized_at: datetime,
        cooldown_seconds: int,
    ) -> IncidentRecord:
        if cooldown_seconds < 0:
            raise ValueError("Cooldown seconds cannot be negative.")

        async with self.database.session() as session:
            model = await session.get(CompromisedAccountIncident, incident_id)
            if model is None:
                raise LookupError(f"Compromised-account incident {incident_id} does not exist.")

            model.status = "completed"
            model.containment_status = containment_status
            model.ban_status = ban_status
            model.ban_error = ban_error
            model.native_delete_requested = native_delete_requested
            model.fallback_cleanup_run = fallback_cleanup_run
            model.deleted_message_count = deleted_message_count
            model.failed_scopes_json = [dict(item) for item in failed_scopes] or None
            model.active_key = None
            model.cooldown_until = finalized_at + timedelta(seconds=cooldown_seconds)
            await session.commit()
            await session.refresh(model)
            return self._record(model)

    async def mark_in_progress_interrupted(self, now: datetime) -> list[IncidentRecord]:
        del now
        async with self.database.session() as session:
            statement = (
                select(CompromisedAccountIncident)
                .where(CompromisedAccountIncident.status == "in_progress")
                .order_by(CompromisedAccountIncident.id.asc())
            )
            models = list((await session.execute(statement)).scalars().all())
            if not models:
                return []

            for model in models:
                model.status = "interrupted"
                model.containment_status = "interrupted"
                model.active_key = None
            await session.commit()
            for model in models:
                await session.refresh(model)
            return [self._record(model) for model in models]
