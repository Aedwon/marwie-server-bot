from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from marwie_bot.features.moderation.compromise_trap_repository import (
    ClaimDisposition,
    ClaimResult,
    IncidentRecord,
)
from marwie_bot.features.moderation.compromise_trap_service import (
    TRAP_COOLDOWN_SECONDS,
    TRAP_DELETE_SECONDS,
    BanAttempt,
    CleanupFailure,
    CleanupResult,
    CompromiseTrapService,
    ContainmentStatus,
    TrapTrigger,
)


def _incident(trigger: TrapTrigger, incident_id: int = 7) -> IncidentRecord:
    return IncidentRecord(
        id=incident_id,
        guild_id=trigger.guild_id,
        target_id=trigger.user_id,
        trigger_channel_id=trigger.channel_id,
        trigger_message_id=trigger.message_id,
        triggered_at=trigger.triggered_at,
        status="in_progress",
        containment_status=None,
        ban_status=None,
        ban_error=None,
        native_delete_requested=False,
        fallback_cleanup_run=False,
        deleted_message_count=0,
        failed_scopes=(),
        active_key=f"{trigger.guild_id}:{trigger.user_id}",
        cooldown_until=None,
        created_at=trigger.triggered_at,
        updated_at=trigger.triggered_at,
    )


class FakeRepository:
    def __init__(self, claim: ClaimResult) -> None:
        self.claim = claim
        self.claim_calls: list[dict[str, Any]] = []
        self.finalize_calls: list[dict[str, Any]] = []

    async def claim_incident(self, **kwargs: Any) -> ClaimResult:
        self.claim_calls.append(dict(kwargs))
        return self.claim

    async def finalize_incident(self, incident_id: int, **kwargs: Any) -> IncidentRecord:
        self.finalize_calls.append({"incident_id": incident_id, **kwargs})
        assert self.claim.incident is not None
        base = self.claim.incident
        return IncidentRecord(
            id=base.id,
            guild_id=base.guild_id,
            target_id=base.target_id,
            trigger_channel_id=base.trigger_channel_id,
            trigger_message_id=base.trigger_message_id,
            triggered_at=base.triggered_at,
            status="completed",
            containment_status=str(kwargs["containment_status"]),
            ban_status=str(kwargs["ban_status"]),
            ban_error=kwargs["ban_error"],
            native_delete_requested=bool(kwargs["native_delete_requested"]),
            fallback_cleanup_run=bool(kwargs["fallback_cleanup_run"]),
            deleted_message_count=int(kwargs["deleted_message_count"]),
            failed_scopes=tuple(dict(item) for item in kwargs["failed_scopes"]),
            active_key=None,
            cooldown_until=kwargs["finalized_at"] + timedelta(seconds=kwargs["cooldown_seconds"]),
            created_at=base.created_at,
            updated_at=kwargs["finalized_at"],
        )


class FakeEnforcer:
    def __init__(
        self,
        *,
        ban: BanAttempt,
        cleanup: CleanupResult | None = None,
        cleanup_error: Exception | None = None,
    ) -> None:
        self.ban_result = ban
        self.cleanup_result = cleanup or CleanupResult(0, 0, ())
        self.cleanup_error = cleanup_error
        self.ban_calls: list[dict[str, Any]] = []
        self.cleanup_calls: list[dict[str, Any]] = []

    async def ban(self, user_id: int, reason: str, delete_message_seconds: int) -> BanAttempt:
        self.ban_calls.append(
            {
                "user_id": user_id,
                "reason": reason,
                "delete_message_seconds": delete_message_seconds,
            }
        )
        return self.ban_result

    async def cleanup(self, user_id: int, since: datetime) -> CleanupResult:
        self.cleanup_calls.append({"user_id": user_id, "since": since})
        if self.cleanup_error is not None:
            raise self.cleanup_error
        return self.cleanup_result


def _trigger() -> TrapTrigger:
    return TrapTrigger(
        guild_id=10,
        user_id=20,
        channel_id=30,
        message_id=40,
        triggered_at=datetime(2026, 9, 9, 3, 0, tzinfo=UTC),
    )


@pytest.mark.asyncio
async def test_successful_ban_requests_exact_window_and_skips_fallback() -> None:
    trigger = _trigger()
    repository = FakeRepository(ClaimResult(ClaimDisposition.CLAIMED, _incident(trigger)))
    enforcer = FakeEnforcer(ban=BanAttempt(True))
    service = CompromiseTrapService(repository)
    now = trigger.triggered_at + timedelta(seconds=2)

    result = await service.execute(trigger, enforcer, moderator_id=99, now=now)

    assert enforcer.ban_calls == [
        {
            "user_id": 20,
            "reason": result.reason,
            "delete_message_seconds": TRAP_DELETE_SECONDS,
        }
    ]
    assert TRAP_DELETE_SECONDS == 86_400
    assert enforcer.cleanup_calls == []
    assert result.containment_status is ContainmentStatus.CONTAINED
    assert result.native_delete_requested is True
    assert result.fallback_cleanup_run is False
    assert result.deleted_message_count == 0
    assert result.delete_trigger_only is False
    assert len(repository.finalize_calls) == 1
    assert repository.finalize_calls[0]["cooldown_seconds"] == TRAP_COOLDOWN_SECONDS == 60


