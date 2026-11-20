# Local Control runtime synchronization decisions

Date: 2026-10-16

## Decision

For the Mac-hosted local Control runtime, replace the remote-hosting wake model with a true always-on bot worker and periodic local snapshot heartbeat. Normalize SQLite Control timestamps to explicit UTC at the Node adapter boundary, and replace long-held guild-state refresh requests with HTTP 202 plus bounded client polling.

This decision applies only to the local shared-SQLite runtime. Vercel/Neon rollback compatibility and the Discord webhook wake transport remain available until the user separately approves decommissioning.

## What this supersedes

For local Mac production, this supersedes the operational assumptions in the 2026-08-27 free-tier wake design that prohibited recurring Control polling and snapshot heartbeats to let Neon scale to zero. That cost constraint no longer exists when Node and Rob-bot share local SQLite on an always-running Mac.

It also supersedes the first 2026-10-16 local-hosting interpretation of `CONTROL_WORKER_MODE=always_on`, where wake delivery became a successful no-op but the bot itself still had no recurring queue worker.

## Chosen runtime behavior

- Local production explicitly sets `CONTROL_WORKER_MODE=always_on` on both the bot and web runtimes. Hosted rollback uses `webhook`, which remains the backward-compatible default. Queue polling and heartbeat run only in `always_on` mode.
- Rob-bot checks the local durable Control queue at an approximately one-second idle cadence.
- The existing drain lock remains the serialization boundary.
- Empty checks are reads only.
- Rob-bot refreshes connected guild snapshots at startup, after relevant actions, on explicit refresh, and approximately every 60 seconds.
- Snapshot freshness keeps the existing stale-state safety boundary.
- The local website treats SQLite timestamp strings as UTC and exposes explicit UTC timestamps to JavaScript.
- A stale guild-state request enqueues or reuses `refresh_snapshot` and returns HTTP 202 promptly.
- The browser polls for a bounded period and shows a real unavailable state if freshness is not restored.

## Why

The previous architecture coupled action delivery to a Discord webhook because the bot host could sleep and the shared Neon database needed to scale to zero. On the local Mac both processes are already running and the database is local. Keeping the old wake model adds failure modes without saving meaningful resources.

The current SQLite bridge also crosses a Python/JavaScript time boundary. A timezone-less UTC value must not be parsed as local wall-clock time. Making UTC explicit at the adapter boundary prevents host-timezone-dependent freshness behavior.

## Rejected alternatives

### Restore the Discord webhook as the local trigger

Rejected because it reintroduces a remote Discord dependency for two processes already sharing one local database. It also leaves local queue correctness dependent on a notification channel that is no longer operationally necessary.

### Keep the no-op wake and only add a queue poll

Rejected as incomplete. It would fix queued actions but leave the timezone ambiguity and the 75-second blocking refresh request in place.

### Collapse the Control API into the Python bot

Rejected for now because it would rewrite working OAuth/session/API infrastructure and erase the existing website production boundary without a corresponding product benefit.

## Security invariants

The redesign does not change the authorization model. Discord OAuth, CSRF, same-origin mutation checks, idempotency, browser-side early authorization, bot-side live membership/permission checks, bot permission/hierarchy checks and fresh-snapshot mutation gating remain required.

The web runtime still never receives the Discord bot token. The bot remains the only executor of Discord mutations.

## Operational implications

A one-second local queue read and one snapshot write per guild per minute are acceptable for the local SQLite deployment. They would not be acceptable to reintroduce blindly into the old Neon free-tier deployment. Any future change that makes the hosted rollback path continuously poll again requires a separate cost review.

Vercel and Neon remain untouched during repair and verification.
