# Stage A: Control Analytics v2 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `/control/analytics` to display Rob-bot's live `schema_version: 2` analytics snapshots with accurate v2 metric semantics, per-range coverage chips, local-time formatting, and an accessible interactive operational-events chart while keeping flat and unversioned ranged v1 snapshots working unchanged.

**Architecture:** Pure formatting, coverage selection, duration formatting, and SVG rendering helpers live in `docs-site/control-analytics.js`. The chart stays a single operational-events line graph (no multi-series switcher while passive telemetry is disabled) using `role="group"` on `<svg>` so focusable points remain accessible to screen readers and keyboard/touch users, with a dedicated `.analytics-chart-scroll` horizontal wrapper keeping the inline bucket breakdown inspector visible at all scroll positions. Work runs strictly on `web/control-redesign-finish-r1` until Stage C acceptance.

**Tech Stack:** Vanilla ES modules (`docs-site/control-analytics.js`), CSS custom properties (`docs-site/control.css`, `docs-site/control-features.css`), native `Intl.DateTimeFormat`, inline SVG, Node.js `node:test`.

**Master Plan:** `docs/superpowers/plans/2026-11-20-website-improvements-critical-path.md`
**Design System:** `docs/superpowers/specs/2026-10-16-control-design-system.md`

## Global Constraints

- Before Task 1, move the four untracked plan files from `wt-local-web-hosting-r1/docs/superpowers/plans/` into `wt-control-redesign-finish-r1/docs/superpowers/plans/` and commit them on `web/control-redesign-finish-r1` using explicit file paths (never `git add -A`).
- Execute all Stage A edits in `/Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1` on branch `web/control-redesign-finish-r1`. Never edit `main`, Python code, or write to `/Users/aedwon/Documents/Projects/marwie-server-bot/data/marwie.db`.
- Preserve Design System contracts: paper/ink/sky semantic tokens, Figtree weights strictly in `{400, 500, 600}`, numeric `font-size >= 12px` (`13px / 18px` on `.control-stat-row dt` and `.control-state-chip`), `font-variant-numeric: tabular-nums` on all counts/timestamps/axes, and text+tone status chips with no leading dots.
- Preserve forbidden-string contracts (`control-legacy-removal.test.js`, `control-stage3-reconciliation.test.js`, `control-analytics-workflows.test.js`, `control-uiux-refinements-r3.test.js`): never introduce `analytics-dashboard`, `analytics-metrics`, `analytics-stat`, `analytics-metric`, `Build Help`, `correct-answer count`, `analytics-chart-bars`, `analytics-series-table`, `View chart data`, `<details`, `control-visually-hidden`, or `display: none !important;`.
- Preserve edit-mode Context contract (`control-route-render-contract.test.js:155-171`): edit mode Context must NOT render `<dt>Channel</dt>`.
- Preserve backward compatibility for both flat v1 snapshots (7 rows, no `<svg>`) and unversioned ranged v1 snapshots (7 rows, real-bucket line graph, 6 range buttons).
- Bump cache-busting versions together: `control.css?v=32`, `control-features.css?v=16`, `control-app.js?v=30`, `control-analytics.js?v=21`.
- Do not push to remote.

## File Structure

