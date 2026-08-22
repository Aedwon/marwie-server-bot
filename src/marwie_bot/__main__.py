from __future__ import annotations

import asyncio
import logging

from marwie_bot.bot import MarwieBot
from marwie_bot.config.settings import get_settings
from marwie_bot.shared.logging import configure_logging

logger = logging.getLogger(__name__)


async def run() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    logger.info("Starting Marwie bot environment=%s", settings.environment)

    token = settings.require_discord_token()
    bot = MarwieBot(settings)
    async with bot:
        await bot.start(token)


def main() -> None:
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
