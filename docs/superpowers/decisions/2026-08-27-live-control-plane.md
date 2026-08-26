# Live control plane decisions

Date: 2026-08-27

## Decision

Promote the approved `/control` prototype into a live authenticated control plane using Vercel + Discord OAuth + Neon Postgres + a database-backed Rob-bot action worker.

## Chosen architecture

- Vercel owns browser authentication, session handling, read API responses and action creation.
- Neon is the shared durable database.
- Rob-bot remains the only holder of the Discord bot token and the only executor of Discord mutations.
- Browser writes become audited queued actions in Neon.
- Rob-bot re-checks the requesting Discord user's current guild membership and permissions before execution.
- Existing domain services/repositories remain the source of business behavior. The control worker adapts queued actions into those services instead of reimplementing slash-command logic.

## Why

This keeps the bot token out of Vercel, works on the existing free hosting arrangement, avoids requiring Bot-Hosting to expose an inbound HTTP server, and gives browser actions durable audit/idempotency semantics.

## Database cutover

Do not require the operator to download the Bot-Hosting SQLite file manually.

Add a one-shot dual-database migration utility. It runs while SQLite remains primary, connects to Neon using a separate migration target environment variable, upgrades the target schema, copies durable rows, verifies counts/invariants, then exits without changing the active database. The production `DATABASE_URL` is changed only after verification.

## Authentication

Use Discord OAuth2 authorization-code flow with `identify guilds`. Browser cookies contain only an opaque session identifier. Session/OAuth state is server-side. State-changing requests require CSRF protection.

Bot-side permission checks are authoritative for writes. Vercel authorization is an early gate, not the final security boundary.

## Notification role panel

Generalize the existing hard-coded Live Notifications panel into durable per-guild role-panel configuration with ordered role/button rows. Re-register persistent views from stored configuration on startup.

## Publishing mentions

Allow message text outside embeds and explicit user/role/`@everyone`/`@here` mentions, but construct `AllowedMentions` from validated resolved mention targets. Do not pass unrestricted browser text into Discord mention parsing.

## Cost

Keep the implementation on the no-payment path: existing Bot-Hosting plan, Vercel Hobby where eligible, and the existing Neon Free project. No paid infrastructure is introduced by this decision.
