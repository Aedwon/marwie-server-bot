# Marwie server bot

Production-oriented Discord bot for the Marwie AI App Builders community. It is a clean rebuild of the older community bot with per-guild configuration, async SQLAlchemy persistence, Alembic migrations, restart-safe background jobs and Discord-native interactions.

The V1 implementation covers moderation, message logs, tickets, temporary voice workspaces, announcements, TikTok live announcements, reputation, solved build-help, quizzes, anonymous questions, coworking utilities, AI update feeds, analytics and showcase automation. Semantic `/ask-community` RAG is intentionally reserved for a later phase.

## Commands

Core and setup:

- `/ping`
- `/setup text-channel`, `/setup voice-channel`, `/setup forum`, `/setup category`, `/setup role`, `/setup solved-tag`
- `/setup feature`, `/setup log-ignore`, `/setup status`

Operations:

- `/warn`, `/timeout`, `/kick`, `/ban`, `/unban`, `/history`
- `/ticket-type add|disable|list`, `/ticket-panel post`
- `/announce`
- `/live [topic]` — Mar Wie only; posts the TikTok Live notification

Community:

- `/rank`, `/leaderboard`, `/profile`
- `/reputation award`, `/reputation thresholds`
- `/solve`
- `/quiz add|start|schedule`
- `/anonask`, `/anonwho`
- `/pomodoro start|status|stop`
- `/lfg`
- `/ai-source add|list|disable|poll`
- `/analytics`
- `/app-of-week`

## Local verification

Python 3.12 or 3.13 is supported.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cp .env.example .env
pytest
ruff check .
ruff format --check .
mypy src tests
python -m compileall -q src tests migrations main.py
alembic upgrade head
```

Start with:

```bash
python main.py
```

The bot runs committed Alembic migrations before connecting to Discord. Migration failure stops startup.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | yes | none | Discord bot token |
| `DATABASE_URL` | no | `sqlite+aiosqlite:///./data/marwie.db` | SQLite or PostgreSQL SQLAlchemy URL |
| `ENVIRONMENT` | no | `development` | `development`, `staging`, or `production` |
| `LOG_LEVEL` | no | `INFO` | Python log level |
| `COMMAND_GUILD_ID` | recommended initially | none | sync slash commands immediately to one server |
| `SYNC_COMMANDS` | no | `true` | sync application commands at startup |
| `ENABLE_MESSAGE_CONTENT` | no | `false` | enable full message text logging/reputation/transcript context |
| `ENABLE_BACKGROUND_TASKS` | no | `true` | run quiz/feed/analytics/showcase/Pomodoro reconciliation loops |
| `MAR_WIE_USER_ID` | no | `703986808962285621` | exact Discord account allowed to publish `/live` announcements |
| `MAR_WIE_TIKTOK_URL` | no | none | TikTok profile/LIVE URL used for the `Watch on TikTok` button |

Never commit the real Discord token.

`MAR_WIE_TIKTOK_URL` is optional. If it is unset, `/live` still posts the live announcement without a link button. The value must be an HTTPS URL on `tiktok.com` or one of its subdomains.

## Discord Developer Portal

Create an application and bot, then invite it with the `bot` and `applications.commands` scopes.

Recommended bot permissions for the full V1:

- View Channels
- Send Messages
- Embed Links
- Attach Files
- Read Message History
- Manage Channels
- Move Members
- Moderate Members
- Kick Members
- Ban Members
- Manage Threads
- Manage Roles

The bot role must sit above members it needs to moderate and above Builder/Contributor/Mentor roles it manages.

**Message Content intent is optional.** The bot works without it. Enable the privileged Message Content intent in the Developer Portal and set `ENABLE_MESSAGE_CONTENT=true` if you want full before/after/deleted message text, richer ticket transcripts, solution excerpts and message-based reputation. Server Members and Presence privileged intents are not required.

## One-time Discord server setup

Create the channels/categories/roles you want first. Then configure the IDs through slash commands. Nothing is hardcoded in feature code.

Suggested resource mapping for the community layout:

