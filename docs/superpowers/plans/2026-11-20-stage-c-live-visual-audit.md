# Stage C: Lean Live Visual Audit, Bounded Polish, and Safe Promotion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Visually inspect the upgraded Control routes and aligned public pages (`/commands`, `/handbook`) against `docs/superpowers/specs/2026-10-16-control-design-system.md` using a lean zero-write review server, fix only confirmed visual or accessibility drift via TDD, validate the integrated candidate in a temporary worktree, and safely promote the accepted SHA to local `web/rob-bot-site-production` and `ops/local-web-hosting-r1`.

**Architecture:** A small disposable review script (outside git in `<artifactDir>/scratch/audit-server.mjs`) imports `createLocalServer({ siteRoot, apiLoaders })` from `ops/local-web-hosting-r1/server/local-server.js` (reusing exact production static routing so `/control-app.js` and `/control.css` are never misrouted!) and injects read-only fixture API handlers populated once at startup from `/Users/aedwon/Documents/Projects/marwie-server-bot/data/marwie.db` via `{ readOnly: true, readBigInts: true }`, closing the database handle immediately before listening. This allows full signed-in auditing BEFORE promotion with zero writes to production SQLite.

**Tech Stack:** Existing `server/local-server.js`, `api/_lib/snapshot-compat.js`, `node:sqlite` (read-only), T3 Code browser preview tools (`preview_status`, `preview_open`, `preview_navigate`, `preview_resize`, `preview_set_appearance`, `preview_snapshot`, `preview_act`, `preview_evaluate`, `t3_preview_close`), `node:test`.

**Master Plan:** `docs/superpowers/plans/2026-11-20-website-improvements-critical-path.md`
**Design System:** `docs/superpowers/specs/2026-10-16-control-design-system.md`

## Global Constraints

- Never write to `/Users/aedwon/Documents/Projects/marwie-server-bot/data/marwie.db`. Open read-only once to read `control_guild_snapshots` JSON into memory, then close the handle immediately before starting the review HTTP server.
- Never authenticate a browser session against live `127.0.0.1:8787` during automated audit.
- Keep polish strictly bounded to **confirmed contract failures** against `2026-10-16-control-design-system.md` or WCAG 2.2 AA (no subjective redesign churn).
- Never use `git add -A`; always stage explicit named paths and inspect `git diff --cached --stat`.
- Verify fast-forward ancestry and test the integrated merge in a temporary detached worktree BEFORE moving local `web/rob-bot-site-production` or merging into the live served `ops/local-web-hosting-r1` worktree.
- Close opened preview tabs and stop the temporary audit server before finishing. Never push without explicit user approval.

## File Structure

- **Scratch (outside repo):** `<artifactDir>/scratch/audit-server.mjs` — ~70-line launcher importing `createLocalServer` and `normalizeSnapshotChannelCapabilities`, serving `wt-control-redesign-finish-r1/docs-site` on `127.0.0.1:8788`.
- **Modify (only for confirmed drift):** targeted `docs-site/` files + TDD regression assertions in `web-tests/` + synchronized `?v=` asset bumps on `web/control-redesign-finish-r1`.
- **Modify:** `docs/superpowers/decisions/2026-11-20-website-public-and-analytics-alignment.md` — record isolated zero-write acceptance rule, resolved drift findings, and (in a follow-up note or report after promotion) promoted SHAs.

---

### Task 1: Launch Lean Zero-Write Review Server (Reusing `createLocalServer`)

**Files:**
- Create (scratch only, outside git): `<artifactDir>/scratch/audit-server.mjs`

**Interfaces:**
- Consumes:
  - `/Users/aedwon/Documents/Projects/marwie-server-bot-wt-local-web-hosting-r1/server/local-server.js` (`createLocalServer`)
  - `/Users/aedwon/Documents/Projects/marwie-server-bot-wt-local-web-hosting-r1/api/_lib/snapshot-compat.js` (`normalizeSnapshotChannelCapabilities`)
  - Read-only snapshot row from `/Users/aedwon/Documents/Projects/marwie-server-bot/data/marwie.db` (`{ readOnly: true, readBigInts: true }`, closed immediately after reading `snapshot_json` into RAM)
- Produces: Loopback server at `http://127.0.0.1:8788` with exact API shapes expected by `docs-site/control-app.js`:
  - `GET /api/session`: returns `{ authenticated: true, user: { id: '1', username: 'AuditAdmin', avatar_url: null }, csrf_token: 'audit-csrf', guilds: [{ id: guildId, name: guildName, owner: true, permissions: '8' }] }` (or `{ authenticated: false, login_url: '/api/auth/start' }` when cookie `audit_mode=signed_out` is set via a helper endpoint `GET /__audit/mode?mode=live|empty_analytics|signed_out` that sets an in-memory mode persisting across API calls).
  - `GET /api/guild-state`: returns `{ guild_id: guildId, state: normalizedState, snapshot: { updated_at: new Date().toISOString(), worker_version, fresh: true, page_revisions: normalizedState.meta?.page_revisions || {} } }` (and in `empty_analytics` mode omits `state.analytics` to inspect the unavailable Analytics state cleanly).
  - `GET /api/activity`: returns `{ items: [...representative items...], next_cursor: null }` (preserving `{ items, next_cursor }` contract in `control-secondary.js:184`).
  - `POST /api/logout`: returns `200 { ok: true }`.
  - `POST /api/page-save` and `POST /api/action`: return `403 { error: 'Audit mode is read-only.' }`.

