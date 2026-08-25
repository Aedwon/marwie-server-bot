# Marwie server bot

Production-oriented Discord bot for the Marwie AI App Builders community. It is a clean rebuild of the older community bot with per-guild configuration, async SQLAlchemy persistence, Alembic migrations, restart-safe background jobs and Discord-native interactions.

The V1 implementation covers moderation, message logs, tickets, temporary voice workspaces, announcements, TikTok live announcements, reputation, solved build-help, quizzes, anonymous questions, coworking utilities, AI update feeds, analytics and showcase automation. Semantic `/ask-community` RAG is intentionally reserved for a later phase.

## Command confirmation

Every slash command requires one explicit confirmation before it runs.

1. Run the slash command and fill in its options as usual.
2. Rob-bot shows an ephemeral **Approve** / **Decline** prompt.
3. **Approve** runs the command. **Decline** makes no change and runs no command callback.
4. The prompt expires after 60 seconds if neither option is selected.

Only the member who invoked the command can approve or decline it. This applies to all slash commands, including read-only commands such as `/rank`, `/profile`, `/leaderboard` and `/setup status`.

## Commands

Core and setup:

- `/ping`
- `/setup auto` — recommended first-run setup; discovers, adopts or creates the standard Discord resources
- `/setup role-panel` — post or refresh the member self-role panel
- `/setup text-channel`, `/setup voice-channel`, `/setup forum`, `/setup category`, `/setup role`, `/setup solved-tag` — manual resource overrides
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

Administrator also covers these permissions and is the simplest configuration for a trusted server-owned bot. The bot role must sit above members it needs to moderate and above the Builder, Contributor, Mentor and Live Notifications roles it manages.

**Message Content intent is optional.** The bot works without it. Enable the privileged Message Content intent in the Developer Portal and set `ENABLE_MESSAGE_CONTENT=true` if you want full before/after/deleted message text, richer ticket transcripts, solution excerpts and message-based reputation. Server Members and Presence privileged intents are not required.

## Recommended one-time server setup

The normal first-run path is now one command:

1. Start the bot and make sure its slash commands are synced.
2. As a server Administrator, run `/setup auto`.
3. Review the confirmation prompt and press **Approve**.
4. Review the private setup report. It states which resources were kept, adopted or created.
5. Run `/setup status` any time you want to inspect the stored mappings.

`/setup auto` is safe to run again. For each resource it first keeps a valid configured object, then looks for an existing object with the standard name, and only creates a new one when neither exists. It does not delete unrelated roles, channels, categories or forum tags, and it does not rename or move an existing resource simply to force the suggested layout.

### What `/setup auto` configures

| Resource key | Standard Discord resource | Behavior |
| --- | --- | --- |
| `moderation_log` | `#moderation-log` | staff/private text channel |
| `message_log` | `#bot-logs` | staff/private text channel |
| `bot_log` | `#bot-logs` | intentionally shares the same channel as `message_log` |
| `ticket_panel` | `#ticket` | public ticket-panel destination |
| `ticket_category` | `TICKETS` category | private base category for created tickets |
| `ticket_logs` | `#ticket-logs` | staff/private text channel |
| `create_workspace_voice` | `Create Workspace` | voice channel under `WORKSPACES` |
| `temp_voice_category` | `WORKSPACES` category | home for temporary workspace voice channels |
| `coworking_lounge` | `Coworking Lounge` | permanent voice channel under `WORKSPACES` |
| `announcements` | `#announcements` | general announcements |
| `live_announcements` | `#live-announcements` | TikTok Live announcements |
| `live_ping_role` | `Live Notifications` | member opt-in notification role |
| `role_panel` | `#roles` | self-role button destination |
| `ai_updates` | `#ai-updates` | AI feed posts |
| `build_help_forum` | `#build-help` forum | build-help posts |
| `solved_tag` | `Solved` tag | created/adopted inside `#build-help` |
| `quiz_channel` | `#quizzes` | quiz delivery |
| `anon_questions` | `#anonymous-questions` | `/anonask` destination |
| `analytics` | `#analytics` | staff/private analytics channel |
| `showcase_forum` | `#showcase` forum | community showcase |
| `app_of_the_week` | `#app-of-the-week` | weekly spotlight |
| `collab_lfg` | `#collab-lfg` | collaboration/LFG posts |
| `builder_role` | `Builder` | reputation-earned role |
| `contributor_role` | `Contributor` | reputation-earned role |
| `mentor_role` | `Mentor` | reputation-earned role |