| Resource key | Discord resource |
| --- | --- |
| `moderation_log` | `#moderation-log` |
| `message_log` | `#bot-logs` or a dedicated message log |
| `ticket_panel` | `#ticket` |
| `ticket_category` | private ticket category |
| `ticket_logs` | `#ticket-logs` |
| `create_workspace_voice` | `Create Workspace` voice channel |
| `temp_voice_category` | category for temporary workspaces |
| `coworking_lounge` | permanent Coworking Lounge |
| `announcements` | `#announcements` |
| `live_announcements` | `#live-announcements` if the server uses a dedicated live channel |
| `live_ping_role` | optional opt-in role for TikTok Live notifications |
| `ai_updates` | `#ai-updates` |
| `build_help_forum` | `#build-help` forum |
| `solved_tag` | `Solved` tag in `#build-help` |
| `quiz_channel` | channel for programming/AI quizzes |
| `anon_questions` | channel that receives `/anonask` posts |
| `analytics` | staff analytics/mod channel |
| `showcase_forum` | `#showcase` forum |
| `app_of_week` | `#app-of-the-week` |
| `collab_lfg` | `#collab-lfg` |
| `builder_role` | Builder role |
| `contributor_role` | Contributor role |
| `mentor_role` | Mentor role |
| `bot_log` | `#bot-logs` |

Use `/setup text-channel`, `/setup voice-channel`, `/setup forum`, `/setup category`, `/setup role` and `/setup solved-tag` to save these resources. `/setup status` shows configured and stale resources.

For TikTok Live notifications, set `live_announcements` with `/setup text-channel`. If it is not configured, `/live` falls back to the existing `announcements` resource. Set `live_ping_role` with `/setup role` only if you want an opt-in role ping. Rob-bot never uses `@everyone` or `@here` for `/live`. The command is administrator-visible by default, but runtime authorization still permits only Discord user ID `703986808962285621`.

For the ticket category, deny `@everyone` View Channel and grant the staff roles that should see tickets. The bot preserves those category permissions and adds an opener-specific override when a ticket is created.

Then:

1. Add ticket types with `/ticket-type add`.
2. Post the panel with `/ticket-panel post`.
3. Add quiz questions with `/quiz add`, then optionally `/quiz schedule`.
4. Configure Builder/Contributor/Mentor thresholds if the defaults `50 / 150 / 500` are not suitable.
5. Add official RSS/Atom feeds with `/ai-source add`. Only add sources you consider authoritative.
6. Use `/setup log-ignore` for staff/private channels that should not be mirrored into message logs.
7. Disable any system you do not want with `/setup feature`.

## bot-hosting.net

Once this branch is merged to `main`, deployment should require no code changes:

1. Create an **Application** on bot-hosting.net.
2. Select GitHub source `Aedwon/marwie-server-bot` and branch `main`.
3. Select Python 3.12.
4. Set the entry file to `main.py`.
5. Add `DISCORD_TOKEN` as a secret.
6. Set `ENVIRONMENT=production`.
7. Set `COMMAND_GUILD_ID` to your Discord server ID for immediate guild-scoped command sync.
8. Set `MAR_WIE_TIKTOK_URL` to Mar Wie's TikTok profile or LIVE URL if you want the live announcement button.
9. `MAR_WIE_USER_ID` may be omitted because the accepted Mar Wie ID `703986808962285621` is the default; set it only if the authorized account changes.
10. Set `ENABLE_MESSAGE_CONTENT=true` only if the matching privileged intent is enabled in Discord.
11. Leave `DATABASE_URL` unset to use persistent SQLite storage at `data/marwie.db`, or set a PostgreSQL URL.
12. Start the application and confirm migrations, extension loading and command sync complete in the console.

Keep host backups enabled for the SQLite database. The application normalizes ordinary `postgres://` and `postgresql://` URLs to the async PostgreSQL driver automatically.

## Reliability notes

- Persistent ticket and quiz controls are re-registered at startup.
- Temporary voice channels are reconciled after restarts and deleted when empty.
- Deleted ticket channels are marked deleted in durable state.
- Quiz answers and AI feed items are deduplicated in the database.
- Scheduled jobs store timestamps or durable session state so restart does not create duplicate weekly/scheduled posts.
- Anonymous question identities are not shown publicly. `/anonwho` is limited to staff with Moderate Members.
- Reputation is an append-only event ledger with a transactional total cache.
- `/live` is manual by design. It does not scrape TikTok or require an external LIVE-detection service.

## Project workflow

Read `AGENTS.md` before implementation work. Non-trivial changes require a spec and implementation plan under `docs/superpowers/`.
