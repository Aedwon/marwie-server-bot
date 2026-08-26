import discord

from marwie_bot.features.control_plane.notification_panel import (
    button_custom_id,
    button_style,
    parse_button_custom_id,
)


def test_notification_button_custom_id_round_trips() -> None:
    custom_id = button_custom_id(123, 456)
    assert custom_id == "rob:self-role:123:456"
    assert parse_button_custom_id(custom_id) == (123, 456)


def test_notification_button_custom_id_rejects_other_controls() -> None:
    assert parse_button_custom_id("rob:other:123:456") is None
    assert parse_button_custom_id("rob:self-role:not-a-number:456") is None


def test_notification_button_styles_are_explicit() -> None:
    assert button_style("primary") is discord.ButtonStyle.primary
    assert button_style("secondary") is discord.ButtonStyle.secondary
    assert button_style("success") is discord.ButtonStyle.success
    assert button_style("danger") is discord.ButtonStyle.danger
