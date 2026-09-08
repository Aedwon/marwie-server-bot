from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from typing import Any, Protocol

from marwie_bot.features.moderation.compromise_trap_repository import (
    ClaimDisposition,
    ClaimResult,
    IncidentRecord,
)

TRAP_DELETE_SECONDS = 86_400
TRAP_COOLDOWN_SECONDS = 60
TRAP_REASON = (
    "Automatic compromised-account trap enforcement: user posted in the configured trap channel."
)


class IncidentStatus(StrEnum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    INTERRUPTED = "interrupted"


class ContainmentStatus(StrEnum):
    CONTAINED = "contained"
    PARTIALLY_CONTAINED = "partially_contained"
    FAILED = "failed"
    INTERRUPTED = "interrupted"


class BanStatus(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class TrapTrigger:
    guild_id: int
    user_id: int
    channel_id: int
    message_id: int
    triggered_at: datetime


@dataclass(frozen=True, slots=True)
class BanAttempt:
    succeeded: bool
    error: str | None = None


@dataclass(frozen=True, slots=True)
class CleanupFailure:
    scope_id: int
    scope_name: str
    error: str


@dataclass(frozen=True, slots=True)
class CleanupResult:
    deleted_count: int
    scanned_scopes: int
    failures: tuple[CleanupFailure, ...]


@dataclass(frozen=True, slots=True)
class TrapExecutionResult:
    disposition: ClaimDisposition
    full_incident: bool
    delete_trigger_only: bool
    incident_id: int | None
    reason: str
    containment_status: ContainmentStatus | None
    ban_status: BanStatus | None
    ban_error: str | None
    native_delete_requested: bool
    fallback_cleanup_run: bool
    deleted_message_count: int
    failed_scopes: tuple[CleanupFailure, ...]
    metadata: dict[str, Any]


class TrapIncidentRepository(Protocol):
    async def claim_incident(
        self,
        *,
        guild_id: int,
        target_id: int,
        trigger_channel_id: int,
        trigger_message_id: int,
        triggered_at: datetime,
        now: datetime,
    ) -> ClaimResult: ...

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
    ) -> IncidentRecord: ...


class TrapEnforcer(Protocol):
    async def ban(
        self,
        user_id: int,
        reason: str,
        delete_message_seconds: int,
    ) -> BanAttempt: ...

    async def cleanup(self, user_id: int, since: datetime) -> CleanupResult: ...


def _bounded_error(error: BaseException) -> str:
    detail = str(error).strip()
    text = type(error).__name__ if not detail else f"{type(error).__name__}: {detail}"
    return text[:300]


def _containment_for_cleanup(result: CleanupResult) -> ContainmentStatus:
    if result.scanned_scopes <= 0:
        return ContainmentStatus.FAILED
    if result.failures:
        return ContainmentStatus.PARTIALLY_CONTAINED
    return ContainmentStatus.CONTAINED


def _metadata(
    *,
    trigger: TrapTrigger,
    moderator_id: int,
    incident_id: int,
    ban_status: BanStatus,
    ban_error: str | None,
    native_delete_requested: bool,
    fallback_cleanup_run: bool,
    cleanup_result: CleanupResult,
    containment_status: ContainmentStatus,
) -> dict[str, Any]:
    return {
        "automated": True,
        "source": "compromised_account_trap",
        "incident_id": incident_id,
        "trigger_channel_id": trigger.channel_id,
        "trigger_message_id": trigger.message_id,
        "moderator_id": moderator_id,
        "ban_status": ban_status.value,
        "ban_error": ban_error,
        "native_delete_requested": native_delete_requested,
        "cleanup_path": "fallback" if fallback_cleanup_run else "discord_native_ban",
        "fallback_cleanup_run": fallback_cleanup_run,
        "deleted_message_count": cleanup_result.deleted_count,
        "failed_scope_ids": [failure.scope_id for failure in cleanup_result.failures],
        "containment_status": containment_status.value,
    }


class CompromiseTrapService:
    def __init__(self, repository: TrapIncidentRepository) -> None:
        self.repository = repository

    async def execute(
        self,
        trigger: TrapTrigger,
        enforcer: TrapEnforcer,
        *,
        moderator_id: int,
        now: datetime | None = None,
    ) -> TrapExecutionResult:
        execution_now = now or datetime.now(UTC)
        claim = await self.repository.claim_incident(
            guild_id=trigger.guild_id,
            target_id=trigger.user_id,
            trigger_channel_id=trigger.channel_id,
            trigger_message_id=trigger.message_id,
            triggered_at=trigger.triggered_at,
            now=execution_now,
        )

        if claim.disposition is not ClaimDisposition.CLAIMED:
            return TrapExecutionResult(
                disposition=claim.disposition,
                full_incident=False,
                delete_trigger_only=True,
                incident_id=claim.incident.id if claim.incident is not None else None,
                reason=TRAP_REASON,
                containment_status=None,
                ban_status=None,
                ban_error=None,
                native_delete_requested=False,
                fallback_cleanup_run=False,
                deleted_message_count=0,
                failed_scopes=(),
                metadata={},
            )

        incident = claim.incident
        if incident is None:
            raise RuntimeError("A claimed compromised-account incident requires a durable record.")

        ban_attempt = await enforcer.ban(
            trigger.user_id,
            TRAP_REASON,
            TRAP_DELETE_SECONDS,
        )
        ban_status = BanStatus.SUCCEEDED if ban_attempt.succeeded else BanStatus.FAILED
        native_delete_requested = ban_attempt.succeeded
        fallback_cleanup_run = not ban_attempt.succeeded
        cleanup_result = CleanupResult(deleted_count=0, scanned_scopes=0, failures=())

        if ban_attempt.succeeded:
            containment_status = ContainmentStatus.CONTAINED
        else:
            try:
                cleanup_result = await enforcer.cleanup(
                    trigger.user_id,
                    trigger.triggered_at - timedelta(seconds=TRAP_DELETE_SECONDS),
                )
            except Exception as error:
                cleanup_result = CleanupResult(
                    deleted_count=0,
                    scanned_scopes=0,
                    failures=(
                        CleanupFailure(
                            scope_id=0,
                            scope_name="server_cleanup",
                            error=_bounded_error(error),
                        ),
                    ),
                )
            containment_status = _containment_for_cleanup(cleanup_result)

        failed_scope_rows = [
            {
                "scope_id": failure.scope_id,
                "scope_name": failure.scope_name,
                "error": failure.error,
            }
            for failure in cleanup_result.failures
        ]
        await self.repository.finalize_incident(
            incident.id,
            containment_status=containment_status.value,
            ban_status=ban_status.value,
            ban_error=ban_attempt.error,
            native_delete_requested=native_delete_requested,
            fallback_cleanup_run=fallback_cleanup_run,
            deleted_message_count=cleanup_result.deleted_count,
            failed_scopes=failed_scope_rows,
            finalized_at=execution_now,
            cooldown_seconds=TRAP_COOLDOWN_SECONDS,
        )
        metadata = _metadata(
            trigger=trigger,
            moderator_id=moderator_id,
            incident_id=incident.id,
            ban_status=ban_status,
            ban_error=ban_attempt.error,
            native_delete_requested=native_delete_requested,
            fallback_cleanup_run=fallback_cleanup_run,
            cleanup_result=cleanup_result,
            containment_status=containment_status,
        )
        return TrapExecutionResult(
            disposition=claim.disposition,
            full_incident=True,
            delete_trigger_only=False,
            incident_id=incident.id,
            reason=TRAP_REASON,
            containment_status=containment_status,
            ban_status=ban_status,
            ban_error=ban_attempt.error,
            native_delete_requested=native_delete_requested,
            fallback_cleanup_run=fallback_cleanup_run,
            deleted_message_count=cleanup_result.deleted_count,
            failed_scopes=cleanup_result.failures,
            metadata=metadata,
        )
