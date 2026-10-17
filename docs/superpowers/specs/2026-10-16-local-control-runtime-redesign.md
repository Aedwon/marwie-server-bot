# Local Control Runtime Redesign

Date: 2026-10-16
Status: Draft for review

## Problem

Rob-bot's website and Control runtime have been moved from Vercel + Neon toward local hosting on the same M4 Mac that runs the Discord bot. The current local deployment successfully serves the website through Cloudflare Tunnel and Discord OAuth works, but Control remains stuck on `Loading fresh server state…`.

The local migration preserved remote-hosting assumptions that no longer fit a co-located always-on architecture:

1. The web runtime treats `CONTROL_WORKER_MODE=always_on` as if wake delivery succeeded, but the Python bot still drains queued Control actions only at startup or when a legacy Discord webhook message arrives.
2. SQLite timestamp values cross the Python/Node boundary without an explicit timezone. Python writes UTC datetimes, while the Node SQLite adapter exposes SQLite-style timestamp strings without a `Z` or offset. JavaScript date parsing can therefore interpret fresh UTC state as local time and classify it as stale on a UTC+8 host.
3. `GET /api/guild-state` can hold a request open for up to 75 seconds while waiting for a refresh. That behavior was tolerable for a hosted wake-based worker but is a poor fit for Cloudflare + a local always-on worker and hides which stage is unhealthy.
4. Existing tests verify the Python control plane and Node SQLite adapter mostly in isolation. They do not sufficiently exercise the cross-runtime contract under the production timezone.

## Goals

- Keep the current production topology: Cloudflare Tunnel -> loopback-only Node web/API -> shared local SQLite <- always-running Python Discord bot.
- Remove the legacy Discord wake webhook as a production dependency.
- Make the Python bot an actual always-on Control worker.
- Keep Control state fresh without weakening stale-state safety.
- Normalize all web-facing database timestamps to explicit UTC ISO-8601.
- Replace long blocking snapshot refresh requests with an explicit asynchronous refresh protocol.
- Preserve Discord OAuth, CSRF, browser authorization, bot-side live permission checks, idempotency, auditability, and safe failure when the bot is unavailable.
- Preserve Vercel and Neon only as rollback infrastructure until local production is verified end to end.

## Non-goals

- Do not rewrite the Control API into Python.
- Do not merge the bot and website production lines.
- Do not replace SQLite with PostgreSQL locally.
- Do not remove stale-snapshot gating.
- Do not delete Vercel or Neon.
- Do not change unrelated Discord features or the public website design.

## Target architecture

```text
Internet
  -> Cloudflare HTTPS/Tunnel
  -> 127.0.0.1:8787 Node web/API
       -> sessions and API state
       -> shared SQLite database
            <- Python Rob-bot Control worker
                 -> Discord
```

The website remains a separate checkout/worktree from the bot runtime. They share only the SQLite database and external runtime configuration.

## Control worker model

### Continuous queue draining

When background tasks are enabled, the Python Control plane owns one long-lived worker loop. The loop:

1. waits for a short bounded poll interval, approximately one second;
2. claims and drains queued Control actions through the existing repository and executor path;
3. sleeps when idle instead of busy-spinning;
4. logs unexpected failures with enough context to diagnose them;
5. continues after recoverable iteration failures;
6. is cancelled cleanly when the cog or bot shuts down.

Only one loop may be active per bot process. Existing `_drain_lock` protection remains useful for serialization and compatibility with any legacy/manual drain trigger.

The Discord wake webhook is no longer required in local production. Legacy webhook handling may remain temporarily for rollback compatibility, but always-on mode must not depend on it.

### Snapshot publication

Snapshots are produced through the existing `_refresh_snapshot` path.

The bot must publish:

- an initial snapshot after Discord readiness;
- a refreshed snapshot after every completed/rejected/failed action where state may have changed, preserving existing post-action behavior;
- a lightweight periodic heartbeat snapshot for each connected guild, with a target interval of 30 seconds and enough jitter or serialized execution to avoid overlapping refreshes.

A heartbeat keeps the browser read path normally fresh without forcing every page load to enqueue work. The heartbeat is not a replacement for on-demand refresh. It is a freshness baseline.

If snapshot generation for one guild fails, log it and continue servicing other guilds and future iterations.

## Timestamp contract

SQLite storage format is an implementation detail and must not leak into JavaScript freshness calculations.

The Node SQLite adapter must normalize timestamp result columns used by Control to explicit UTC ISO-8601 strings such as:

```text
2026-10-16T06:00:00.000Z
```

At minimum this applies to columns whose names conventionally represent timestamps, including `created_at`, `claimed_at`, `finished_at`, `updated_at`, and `expires_at`.

Rules:

- Values that already include an explicit timezone remain semantically unchanged.
- SQLite `YYYY-MM-DD HH:MM:SS[.sss]` values are treated as UTC and serialized with `T` and `Z`.
- Invalid or unknown values are not guessed into a date. They remain unchanged or cause the caller's normal validation/freshness path to fail safely.
- JSON decoding remains independent of timestamp normalization.

All freshness and expiry calculations in Node operate on explicit UTC instants.

## Snapshot freshness protocol

