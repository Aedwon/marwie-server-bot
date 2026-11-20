# Website Public Pages and Analytics v2 Alignment Decisions

Date: 2026-11-20
Status: Active (Stage A approved; Stage B and Stage C appended at their stage gates)
Scope: Rob-bot Control Analytics (`/control/analytics`) and Public Reference Pages (`/commands`, `/handbook`)

## Context

The Discord bot on `main` (`26fbbbc`) now publishes `schema_version: 2` analytics snapshots into `control_guild_snapshots` with per-range coverage metadata, event-based ticket counters (`tickets_reopened`, `tickets_closed_distinct`, `open_ticket_backlog`, `ticket_median_close_seconds`), `anonymous_messages`, and nullable passive telemetry (`human_messages`, `voice_member_minutes`).

Meanwhile, the Control Analytics UI still rendered v1-only UTC metrics, and the public `/commands` and `/handbook` routes retained pre-redesign styling and defaults.

## Stage A: Control Analytics v2 Display

### Decision 1: Local-time Analytics display (supersedes R3 forced-UTC)

Supersedes the forced-UTC X-axis rule in `docs/superpowers/specs/2026-09-01-control-uiux-refinements-r3.md:59`.

- Selected period bounds (`From` / `To`), bucket inspector timestamps, and Context `Last generated` render in the browser's local timezone using `Intl.DateTimeFormat` with `timeZoneName: 'short'`.
- Chart X-axis ticks format in local time according to `bucket_granularity` (`hour` / `6hour` include time; `day` / `week` include month and day, plus 2-digit year when a series spans multiple local calendar years).
- If two axis ticks collide in local time (such as a DST fall-back fold), the colliding ticks append `timeZoneName: 'short'` to remain unambiguous.
- Pure formatting helpers accept optional `{ locale, timeZone }` overrides for deterministic unit testing.

### Decision 2: Eight-field v2 operational activity total

Extends the six-field activity sum in `docs/superpowers/specs/2026-09-01-control-uiux-refinements-r3.md:54`.

- Operational event buckets sum `moderation_cases + tickets_opened + tickets_closed + tickets_reopened + quiz_answers + anonymous_questions + anonymous_messages + reputation_events`.
- `quiz_correct` remains excluded from the activity event total and is used only for exact `quiz_accuracy`.
- Legacy v1 buckets lacking `tickets_reopened` and `anonymous_messages` default those absent fields to `0`, preserving the exact six-field R3 sum.

### Decision 3: v2 metric, coverage, and single-series chart scope

- **Coverage selection:** Coverage badges read from `projection.coverage` for the selected range. Top-level `analytics.coverage` is used as a fallback ONLY for flat/unranged snapshots or when `projection.range_key === analytics.default_range`, never borrowing `7d` coverage for another range.
- **Coverage copy:** When the backend supplies a non-null `note`, display it verbatim without duplicating gap or drop counts. Synthesize percentage/gap/drop detail only when `note` is absent and coverage is incomplete or has gaps/drops.
- **Ticket semantics:** `Tickets closed` displays closure events and appends `(<N> distinct)` when `tickets_closed_distinct` differs from `tickets_closed`. `Open tickets (current)` is explicitly labeled point-in-time. `Median ticket close time` shows formatted duration when non-null, `No closures` when `tickets_closed === 0`, and `Unavailable` when `tickets_closed` is absent or `tickets_closed > 0` with `ticket_median_close_seconds == null`.
- **Passive telemetry:** `Human messages` and `Voice member minutes` display `Unavailable` when unavailable/null (never `0`), append `(partial)` when `status === 'partial'`, and show measured values (including true `0`) when `status === 'complete'`.
- **Single operational-events chart (YAGNI):** Passive telemetry is disabled in live production. Keep one operational-events SVG chart (`role="group"` so interactive focusable points remain accessible) with a dedicated horizontal scroll wrapper around `<svg>` and a non-clipping bucket breakdown inspector outside the scroller. Non-null passive counts still appear in the bucket breakdown when present.
- **v1 compatibility:** Flat v1 snapshots and unversioned ranged v1 snapshots retain their exact 7 operational rows and existing chart behavior without fabricating v2 metrics or coverage chips.


## Stage B: Public Pages Design-System Alignment (`/commands` and `/handbook`)

### Decision 4: All Commands switches to System theme default (supersedes dark-first spec)

