import pytest

from marwie_bot.config.settings import Settings


def test_settings_can_load_without_discord_token() -> None:
    settings = Settings(discord_token=None)

    assert settings.discord_token is None
    assert settings.database_url == "sqlite+aiosqlite:///./data/marwie.db"


def test_runtime_rejects_missing_discord_token() -> None:
    settings = Settings(discord_token=None)

    with pytest.raises(RuntimeError, match="DISCORD_TOKEN"):
        settings.require_discord_token()
