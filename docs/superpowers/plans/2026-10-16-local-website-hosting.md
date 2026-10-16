# Local Website Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Move the Rob-bot website and Control runtime from Vercel + Neon to the user's M4 Mac while preserving the existing Control security model and sharing the bot's local SQLite database.

**Architecture:** Run a loopback-only Node HTTP service from the website production line, use Node 26 `node:sqlite` to access the bot checkout's existing SQLite database, and publish the site through a named Cloudflare Tunnel. Keep the bot and website in separate checkouts and keep Vercel/Neon intact as rollback infrastructure until the local cutover is verified.

**Tech Stack:** Node.js 26, `node:sqlite`, existing ES modules/Vercel-style handlers, SQLite/Alembic schema, Cloudflare Tunnel, macOS LaunchAgent.

**Spec:** `docs/superpowers/specs/2026-10-16-local-website-hosting.md`

## Global Constraints

- Do not merge the bot and website production lines.
- Do not touch the main checkout's `.visual-companion/` work.
- Do not place Discord, Cloudflare, database, OAuth, or session credentials in Git, relay issues, process arguments, or generated plist files.
- The local HTTP origin binds to `127.0.0.1` by default and is exposed publicly only through Cloudflare Tunnel.
- Preserve Discord OAuth, CSRF, same-origin checks, browser permission checks, bot-side permission re-checks, idempotency, rate limiting, and fresh-snapshot gating.
- Do not mutate schema during normal web startup. Alembic remains the schema authority.
- Do not bypass relay restrictions on `launchctl`.
- Do not delete or disable Vercel or Neon production resources in this plan.
- Local commits after a task is green are allowed by this plan. Do not push, merge, or publish a shared branch without separate authorization.

## Review Focus

- SQLite and PostgreSQL timestamp/JSON semantics must not change session expiry, snapshot freshness, or activity ordering.
- SQLite contention with the running bot must fail safely and use a bounded busy timeout.
- Static serving must never escape `docs-site` or dynamically import arbitrary modules.
- Always-on worker mode must remove only the obsolete wake dependency, not fresh-state safety.
- Proxy/public-origin handling must keep Secure cookies, OAuth redirect URLs, CSRF origin validation, and callback paths correct behind Cloudflare.

---

### Task 1: Local SQLite Control backend and always-on worker mode

**Files:**
- Create: `api/_lib/sqlite-database.js`
- Modify: `api/_lib/control.js`
- Test: `web-tests/control-local-sqlite.test.js`
- Test: `web-tests/control-foundation-contract.test.js`

**Interfaces:**
- Produces: `createSqliteTaggedClient(path)` with the same asynchronous tagged-template call shape used by existing `database()` callers.
- Produces: database selection where `CONTROL_SQLITE_PATH` selects SQLite and existing `DATABASE_URL`/`CONTROL_DATABASE_URL` retains Neon rollback support.
- Produces: `CONTROL_WORKER_MODE=always_on` causes `tryWakeControlWorker()` to return true without webhook delivery.

- [ ] **Step 1: Write failing SQLite adapter tests**

Cover real temporary SQLite execution for bound values, JSON columns, PostgreSQL `::json` and `::timestamptz` casts, 3-minute and 60-second interval expressions, named idempotency conflict handling, `RETURNING`, Date binding, and JSON decoding. Add an always-on wake test that proves no webhook is required.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test web-tests/control-local-sqlite.test.js`
Expected: FAIL because the local SQLite adapter/always-on behavior does not exist.

- [ ] **Step 3: Implement the minimum adapter and backend selection**

Use `node:sqlite` `DatabaseSync`, `PRAGMA foreign_keys=ON`, and a 5000 ms `busy_timeout`. Translate only the PostgreSQL constructs currently present in the Control queries, bind every dynamic value through SQLite parameters, normalize Date values to UTC SQLite-compatible timestamps, decode returned `*_json` strings, and leave Neon behavior unchanged when no SQLite path is configured.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test web-tests/control-local-sqlite.test.js web-tests/control-foundation-contract.test.js`
Expected: PASS.

- [ ] **Step 5: Run full web tests**

Run: `npm run test:web`
Expected: PASS with zero failures.

- [ ] **Step 6: Commit Task 1 locally**

Commit message: `feat: support local sqlite control runtime`

---

### Task 2: Loopback-only local HTTP server

**Files:**
- Create: `server/local-server.js`
- Test: `web-tests/local-server.test.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `createLocalServer(options)` for tests and `npm run start:local` for production.
- Consumes: existing handlers under the explicit `/api` allow-list.

- [ ] **Step 1: Write failing local-server tests**

Exercise `/healthz`, `/`, `/control`, `/commands`, `/handbook`, a representative static asset, one API handler dispatch, unknown route behavior, encoded traversal attempts, non-allow-listed API paths, loopback defaults, and forwarded/public origin compatibility.

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test web-tests/local-server.test.js`
Expected: FAIL because the local server does not exist.

