from __future__ import annotations

from functools import lru_cache
from typing import Literal
from urllib.parse import urlparse

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
    cutover_read_only: bool = False
    mar_wie_user_id: int = 703986808962285621
    mar_wie_tiktok_url: str | None = None

    @field_validator("log_level")
    @classmethod
    def normalize_log_level(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("mar_wie_tiktok_url")
    @classmethod
    def normalize_tiktok_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        parsed = urlparse(normalized)
        hostname = (parsed.hostname or "").lower()
        if parsed.scheme != "https" or not (
            hostname == "tiktok.com" or hostname.endswith(".tiktok.com")
        ):
            raise ValueError("MAR_WIE_TIKTOK_URL must be an https://tiktok.com URL")
        return normalized

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
