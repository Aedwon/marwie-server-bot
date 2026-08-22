from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    discord_token: SecretStr | None = None
    database_url: str = "sqlite+aiosqlite:///./data/marwie.db"
    environment: Literal["development", "staging", "production"] = "development"
    log_level: str = "INFO"
    command_guild_id: int | None = None
    sync_commands: bool = True
    enable_message_content: bool = False
    enable_background_tasks: bool = True

    @field_validator("log_level")
    @classmethod
    def normalize_log_level(cls, value: str) -> str:
        return value.strip().upper()

    def require_discord_token(self) -> str:
        if self.discord_token is None:
            raise RuntimeError("DISCORD_TOKEN is required to start the bot")
        token = self.discord_token.get_secret_value().strip()
        if not token:
            raise RuntimeError("DISCORD_TOKEN is required to start the bot")
        return token


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