- **Create:** `docs/superpowers/decisions/2026-11-20-website-public-and-analytics-alignment.md` — records local-time display reversal and the 8-field v2 operational event total (with `quiz_correct` kept out of totals).
- **Create:** `web-tests/control-analytics-v2.test.js` — focused unit and interaction tests for v2 metrics, per-range coverage without wrong-range fallback, null/partial/zero passive telemetry, ticket duration edge cases, DST/cross-year local-time formatting (`locale: 'en-US'`), accessible chart points + inspector, and range focus retention.
- **Modify:** `docs-site/control-analytics.js` — v2 detection, pure formatting/coverage helpers, v2 metric sections, coverage list, accessible single-series chart + outside-scroller inspector, focus-retaining interaction controller, and updated Context panel.
- **Modify:** `docs-site/control.css` — add `.control-state-chip[data-tone="warning"]` and `[data-tone="info"]` (neutral inherits base `.control-state-chip`).
- **Modify:** `docs-site/control-features.css` — styles for `.analytics-coverage-list`, `.analytics-passive-section`, `.analytics-chart-scroll`, `.analytics-chart-inspector`, `13px` tabular SVG axis labels, and focusable chart points (weights strictly `400/500/600`, font sizes `>= 12px`).
- **Modify:** `docs-site/control.html`, `docs-site/commands.html`, `docs-site/control-app.js` — bump asset query versions (`control.css?v=32`, `control-features.css?v=16`, `control-app.js?v=30`, `control-analytics.js?v=21`).
- **Modify:** `web-tests/control-uiux-refinements-r3.test.js`, `web-tests/control-theme-surfaces.test.js`, `web-tests/control-legacy-removal.test.js`, `web-tests/control-stage3-reconciliation.test.js` — update superseded `UTC buckets` summary check and pinned asset versions.

---

### Task 1: Reconcile Plan Files, Record Decisions, and Render Visual Companion Mockup

**Files:**
- Move: `docs/superpowers/plans/2026-11-20-*.md` from `wt-local-web-hosting-r1` into `wt-control-redesign-finish-r1`
- Create: `docs/superpowers/decisions/2026-11-20-website-public-and-analytics-alignment.md`

**Interfaces:**
- Produces: Clean plan-file ownership on `web/control-redesign-finish-r1` (preventing merge collisions with `ops/local-web-hosting-r1`), recorded design reversals, and an inline visual proposal for `/control/analytics` v2.

- [ ] **Step 1: Move plan files onto `web/control-redesign-finish-r1` and write Stage A decisions**

Move the four untracked `docs/superpowers/plans/2026-11-20-*.md` files out of `wt-local-web-hosting-r1` into `wt-control-redesign-finish-r1/docs/superpowers/plans/` so `wt-local-web-hosting-r1` returns to a clean `git status`.

Create `docs/superpowers/decisions/2026-11-20-website-public-and-analytics-alignment.md` recording:
1. **Local-time Analytics display** (supersedes `2026-09-01-control-uiux-refinements-r3.md:59` X-axis UTC rule): range boundaries, bucket inspector timestamps, and `Last generated` render in the browser's local timezone with explicit `timeZoneName: 'short'`. Chart axis ticks use local time matching `bucket_granularity`, disambiguating DST folds by appending the short zone when formatted labels collide, and appending the year when a series crosses calendar years. Pure helpers accept `{ locale, timeZone }` for deterministic tests.
2. **Eight-field v2 operational activity total** (extends `2026-09-01-control-uiux-refinements-r3.md:54`): v2 buckets sum `moderation_cases + tickets_opened + tickets_closed + tickets_reopened + quiz_answers + anonymous_questions + anonymous_messages + reputation_events` (keeping `quiz_correct` strictly out of totals, used only for `quiz_accuracy`). V1 buckets lacking `tickets_reopened` and `anonymous_messages` automatically yield the exact 6-field R3 total.
3. **v2 metric & coverage rules**:
   - Coverage reads from `projection.coverage`; falls back to `analytics.coverage` ONLY for flat/unranged snapshots or when `projection.range_key === analytics.default_range` (never borrowing `7d` coverage for another range).
   - `Tickets closed` shows closure events, appending `(<N> distinct)` when `tickets_closed_distinct != null && tickets_closed_distinct !== tickets_closed`.
   - `Open tickets (current)` explicitly labels the point-in-time backlog.
   - `Median ticket close time` shows formatted duration when non-null, `No closures` when `tickets_closed === 0`, and `Unavailable` when `tickets_closed == null` or when `tickets_closed > 0 && ticket_median_close_seconds == null`.
   - Passive telemetry (`Human messages`, `Voice member minutes`) renders `Unavailable` when unavailable/null, `<N> (partial)` / `<N> min (partial)` when `status === 'partial'`, and `<N>` / `<N> min` when `status === 'complete'`. Multi-series passive chart switching is deferred (YAGNI) while passive telemetry is disabled in production; non-null passive counts still appear in the bucket breakdown inspector.