@pytest.mark.asyncio
async def test_failed_ban_runs_cleanup_from_exact_previous_24_hours() -> None:
    trigger = _trigger()
    repository = FakeRepository(ClaimResult(ClaimDisposition.CLAIMED, _incident(trigger)))
    enforcer = FakeEnforcer(
        ban=BanAttempt(False, "Forbidden: hierarchy"),
        cleanup=CleanupResult(deleted_count=3, scanned_scopes=4, failures=()),
    )
    service = CompromiseTrapService(repository)

    result = await service.execute(trigger, enforcer, moderator_id=99)

    assert enforcer.cleanup_calls == [
        {
            "user_id": 20,
            "since": trigger.triggered_at - timedelta(seconds=86_400),
        }
    ]
    assert result.containment_status is ContainmentStatus.CONTAINED
    assert result.native_delete_requested is False
    assert result.fallback_cleanup_run is True
    assert result.deleted_message_count == 3


@pytest.mark.asyncio
async def test_cleanup_failures_classify_partial_when_some_scope_was_scanned() -> None:
    trigger = _trigger()
    repository = FakeRepository(ClaimResult(ClaimDisposition.CLAIMED, _incident(trigger)))
    failure = CleanupFailure(scope_id=50, scope_name="private", error="Forbidden")
    enforcer = FakeEnforcer(
        ban=BanAttempt(False, "Forbidden"),
        cleanup=CleanupResult(deleted_count=2, scanned_scopes=3, failures=(failure,)),
    )

    result = await CompromiseTrapService(repository).execute(trigger, enforcer, moderator_id=99)

    assert result.containment_status is ContainmentStatus.PARTIALLY_CONTAINED
    assert result.failed_scopes == (failure,)


@pytest.mark.asyncio
async def test_failed_ban_with_zero_successfully_scanned_scopes_is_failed() -> None:
    trigger = _trigger()
    repository = FakeRepository(ClaimResult(ClaimDisposition.CLAIMED, _incident(trigger)))
    failure = CleanupFailure(scope_id=50, scope_name="private", error="Forbidden")
    enforcer = FakeEnforcer(
        ban=BanAttempt(False, "Forbidden"),
        cleanup=CleanupResult(deleted_count=0, scanned_scopes=0, failures=(failure,)),
    )

    result = await CompromiseTrapService(repository).execute(trigger, enforcer, moderator_id=99)

    assert result.containment_status is ContainmentStatus.FAILED


@pytest.mark.asyncio
@pytest.mark.parametrize("disposition", [ClaimDisposition.IN_FLIGHT, ClaimDisposition.COOLDOWN])
async def test_suppressed_claim_only_requests_new_trap_message_cleanup(
    disposition: ClaimDisposition,
) -> None:
    trigger = _trigger()
    repository = FakeRepository(ClaimResult(disposition, _incident(trigger)))
    enforcer = FakeEnforcer(ban=BanAttempt(True))

    result = await CompromiseTrapService(repository).execute(trigger, enforcer, moderator_id=99)

    assert result.disposition is disposition
    assert result.delete_trigger_only is True
    assert result.full_incident is False
    assert enforcer.ban_calls == []
    assert enforcer.cleanup_calls == []
    assert repository.finalize_calls == []


@pytest.mark.asyncio
async def test_metadata_is_content_free_and_contains_audit_outcomes() -> None:
    trigger = _trigger()
    repository = FakeRepository(ClaimResult(ClaimDisposition.CLAIMED, _incident(trigger, 77)))
    failures = (
        CleanupFailure(scope_id=51, scope_name="private-a", error="Forbidden"),
        CleanupFailure(scope_id=52, scope_name="private-b", error="HTTPException"),
    )
    enforcer = FakeEnforcer(
        ban=BanAttempt(False, "Forbidden: hierarchy"),
        cleanup=CleanupResult(deleted_count=5, scanned_scopes=3, failures=failures),
    )

    result = await CompromiseTrapService(repository).execute(trigger, enforcer, moderator_id=99)
    metadata = result.metadata

    assert metadata["automated"] is True
    assert metadata["source"] == "compromised_account_trap"
    assert metadata["incident_id"] == 77
    assert metadata["trigger_channel_id"] == 30
    assert metadata["trigger_message_id"] == 40
    assert metadata["ban_status"] == "failed"
    assert metadata["cleanup_path"] == "fallback"
    assert metadata["deleted_message_count"] == 5
    assert metadata["failed_scope_ids"] == [51, 52]
    assert metadata["containment_status"] == "partially_contained"
    assert metadata["moderator_id"] == 99
    assert not any("content" in key.lower() for key in metadata)


@pytest.mark.asyncio
async def test_unexpected_cleanup_exception_is_finalized_as_failed() -> None:
    trigger = _trigger()
    repository = FakeRepository(ClaimResult(ClaimDisposition.CLAIMED, _incident(trigger)))
    enforcer = FakeEnforcer(
        ban=BanAttempt(False, "Forbidden"),
        cleanup_error=RuntimeError("unexpected cleanup failure"),
    )

    result = await CompromiseTrapService(repository).execute(trigger, enforcer, moderator_id=99)

    assert result.containment_status is ContainmentStatus.FAILED
    assert result.fallback_cleanup_run is True
    assert len(result.failed_scopes) == 1
    assert result.failed_scopes[0].scope_name == "server_cleanup"
    assert "RuntimeError" in result.failed_scopes[0].error
    assert len(repository.finalize_calls) == 1
