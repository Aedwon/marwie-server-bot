# Local Control Runtime Synchronization

Date: 2026-10-16
Status: Draft for written review

## Context

Rob-bot and the authenticated Control website now run continuously on the same M4 Mac and share the bot production SQLite database. The previous Control architecture was designed for Vercel, Neon and a sleeping Bot-Hosting worker. It used a Discord webhook to wake the bot and deliberately avoided recurring queue polling and snapshot heartbeats so Neon could scale to zero.

Those cost and wake constraints no longer apply to the local Mac runtime. Carrying the old wake contract into the local deployment created two failures: local `always_on` mode reports wake delivery as successful without creating a continuously draining bot worker, and SQLite timestamps cross the Python/Node boundary without an explicit UTC timezone contract. A stale Control snapshot can therefore remain queued indefinitely or be interpreted as stale immediately.

This spec redesigns only the synchronization protocol. It preserves the current OAuth, authorization, audit, idempotency and deployment safety model.

## Superseded behavior

For the local Mac runtime, this spec supersedes the wake and snapshot strategy in:

- `docs/superpowers/specs/2026-08-27-live-control-free-tier-wakeup.md`;
- the `Always-on worker behavior` section of `docs/superpowers/specs/2026-10-16-local-website-hosting.md` on the website line.

The old webhook-driven transport remains supported for Vercel/Neon rollback. This spec does not delete or disable Vercel, Neon, or webhook-mode compatibility.

## Goals

- Make the local bot an actual continuously available Control worker.
- Make fresh-state detection correct in every host timezone, including Asia/Manila.
- Remove long-held HTTP requests while Control waits for a snapshot.
- Keep stale-state mutation protection intact.
- Keep browser actions durable and idempotent through the existing `control_actions` queue.
- Preserve bot-side live guild membership and Discord permission checks.
- Preserve separate bot and website production lines.
- Avoid schema changes unless implementation proves one is necessary.

## Non-goals

- Do not merge the Node web runtime into Python.
- Do not move Discord OAuth into the bot.
- Do not replace SQLite.
- Do not remove the durable action queue or audit trail.
- Do not remove Vercel/Neon rollback resources.
- Do not weaken the three-minute stale-snapshot safety boundary for mutations.

## Target topology

```text
Internet
  -> Cloudflare HTTPS/Tunnel
  -> local Node website/API on 127.0.0.1:8787
       -> shared SQLite database
            <- always-running Python Rob-bot worker
                 -> Discord
```

The database remains the durable handoff between browser/API and bot. The web process never receives the Discord bot token. The bot remains the only executor of Discord mutations.

## UTC timestamp contract

All Control timestamps are UTC. SQLite storage may remain compatible with the existing SQLAlchemy schema, but a timezone-less SQLite text value must never be interpreted as local wall-clock time by the Node runtime.

At the SQLite adapter boundary:

- database timestamp values used by Control are interpreted as UTC;
- values exposed to JavaScript date logic are normalized to an explicit RFC 3339/ISO-8601 UTC representation ending in `Z`;
- API responses expose explicit UTC timestamps;
- freshness comparisons operate only on normalized values;
- JSON decoding behavior remains unchanged.

Verification must include a timezone regression test executed with `TZ=Asia/Manila` proving a newly written UTC snapshot is fresh and an actually old snapshot is stale. The test must fail against the current timezone-less behavior before implementation.

## Always-on bot worker

Worker mode is explicit on both runtimes. Local production sets `CONTROL_WORKER_MODE=always_on` in both the bot production environment and the web production environment. Hosted Vercel/Neon rollback uses `CONTROL_WORKER_MODE=webhook`, with webhook mode remaining the backward-compatible default when the setting is absent. The bot must validate the supported values and must not infer always-on behavior merely from a missing webhook ID or from the database backend.

Queue polling and the periodic snapshot heartbeat described below run only in `always_on` mode. In `webhook` mode, the existing event-driven wake behavior and no-heartbeat cost invariant remain intact.

When background tasks are enabled and worker mode is `always_on`, the local Rob-bot process continuously services the durable Control queue.

Required behavior:

- start the worker only after Discord is ready and the Control cog has completed its startup initialization;
- poll the local queue at a bounded idle cadence of approximately one second;
- serialize drains through the existing `_drain_lock`;
- drain all currently queued actions before returning to the idle wait;
- do not log every empty poll;
- log unexpected worker failures with context and continue after a bounded backoff instead of permanently killing the loop;
- cancel the worker cleanly when the cog unloads or the bot closes;
- never run the worker when `ENABLE_BACKGROUND_TASKS=false` or cutover read-only mode disables background tasks.

The Discord wake webhook is not required in local production. Existing webhook handling may remain for rollback compatibility, but correctness in `always_on` local mode must not depend on receiving a Discord message.

## Snapshot heartbeat

