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
