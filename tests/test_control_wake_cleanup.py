from __future__ import annotations

from types import SimpleNamespace

import pytest

from marwie_bot.features.control_plane.cog import ControlPlaneCog


@pytest.mark.asyncio
async def test_control_wake_message_is_deleted_before_queue_drain() -> None:
    cog = object.__new__(ControlPlaneCog)
    cog.settings = SimpleNamespace(  # type: ignore[assignment]
        enable_background_tasks=True,
        control_wake_webhook_id=123,
    )

    events: list[str] = []

    class WakeMessage:
        webhook_id = 123

        async def delete(self) -> None:
            events.append("delete")

    async def drain_actions() -> int:
        events.append("drain")
        return 2

    cog._drain_actions = drain_actions  # type: ignore[method-assign]

    await ControlPlaneCog.on_message(cog, WakeMessage())  # type: ignore[arg-type]

    assert events == ["delete", "drain"]


@pytest.mark.asyncio
async def test_unrelated_webhook_message_is_not_deleted_or_drained() -> None:
    cog = object.__new__(ControlPlaneCog)
    cog.settings = SimpleNamespace(  # type: ignore[assignment]
        enable_background_tasks=True,
        control_wake_webhook_id=123,
    )

    events: list[str] = []

    class OtherMessage:
        webhook_id = 999

        async def delete(self) -> None:
            events.append("delete")

    async def drain_actions() -> int:
        events.append("drain")
        return 0

    cog._drain_actions = drain_actions  # type: ignore[method-assign]

    await ControlPlaneCog.on_message(cog, OtherMessage())  # type: ignore[arg-type]

    assert events == []
