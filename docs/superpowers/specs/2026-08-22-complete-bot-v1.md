# Complete bot V1 specification

Date: 2026-08-22
Status: accepted for implementation

## Goal

Finish the production V1 so deployment work is limited to connecting the Discord application, configuring server resources, adding optional external feeds, and starting the bot on bot-hosting.net.

## Scope

This V1 includes every operational/community system from the approved brief that was scheduled before the later RAG phase:

- moderation cases: warn, timeout, kick, ban, unban, history and audit logging
- message edit/delete logging with configurable ignored channels
- ticket panel, configurable ticket types, duplicate prevention, claim, close, reopen, transcript logging and deleted-channel reconciliation
- Create Workspace temporary voice channels with restart reconciliation; Coworking Lounge remains permanent
- Discord-native announcement composer with modal, preview, edit, destination and send flow
- reputation ledger, totals, Builder/Contributor/Mentor role thresholds, rank, leaderboard, profile and staff awards
- build-help solved knowledge records, accepted helper, Solved forum tag and `/solve`
- programming/AI quizzes with persistent answer buttons, staff question management and scheduled delivery
- `/anonask` with durable identity audit, rate limits and staff-only identity lookup
- durable Pomodoro sessions for coworking
- collaboration/LFG structured posts
- AI update RSS/Atom sources with categories, dedupe and scheduled polling
- weekly aggregate staff analytics
- showcase App of the Week selection/posting and unanswered build-help surfacing

The future semantic `/ask-community` RAG layer remains outside V1 because the approved brief explicitly places it after the operational phases. V1 stores solved-answer metadata so that layer can be added without schema redesign.

## Discord configuration

Discord IDs must remain runtime data. The setup system supports channels, roles and forum tags for all V1 features. Feature-specific scheduling and ignore lists use per-guild feature configuration JSON.

Required or optional resource keys include moderation/message/ticket logs, ticket category, Create Workspace, temporary voice category, Coworking Lounge, announcements, AI updates, build-help forum/Solved tag, quiz channel, anonymous questions channel, analytics channel, showcase forum, App of the Week channel, collaboration channel and reputation roles.

## Intents

Default intents are used. Voice state events are enabled. Message-content intent is optional and controlled by `ENABLE_MESSAGE_CONTENT`. When disabled, message log/reputation functionality must degrade safely without assuming message text is available. The deployment guide explains that full edit/delete content logging requires enabling the privileged Message Content intent in the Discord Developer Portal and setting the environment toggle.

## Data and persistence

All durable records include `guild_id` where applicable. New tables cover tickets/events/types, temporary voice channels, reputation events/totals, forum solutions, quiz questions/sessions/answers, anonymous questions, Pomodoro sessions, AI update sources/items, showcase spotlights and scheduler state where needed.

Reputation uses an append-only event ledger. Derived totals may be cached transactionally but the ledger remains authoritative.

Ticket, quiz and voice state must survive restarts. Persistent Discord views use stable custom IDs and are registered during startup.

## Permissions and abuse controls

Admin/setup commands require Administrator. Moderation commands require the corresponding Discord permission and role hierarchy checks. Ticket staff actions require Manage Channels or Moderate Members. Anonymous identity lookup requires Moderate Members and is never exposed in public messages. `/anonask` is rate limited per guild/user. Staff reputation awards are audited as reputation events.

## Failure and recovery

External feed failures are logged and retried on the next polling cycle. Duplicate feed items are suppressed by durable unique keys. Deleted ticket/voice resources are reconciled without crashing. Missing configured Discord resources produce actionable setup messages. Background loops are idempotent and may run after restart without duplicating scheduled posts.

## Observability

Unexpected command and background-task failures use structured standard logging. Staff-facing operational records go to configured Discord log channels when available. Weekly analytics summarize moderation, tickets, solved posts, quizzes, anonymous questions and reputation activity.

## Testing

Pure services and persistence-sensitive decisions receive unit tests. CI must pass pytest, Ruff lint/format, mypy, compileall and an Alembic upgrade against a clean SQLite database. No live Discord token is required by CI.

## Deployment completion

The final README must include one setup checklist for Discord Developer Portal, bot permissions, bot-hosting.net environment variables, required `/setup` commands and optional AI update source configuration. After CI is green, no code editing should be required for first production startup.