New staff/private resources deny `@everyone` View Channel. Server Administrators can still access them. Add explicit channel/category overwrites for non-administrator staff roles if your moderation team uses narrower permissions.

After provisioning resources, `/setup auto` also posts or refreshes the self-role panel in `#roles`.

### Role behavior

The bot uses four standard community roles with different ownership rules:

| Role | How a member gets it | Default behavior |
| --- | --- | --- |
| `Builder` | automatic reputation threshold | granted at 50 points and removed if the member falls below the threshold |
| `Contributor` | automatic reputation threshold | granted at 150 points and removed if the member falls below the threshold |
| `Mentor` | automatic reputation threshold | granted at 500 points and removed if the member falls below the threshold |
| `Live Notifications` | self-service button in `#roles` | member can add or remove it at any time; `/live` uses it for opt-in pings |

Builder, Contributor and Mentor are achievement roles and are **not** exposed on the self-role panel. Change their point requirements with `/reputation thresholds`.

Staff, moderator and administrator roles remain owned by the Discord server. Rob-bot does not create them, grant them, or decide who belongs to staff. Staff access is based on Discord permissions such as Administrator, Manage Guild, Moderate Members or Manage Channels depending on the command.

### Manual setup and overrides

The individual `/setup` commands still exist for custom server layouts. Use them after `/setup auto` when you want a feature to use a differently named or pre-existing object:

- `/setup text-channel` for text destinations such as `announcements`, `role_panel` or `bot_log`
- `/setup voice-channel` for `create_workspace_voice` or `coworking_lounge`
- `/setup forum` for `build_help_forum` or `showcase_forum`
- `/setup category` for `ticket_category` or `temp_voice_category`
- `/setup role` for `builder_role`, `contributor_role`, `mentor_role` or `live_ping_role`
- `/setup solved-tag` to choose an existing build-help forum tag
- `/setup role-panel` to repost or refresh the Live Notifications button panel after a manual role/channel override
- `/setup status` to inspect all current mappings and identify stale Discord IDs

These commands replace the stored mapping. They do not require the resource to use the standard auto-setup name.

### Feature content that still needs an administrator choice

`/setup auto` configures Discord infrastructure. It intentionally does not invent community content or policy choices. Configure these when you are ready to use the related feature:

1. Add ticket types with `/ticket-type add`, then post the panel with `/ticket-panel post`.
2. Add quiz questions with `/quiz add`, then optionally schedule them with `/quiz schedule`.
3. Add official RSS/Atom sources with `/ai-source add`. Only add sources you consider authoritative.
4. Change Builder/Contributor/Mentor thresholds with `/reputation thresholds` if the defaults `50 / 150 / 500` are not suitable.
5. Use `/setup log-ignore` for staff/private channels that should not be mirrored into message logs.
6. Disable any system you do not want with `/setup feature`.

For TikTok Live notifications, `/setup auto` configures both `#live-announcements` and the opt-in `Live Notifications` role. `/live` falls back to the general `announcements` resource if the dedicated live channel is later removed from configuration. Rob-bot never uses `@everyone` or `@here` for `/live`. Runtime authorization still permits only the configured Mar Wie account to publish a live announcement.

## bot-hosting.net

Once the intended branch is deployed, startup should require no code changes:

1. Create an **Application** on bot-hosting.net.
2. Select GitHub source `Aedwon/marwie-server-bot` and the branch you intend to deploy.
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
13. Run `/setup auto` in Discord and approve the setup plan.

Keep host backups enabled for the SQLite database. The application normalizes ordinary `postgres://` and `postgresql://` URLs to the async PostgreSQL driver automatically.

## Reliability notes

- Persistent ticket, quiz and Live Notifications role controls are re-registered at startup.
- Temporary voice channels are reconciled after restarts and deleted when empty.
- Deleted ticket channels are marked deleted in durable state.
- Quiz answers and AI feed items are deduplicated in the database.
- Scheduled jobs store timestamps or durable session state so restart does not create duplicate weekly/scheduled posts.
- Anonymous question identities are not shown publicly. `/anonwho` is limited to staff with Moderate Members.
- Reputation is an append-only event ledger with a transactional total cache.
- `/live` is manual by design. It does not scrape TikTok or require an external LIVE-detection service.
- `/setup auto` is additive and idempotent. It repairs mappings and creates missing standard resources without deleting unrelated server structure.

## Project workflow

Read `AGENTS.md` before implementation work. Non-trivial changes require a spec and implementation plan under `docs/superpowers/`.
