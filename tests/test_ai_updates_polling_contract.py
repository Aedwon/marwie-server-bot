from __future__ import annotations

import inspect

from marwie_bot.features.ai_updates.cog import AIUpdatesCog
from marwie_bot.features.control_plane.executor import ControlActionExecutor


def test_manual_poll_command_does_not_call_automatic_publish_path() -> None:
    source = inspect.getsource(AIUpdatesCog.poll_now.callback)

    assert "_poll_source" not in source
    assert "preview" in source.lower()


def test_control_browser_poll_action_fails_closed_instead_of_publishing() -> None:
    source = inspect.getsource(ControlActionExecutor._poll_ai_sources)

    assert "_poll_source" not in source
    assert "command" in source.lower()


def test_scheduled_polling_still_uses_automatic_publish_path() -> None:
    loop_source = inspect.getsource(AIUpdatesCog.poll_loop.coro)
    automatic_source = inspect.getsource(AIUpdatesCog._poll_source)

    assert "_poll_source" in loop_source
    assert "_publish_candidates" in automatic_source
