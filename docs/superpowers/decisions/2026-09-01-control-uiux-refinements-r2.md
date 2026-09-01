# Control UI/UX Refinements R2 Decisions

## Context

The R1 Control refinement established shared header controls, semantic mapping summaries and a richer Announcement builder, but the later annotated review requires a more consistent table/action language, narrower Voice ownership, stronger operational page composition and a real selectable Analytics dashboard.

## Decisions

### One canonical table language

Mappings -> Channels remains the visual and semantic source of truth. Cross-domain summaries use the same outer enclosure, header, row rules and stable columns instead of row cards. Mapping status remains plain colored text.

### One shared action language

Ordinary inline Control links use a reusable trailing-arrow action rather than underlines or button-like secondary links. Primary actions and `Edit settings` retain the established inverse monochrome button treatment. Header action order is Edit settings first, feature toggle second.

### Voice page owns only Temporary voice

The route remains `/control/community/voice-coworking` for compatibility, but the page exposes one `Temporary voice` control backed by the existing `voice` feature. Control page-save ownership and revision material are narrowed from `{voice, coworking}` to `{voice}`. This deliberately avoids a hidden writable coworking field. The `coworking` feature, stored value, command behavior and runtime logic remain untouched.

### Analytics ranges are snapshot data, not per-view actions

Do not make `guild-state` snapshots range-specific and do not queue a refresh whenever a user clicks a range. Guild snapshots are shared state, so range-specific refreshes would create cross-viewer contention and cache ambiguity.

Instead, `AnalyticsService` computes the six approved aggregate windows and real bucket series at one common UTC end time, and the worker publishes them together in the existing snapshot. The flat 7-day projection remains for compatibility. The browser range control switches among already-authoritative aggregates and defaults to 7d.

This is safe for SQLite and PostgreSQL because bucket aggregation uses ordinary SQLAlchemy conditional aggregates and timestamp comparisons rather than backend-specific date functions. The dashboard exposes aggregates only.

### `/analytics` command is unchanged

The Discord command and scheduled weekly report keep their previous exact 168-hour contract. The selectable ranges belong only to authenticated Control. This avoids silently changing an established command/manual contract.

### Charts remain dependency-free and data-faithful

Use CSS and semantic markup for the Control chart. Every plotted bucket is supplied by the worker from persisted rows, and a textual/table equivalent is available to keyboard and assistive-technology users. No decorative or interpolated history is permitted.

### Workflow copy remains repository-grounded

The three workflow pages may reorganize and strengthen Follow-up/exception guidance, but factual claims must be traceable to implementation or `docs/commands.md`. No new moderation policy, permission model or runtime promise is introduced.

## Non-decisions

- No production deployment or bot restart.
- No new framework, chart package or color-picker dependency.
- No change to page-save confirmation, CSRF, idempotency or conflict semantics.
- No change to Mappings resource ownership.
