# Marwie server bot

Production-oriented Discord bot for the Marwie AI App Builders community. It is a clean rebuild of the older community bot with per-guild configuration, async SQLAlchemy persistence, Alembic migrations, restart-safe background jobs and Discord-native interactions.

The V1 implementation covers moderation, message logs, tickets, temporary voice workspaces, announcements, TikTok live announcements, reputation, quizzes, anonymous questions, coworking utilities, AI update feeds, analytics and showcase automation. Semantic `/ask-community` RAG is intentionally reserved for a later phase.

## Command confirmation

Every slash command requires one explicit confirmation before it runs.

1. Run the slash command and fill in its options as usual.
2. Rob-bot shows an ephemeral confirmation containing the exact command, what it does, any supplied option values and command-specific side effects when they matter.
3. Review the context, then press **Approve** or **Decline**.
4. **Approve** runs the command. **Decline** makes no change and runs no command callback.
5. The prompt expires after 60 seconds if neither option is selected.

Only the member who invoked the command can approve or decline it. This applies to all slash commands, including read-only commands such as `/rank`, `/profile`, `/leaderboard` and `/setup status`.

`/setup auto` has one additional safety layer. The first approval authorizes discovery and safe connection to existing Discord resources. If Rob-bot still needs to create something, remap an existing binding or refresh the self-role panel, it shows a second private confirmation listing the exact proposed changes before applying them.

If an approved command fails unexpectedly, the private failure message includes a short error reference. Known safe operational failures, including automatic-setup Discord errors, also explain the failing resource or stage without exposing raw tracebacks or secrets.

## Commands

For exact syntax, permissions, every accepted option and range, side effects, failure conditions, and realistic examples for all 43 slash commands, see the **[Rob-bot command manual](docs/commands.md)**.

Core and setup:

- `/ping`
- `/setup auto` — recommended first-run setup; discovers and connects existing resources before proposing missing ones
- `/setup role-panel` — post or refresh the member self-role panel
- `/setup text-channel`, `/setup voice-channel`, `/setup forum`, `/setup category`, `/setup role` — manual resource overrides
- `/setup feature`, `/setup log-ignore`, `/setup status`

Operations:

- `/warn`, `/timeout`, `/kick`, `/ban`, `/unban`, `/history`
- `/ticket-type add|disable|list`, `/ticket-panel post`
- `/announce`
- `/live [topic]` — Mar Wie only; posts the TikTok Live notification

Community:

- `/rank`, `/leaderboard`, `/profile`
- `/reputation award`, `/reputation thresholds`
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

**Message Content intent is optional.** The bot works without it. Enable the privileged Message Content intent in the Developer Portal and set `ENABLE_MESSAGE_CONTENT=true` if you want full before/after/deleted message text, richer ticket transcripts and message-based reputation. Server Members and Presence privileged intents are not required.

## Recommended one-time server setup

`/setup auto` is discovery-first. It treats the existing Discord server layout as the source of truth before it proposes new infrastructure.

The normal first-run path is:

1. Start the bot and make sure its slash commands are synced.
2. As a server Administrator, run `/setup auto`.
3. Review the first contextual confirmation and press **Approve**. This authorizes Rob-bot to scan the existing server and safely save clear existing-resource bindings.
4. Rob-bot searches existing text channels, voice channels, Forum Channels, categories and roles by normalized logical name.
5. If every required resource can already be connected safely, setup completes without another prompt.
6. If anything must be created or an existing valid automatic-style mapping must be changed, Rob-bot shows a second private confirmation listing every proposed mutation.
7. Press **Approve changes** to apply only those listed mutations, or **Decline changes** to keep the safe existing-resource bindings without creating or modifying Discord resources.
8. Run `/setup status` any time you want to inspect the stored mappings.

Automatic name matching is case-insensitive and ignores decorative emoji and separators. Spaces, underscores and hyphens are treated as equivalent separators. This means existing names such as `🚨-announcements`, `🤖-ai-updates`, `🤝-collab-lfg`, `📱-app-of-the-week` and `🤓-roles` match their logical resources without needing to be renamed.

A small explicit alias list also recognizes the server's established terminology where the logical meaning is unambiguous. Examples include `🔴-live` for live announcements, `🎫-tickets` for the ticket panel, `Create VC` for the workspace creator, `Coworking` for the coworking lounge, `🎭-anonymous` for anonymous questions and `CO-WORKING SPACE` for the workspace category.

Matching always requires the expected Discord object type. For example, a category named `SHOWCASE` cannot satisfy the `showcase_forum` resource because that resource requires a Forum Channel.

When multiple existing resources match, Rob-bot prefers the oldest Discord object. This lets an older founder-created channel win over a newer duplicate created by an earlier auto-setup run. If Rob-bot is already bound to the newer automatic-style duplicate, changing that binding is shown as a remap in the second confirmation instead of happening silently.

A valid manual mapping with a custom name outside the automatic alias set remains authoritative. `/setup auto` does not replace it just because another resource happens to resemble the standard layout.

A Discord resource is created only when no suitable existing resource or intentional manual mapping can satisfy the requirement and the administrator explicitly approves the second mutation prompt. Discord Community is required only when that approved plan needs Rob-bot to **create** a Forum Channel. Existing Forum Channels can be discovered and connected even when Community is not enabled.

`/setup auto` never deletes, renames, moves or merges existing channels, roles, categories, Forum Channels or voice channels. Duplicate resources left by an older setup run are not removed automatically.

### What `/setup auto` configures

