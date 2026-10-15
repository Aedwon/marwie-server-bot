# Local macOS Hosting Spec

Date: 2026-10-16
Status: Accepted for implementation

## Problem

The Bot-Hosting.net deployment and its persisted data were deleted after the hosting subscription was not renewed. Rob-bot therefore needs a fresh production runtime. The user wants to run it on their M4 MacBook Air, which is normally powered on and connected to Wi-Fi.

## Goals

- Run the Discord bot from the local `marwie-server-bot` checkout on macOS.
- Start the bot automatically when the user logs in.
- Restart the bot automatically after an unexpected process exit.
- Keep the Discord token and deployment-specific environment outside Git.
- Start from a fresh local SQLite database and committed Alembic migrations.
- Keep durable stdout/stderr logs in the user's Library.
- Prevent idle system sleep while the bot runs on AC power without changing global power policy.
- Keep updates explicit and safe instead of automatically pulling arbitrary repository changes into a running bot.
- Remove the obsolete Bot-Hosting restart bridge from active infrastructure.

## Non-goals

- No database recovery or migration from Bot-Hosting.net.
- No high-availability failover or second production host.
- No LaunchDaemon or root-owned service.
- No automatic Git pulls or unattended application upgrades.
- No GitHub-hosted Actions for routine local deployment checks.
- No storage of Discord credentials in the repository, LaunchAgent plist, logs, or relay issues.

## Host facts

The target host has:

- Apple Silicon macOS on the user's M4 MacBook Air;
- Python 3.12.14 at `~/.local/bin/python3.12`;
- `/usr/bin/caffeinate`;
- `/bin/launchctl`;
- the repository under `~/Documents/Projects/marwie-server-bot`.

A macOS LaunchAgent starts after the owning user logs in. It does not run before login. Closing the laptop lid can still suspend the Mac; this design does not bypass lid-sleep behavior.

## Runtime layout

- Repository: `~/Documents/Projects/marwie-server-bot`
- Python environment: `<repo>/.venv`
- Production environment file: `~/.config/marwie-server-bot/production.env`
- SQLite database: `<repo>/data/marwie.db`
- LaunchAgent: `~/Library/LaunchAgents/com.aedwon.marwie-server-bot.plist`
- Logs: `~/Library/Logs/marwie-server-bot/stdout.log` and `stderr.log`

The repository already ignores `.venv/`, `data/`, `.env`, and database files.

## Service model

A repository-owned Python helper provides three operations:

- `install`: create the external configuration/log directories and render the LaunchAgent plist without activating it;
- `check`: validate the required runtime files and production environment without printing secret values;
- `run`: load the external production environment, require a non-empty Discord token and `ENVIRONMENT=production`, then replace itself with `/usr/bin/caffeinate -s <repo>/.venv/bin/python <repo>/main.py`.

The LaunchAgent uses absolute paths, `RunAtLoad`, automatic keep-alive, a restart throttle, the repository as its working directory, and persistent stdout/stderr paths. The plist contains no Discord token or other secret value.

`caffeinate -s` prevents idle system sleep only while AC power is connected and the bot process is running. It does not change permanent `pmset` settings.

## Secrets and environment

The installer creates `~/.config/marwie-server-bot/production.env` from `.env.example` only when the file does not already exist. It changes the environment default to `production` and leaves `DISCORD_TOKEN` empty.

The configuration directory is owner-only and the environment file is mode `0600`. Existing environment files are never overwritten by the installer.

The user must supply the Discord bot token before service activation. `COMMAND_GUILD_ID` remains optional but is recommended for immediate guild-scoped slash-command synchronization.

## Database

This is a fresh deployment. The default database URL remains `sqlite+aiosqlite:///./data/marwie.db`.

Before service activation:

1. create the Python 3.12 virtual environment;
2. install production/development dependencies needed for verification;
3. run repository verification;
4. run Alembic through the current committed migration head against the fresh local database.

The bot's normal startup migration behavior remains unchanged.

## Fresh Discord setup

The database contains no previous resource bindings. After the bot connects successfully, a server administrator must run `/setup auto`, approve discovery, review any proposed mutations, and then inspect `/setup status`.

Existing Discord channels and roles remain the source of truth. This is not authorization to recreate resources blindly.

## Updates and restarts

Code updates are deliberate:

1. unload the LaunchAgent;
2. fetch and fast-forward the production checkout to the intended accepted `main` commit;
3. refresh dependencies if requirements changed;
4. run the required verification and migrations;
5. bootstrap the LaunchAgent again.

No background process performs automatic pulls.

## Bot-Hosting retirement

The 2026-08-25 Bot-Hosting restart-bridge documents remain as historical records. The active restart workflow and marker are removed because there is no Bot-Hosting deployment to control.

The repository deployment boundary for `main` changes from Bot-Hosting to local macOS hosting. Website deployment boundaries remain unchanged.

## Verification

Implementation verification must include:

- unit tests for environment handling and LaunchAgent generation;
- `pytest`;
- `ruff check .`;
- `ruff format --check .`;
- `mypy src tests`;
- `python -m compileall -q src tests migrations main.py scripts`;
- a clean Alembic upgrade against the fresh local SQLite database;
- validation that the rendered plist parses correctly;
- confirmation that the rendered plist contains no Discord token;
- confirmation that the external environment file is `0600`;
- confirmation that the old Bot-Hosting workflow and marker are removed.

Actual LaunchAgent activation and Discord connection require the user's real Discord token. The terminal relay must not bypass its policy that blocks `launchctl`; activation remains an explicit local operator step after configuration is valid.
