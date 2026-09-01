# Control UI/UX Refinements R2

## Status

Approved for implementation on 2026-09-01. This specification supersedes earlier Control UI comments where the user's annotated R2 rulings differ. It refines the implementation at `1e3a8aedaee0808d30955b3b074c736b3d8ffb8f` without moving production or `main`.

## Shared visual language

- The existing Mappings -> Channels table is the canonical Control table: one restrained rounded outer enclosure, full-width header and row rules, stable aligned columns, one row per record, plain colored status text, and horizontal scrolling only when necessary.
- Ordinary Control links are not underlined. Inline navigation actions use a compact reusable text treatment with a trailing arrow and visible focus treatment.
- Primary CTAs use the established inverse monochrome treatment: white surface/black text in dark mode and black surface/white text in light mode.
- `Edit settings` uses the Utilities-style button everywhere, sits above the feature toggle, and uses consistent sizing/radius. The feature toggle remains accessible but has no surrounding container border.
- Routine Control typography remains at least 13px. Light, dark, system, reduced motion, keyboard focus, and responsive behavior remain supported.

## Domain refinements

- Community: Reputation uses a tier-progression presentation; Quizzes uses a concise operational snapshot; Voice & Coworking exposes one `Temporary voice` toggle backed only by the existing `voice` feature; Showcase and all Community mapping summaries use the canonical table. The stored `coworking` feature value and runtime remain untouched.
- Content: Feeds sources use the canonical table; Feeds/Announcements/Live remove excess header spacing; Announcement composer/preview become deliberate admin surfaces and the color popover becomes a dependency-free accessible hue + saturation/value picker; Live becomes a compact ordered dispatch surface. Existing posting validation, mention safety, confirmation and destination behavior remain unchanged.
- Utilities: ticket types, notification panel summaries, and all mapping summaries use canonical tables. Utility mapping summaries have no per-row Action column and one section-level Manage mappings action. Active `Anonymous Questions` navigation stays on one line without breaking narrow layouts.
- Workflows: Moderation, Ticket handling and Events use one consistent numbered operational timeline. Copy is derived only from implementation and `docs/commands.md`; no new policy or permission claims are introduced.
- Commands: Control command tasks use compact action rows with human goal, code-styled Discord command, and shared arrow action links. Ownership and canonical links do not change.
- Mappings: Channels/Roles/Categories table structure remains canonical. `Review suggested mappings` adopts the established CTA styling without changing disabled, quiet, confirmation, review or application behavior.

## Analytics dashboard contract

The public Discord `/analytics` command remains the existing previous-168-hour report. R2 changes only the authenticated Control dashboard.

The persistence layer already records timestamped moderation cases, ticket opens/closes, quiz answers, anonymous questions and reputation events. Control therefore may expose real historical dashboard windows without inventing values.

### Snapshot ranges

The Control worker publishes all supported dashboard ranges together in the normal guild snapshot so one user's range choice never mutates guild-global snapshot state or competes with another viewer. The existing flat 7-day analytics fields remain in the snapshot for compatibility.

Supported keys and exact UTC windows:

- `1d`: previous 24 hours
- `3d`: previous 72 hours
- `7d`: previous 168 hours; default
- `2w`: previous 336 hours
- `1m`: previous 720 hours (30 days)
- `all`: earliest persisted event for a supported metric through the common snapshot end; if no event exists, start equals end and all metrics are zero

Every range is half-open `[period_start, period_end)` and uses one shared UTC `period_end` per snapshot. Summary fields stay aggregate-only: moderation cases, tickets opened, tickets closed, quiz answers, quiz accuracy, anonymous questions and reputation events. No member IDs, message contents, questions, source rows or other raw/private activity are exposed.

### Historical series

Charts use only real bucketed aggregates from the same persisted rows. Fixed ranges use deterministic contiguous buckets: six 4-hour buckets for 1d, six 12-hour buckets for 3d, seven daily buckets for 7d, seven 2-day buckets for 2w, and ten 3-day buckets for 1m. All time uses up to twelve contiguous equal-duration buckets across the real stored span. Bucket boundaries are UTC and half-open.

The service computes bucket counts with SQLAlchemy expressions that are portable to SQLite and PostgreSQL; no dialect-specific date truncation is required. Quiz correctness is used only to derive aggregate bucket accuracy and is not exposed as a separate metric.

The Control UI renders the selected shortcut, explicit From/To range, summary metrics, and a dependency-free activity-over-time graph with an accessible textual/table equivalent. Empty buckets remain true zeroes; absent analytics projection renders an unavailable state instead of fake data.

## Safety and ownership

- Voice & Coworking page revision and page-save ownership cover `voice` only after R2. The `coworking` feature still exists and its persisted value/runtime behavior are not changed.
- Analytics range selection is local view state, not a saved setting and not a Control action. Analytics continues to own only its existing feature toggle for page saves.
- Authorization, CSRF, idempotency, revision-aware saves, conflicts, consequence confirmations, Discord permission checks and allowed-mention restrictions are unchanged.
- No framework or large dependency is added.

## Verification

Use focused RED/GREEN tests for Analytics historical ranges and Voice ownership. For visual work, use targeted markup/style checks, JavaScript syntax checks for touched files, `git diff --check`, and localhost visual checks in dark/light plus wide/narrow states when browser automation is available. Do not substitute a broad suite for this refinement pass.