- [ ] **Step 1: Start `<artifactDir>/scratch/audit-server.mjs` and verify endpoints**

Confirm `http://127.0.0.1:8788/healthz` returns `{"ok":true}`, `/api/session` returns valid authenticated JSON with `csrf_token` and string `guild_id`, `/api/guild-state` returns `{ guild_id, state, snapshot }` with `page_revisions`, and `/control-app.js` returns `text/javascript` (confirming static routing is intact).

---

### Task 2: Lean Visual & Contract Audit Sweep

**Files:**
- Read-only browser inspection of `http://127.0.0.1:8788`.

**Interfaces:**
- Produces: Concise **Drift Ledger** listing only confirmed Design System or accessibility contract failures (route, viewport, theme, spec citation, computed/visual evidence).

- [ ] **Step 1: Inspect key representative Control routes + both public pages via `preview_*`**

Open one preview tab via `preview_status` -> `preview_open` (`target: { kind: 'environment-port', port: 8788 }`).

**Focused route set (covers every shell template, component family, and changed surface without 400-screenshot bloat):**
1. `/control/analytics` (read + edit + `empty_analytics` unavailable state — verifies new v2 metrics, coverage chips, local time, chart axis size `>= 12px`, non-clipping inspector, and range focus retention)
2. `/control/community/reputation` (read + edit — verifies tier rows, form fields, floating save bar)
3. `/control/community/quizzes` (read + edit — verifies empty-state / question bank list)
4. `/control/content/announcements` (verifies composer + right-panel Discord dark preview)
5. `/control/utilities/ticket-configuration` (read + edit — verifies summary table & stacked mobile rows)
6. `/control/utilities/notification-roles` (read + edit — verifies emoji combobox + no inert toggle)
7. `/control/mappings/channels` (read + edit — verifies no-context layout + 3/2/1 column grid)
8. `/control/activity` and `/control/commands` (verifies secondary list/table layouts)
9. `/` in `signed_out` mode (verifies single sidebar Discord CTA, zero body duplicate)
10. `/commands` (desktop default, active search + Escape with open drawer, `<dialog>` open & Escape restore, mobile drawer)
11. `/handbook` (desktop light/dark, setup checklist, FAQ, mobile drawer open & closed `inert` check)

*(If any shared shell/layout CSS in `control.css` or `control-features.css` is edited in Task 3, spot-check the remaining Control routes before finalizing.)*

**Required viewport/theme checks:**
- `1440x900` Light & Dark (`preview_set_appearance` `'light'` / `'dark'`, verifying labeled nav `240px`, center, `304px` context column, and dark token parity)
- `1024x900` Light (verifying `data-nav-mode="rail"` `64px` + `data-context-mode="column"` `304px`, and noting rail hover transitions to expanded nav + context drawer per `control-shell-layout.js:51`)
- `960x900` Light (below `1016px` `contextRail` threshold — verifying `data-nav-mode="rail"` + `data-context-mode="drawer"` + page-header Context trigger opening/closing cleanly)
- `390x844` Light & Dark (verifying topbar, drawers closed/open, stacked tables, `>= 44px` hit heights, `16px` input font size, Analytics chart horizontal scroll + stationary inspector, zero page horizontal overflow)

**Quick `preview_evaluate` contract checks on inspected routes:**
- `document.documentElement.scrollWidth <= window.innerWidth`
- `document.fonts.check('500 14px Figtree')` is `true` on Control, Commands, and Handbook
- No visible text or SVG `<text>` bounding height renders below `12px` (or `< 13px` routine UI on Commands)
- Desktop `#commandsNavDrawer` and `#sidebar` are NOT `inert`; closed mobile drawers ARE `inert` + `aria-hidden="true"`
- Keyboard Tab/Escape check on Analytics range buttons & chart points, Commands `<dialog>` & drawer with live search, and Handbook drawer.

---

### Task 3: Bounded Drift Fixes (TDD) and Re-Check

**Files:**
- Modify (only if Drift Ledger is non-empty): affected `docs-site/` files, corresponding `web-tests/` regression tests, and bumped `?v=` versions.
- Modify: `docs/superpowers/decisions/2026-11-20-website-public-and-analytics-alignment.md`.

**Interfaces:**
- Produces: Zero remaining confirmed Design System violations, clean full test suite on `web/control-redesign-finish-r1`, and updated decision record.

- [ ] **Step 1: Fix confirmed Drift Ledger items via TDD**

