# Marwie server bot

Discord bot for the Marwie server community. The project is a clean rebuild of the older community bot, with smaller feature modules, explicit migrations, per-guild configuration, and no game-specific economy or social-RP systems.

The current milestone includes the runtime foundation plus warning and moderation-history commands.

## Current commands

- `/ping` checks gateway latency.
- `/setup resource` lets an administrator set the moderation log channel.
- `/setup status` shows the guild's saved bot resources and flags stale channel IDs.
- `/warn` records a warning after moderator and bot hierarchy checks.
- `/history` shows the latest moderation cases for a member.

## Local setup

Python 3.12 or 3.13 is supported.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
```

Set at least:

```env
DISCORD_TOKEN=your_bot_token
COMMAND_GUILD_ID=your_test_server_id
```

`COMMAND_GUILD_ID` is optional. When it is set, slash commands sync only to that guild, which is useful during development. When it is omitted, the bot syncs global commands.

Run migrations manually when developing:

```bash
alembic upgrade head
```

Start the bot:

```bash
python main.py
```

The bot also applies committed Alembic migrations before it connects to Discord. A migration failure stops startup instead of running against an unknown schema.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | yes at runtime | none | Discord bot token |
| `DATABASE_URL` | no | `sqlite+aiosqlite:///./data/marwie.db` | SQLAlchemy database URL |
| `ENVIRONMENT` | no | `development` | `development`, `staging`, or `production` |
| `LOG_LEVEL` | no | `INFO` | Python log level |
| `COMMAND_GUILD_ID` | no | none | guild-scoped slash-command sync |
| `SYNC_COMMANDS` | no | `true` | enable startup command sync |

Never commit the real Discord token.

## Discord application setup

Create the application and bot in the Discord Developer Portal. Invite it with the `bot` and `applications.commands` scopes.

This milestone does not require Message Content or Server Members privileged intents. Leave them disabled until a later feature explicitly needs them.

For the current commands, the bot needs permission to view and send messages in the configured moderation-log channel and to embed links there. The bot's role must also sit above members it is expected to moderate so hierarchy checks can pass.

## bot-hosting.net deployment

The repository is designed for the current bot-hosting.net Python deployment flow.

1. Create an **Application** deployment.
2. Choose **GitHub** as the source and select `Aedwon/marwie-server-bot`.
3. Use the `main` branch after the milestone branch has been merged.
4. Choose a Python runtime that satisfies `>=3.12,<3.14`. Python 3.12 is the conservative choice when available.
5. Set the entry file to `main.py`.
6. Keep `requirements.txt` in the repository root. The host installs those packages during startup.
7. Add `DISCORD_TOKEN` as a secret environment variable.
8. Set `ENVIRONMENT=production`.
9. Set `COMMAND_GUILD_ID` to the server ID while this is a single-server deployment. Omit it later if commands should be global.
10. Start the deployment and inspect the console. Startup should migrate the database, load the three extensions, sync commands, then connect to Discord.

The default SQLite database is stored at `data/marwie.db` inside deployment storage. Keep host backups enabled. When the project moves to managed PostgreSQL, set `DATABASE_URL` to the PostgreSQL connection URL and the application will use the async PostgreSQL driver.

## Verification

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
python -m compileall -q src tests
alembic upgrade head
```

CI runs the same checks against a clean Python 3.12 environment and a temporary SQLite database.

## Project workflow

Read `AGENTS.md` before implementation work. Non-trivial features get a spec and implementation plan under `docs/superpowers/` before code changes begin.