The local bot publishes Control snapshots as a lightweight liveness heartbeat.

Refresh each connected guild snapshot:

1. during Control startup initialization;
2. after any queued action finishes, fails or is rejected when the action requires post-action refresh;
3. after an explicit `refresh_snapshot` action;
4. periodically while the bot is ready, with a target cadence of 60 seconds.

The heartbeat is a local SQLite write, so the old Neon scale-to-zero constraint does not apply. The periodic task must avoid overlapping refresh cycles and must log failures without terminating future heartbeats.

The existing stale threshold remains the safety boundary. If the bot stops, its last heartbeat naturally ages out and mutation controls remain disabled once the snapshot is stale.

## Guild-state refresh protocol

`GET /api/guild-state` must not hold a request open for tens of seconds.

When the requested snapshot is fresh:

- return HTTP 200 with the current state and snapshot metadata.

When the snapshot is missing or stale:

- idempotently enqueue or reuse a `refresh_snapshot` action;
- attempt the configured wake transport only when the active worker mode requires it;
- return HTTP 202 promptly with a machine-readable `refreshing` state and a short retry hint;
- do not wait inside the server request for the snapshot to become fresh.

The browser then polls the same guild-state endpoint at a short bounded interval. A successful refresh produces HTTP 200. If state does not become fresh within a bounded client deadline, Control renders a clear unavailable/offline error and keeps mutation controls disabled. It must not remain indefinitely on `Loading fresh server state…`.

The same 202 protocol may be used in webhook rollback mode. In that mode `tryWakeControlWorker()` still delivers the Discord webhook. In local `always_on` mode wake is a no-op because the bot queue worker is already active.

## Mutation safety

The redesign does not change authorization semantics.

- Browser sessions still come from Discord OAuth.
- State-changing API calls still require CSRF and same-origin validation.
- Action creation remains rate-limited and idempotent.
- Every queued action retains `guild_id` and `actor_id`.
- Rob-bot rechecks live guild membership and required Discord permissions before execution.
- Normal mutations still require fresh Control state before queueing.
- `refresh_snapshot` remains the exception that may be queued while current state is stale.
- Discord bot permissions and role hierarchy checks remain authoritative.

## SQLite concurrency

Node and Python continue sharing one SQLite database. The existing bounded busy timeout and foreign-key enforcement remain required. Worker polling must use ordinary short transactions and must not hold a database transaction across Discord network calls. Queue claiming remains atomic and idempotent.

No recurring polling loop may mutate rows when there is no work. Empty queue checks are reads only.

## Observability

Add enough runtime evidence to diagnose this path without exposing secrets.

Bot logs should identify:

- Control worker startup and shutdown;
- non-zero queue drain counts;
- unexpected queue worker exceptions;
- heartbeat refresh failures with guild ID;
- snapshot publication failures.

Web/API errors should distinguish:

- refreshing;
- authentication/authorization failure;
- bot state unavailable after the client deadline;
- an action that failed or was rejected.

Do not log OAuth secrets, bot tokens, session cookies, CSRF secrets, Cloudflare credentials or full database credentials.

## Cross-runtime verification

The previous local-hosting tests proved Node SQLite behavior and bot behavior separately. The repaired design requires a shared-database integration test that crosses the runtime boundary.

At minimum verify:

1. a Node-side Control request creates a durable queued refresh/action in a temporary SQLite database;
2. the Python Control worker claims and finishes that action from the same database;
3. Python publishes a snapshot into the shared database;
4. Node reads the published timestamp as explicit UTC and considers it fresh under `TZ=Asia/Manila`;
5. a genuinely stale timestamp is rejected;
6. a duplicate/idempotent request does not create duplicate actions;
7. worker restart recovers an already queued action;
8. disabling background tasks prevents the local worker from executing actions.

If a single mixed-language test harness is impractical, the implementation plan may use a deterministic fixture handoff between focused Node and Python test commands, but the verification must still prove the same persisted SQLite values are mutually compatible.

## Deployment and rollback

Implementation is promoted independently to the two production lines.

- Bot worker changes belong to `main`.
- Website/API/timestamp adapter changes belong to the website production line and its local hosting worktree.
- Do not merge one production branch into the other.

Cutover verification order:

1. focused RED/GREEN bot tests;
2. focused RED/GREEN web timestamp and 202-refresh tests;
3. cross-runtime SQLite verification under Asia/Manila;
4. full Python and web verification gates named by the implementation plans;
5. restart the bot and web LaunchAgents through the explicit operator boundary;
6. verify public OAuth session;
7. verify Control loads current state;
8. verify one low-risk Control write is queued, consumed and reflected;
9. wait longer than one heartbeat interval and verify state remains fresh without a webhook.

Vercel and Neon remain untouched until this local path passes end to end and the user separately authorizes decommissioning.
