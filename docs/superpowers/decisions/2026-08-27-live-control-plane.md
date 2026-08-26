# Live control plane decisions

Date: 2026-08-27

## Decision

Promote the approved `/control` prototype into a live authenticated control plane using Vercel + Discord OAuth + Neon Postgres + an event-driven Rob-bot action worker.

## Chosen architecture

- Vercel owns browser authentication, session handling, read API responses and action creation.
- Neon is the shared durable database and audit trail.
- Rob-bot remains the only holder of the Discord bot token and the only executor of Discord mutations.
- Browser writes become audited queued actions in Neon.
- After an action is durably queued, Vercel sends a wake-only notification through one private Discord incoming webhook.
- Rob-bot trusts only the configured webhook ID, drains queued actions, re-checks the requesting Discord user's current guild membership/permissions and then executes them.
- Existing domain services/repositories remain the source of business behavior. The control worker adapts queued actions into those services instead of reimplementing slash-command logic.
- The webhook is not an authorization path. Possession of the webhook URL can at most ask the bot to inspect its already-authorized queue; it cannot create a valid control action by itself.

## Why

This keeps the bot token out of Vercel, works on the existing free hosting arrangement, avoids requiring Bot-Hosting to expose an inbound HTTP server, and gives browser actions durable audit/idempotency semantics.

A fixed 2-second Neon poll was rejected after cost review. Neon Free provides 100 CU-hours per project each month and scales to zero after five minutes. At the project's 0.25 CU minimum, keeping compute awake continuously would consume about 180 CU-hours in a 30-day month and could suspend the Free database before month-end. Event-driven wakeups let Neon scale to zero when Control is unused.

## Queue wakeup and recovery

Use one private Discord incoming webhook as a wake signal:

- Vercel stores `CONTROL_WAKE_WEBHOOK_URL` as a secret and posts a minimal wake message after enqueueing a new or retried queued action.
- Bot-Hosting stores only `CONTROL_WAKE_WEBHOOK_ID`, which is not a credential.
- Rob-bot listens for messages from that exact webhook ID and drains the durable Neon queue under an async lock.
- The wake message does not need to carry an action ID; the database is authoritative.
- Rob-bot drains pending actions once on startup as recovery for any wake delivered while the bot was offline.
- A failed webhook delivery leaves the action queued and auditable. A browser retry with the same idempotency key re-sends the wake without duplicating the action.
- No high-frequency fallback database poll is used.

## Snapshot strategy

Do not keep Neon awake with a periodic 30-second snapshot heartbeat.

- Refresh guild snapshots on bot startup.
- Refresh the affected guild after every completed/rejected/failed action.
- Allow an authenticated browser to queue a `refresh_snapshot` action even when the existing snapshot is absent or stale; the wake webhook immediately prompts Rob-bot to rebuild it.
- The browser requests this refresh on initial guild load when needed, then waits briefly and retries the read.
- Relevant Discord events may opportunistically refresh snapshots, but correctness must not depend on a constant database heartbeat.

This makes an old snapshot mean “refresh required,” not “bot definitely offline.”

## Database cutover

Do not require the operator to download the Bot-Hosting SQLite file manually.

Add a one-shot dual-database migration utility. It runs while SQLite remains primary, connects to Neon using a separate migration target environment variable, upgrades the target schema, copies durable rows, verifies counts/invariants, then exits without changing the active database. The production `DATABASE_URL` is changed only after verification.

The final SQLite snapshot is taken with `CUTOVER_READ_ONLY=true`, which blocks slash-command writes, disables background schedulers and makes SQLite application sessions query-only.

Do not exercise OAuth against the production Neon target before the SQLite migration: a browser session row would make the migration target non-empty. OAuth credentials/redirects may be configured in advance, but the production target remains untouched until cutover verification succeeds.

## Authentication

Use Discord OAuth2 authorization-code flow with `identify guilds`. Browser cookies contain only opaque random session material. Session/OAuth state is server-side. State-changing requests require CSRF protection.

Bot-side permission checks are authoritative for writes. Vercel authorization is an early gate, not the final security boundary.

## Notification role panel

Generalize the existing hard-coded Live Notifications panel into durable per-guild role-panel configuration with ordered role/button rows. Re-register persistent views from stored configuration on startup.

## Publishing mentions

Allow message text outside embeds and explicit user/role/`@everyone`/`@here` mentions, but construct `AllowedMentions` from validated resolved mention targets. Do not pass unrestricted browser text into Discord mention parsing.

## Cost

Keep the implementation on the no-payment path: existing Bot-Hosting plan, Vercel Hobby where eligible, and the existing Neon Free project. No paid infrastructure is introduced by this decision.

The control architecture must remain idle-friendly so Neon can scale to zero. Any future recurring database poll or heartbeat requires another Free-plan cost review before adoption.
