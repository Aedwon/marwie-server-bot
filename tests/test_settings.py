import pytest

from marwie_bot.config.settings import Settings


MAR_WIE_USER_ID = 703986808962285621


def test_settings_can_load_without_discord_token() -> None:
    settings = Settings(
        discord_token=None,
        database_url="sqlite+aiosqlite:///./data/marwie.db",
    )

    assert settings.discord_token is None
    assert settings.database_url == "sqlite+aiosqlite:///./data/marwie.db"


def test_runtime_rejects_missing_discord_token() -> None:
    settings = Settings(discord_token=None)

    with pytest.raises(RuntimeError, match="DISCORD_TOKEN"):
        settings.require_discord_token()


def test_live_announcement_settings_have_accepted_defaults() -> None:
    settings = Settings(discord_token=None)

    assert settings.mar_wie_user_id == MAR_WIE_USER_ID
    assert settings.mar_wie_tiktok_url is None


def test_blank_tiktok_url_is_normalized_to_none() -> None:
    settings = Settings(discord_token=None, mar_wie_tiktok_url="   ")

    assert settings.mar_wie_tiktok_url is None
