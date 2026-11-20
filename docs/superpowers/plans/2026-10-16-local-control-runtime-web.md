# Local Control Runtime Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local Control read shared SQLite time correctly and refresh stale server state quickly without a 75-second server-side wait.

**Architecture:** Normalize SQLite Control timestamps to explicit UTC at the Node adapter boundary. When guild state is stale or missing, `GET /api/guild-state` reuses a recent active refresh action when possible, otherwise queues one, then immediately returns HTTP 202. The browser polls once per second for at most 10 attempts and shows a real unavailable error if fresh state never arrives. Hosted webhook wake behavior remains intact; local `always_on` wake stays a no-op because the bot worker is already running.

**Tech Stack:** Node.js local runtime, ES modules, `node:sqlite`, existing Vercel-style handlers, node:test.

**Spec:** `docs/superpowers/specs/2026-10-16-local-control-runtime.md`

## Global Constraints

- Website/API changes stay in the website production line/local hosting worktree.
- Preserve Vercel/Neon behavior when local SQLite/always-on mode is not selected.
- Preserve Discord OAuth, sessions, CSRF, same-origin checks, guild authorization, action idempotency and fresh-snapshot mutation gating.
- SQLite Control timestamps exposed to JavaScript must be explicit UTC (`...Z`).
- Keep the existing three-minute snapshot freshness boundary.
- `GET /api/guild-state` must never wait/sleep for the bot.
- Stale/missing state returns 202 promptly and never enables mutations.
- Browser refresh polling is fixed at about one second and bounded to 10 attempts.
- Do not alter Vercel/Neon rollback resources.
- No schema change is authorized.
- Do not commit or push unless separately authorized.

## Review Focus

- Asia/Manila timezone parsing must not make fresh UTC SQLite rows look eight hours old. Task 1 tests this.
- Repeated stale reads must reuse a recent queued/claimed `refresh_snapshot` instead of building a backlog. Task 2 tests this.
- A stale claimed refresh must not block retries forever; only a recent active refresh (30 seconds or newer) is reused. Task 2 tests this.
- Repeated 202 responses must stop after 10 attempts and render an unavailable state. Task 3 tests this.
- Already-fresh state must remain the fast path with no refresh action created. Task 2 tests this.

---

### Task 1: Normalize SQLite Control timestamps to UTC

**Files:**
- Modify: `api/_lib/sqlite-database.js`
- Modify: `web-tests/control-local-sqlite.test.js`
- Modify: `api/_lib/control.js` only if a small defensive timestamp helper is needed.

**Interfaces:**
- Produces: timestamp-shaped Control columns (`*_at`) returned from SQLite as ISO-8601 UTC strings with `T` and trailing `Z`.
- Preserves: JSON decoding and BigInt conversion.
- Preserves: current SQLite storage format for bound Python/Node dates.

- [ ] **Step 1: Write the timezone regression test**

Under `TZ=Asia/Manila`, insert/read a known SQLite UTC timestamp, assert the decoded value has explicit UTC, assert a current snapshot is fresh, and assert one older than three minutes is stale.

- [ ] **Step 2: Verify RED**

Run: `TZ=Asia/Manila node --test web-tests/control-local-sqlite.test.js`
Expected: FAIL because rows are currently timezone-less.

- [ ] **Step 3: Implement narrow adapter normalization**

Normalize only timestamp columns at row decode time. Convert SQLite UTC text such as `YYYY-MM-DD HH:MM:SS[.sss]` to a valid UTC ISO string. Do not reinterpret arbitrary strings or JSON values.

- [ ] **Step 4: Verify GREEN**

Run: `TZ=Asia/Manila node --test web-tests/control-local-sqlite.test.js web-tests/control-foundation-contract.test.js`
Expected: PASS.

---

### Task 2: Immediate 202 guild-state refresh with safe deduplication

**Files:**
- Modify: `api/guild-state.js`
- Create: `web-tests/control-guild-state-refresh.test.js`

**Interfaces:**
- Fresh response: HTTP 200 with the existing `{ guild_id, state, snapshot }`.
- Refreshing response: HTTP 202 with `{ guild_id, status: "refreshing", retry_after_ms: 1000 }` and `Retry-After: 1`.
- Reuses an existing `refresh_snapshot` for the same guild/actor when status is `queued` or `claimed` and it was created within the last 30 seconds.
- If no recent active refresh exists, queues one using the existing idempotent insert path and attempts the configured wake transport.

- [ ] **Step 1: Write failing endpoint tests**

Cover:
- fresh snapshot returns 200 and creates no refresh action;
- stale/missing snapshot returns 202 immediately;
- repeated requests reuse a recent queued refresh;
- repeated requests reuse a recent claimed refresh;
- a claimed refresh older than 30 seconds does not suppress a new retry;
- concurrent/same-bucket inserts remain protected by the existing idempotency constraint;
- `always_on` mode does not require a webhook;
- webhook wake failure still returns 202 instead of holding the request open;
- existing invalid-session/guild behavior remains unchanged.

