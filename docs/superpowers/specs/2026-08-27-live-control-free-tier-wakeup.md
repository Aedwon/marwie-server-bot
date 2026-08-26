# Live Control free-tier wake transport

Date: 2026-08-27
Status: approved implementation refinement
Parent spec: `docs/superpowers/specs/2026-08-27-live-control-plane.md`
Decision: `docs/superpowers/decisions/2026-08-27-live-control-plane.md`

## Problem

The first live-control implementation used a Rob-bot database poll every two seconds and a guild snapshot refresh every thirty seconds. That is operationally simple but conflicts with the required no-payment architecture.

Neon Free currently provides 100 CU-hours per project per month and scales idle compute to zero after five minutes. The existing project has a 0.25 CU minimum. A continuously awake 0.25 CU compute consumes roughly 180 CU-hours over a 30-day month, so a high-frequency poll can exhaust the Free allowance even when nobody is using Control.

## Required behavior

Replace continuous Neon polling with an event-driven wake signal while preserving Neon as the durable action queue and audit trail.

### Wake transport

Use one private Discord incoming webhook.

- Vercel stores the full webhook URL as `CONTROL_WAKE_WEBHOOK_URL`.
- Bot-Hosting stores the corresponding numeric webhook ID as `CONTROL_WAKE_WEBHOOK_ID`.
- The webhook lives in a private staff/control channel where Rob-bot can receive message events.
- Vercel posts a minimal message after it has durably enqueued an action.
- Rob-bot reacts only when `message.webhook_id` exactly equals the configured webhook ID.
- The wake message contains no secret authorization material and does not need to identify the action.
- On wake, Rob-bot drains the durable queue using the existing atomic claim semantics.
- Queue execution still rechecks the actor's live guild membership and Discord permissions.

The Discord webhook is a notifier, not an authority. A forged or leaked wake message cannot create an action, choose an actor or bypass database/browser authorization.

### Delivery failure and recovery

- If the Vercel webhook POST fails after an action was queued, return an actionable service error while leaving the action queued/auditable.
- An idempotent browser retry must look up the existing action and re-send the wake instead of creating a second action.
- Rob-bot drains queued actions once during startup so a wake missed while the process was offline is recovered without polling.
- Drain operations are serialized with an async lock so simultaneous webhook messages do not execute the same action concurrently.
- Do not add a frequent fallback database poll.

### Snapshots

Remove the periodic 30-second database snapshot heartbeat.

Refresh a guild snapshot:

1. at Rob-bot startup;
2. after a queued action finishes or is rejected/failed;
3. when an authenticated browser explicitly requests a refresh because its snapshot is missing/stale;
4. optionally after relevant Discord channel/role/guild events, provided refreshes are debounced.

Add `refresh_snapshot` as a control action. It has no Discord mutation side effect but still requires an authenticated manageable guild and bot-side membership/permission verification.

The Vercel action endpoint may queue `refresh_snapshot` without requiring a fresh snapshot first. All other mutations retain the fresh-snapshot precondition.

On initial `/control` guild load:

- if a snapshot is fresh, render it normally;
- if it is absent/stale, request `refresh_snapshot`, wake Rob-bot, wait for completion and reload state;
- if the bot cannot respond, show an offline/unavailable state and keep mutation controls disabled.

### Startup behavior

When Control is enabled and `CONTROL_WAKE_WEBHOOK_ID` is configured:

- wait for the Discord client to become ready;
- register persistent notification-role views;
- drain any queued actions once;
- write initial guild snapshots once.

No recurring action or snapshot database loop is required after startup.

### Cost invariant

When nobody opens Control and no browser action is submitted, the control-plane implementation must not generate recurring Neon queries or writes. This allows Neon's five-minute scale-to-zero behavior to work.

Normal Discord features may still access the production database when Discord activity requires it; the Control feature itself must not keep the database awake solely for heartbeat/polling.

## Configuration

### Vercel

- `DATABASE_URL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `CONTROL_BASE_URL`
- `CONTROL_WAKE_WEBHOOK_URL`

### Bot-Hosting

- `DATABASE_URL`
- `CONTROL_WAKE_WEBHOOK_ID`
- existing Rob-bot variables

The full webhook URL is never stored in Bot-Hosting source code, browser JavaScript, Neon, or git. The numeric webhook ID is not secret.

## Migration/OAuth ordering

Do not sign into the live Control preview against the production Neon target before SQLite migration. OAuth creates a `control_sessions` row, which would make the target non-empty and correctly cause the migration tool to refuse overwrite.

OAuth redirects and secrets may be configured in advance. First functional OAuth login against the production Neon target happens only after `MIGRATION_VERIFIED` and the Neon-backed bot is running.

## Verification

Before production:

- enqueueing a new action sends exactly one wake request;
- an idempotent retry re-sends wake but does not duplicate the action;
- a webhook delivery failure leaves the action queued;
- messages from any other webhook ID do not drain the queue;
- concurrent wake messages serialize through one drain lock;
- startup drains a previously queued action without a wake message;
- no recurring 2-second action poll remains;
- no recurring 30-second snapshot write remains;
- stale/missing snapshot can be refreshed through the wake path;
- normal mutations still reject stale snapshots;
- Control becomes idle at the database when no operator is using it.
