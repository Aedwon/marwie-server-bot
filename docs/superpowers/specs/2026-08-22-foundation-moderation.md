# Foundation and moderation spec

Date: 2026-08-22
Status: accepted

## Goal

Create a deployable Python Discord bot foundation and one complete moderation vertical slice. A fresh deployment must be able to apply migrations, connect to Discord, configure a moderation log channel, record warnings, and retrieve moderation history after a restart.

## Context

`Aedwon/Discord-Bot` proves several useful behaviors, including slash commands, moderation hierarchy checks, server-configured channel IDs, persistent database state, and graceful shutdown. This repository will reuse those behaviors without carrying over the old bot's monolithic database initializer, hardcoded guild assumptions, game-specific systems, or large cogs.

The first deployment target is bot-hosting.net. Its Python runtime installs dependencies from `requirements.txt`, supports GitHub source deployments and environment variables, and does not provide a shell for manual package installation. The application therefore needs a self-contained startup path.

## Scope

Included:

- Python project and package structure
- typed environment configuration
- structured application logging
- SQLAlchemy 2 async database layer
- Alembic migrations applied from the application startup path
- SQLite as the initial database, with PostgreSQL-compatible models and query patterns
- guild resource storage for Discord IDs
- feature-flag storage for later features
- `/ping`
- `/setup status`
- `/setup resource`
- `/warn`
- `/history`
- moderation hierarchy checks
- moderation log delivery
- global application-command error handling
- graceful database and Discord shutdown
- unit tests and CI gates
- bot-hosting.net deployment documentation

Not included:

- timeout, kick, ban, purge, or other destructive moderation commands
- tickets
- message edit/delete logging
- temporary voice channels
- reputation or XP
- quizzes
- anonymous questions
- AI update aggregation
- web dashboard
- automatic creation of Discord roles or channels

## User behavior

### `/ping`

Anyone who can use application commands may run `/ping`. The bot responds with its gateway latency.

### `/setup resource`

Administrators can assign a supported Discord resource key to a channel. V1 supports `moderation_log`. The bot stores the channel ID for the current guild.

The command rejects DMs. Discord channel parameters are typed, so the configured moderation log must be a text-capable channel accepted by the command.

### `/setup status`

Administrators can view the current guild resource configuration. A saved resource whose Discord object no longer exists is shown as stale instead of being silently treated as valid.

### `/warn`

Members with `Moderate Members` permission can warn another member. The command requires a non-empty reason.

The command rejects:

- self-targeting
- targeting the guild owner
- targets whose top role is equal to or above the caller's top role, except when the caller is the guild owner
- targets whose top role is equal to or above the bot's top role

A successful warning is stored before any optional notification work. The bot attempts to DM the warned member and post the case to the configured moderation log channel. A closed DM does not invalidate the case. A missing or stale moderation log does not delete the case. The moderator is told when the audit post could not be delivered.

### `/history`

Members with `Moderate Members` permission can view the latest moderation cases for a member in the current guild. Results are newest first and are sent ephemerally.

## Data and persistence

All guild-owned records include `guild_id`.

### `guilds`

Stores guild IDs seen by configuration or feature writes. This is a lightweight ownership row and does not attempt to mirror Discord guild metadata.

### `guild_resources`

Stores `(guild_id, key, resource_type, discord_id)` with the user who last updated it and timestamps. `(guild_id, key)` is unique.

### `feature_flags`

Stores a boolean enabled flag and optional JSON configuration per `(guild_id, feature)`. The table exists in the foundation but V1 does not expose a feature-flag command.

### `moderation_cases`

Stores the guild, action, target user, moderator, reason, optional expiry, optional JSON metadata, and creation timestamp. The database primary key is the audit case number shown to moderators.

Moderation cases are independent from future reputation, XP, quizzes, or economy systems.

SQLite data lives under `data/` by default. The database URL can be replaced through `DATABASE_URL`. PostgreSQL URLs are normalized to the SQLAlchemy async driver when needed.

## Architecture constraints

Discord cogs only parse Discord interactions, run permission checks, call services, and render Discord responses.

Services contain feature behavior and do not depend on Discord concrete types when the behavior can be expressed as plain data.

Repositories own SQLAlchemy queries. Raw SQL does not belong in cogs.

Alembic owns schema evolution. Startup may apply committed Alembic migrations, but feature code must not create or alter tables opportunistically.

The startup sequence is:

1. load typed settings
2. configure logging
3. prepare the local SQLite directory when applicable
4. run `alembic upgrade head`
5. create the async database session factory
6. load extensions
7. connect to Discord

## Permissions and abuse controls

`/setup` commands require administrator permission.

Moderation commands require `Moderate Members` permission and explicit hierarchy validation.

Reasons are stored as moderator-authored audit data. Commands must not log the Discord token, database credentials, or complete environment dumps.

No anonymous feature exists in this milestone.

## Failure and recovery

Committed migrations run before the bot connects. A migration failure aborts startup.

Database write failures abort the affected command and are logged with context.

If the configured moderation log channel was deleted, the warning remains stored and the command reports that the audit post could not be delivered.

If a member's DMs are closed, the warning remains valid.

A restart does not require recovery work beyond reopening the database because no V1 operation stays pending in memory.

## Observability

Log:

- startup environment name, without secrets
- migration start and completion
- extension load failures
- command failures with command and guild context where available
- moderation log delivery failures
- database lifecycle events

Do not log:

- Discord tokens
- database passwords
- full environment variable sets
- private DM contents beyond the moderator-authored reason already stored as audit data

## Testing

Before this milestone is complete, prove:

- environment settings load and reject a missing token when startup settings are requested
- database URLs normalize correctly for SQLite and PostgreSQL
- hierarchy rules reject self, owner, caller hierarchy, and bot hierarchy violations
- guild-owner hierarchy override only bypasses the caller-role comparison
- resource service reads and writes through its repository contract
- moderation service creates and retrieves cases through its repository contract
- Python source compiles
- pytest passes
- Ruff passes
- formatting check passes
- mypy passes
- Alembic can upgrade a clean SQLite database to head in CI

Discord network calls are not part of automated tests in this milestone.

## Open questions

None blocking this milestone.

## Accepted decisions

See `docs/superpowers/decisions/2026-08-22-foundation-architecture.md`.
