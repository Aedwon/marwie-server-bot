from __future__ import annotations

from discord import app_commands

from marwie_bot.features.configuration.cog import ConfigurationCog


_SETUP_RESOURCE_COMMANDS = (
    "text-channel",
    "voice-channel",
    "forum",
    "category",
    "role",
)


def test_setup_resource_keys_use_autocomplete_instead_of_static_enum_choices() -> None:
    for command_name in _SETUP_RESOURCE_COMMANDS:
        command = ConfigurationCog.setup_group.get_command(command_name)
        assert isinstance(command, app_commands.Command)

        key_parameter = command._params["key"]
        assert not key_parameter.choices
        assert key_parameter.autocomplete is not None
