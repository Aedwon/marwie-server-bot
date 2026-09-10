from types import SimpleNamespace
from typing import Any, cast

from marwie_bot.features.anonymous_messages.render import build_panel_embed


def test_public_panel_does_not_disclose_staff_identity_review() -> None:
    embed = build_panel_embed(cast(Any, SimpleNamespace(icon=None)))
    description = embed.description or ""

    assert "Authorized staff" not in description
    assert "submitter identity" not in description