- [ ] **Step 2: Render concise Visual Companion mockup via `html_preview` + `html_render`**

Preview desktop light (`728px`), desktop dark (`728px`), and mobile (`390px`) mockups of `/control/analytics` v2 showing: range row, operational metrics `<dl>`, passive telemetry + coverage chips, and the operational-events chart with inline inspector below the scroll wrapper. Render inline via `html_render` before editing JS/CSS.

- [ ] **Step 3: Commit plans and decision record on `web/control-redesign-finish-r1`**

```bash
cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1
git add \
  docs/superpowers/plans/2026-11-20-website-improvements-critical-path.md \
  docs/superpowers/plans/2026-11-20-stage-a-analytics-v2-ui.md \
  docs/superpowers/plans/2026-11-20-stage-b-public-pages-alignment.md \
  docs/superpowers/plans/2026-11-20-stage-c-live-visual-audit.md \
  docs/superpowers/decisions/2026-11-20-website-public-and-analytics-alignment.md
git commit -m "docs(web): add website improvement plans and analytics v2 decisions"
```

---

### Task 2: Pure v2 Formatting, Coverage, and Metric Semantics (TDD)

**Files:**
- Create: `web-tests/control-analytics-v2.test.js`
- Modify: `docs-site/control-analytics.js:1-215`

**Interfaces:**
- Produces (exported from `docs-site/control-analytics.js`):
  - `isAnalyticsV2(snapshot, projection)` -> `boolean`
  - `selectAnalyticsCoverage(snapshot, projection)` -> `{ business_events, messages, voice } | null`
  - `formatDurationSeconds(seconds, { ticketsClosed } = {})` -> `string`
  - `formatLocalTimestamp(value, { locale, timeZone } = {})` -> `string`
  - `analyticsPageMarkup({ state, snapshot, selectedRange, locale, timeZone } = {})` -> `string`

- [ ] **Step 1: Write failing tests in `web-tests/control-analytics-v2.test.js`**

Cover all of the following with explicit `locale: 'en-US'` where formatting is asserted:
1. `formatDurationSeconds`: `0` -> `'0s'`, `45` -> `'45s'`, `185` -> `'3m 5s'`, `5400` -> `'1h 30m'`, `90000` -> `'1d 1h'`, `(null, { ticketsClosed: 0 })` -> `'No closures'`, `(null, { ticketsClosed: 3 })` -> `'Unavailable'`, `(null)` (absent `ticketsClosed`) -> `'Unavailable'`.
2. `formatLocalTimestamp`: `'2026-11-20T07:15:49Z'` with `{ locale: 'en-US', timeZone: 'Asia/Manila' }` contains `3:15 PM` and does NOT contain `\bUTC\b`.
3. `selectAnalyticsCoverage`:
   - Uses `projection.coverage` when present (e.g., `1d` complete vs `7d` unavailable).
   - When a non-default range (`1m`) has NO `projection.coverage`, returns `null` (does NOT borrow `7d` top-level `analytics.coverage`!).
   - When `projection.range_key === analytics.default_range` or flat snapshot has no `ranges`, falls back to `analytics.coverage`.
4. **v2 metrics & ticket semantics**:
   - Renders `Open tickets (current)` (identical across ranges), `Tickets reopened`, `Anonymous messages`, `Median ticket close time`.
   - `Tickets closed`: renders `4 (3 distinct)` when `tickets_closed: 4, tickets_closed_distinct: 3`, and plain `3` when `tickets_closed: 3, tickets_closed_distinct: 3`.
   - `quiz_correct` is never added into operational totals; `quiz_answers: 0, quiz_accuracy: null` -> `No answers`; `quiz_answers: 4, quiz_accuracy: 0` -> `0%`.