Supersedes the dark-first default in `docs/superpowers/specs/2026-08-30-all-commands-redesign.md:28`.

- `/commands` (`docs-site/commands.html`) now defaults to `system` (`data-theme="light" data-preference="system"`, `localStorage.getItem('rob-doc-theme') || 'system'`, `<meta name="theme-color" content="#fcfcfb" id="themeColor">`, System appearance button `aria-pressed="true"`), matching Control and Design System §32 and removing the pre-JS dark flash before `control-theme.js` initializes.
- `/commands` removes `/styles.css` and consumes only `control.css` + `commands.css` using canonical `--surface-*`, `--text-*`, `--stroke-*`, `--accent-info`, `--focus-ring`, and `--shadow-floating` tokens with Figtree `400`/`500`/`600` weights and `>= 13px` typography (`13px / 18px` metadata contract preserved on `.search-status` and `.permission-badge`).
- `/commands` adopts an `< 876px` (`max-width: 875px`) drawer breakpoint (`240px` sidebar + `600px` center floor + gaps = `876px`, matching `control-shell-layout.js:22` `labelsNoContext`) because `/commands` has no icon-only rail. `.commands-shell` synchronizes `data-nav-mode="expanded|drawer"` and `data-context-mode="none"` with `installDrawerController({ isDrawer })` on boot and resize so the desktop sidebar is never marked `inert`, and the window Escape handler respects `event.defaultPrevented` / open drawer state so closing the drawer never clears an active search query.

### Decision 5: Handbook token unification without structural overhaul

- `/handbook` (`docs-site/index.html`) keeps its existing navigation/section structure and `/styles.css` HTTP 200 route while removing the stale hardcoded `"45 slash commands"` count (`V1 · slash commands require confirmation`).
- `docs-site/styles.css`, `docs-site/home.css`, and `docs-site/visual.css` migrate completely off the legacy `#365544` green palette, Apple SF system fonts, `650`/`700` weights, and sub-12px sizes onto canonical paper/ink/sky tokens (`#fcfcfb`/`#ffffff`/`#f4f4f2`/`#111113`/`#2f6fa3`/`#7db9e8` light; `#0f0f11`/`#19191c`/`#1b1b1e`/`#ececee`/`#7db9e8` dark), Figtree `400`/`500`/`600`, and a `>= 12px` floor with `visual.css` cascade aligned to `styles.css`.
- `docs-site/app.js` updates `theme-color` to `#0f0f11`/`#fcfcfb`, persists `rob-doc-theme` only on explicit button clicks (`{ persist: true }`), and synchronizes mobile drawer `inert`/`aria-hidden`/focus management so closed offscreen links are never tabbable and Escape restores focus to `#menuBtn`.

## Stage C: Zero-write visual acceptance and bounded polish

- Review builds on `127.0.0.1:8788` reuse `createLocalServer` for production static routing. The audit server reads the SQLite snapshot once in read-only mode, closes the database, serves the snapshot from RAM, and rejects save and action requests. Headless Chromium supplied the captures after T3 desktop preview failed to produce screenshot frames. Each audit launch uses `--use-mock-keychain` and `--password-store=basic` with a disposable Chrome profile.
- Control now supplies a low-specificity 600 weight for semantic headings, emphasis, and table headers. This removes browser-default 700 weights from Reputation tier labels, the Notification roles Buttons heading, resource row headers, Control Commands titles, and the Live destination label. The Notification roles and Control Commands headings use the 16px subsection scale.
- Quizzes interval guidance and Live topic guidance now render at 12px. Shared Control fields use 44px minimum height and 16px type below 640px in the workspace and Context. Placeholders use the theme's readable tertiary text color. Field boundaries meet non-text contrast in both themes and retain the focus stroke on hover. [WCAG 2.2 contrast criteria](https://www.w3.org/TR/WCAG22/#contrast-minimum)
- Control Commands stacked rows now fit the mobile viewport. Removing the inherited 560px table minimum eliminated the measured 198px page overflow at 390px. The Stage A regression test counts only ticks inside the Analytics x-axis group.
- The primary re-audit passed 66 checks. A separate sweep covered all 19 Control destinations and both public routes in desktop and mobile light and dark, including 60 edit-mode checks. Both sweeps recorded zero typography, page-overflow, and theme issues. Stage C Task 4 will record the final promoted SHAs in the handoff report.
