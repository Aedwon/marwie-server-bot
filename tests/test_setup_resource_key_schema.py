from __future__ import annotations

import pytest

from marwie_bot.features.configuration.cog import ConfigurationCog


@pytest.mark.parametrize(
    "command_name",
    ["text-channel", "voice-channel", "forum", "category", "role"],
)
def test_setup_resource_key_uses_autocomplete_instead_of_static_choices(
    command_name: str,
) -> None:
    command = next(
        command for command in ConfigurationCog.setup_group.commands if command.name == command_name
    )
    key_parameter = next(parameter for parameter in command.parameters if parameter.name == "key")

    assert len(key_parameter.choices) <= 25
    assert key_parameter.autocomplete is True