5. **Independent coverage families & passive telemetry**:
   - Disabled passive (`status: 'unavailable'`, `note: 'Passive telemetry disabled'`): renders `Unavailable` (never `0`) and shows the backend `note` verbatim without duplicating gap/drop counts.
   - Partial passive (`messages: partial`, `voice: unavailable` independently): `messages` renders `42 (partial)` with `Partial` chip; `voice` renders `Unavailable`; `covered_ratio: 1` with `dropped_events: 3` and `status: 'partial'` still marks `Partial`; `covered_ratio: 0` marked `partial` still marks `Partial`.
   - Complete zero passive (`status: 'complete'`, `human_messages: 0`, `voice_member_minutes: 0`): renders `0` and `0 min` with no `(partial)` tag.
   - Realistic `1d` fixture uses actual 1-hour buckets across 24 hours (not cloned 7d daily buckets).

- [ ] **Step 2: Run test to verify RED**

Run: `cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1 && TZ=Asia/Manila node --test web-tests/control-analytics-v2.test.js`
Expected: FAIL (new exports do not exist yet).

- [ ] **Step 3: Implement pure v2 helpers, metrics, coverage list, and Context updates in `docs-site/control-analytics.js`**

Key rules:
- `isAnalyticsV2(snapshot, projection)`: true when `Number(snapshot?.analytics?.schema_version) >= 2` or projection has any v2-only key (`open_ticket_backlog`, `ticket_median_close_seconds`, `tickets_reopened`, `anonymous_messages`, `coverage`, `human_messages`, `voice_member_minutes`). Flat and unversioned ranged v1 snapshots return `false` and emit the exact 7 legacy rows.
- `selectAnalyticsCoverage(snapshot, projection)`:
  ```js
  export function selectAnalyticsCoverage(snapshot, projection) {
    if (projection?.coverage && typeof projection.coverage === 'object') return projection.coverage;
    const analytics = snapshot?.analytics;
    if (!analytics?.coverage || typeof analytics.coverage !== 'object') return null;
    const hasRanges = Boolean(analytics.ranges && typeof analytics.ranges === 'object');
    const defaultRange = String(analytics.default_range || '7d');
    if (!hasRanges || projection?.range_key === defaultRange) return analytics.coverage;
    return null;
  }
  ```
- Coverage detail formatting (`coverageDetail(entry)`):
  - If `entry?.note`: return `String(entry.note)` verbatim (avoiding duplicate gap/drop text already embedded by backend).
  - Otherwise, if `entry?.status === 'complete' && !entry.gap_count && !entry.dropped_events`: return `''`.
  - Otherwise build concise parts: `${Math.round(Number(entry.covered_ratio || 0) * 100)}% covered`, plus `${entry.gap_count} gap(s)` if `gap_count > 0`, plus `${entry.dropped_events} dropped` if `dropped_events > 0`.
- Coverage chip tones: `complete` -> `data-tone="good"` (`Complete`), `partial` -> `data-tone="warning"` (`Partial`), `unavailable` -> no `data-tone` (inherits base neutral `.control-state-chip`, label `Unavailable`). Text + tone only, no leading dot.
- `formatDurationSeconds(seconds, { ticketsClosed } = {})`:
  - If `seconds == null || !Number.isFinite(Number(seconds))`: return `ticketsClosed === 0 ? 'No closures' : 'Unavailable'`.
  - Format rounded `Math.max(0, Math.round(Number(seconds)))` cleanly into `Ns`, `Nm [Ns]`, `Nh [Nm]`, or `Nd [Nh]`.
- Context panel (`renderContext`): keep `<dt>Channel</dt>` hidden in `edit` mode (`state?.mode !== 'edit'`), keep `Send permission`, add `Last generated` in local time when `generated_at` exists, and keep `Data source` accurate to v2 business events + passive telemetry availability.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run: `cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1 && TZ=Asia/Manila node --test web-tests/control-analytics-v2.test.js web-tests/control-analytics-workflows.test.js web-tests/control-route-render-contract.test.js`
Expected: PASS.