| Resource key | Standard Discord resource | Existing names also recognized |
| --- | --- | --- |
| `moderation_log` | `#moderation-log` | decorative-prefix variants |
| `message_log` | `#bot-logs` | decorative-prefix variants |
| `bot_log` | `#bot-logs` | intentionally shares the same channel as `message_log` |
| `ticket_panel` | `#ticket` | `tickets`, including `🎫-tickets` |
| `ticket_category` | `TICKETS` category | decorative-prefix variants |
| `ticket_logs` | `#ticket-logs` | decorative-prefix variants |
| `create_workspace_voice` | `Create Workspace` | `Create VC` |
| `temp_voice_category` | `WORKSPACES` category | `CO-WORKING SPACE`, `Coworking Space` |
| `coworking_lounge` | `Coworking Lounge` | `Coworking` |
| `announcements` | `#announcements` | decorative-prefix variants such as `🚨-announcements` |
| `live_announcements` | `#live-announcements` | `live`, including `🔴-live` |
| `live_ping_role` | `Live Notifications` | `live-notifications`, `live-ping` |
| `role_panel` | `#roles` | decorative-prefix variants such as `🤓-roles` |
| `ai_updates` | `#ai-updates` | decorative-prefix variants such as `🤖-ai-updates` |
| `quiz_channel` | `#quizzes` | `quiz` |
| `anon_questions` | `#anonymous-questions` | `anonymous`, including `🎭-anonymous` |
| `analytics` | `#analytics` | decorative-prefix variants |
| `showcase_forum` | `#showcase` forum | matching Forum Channel only; a `SHOWCASE` category does not count |
| `app_of_the_week` | `#app-of-the-week` | decorative-prefix variants such as `📱-app-of-the-week` |
| `collab_lfg` | `#collab-lfg` | decorative-prefix variants such as `🤝-collab-lfg` |
| `builder_role` | `Builder` | case/separator-normalized match |
| `contributor_role` | `Contributor` | case/separator-normalized match |
| `mentor_role` | `Mentor` | case/separator-normalized match |

New staff/private resources deny `@everyone` View Channel. Server Administrators can still access them. Add explicit channel/category overwrites for non-administrator staff roles if your moderation team uses narrower permissions.

The Live Notifications self-role panel is posted or refreshed only as an explicitly listed mutation when setup changes the selected role-panel channel or Live Notifications role.

### Role behavior

The bot uses four standard community roles with different ownership rules:

| Role | How a member gets it | Default behavior |
| --- | --- | --- |
| `Builder` | automatic reputation threshold | granted at 50 points and removed if the member falls below the threshold |
| `Contributor` | automatic reputation threshold | granted at 150 points and removed if the member falls below the threshold |
| `Mentor` | automatic reputation threshold | granted at 500 points and removed if the member falls below the threshold |
| `Live Notifications` | self-service button in the configured roles channel | member can add or remove it at any time; `/live` uses it for opt-in pings |

Builder, Contributor and Mentor are achievement roles and are **not** exposed on the self-role panel. Change their point requirements with `/reputation thresholds`.

Staff, moderator and administrator roles remain owned by the Discord server. Rob-bot does not create them, grant them, or decide who belongs to staff. Staff access is based on Discord permissions such as Administrator, Manage Guild, Moderate Members or Manage Channels depending on the command.

### Manual setup and overrides

The individual `/setup` commands still exist for custom server layouts. Use them when you want a feature to use a differently named or pre-existing object:

- `/setup text-channel` for text destinations such as `announcements`, `role_panel` or `bot_log`
- `/setup voice-channel` for `create_workspace_voice` or `coworking_lounge`
- `/setup forum` for `showcase_forum`
- `/setup category` for `ticket_category` or `temp_voice_category`
- `/setup role` for `builder_role`, `contributor_role`, `mentor_role` or `live_ping_role`
- `/setup role-panel` to repost or refresh the Live Notifications button panel after a manual role/channel override
- `/setup status` to inspect all current mappings and identify stale Discord IDs

These commands replace the stored mapping. They do not require the resource to use the standard auto-setup name. `/setup auto` preserves a valid custom manual mapping whose name is outside its automatic name and alias set.

### Feature content that still needs an administrator choice

`/setup auto` configures Discord infrastructure. It intentionally does not invent community content or policy choices. Configure these when you are ready to use the related feature:

1. Add ticket types with `/ticket-type add`, then post the panel with `/ticket-panel post`.
2. Add quiz questions with `/quiz add`, then optionally schedule them with `/quiz schedule`.
3. Add official RSS/Atom sources with `/ai-source add`. Only add sources you consider authoritative.
4. Change Builder/Contributor/Mentor thresholds with `/reputation thresholds` if the defaults `50 / 150 / 500` are not suitable.
5. Use `/setup log-ignore` for staff/private channels that should not be mirrored into message logs.
6. Disable any system you do not want with `/setup feature`.

For TikTok Live notifications, `/setup auto` configures both the live-announcement destination and the opt-in Live Notifications role. `/live` falls back to the general `announcements` resource if the dedicated live channel is later removed from configuration. Rob-bot never uses `@everyone` or `@here` for `/live`. Runtime authorization still permits only the configured Mar Wie account to publish a live announcement.

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
13. Run `/setup auto` in Discord and approve the discovery pass. Enable Discord Community only if the second setup plan says a Forum Channel must be created.

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
- `/setup auto` is discovery-first and idempotent. It binds clear existing resources before proposing missing infrastructure, and it never deletes or silently restructures unrelated server resources.

## Project workflow

Read `AGENTS.md` before implementation work. Non-trivial changes require a spec and implementation plan under `docs/superpowers/`.
