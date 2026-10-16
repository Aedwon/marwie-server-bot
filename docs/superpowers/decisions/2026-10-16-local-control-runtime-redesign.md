# Local Control Runtime Redesign Decisions

Date: 2026-10-16

## Replace wake-based Control execution with a real always-on worker

The previous local-hosting design treated `CONTROL_WORKER_MODE=always_on` as a successful no-op wake because the bot process is continuously managed by LaunchAgent. That assumption is incomplete. The Python Control plane still drains queued actions only at startup or after the legacy Discord wake webhook message, so a no-op wake can leave queued refreshes and writes unprocessed indefinitely.

Decision: local production uses a real long-lived Control worker loop inside the Python bot. It continuously drains queued actions at a bounded idle cadence while background tasks are enabled. The Discord wake webhook is not required for local production. Legacy webhook handling may remain temporarily for rollback compatibility.

This supersedes the earlier decision that an always-on web worker mode only needed to make wake delivery a successful no-op.

## Make snapshot publication proactive

The original hosted flow refreshed snapshots primarily in response to startup or queued actions. In a co-located always-on deployment, keeping a normally fresh snapshot is cheaper and simpler than forcing every browser load to create work.

Decision: publish an initial snapshot at readiness, refresh after Control actions, and publish a periodic heartbeat snapshot for connected guilds. The target heartbeat interval is approximately 30 seconds. Freshness gating remains mandatory.

## Normalize SQLite timestamps at the Node adapter boundary

Python/SQLAlchemy writes UTC datetimes into SQLite while the Node adapter currently exposes timezone-less SQLite timestamp strings. JavaScript date parsing can interpret those strings using the host's local timezone, which can make fresh data look stale on a UTC+8 host.

Decision: SQLite timestamp storage remains unchanged, but Node normalizes Control timestamp result columns to explicit UTC ISO-8601 before higher-level API logic sees them. Freshness and expiry calculations therefore operate only on explicit instants.

## Replace long blocking snapshot refresh requests

The hosted Control API can hold `GET /api/guild-state` open for up to 75 seconds while waiting for a wake-triggered refresh. With Cloudflare and an always-on local worker, this hides failures and produces a poor operator experience.

Decision: stale `guild-state` requests enqueue or deduplicate refresh work and return `202` promptly. The browser performs bounded short polling until state becomes fresh or an explicit timeout/unavailable state is reached.

## Keep the current local topology

The failure does not justify rewriting the API into Python or replacing shared SQLite.

Decision: retain Cloudflare Tunnel, loopback Node web/API, the separate Python bot process, shared local SQLite, separate bot and website production lines, and Vercel/Neon as temporary rollback infrastructure. Repair the synchronization protocol instead of replacing the surrounding deployment.
