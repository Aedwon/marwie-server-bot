# Local macOS hosting

Rob-bot production runs as a user LaunchAgent on the M4 MacBook Air. This is a fresh deployment with local SQLite state.

## Runtime locations

- Repository: `~/Documents/Projects/marwie-server-bot` after this change is integrated to `main`
- Virtual environment: `<repo>/.venv`
- Production environment: `~/.config/marwie-server-bot/production.env`
- Database: `<repo>/data/marwie.db`
- LaunchAgent: `~/Library/LaunchAgents/com.aedwon.marwie-server-bot.plist`
- Logs: `~/Library/Logs/marwie-server-bot/stdout.log` and `stderr.log`

The Discord token is never stored in Git or in the LaunchAgent plist.

## Initial setup

From the production repository checkout:

```bash
~/.local/bin/python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/python scripts/local_hosting.py install
```

Edit `~/.config/marwie-server-bot/production.env` and set at least:

```text
DISCORD_TOKEN=<real bot token>
ENVIRONMENT=production
```

`COMMAND_GUILD_ID` is recommended for immediate guild-scoped command synchronization. Set `ENABLE_MESSAGE_CONTENT=true` only when the Discord Developer Portal intent is enabled.

Validate without printing secrets:

```bash
.venv/bin/python scripts/local_hosting.py check
```

Do not activate the service until this check passes.

## Fresh database

The deleted Bot-Hosting deployment is not restored. The local service uses a fresh SQLite database at `data/marwie.db`. Run the committed migrations before first activation:

```bash
.venv/bin/alembic upgrade head
```

The bot also runs migrations on normal startup.

## Activate the LaunchAgent

The ChatGPT terminal relay intentionally blocks `launchctl`, so these activation commands are run directly on the Mac after the environment check is green:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aedwon.marwie-server-bot.plist
launchctl kickstart -k gui/$(id -u)/com.aedwon.marwie-server-bot
```

Inspect the service:

```bash
launchctl print gui/$(id -u)/com.aedwon.marwie-server-bot
tail -n 100 ~/Library/Logs/marwie-server-bot/stdout.log
tail -n 100 ~/Library/Logs/marwie-server-bot/stderr.log
```

The LaunchAgent starts after user login and restarts the process after exits. The bot runs under `/usr/bin/caffeinate -s`, which prevents idle system sleep while AC power is connected. Closing the MacBook lid can still suspend the host.

## First Discord setup

Because the database is fresh:

1. Confirm the bot is online and `/ping` responds.
2. Run `/setup auto` as a server Administrator.
3. Approve the discovery pass.
4. Review any proposed creations or remaps before approving them.
5. Run `/setup status` and confirm the stored bindings.

Existing Discord resources remain authoritative. Do not recreate channels or roles just because the database is new.

## Stop and restart

Unload the service:

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.aedwon.marwie-server-bot.plist
```

Load it again with the two activation commands above. To restart a loaded service after a configuration-only change:

```bash
launchctl kickstart -k gui/$(id -u)/com.aedwon.marwie-server-bot
```

## Safe application updates

Do not auto-pull into the running bot. For an accepted `main` update:

1. `launchctl bootout` the service.
2. `git fetch origin` and fast-forward the production checkout to the intended `origin/main`.
3. Run `.venv/bin/python -m pip install -r requirements-dev.txt` if dependencies may have changed.
4. Run the repository verification gates.
5. Run `.venv/bin/alembic upgrade head`.
6. Run `.venv/bin/python scripts/local_hosting.py install` to refresh the plist without overwriting `production.env`.
7. Run `.venv/bin/python scripts/local_hosting.py check`.
8. Bootstrap and kickstart the service.

## Removal

Unload the LaunchAgent first, then remove the generated plist if local hosting is retired. Keep `production.env` and `data/marwie.db` only if their state is still needed. Never commit either one.