For each confirmed violation:
1. Write a failing test first and verify RED.
2. Apply the minimal CSS/JS/HTML fix (keeping `400/500/600` weights, `>= 12px`/`13px` floors, and zero forbidden classes).
3. Bump `?v=` on any edited asset across HTML entrypoints, ESM imports, and pinned tests.
4. Re-capture every affected route/viewport on `127.0.0.1:8788` (plus any shared-CSS sibling routes if `control.css` changed).

- [ ] **Step 2: Clean up audit resources and run full gates on `web/control-redesign-finish-r1`**

1. Close the preview tab via `t3_preview_close`.
2. Stop `<artifactDir>/scratch/audit-server.mjs`.
3. Record Stage C audit results and isolated zero-write acceptance rationale in `docs/superpowers/decisions/2026-11-20-website-public-and-analytics-alignment.md`.
4. Run full gates:
   ```bash
   cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1
   TZ=Asia/Manila npm run check:web
   TZ=Asia/Manila npm run test:web
   git diff --check
   ```
5. Stage ONLY explicit named paths and commit on `web/control-redesign-finish-r1`:
   ```bash
   git add <explicit list of modified/new files>
   git diff --cached --stat
   git commit -m "fix(control): resolve visual audit drift and record acceptance"
   ```

---

### Task 4: Pre-Promotion Integrated Verification, Safe Promotion, and Exact Live Smoke

**Files:**
- Git branch promotion only (no `main`, Python, or `marwie.db` touches).

**Interfaces:**
- Consumes: Accepted commit SHA on `web/control-redesign-finish-r1`.
- Produces: Validated fast-forward on local `web/rob-bot-site-production` and clean merge on `ops/local-web-hosting-r1`.

- [ ] **Step 1: Verify ancestry and test integrated merge in a disposable detached worktree BEFORE touching live checkouts**

```bash
cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1
ACCEPTED_SHA=$(git rev-parse HEAD)
git merge-base --is-ancestor web/rob-bot-site-production "$ACCEPTED_SHA"

TMP_WT=$(mktemp -d /tmp/rob-web-verify-XXXXXX)
git worktree add --detach "$TMP_WT" ops/local-web-hosting-r1
cd "$TMP_WT"
git merge --no-edit "$ACCEPTED_SHA"
TZ=Asia/Manila npm run check:web
TZ=Asia/Manila npm run test:web
git diff --check
cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1
git worktree remove --force "$TMP_WT"
```
Expected: clean merge, 0 test failures (verifying both finish UI AND local SQLite/202-refresh tests together BEFORE modifying live `wt-local-web-hosting-r1`!).

- [ ] **Step 2: Fast-forward local `web/rob-bot-site-production` and merge into `ops/local-web-hosting-r1`**

```bash
cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1
git branch -f web/rob-bot-site-production HEAD

cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-local-web-hosting-r1
git merge --no-ff web/rob-bot-site-production -m "merge: integrate Analytics v2, public pages alignment, and visual audit polish"
TZ=Asia/Manila npm run check:web
TZ=Asia/Manila npm run test:web
git diff --check
git status -sb
```

- [ ] **Step 3: Run exact read-only live verification against `http://127.0.0.1:8787`**

Check every exact accepted asset URL, response `Content-Type`, and absence of `/styles.css` on `/commands` (substitute final exact `?v=` versions from Stage A–C):
```bash
curl -sf http://127.0.0.1:8787/healthz
curl -sf http://127.0.0.1:8787/ | grep -F "/control.css?v=<FINAL>"
curl -sf http://127.0.0.1:8787/ | grep -F "/control-features.css?v=<FINAL>"
curl -sf http://127.0.0.1:8787/ | grep -F "/control-app.js?v=<FINAL>"
curl -sf http://127.0.0.1:8787/commands | grep -F 'data-preference="system"'
curl -sf http://127.0.0.1:8787/commands | grep -F "/commands.css?v=<FINAL>"
! curl -sf http://127.0.0.1:8787/commands | grep -F "/styles.css"
curl -sf http://127.0.0.1:8787/handbook | grep -F "Figtree"
curl -sf http://127.0.0.1:8787/handbook | grep -F "/styles.css?v=<FINAL>"
curl -sI http://127.0.0.1:8787/styles.css | grep -i "content-type: text/css"
curl -sf http://127.0.0.1:8787/api/session
```

- [ ] **Step 4: Handoff to operator**

Report the actual promoted commit SHAs (generated in Step 2), test counts across both worktrees, and live smoke results. Ask the operator explicitly whether they want:
1. A restart of `com.aedwon.marwie-server-web` (`launchctl kickstart -k gui/$(id -u)/com.aedwon.marwie-server-web`) to also load `8510569`'s UTC SQLite / 202 API handlers into the running Node process (with post-restart runtime verification).
2. Pushing `web/control-redesign-finish-r1`, `web/rob-bot-site-production`, and `ops/local-web-hosting-r1` to `origin`.