---

### Task 3: Accessible Operational-Events Chart, DST/Cross-Year Local Ticks, Non-Clipping Inspector, and Range Focus Retention (TDD)

**Files:**
- Modify: `web-tests/control-analytics-v2.test.js`
- Modify: `web-tests/control-uiux-refinements-r3.test.js:41-55`
- Modify: `docs-site/control-analytics.js:90-376`

**Interfaces:**
- Produces:
  - Single operational-events SVG chart (`role="group"`, `<desc id="analytics-line-chart-summary">`, `viewBox="0 0 640 264"`, `13px` tabular axis labels) inside `.analytics-chart-scroll`
  - Non-clipping `<div class="analytics-chart-inspector" data-analytics-inspector aria-live="polite">` OUTSIDE `.analytics-chart-scroll` inside `<figure class="analytics-chart">`
  - Interactive focusable points (`tabindex="0"`, `role="button"`, `Enter`/`Space`/`ArrowLeft`/`ArrowRight`/`Home`/`End`, pointer/touch click/hover) with per-bucket breakdown (showing non-null passive `Human messages` / `Voice minutes` when present)
  - Focus restoration on `[data-analytics-range]` clicks after `rerender()` (overriding `control-app.js:297`'s `shell.main.focus()`).

- [ ] **Step 1: Add failing chart, DST/granularity, inspector, and focus tests to `web-tests/control-analytics-v2.test.js`**

Test:
1. **Eight-field v2 bucket total** counts `tickets_reopened` + `anonymous_messages` and excludes `quiz_correct`; v1 bucket without those fields yields the identical 6-field sum.
2. **All bucket granularities & edge cases**:
   - `1d` (`hour`), `3d` (`6hour`), `7d`/`2w`/`1m` (`day`), `all` (`week` crossing Dec 2025 -> Jan 2026 includes year so ticks do not repeat ambiguously).
   - **DST fold disambiguation**: two hourly buckets in `America/New_York` on `2026-11-01T05:30:00Z` (`1:30 AM EDT`) and `2026-11-01T06:30:00Z` (`1:30 AM EST`) produce distinct x-axis tick labels (neither duplicates `Nov 1, 1:30 AM`).
   - Single-bucket series renders 1 point and 0 `<polyline>` elements; empty `series: []` omits the chart section cleanly.
3. **Accessible SVG structure & inspector outside scroller**:
   - `<svg class="analytics-line-chart"` uses `role="group"` (NOT `role="img"`, so focusable `<g role="button">` children remain exposed to assistive technology!).
   - `.analytics-chart-scroll` wraps `<svg>`, and `[data-analytics-inspector]` is a sibling AFTER `.analytics-chart-scroll` (so horizontal scrolling to the far-right bucket never scrolls the inspector out of view).
   - Focusing, clicking, or pressing `Enter`/`Space` on a `[data-analytics-point]` updates `[data-analytics-inspector]` with the bucket's local timestamp, operational event total, non-zero component counts, and non-null passive counts (`Human messages` / `Voice minutes` when present).
   - `ArrowRight`/`ArrowLeft`/`Home`/`End` moves focus across `[data-analytics-point]` elements and updates the inspector.
4. **Range switch focus retention & inspector reset**:
   - Activating `[data-analytics-range="1d"]` updates `selectedRange`, invokes `rerender()`, resets any active bucket selection cleanly, and restores focus to `root.querySelector('[data-analytics-range="1d"]')`.

- [ ] **Step 2: Run test to verify RED**

Run: `cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1 && TZ=Asia/Manila node --test web-tests/control-analytics-v2.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement chart, local-time tick disambiguation, outside-scroller inspector, and focus retention**

Key details in `docs-site/control-analytics.js`:
- `formatAxisTicks(series, indexes, { granularity, selectedRange, locale, timeZone })`:
  - Determine `isSubDay = granularity === 'hour' || granularity === '6hour' || (!granularity && (selectedRange === '1d' || selectedRange === '3d'))`.
  - Detect `spansYears`: compare local year (`Intl.DateTimeFormat(locale, { year: 'numeric', timeZone })`) of first and last bucket.
  - Format initial labels: sub-day -> `{ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }`; day/week -> `{ month: 'short', day: 'numeric', ...(spansYears ? { year: '2-digit' } : {}) }`.
  - If any two formatted tick labels are identical (e.g. DST fall-back fold), reformat the colliding ticks with `timeZoneName: 'short'` so every tick is unambiguous!
- SVG geometry: `viewBox="0 0 640 264"`, `margin = { top: 18, right: 20, bottom: 48, left: 54 }`. At `min-width: 600px`, `13px` SVG text scales to `>= 12.18px`. Use `r="10"` transparent hit circle (`analytics-line-hit`) + `r="4"` visible `.analytics-line-point` inside `<g class="analytics-point-group" tabindex="0" role="button" data-analytics-point="${index}" data-bucket-summary="..." aria-label="...">` so dense 24-point or 30-point series keep clean hit separation (`~19px` spacing at 30 points).
- Inspector `<div class="analytics-chart-inspector" data-analytics-inspector aria-live="polite">Select, focus, or hover a point to inspect bucket counts.</div>` placed OUTSIDE `.analytics-chart-scroll`, directly before `<figcaption>Activity count per supplied bucket from persisted server data.</figcaption>`.
- `<desc id="analytics-line-chart-summary">${series.length} real bucket${series.length === 1 ? '' : 's'} plotted for ${selectedRange === 'all' ? 'All time' : selectedRange}. Activity ranges from ${min} to ${max} operational events per supplied bucket.</desc>`
- In `installAnalyticsPageInteractions`:
  - `activatePoint(pointEl)` updates `[data-analytics-inspector]` text from `pointEl.getAttribute('data-bucket-summary')` and toggles `data-active="true"` on the active point only.
  - Wire `pointerenter`/`mouseover`, `focusin`, `click`, and `keydown` (`Enter`, `Space`, `ArrowLeft`, `ArrowRight`, `Home`, `End`) on `[data-analytics-point]`.
  - On `[data-analytics-range]` click: call `onRangeChange(value)`, call `rerender()`, then call `root.querySelector(`[data-analytics-range="${value}"]`)?.focus?.()`.
- Update `web-tests/control-uiux-refinements-r3.test.js:50` from `/<desc id="analytics-line-chart-summary">3 real UTC buckets/` to `/<desc id="analytics-line-chart-summary">3 real buckets/`.

- [ ] **Step 4: Run focused analytics suite to verify GREEN**

Run: `cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1 && TZ=Asia/Manila node --test web-tests/control-analytics-v2.test.js web-tests/control-analytics-workflows.test.js web-tests/control-uiux-refinements-r2.test.js web-tests/control-uiux-refinements-r3.test.js web-tests/control-route-render-contract.test.js`
Expected: PASS.

---

### Task 4: Design-System CSS Tokens, Typography Floor, and Coordinated Cache-Busting (TDD)

**Files:**
- Modify: `docs-site/control.css:626-641`
- Modify: `docs-site/control-features.css:794-825,882-904`
- Modify: `docs-site/control.html:20-21,69`
- Modify: `docs-site/commands.html:20`
- Modify: `docs-site/control-app.js:4`
- Modify: `web-tests/control-analytics-v2.test.js`
- Modify: `web-tests/control-theme-surfaces.test.js`
- Modify: `web-tests/control-legacy-removal.test.js`
- Modify: `web-tests/control-stage3-reconciliation.test.js`

**Interfaces:**
- Produces:
  - `.control-state-chip[data-tone="warning"]` and `[data-tone="info"]` in `control.css?v=32`
  - `.analytics-coverage-list`, `.analytics-passive-section`, `.analytics-chart-scroll`, `.analytics-chart-inspector`, `.analytics-point-group`, `.analytics-line-hit`, and `13px` tabular SVG labels in `control-features.css?v=16`
  - Synchronized query versions: `control.css?v=32`, `control-features.css?v=16`, `control-app.js?v=30`, `control-analytics.js?v=21`.

- [ ] **Step 1: Add CSS & version assertions (RED)**

Add CSS assertions in `web-tests/control-analytics-v2.test.js` checking `.control-state-chip[data-tone="warning"]`, `.control-state-chip[data-tone="info"]`, `.analytics-chart-scroll { overflow-x: auto; }`, `.analytics-line-chart` `min-width: 600px`, `13px` tabular `.analytics-axis-tick`/`.analytics-axis-label`, and `.analytics-chart-inspector`.
Update pinned versions in `control-theme-surfaces.test.js` (`control.css?v=32`, `control-app.js?v=30`, `control-analytics.js?v=21`), `control-legacy-removal.test.js` (`control-features.css?v=16`), and `control-stage3-reconciliation.test.js` (`control-features.css?v=16`).

- [ ] **Step 2: Run tests to verify RED**

Run: `cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1 && TZ=Asia/Manila node --test web-tests/control-analytics-v2.test.js web-tests/control-theme-surfaces.test.js web-tests/control-legacy-removal.test.js web-tests/control-stage3-reconciliation.test.js`
Expected: FAIL.

- [ ] **Step 3: Apply CSS updates and bump asset query versions**

- In `docs-site/control.css`: add `.control-state-chip[data-tone="warning"]` (`--status-warning-*`) and `.control-state-chip[data-tone="info"]` (`--status-info-*`).
- In `docs-site/control-features.css`:
  - Move `overflow-x: auto` from `.analytics-chart` onto `.analytics-chart-scroll`, leaving `.analytics-chart-inspector` outside the scroller with subtle hairline styling (`padding: 10px 12px; border: 1px solid var(--stroke-subtle); border-radius: 10px; background: var(--surface-secondary); color: var(--text-primary); font-size: 13px; line-height: 18px; font-variant-numeric: tabular-nums;`).
  - Style `.analytics-coverage-list`, `.analytics-coverage-item`, `.analytics-coverage-note`, `.analytics-passive-section`, `.analytics-point-group`, `.analytics-line-hit` (`fill: transparent; cursor: pointer;`), and `.analytics-point-group[data-active="true"] .analytics-line-point` (`r: 5.5` or stronger stroke).
  - Update `.analytics-line-chart` to `min-width: 600px;` and `.analytics-axis-label, .analytics-axis-tick` to `font: 400 13px var(--font-sans); font-variant-numeric: tabular-nums;`.
  - Add responsive stacking for `.analytics-coverage-list` inside `@container control-main (max-width: 720px)` (targeting `.analytics-section-heading`, NOT non-existent `.analytics-chart-head`).
  - Keep all `font-weight` values in `{400, 500, 600}` and all `font-size >= 12px`.
- Update `?v=` in `docs-site/control.html`, `docs-site/commands.html`, and `docs-site/control-app.js`.

- [ ] **Step 4: Run full web verification gates on `web/control-redesign-finish-r1`**

```bash
cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1
TZ=Asia/Manila npm run check:web
TZ=Asia/Manila npm run test:web
git diff --check
```
Expected: ALL tests pass with 0 failures.

- [ ] **Step 5: Commit Stage A on `web/control-redesign-finish-r1` using named paths**

```bash
cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1
git add \
  docs-site/control-analytics.js \
  docs-site/control.css \
  docs-site/control-features.css \
  docs-site/control.html \
  docs-site/commands.html \
  docs-site/control-app.js \
  web-tests/control-analytics-v2.test.js \
  web-tests/control-uiux-refinements-r3.test.js \
  web-tests/control-theme-surfaces.test.js \
  web-tests/control-legacy-removal.test.js \
  web-tests/control-stage3-reconciliation.test.js
git diff --cached --stat
git commit -m "feat(analytics): upgrade Control Analytics UI for schema v2 and local time"
```