- [ ] **Step 2: Verify RED**

Run: `node --test web-tests/control-guild-state-refresh.test.js`
Expected: FAIL because the endpoint currently waits up to 75 seconds.

- [ ] **Step 3: Implement the non-blocking endpoint**

Remove `waitForFreshSnapshot()` and all request-path sleeps. Before inserting, query for a recent active refresh action for the same guild/actor. Reuse it if present; otherwise use the existing insert/idempotency path. Attempt wake only according to `CONTROL_WORKER_MODE`, then return 202 immediately.

- [ ] **Step 4: Verify GREEN**

Run: `node --test web-tests/control-guild-state-refresh.test.js web-tests/control-actions.test.js`
Expected: PASS.

---

### Task 3: Simple bounded browser polling and error state

**Files:**
- Modify: `docs-site/control-api.js`
- Modify: `docs-site/control-app.js`
- Modify: `web-tests/control-api-client.test.js`
- Modify: `web-tests/control-main-focus-ux.test.js` only for the established load-status contract.

**Interfaces:**
- `loadGuildState(guildId, options?)` keeps existing callers valid.
- On HTTP 200, return state immediately.
- On HTTP 202 with `status: "refreshing"`, wait 1000 ms and retry.
- Stop after at most 10 refreshing responses.
- Exhaustion throws: `Rob-bot could not provide fresh server state. Try again in a moment.`
- Tests may inject `fetchImpl` and `delay` so they run instantly.

- [ ] **Step 1: Write failing API-client tests**

Cover 202→200 success, repeated 202 exhaustion at exactly the configured bound, and immediate failure for ordinary 4xx/5xx errors.

- [ ] **Step 2: Write the Control load-error test**

Assert that initial guild-state failure clears/leaves `guildState` and `snapshot` non-actionable, replaces `Loading fresh server state…` with a bad/unavailable status, and renders the disabled state.

- [ ] **Step 3: Verify RED**

Run: `node --test web-tests/control-api-client.test.js web-tests/control-main-focus-ux.test.js`
Expected: FAIL on the new retry/error assertions.

- [ ] **Step 4: Implement fixed bounded polling**

Keep the retry loop only in `control-api.js`. Use one-second delay and 10 attempts; do not add exponential backoff or another timer abstraction. In `control-app.js`, catch initial load failure, keep state unavailable, set a clear bad status, and render.

- [ ] **Step 5: Verify GREEN**

Run: `node --test web-tests/control-api-client.test.js web-tests/control-main-focus-ux.test.js web-tests/control-guild-state-refresh.test.js`
Expected: PASS.

---

### Task 4: Cross-runtime and final verification

**Files:**
- Modify: `docs/operations/local-website-hosting.md` only if the final behavior is not already documented.
- No production DB test writes until the explicit smoke test.

- [ ] **Step 1: Verify shared SQLite compatibility with one disposable database**

Create one temporary DB at current schema. Use the Python Control repository to write a representative snapshot and queued refresh action. Point the Node SQLite adapter at that same file under `TZ=Asia/Manila` and verify the snapshot is explicit UTC/fresh and the action fields are readable. Do this as relay verification; do not build a new permanent mixed-language harness unless a failing compatibility case requires one.

- [ ] **Step 2: Run focused local-control tests**

Run: `TZ=Asia/Manila node --test web-tests/control-local-sqlite.test.js web-tests/control-guild-state-refresh.test.js web-tests/control-api-client.test.js web-tests/control-main-focus-ux.test.js web-tests/control-foundation-contract.test.js`
Expected: PASS.

- [ ] **Step 3: Run normal web gates**

Run separately: `npm run check:web` and `npm run test:web`.
Expected: both exit 0. Do not widen this repair solely to satisfy unrelated build-overlay or Python issues.

- [ ] **Step 4: Verify scope**

Run: `git diff --check` and `git status --short`.
Expected: only approved Control/local-hosting docs, API/client tests and source are changed; existing untracked `node_modules` artifacts remain unstaged.

- [ ] **Step 5: Verify local runtime config without printing secrets**

Confirm external web production env has `CONTROL_WORKER_MODE=always_on`. After the bot plan is green, confirm the bot production env is also set to `always_on`.

- [ ] **Step 6: End-to-end smoke after explicit operator restart**

Restart bot and web through the existing operator `launchctl` boundary. Verify public `/healthz` 200, Discord OAuth session, Control reaches current state, one low-risk Control write is queued/consumed/reflected, and after more than 60 seconds the state remains fresh without a Discord wake webhook. Keep Vercel/Neon untouched.
