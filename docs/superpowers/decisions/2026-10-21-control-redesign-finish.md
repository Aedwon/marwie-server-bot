# Control redesign finish boundary

Date: 2026-10-21
Status: Active
Scope: Rob-bot Control website

## Context

The approved Control design system was promoted, then followed by a legacy-removal pass. Passing tests did not prevent several routes from rendering a header over an empty center. The work also split across three lines that no longer match:

- `web/rob-bot-site-production` carries the promotion commit.
- `ops/local-web-hosting-r1` carries the legacy-removal work and uncommitted local runtime edits.
- `web/control-canonical-cleanup-r1` carries overlapping cleanup, is unmerged, and uses a palette and type scale that differ from the approved spec.

The 2026-10-16 Control design system and the 2026-10-17 completion decisions remain authoritative. This entry tightens execution. It does not change the approved design.

## Decision

### Completion evidence

A route is complete only when a render-level test and a reviewed screenshot both show the required page anatomy in read and edit modes. Route lists, token names, and forbidden-string checks are necessary but not sufficient.

The route matrix in `docs/superpowers/plans/2026-10-21-control-redesign-finish.md` is the scope boundary for this pass.

### Delivery line

Work continues on one finish branch, `web/control-redesign-finish-r1`, derived from `origin/web/rob-bot-site-production`. The legacy-removal commits are ported onto it. The local hosting worktree is integrated only after visual acceptance, and its uncommitted runtime edits are preserved.

### Style layer

One canonical Control style layer remains. It uses the semantic tokens and geometry in the 2026-10-16 design system. The handbook stylesheet is not a dependency.

`web/control-canonical-cleanup-r1` is not merged wholesale. Its valid goal, removing the handbook dependency and keeping one style layer, is re-implemented against the approved tokens. Its palette and type values are rejected.

### Promotion

Promotion to `web/rob-bot-site-production` happens only after the acceptance table has no failing routes. `main` is not touched. The Discord bot is not deployed.

## Consequences

The finish pass costs one manual port of two commits, a possible stylesheet conflict, and route-by-route visual review. In exchange, production stays authoritative, the local runtime work is not put at risk during composition, and the parallel cleanup attempts stop competing.

## Acceptance

Completion requires:

1. All 19 canonical routes pass the render contract in read and edit modes.
2. Every route is captured from the real signed-in local site at wide light, wide dark, 1024, and 390.
3. No route shows a header-only center, a reserved empty right column, raw enum labels, Mappings detour copy, or a legacy body layout.
4. `npm run check:web`, `npm run test:web`, and `git diff --check` pass.
5. The production and local-hosting promotion is recorded with commit identifiers and verification output.

## Status on 2026-10-22

The finish implementation is complete on `web/control-redesign-finish-r1`, based on production commit `c286a1b`. All 19 canonical routes were recomposed. One Control style layer remains. Responsive behavior covers wide desktop, 1024 with the context drawer, and 390 with stacked summary tables. Edit mode suppresses duplicate page-specific resource readiness and keeps the generic resource editor.

Automated gates passed on this date: `npm run test:web` ran 247 tests with 0 failures, `npm run check:web` passed, and `git diff --check` was clean.

### Live acceptance

The signed-in capture ran against the real local server through `https://aidevph.aedwon.site` on 2026-10-21. That hostname routes to the local origin at `127.0.0.1:8787` and uses the same database and backend. The read capture has 162 images in `.visual-companion/control-finish-review/live-read`. The edit capture has 300 images in `.visual-companion/control-finish-review/live-edit`. The review covered all 19 routes at 1440 light and dark, 1024 with context closed and open, and 390 light and dark, in read and edit modes where edit mode exists.

The real guild data included empty states for Quizzes questions, Feeds sources, Tickets types, and Analytics activity. Each empty state was explicit and did not leave a header-only center. The rest of the routes rendered real mappings, roles, channels, and activity.

### Follow-up fix

One defect was found during the live review. Notification roles rendered an inert feature toggle in edit mode and no state chip in read mode. The page has no `notification_roles` feature flag, so the toggle had no effect. The edit-mode toggle was removed for that page, and a render contract test now covers it. Asset versions were bumped to `control.css?v=18`, `control-features.css?v=7`, and `control-app.js?v=14`.

The fixed Notification roles views were recaptured live in `.visual-companion/control-finish-review/live-edit-notification-roles4` (20 images) on 2026-10-22 and copied into `live-edit`. The live edit header has no inert toggle at 1440, 1024, and 390 in light and dark. The route is accepted.

The other 18 routes are accepted from the live read and edit captures. The local web service was restored after the capture. The public host serves the previous local-hosting build again (`control.css?v=12`), and both the local and public `/healthz` endpoints return 200. The finish branch is committed locally but not pushed, merged, or promoted. The local hosting worktree was not reset, cleaned, or modified.

No bot deploy was made. `main` was not changed.