- [ ] **Step 3: Implement `createLocalServer` and CLI startup**

Use Node `http`, an explicit API module allow-list, canonical static path resolution confined to `docs-site`, existing clean-route mappings, MIME types needed by the current site, and safe 404/405 behavior. Default to `127.0.0.1:8787`. Do not expose repository files outside `docs-site`.

- [ ] **Step 4: Add the production script**

Add `start:local` and include `server` in the web syntax-check script.

- [ ] **Step 5: Run focused and full web verification**

Run: `node --test web-tests/local-server.test.js`
Expected: PASS.

Run: `npm run check:web`
Expected: PASS.

Run: `npm run test:web`
Expected: PASS with zero failures.

- [ ] **Step 6: Commit Task 2 locally**

Commit message: `feat: add local web control server`

---

### Task 3: macOS website service configuration

**Files:**
- Create: `scripts/local_web_hosting.mjs`
- Test: `web-tests/local-web-hosting.test.js`
- Create: `docs/operations/local-website-hosting.md`
- Modify: `.env.example` only if safe public local-runtime keys are missing.

**Interfaces:**
- Produces: `install`, `check`, and `run` operations for local website hosting.
- Produces: external `~/.config/marwie-server-bot/web-production.env`, LaunchAgent plist, and durable log paths without embedding secret values.
- Consumes: website checkout path and the bot checkout SQLite path.

- [ ] **Step 1: Write failing hosting-helper tests**

Test environment parsing without value disclosure, template creation without overwrite, owner-only `0600` env mode, absolute-path plist rendering, loopback defaults, expected Node command, log paths, no OAuth secret in plist, database existence checks, and clear failure for missing required non-secret configuration.

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test web-tests/local-web-hosting.test.js`
Expected: FAIL because the hosting helper does not exist.

- [ ] **Step 3: Implement helper and operator documentation**

Follow the existing bot local-hosting pattern. `install` renders files but never activates services. `check` validates without printing secret values. `run` loads the external environment and replaces itself with the local Node server process. Document Cloudflare named-tunnel setup, OAuth callback requirements, rollback, and the explicit `launchctl` operator boundary.

- [ ] **Step 4: Run focused and full web verification**

Run: `node --test web-tests/local-web-hosting.test.js`
Expected: PASS.

Run: `npm run check:web`
Expected: PASS.

Run: `npm run test:web`
Expected: PASS with zero failures.

- [ ] **Step 5: Commit Task 3 locally**

Commit message: `ops: add local website hosting service`

---

### Task 4: Integration verification and cutover preparation

**Files:**
- Modify only files named by earlier tasks if verification exposes a defect. Any behavior change requires a RED test first.

**Interfaces:**
- Consumes: SQLite adapter, local HTTP server, hosting helper.
- Produces: a verified local deployment candidate and exact remaining operator steps.

- [ ] **Step 1: Install deterministic Node dependencies**

Run: `npm ci`
Expected: exit 0.

- [ ] **Step 2: Run web gates**

Run: `npm run check:web`
Expected: PASS.

Run: `npm run test:web`
Expected: PASS with zero failures.

- [ ] **Step 3: Run full repository build gate**

Run: `npm run build`
Expected: exit 0. If an unrelated pre-existing Python/toolchain failure appears, record it explicitly and do not misreport completion.

- [ ] **Step 4: Verify disposable SQLite integration**

Create a disposable database from current migrations or a minimal current-schema fixture, start the local server on loopback with test OAuth placeholders, and verify health/static/API database reads without exposing a public listener.

- [ ] **Step 5: Verify production SQLite readiness read-only**

Confirm the real bot database contains `control_actions`, `control_guild_snapshots`, and `control_sessions`, and confirm the local site can open it read-only for a harmless query. Do not write a production Control action until public OAuth is working.

- [ ] **Step 6: Install/render local web service files**

Run the helper `install` then `check`. Verify the environment file mode, plist parse, no secret leakage, loopback binding, and log destinations. Do not activate with `launchctl` through the relay.

- [ ] **Step 7: Configure Cloudflare as far as credentials allow**

Verify `cloudflared`. If account authorization is absent, run the supported login flow and stop at the browser/account approval boundary. After authorization, create a named tunnel, route the chosen stable hostname to `http://127.0.0.1:8787`, and render external tunnel configuration without exposing credentials.

- [ ] **Step 8: Public cutover smoke test after required operator approvals**

After Cloudflare authorization, final hostname selection, Discord OAuth callback registration, and LaunchAgent activation, verify public pages, OAuth login, Control state read, and one low-risk idempotent Control write end to end.

- [ ] **Step 9: Final whole-branch verification**

Run: `git diff --check`
Expected: no output.

Run: `npm run check:web && npm run test:web` as separate relay commands because shell composition is not used.
Expected: both exit 0.

Do not push, merge, delete Vercel, or delete Neon as part of this task.