### Current behavior to remove

The current stale path performs:

```text
GET /api/guild-state
  -> enqueue refresh action
  -> optionally wake worker
  -> hold request open and poll SQLite for up to 75 seconds
```

This makes a slow or dead worker look like a hanging page.

### New behavior

`GET /api/guild-state?guild_id=...` becomes non-blocking with respect to worker execution.

When a fresh snapshot exists:

- return `200` with the existing state payload and `snapshot.fresh=true`.

When the snapshot is stale or missing:

1. enqueue or deduplicate a `refresh_snapshot` action using the existing short refresh bucket;
2. return `202` promptly with a machine-readable body such as:

```json
{
  "status": "refreshing",
  "retry_after_ms": 1000
}
```

The browser then polls `GET /api/guild-state` for a bounded period.

Recommended client behavior:

- first retry after about one second;
- continue at approximately one-second intervals;
- stop after a bounded timeout, approximately 15 seconds;
- if still unavailable, show a clear error such as `Rob-bot is online but has not published fresh server state yet. Retry.` instead of leaving a permanent loading message.

The API may include diagnostic-safe status metadata, but it must not expose secrets or internal filesystem paths.

## Safety and authorization

Existing safeguards remain mandatory:

- Discord OAuth session validation;
- guild membership/manage-server checks from the browser session;
- CSRF protection for mutations;
- same-origin protections;
- idempotency keys;
- bot-side live membership and permission re-checks before administrative execution;
- stale snapshots are never treated as actionable current state;
- queued work must not be executed when background tasks are disabled or the bot is in cutover read-only mode.

The browser may request refreshes, but only the bot decides whether the requesting actor still has the required live Discord permission.

## Failure behavior

### Bot offline

The website remains reachable. Stale `guild-state` calls return `202` while the client retries, then the client shows an explicit unavailable/stale-state error. No mutation is treated as successful.

### SQLite contention

Keep the bounded SQLite busy timeout. Transient contention may surface as retryable API/worker failure, but neither runtime should spin indefinitely.

### Worker iteration failure

Log the exception. Do not terminate the entire Control worker loop for a single unexpected action or snapshot refresh failure unless the surrounding bot process is shutting down.

### Clock/timezone differences

The timestamp contract removes host-local timezone interpretation from freshness logic. Tests must set `TZ=Asia/Manila` or otherwise exercise UTC+8 parsing explicitly.

## Cross-runtime verification

The redesign is not complete until one integration test proves the production contract across both runtimes.

The test must use a temporary SQLite database at the current schema and exercise, at minimum:

1. Node enqueues a `refresh_snapshot` Control action or produces equivalent database state through the public adapter contract.
2. The Python Control repository/worker claims and completes that queued action through the intended worker path, using a controlled fake Discord guild/snapshot builder where live Discord is not appropriate.
3. Python writes a snapshot timestamp.
4. Node reads that snapshot through the SQLite adapter.
5. Node freshness logic classifies the timestamp as fresh under `Asia/Manila`.
6. The API stale path returns `202` instead of holding an HTTP request open.
7. A subsequent read returns `200` after the snapshot becomes fresh.

If a single-process cross-language harness is impractical, the plan may implement two cooperating test commands against one temporary database, but the verification must still prove the real serialized database contract, not duplicated mocks.

## Observability

Add concise logs for:

- worker loop start/stop;
- queue drain failures;
- processed action counts when non-zero;
- periodic snapshot refresh failures;
- initial snapshot publication failures.

Do not log OAuth secrets, Discord tokens, session tokens, CSRF tokens, Cloudflare credentials, or full sensitive action payloads.

The web UI should distinguish:

- `Loading server state…`
- `Refreshing server state…`
- `Server state is current.`
- explicit timeout/unavailable state.

## Deployment and compatibility

Bot-side changes belong to the bot production line and website/API changes belong to the website production line. The implementation plan must define separate promotion steps so one production branch is never merged wholesale into the other.

During development and cutover:

- keep the current Mac LaunchAgents;
- keep Cloudflare Tunnel and `aidevph.aedwon.site` unchanged;
- keep Vercel and Neon intact as rollback resources;
- do not restore the Discord wake webhook as the local-production mechanism;
- preserve existing local SQLite data.

The final cutover verification must include:

1. bot worker process healthy;
2. local web `/healthz` healthy;
3. public HTTPS healthy;
4. Discord OAuth login healthy;
5. Control reaches fresh state without manual bot restart;
6. one low-risk Control write is queued, consumed, completed, and reflected in a fresh snapshot;
7. the same flow remains healthy after the snapshot freshness window has elapsed.

## Success criteria

The redesign is successful when:

- opening Control does not depend on a Discord wake webhook;
- a fresh snapshot normally exists because of the heartbeat;
- stale state triggers a visible bounded refresh flow instead of a 75-second hanging request;
- queued actions are consumed automatically by the always-on bot;
- timestamp freshness is correct under UTC+8;
- bot restarts recover pending queued work safely;
- existing permission, CSRF, idempotency, and stale-state protections continue to pass their tests;
- end-to-end public Control read and one low-risk write work through Cloudflare against the shared local SQLite database.
