# Control redesign finish boundary

Date: 2026-10-21
Status: Active; visual acceptance reopened after live review
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

The other 18 routes were accepted from the live read and edit captures. That acceptance was reopened by the 2026-10-22 live review. The local web service was restored after the earlier capture. The public host served the previous local-hosting build again (`control.css?v=12`), and both the local and public `/healthz` endpoints returned 200. The finish branch is committed locally but not pushed, merged, or promoted. The local hosting worktree was not reset, cleaned, or modified.

No bot deploy was made. `main` was not changed.

### Review follow-up: floating save bar

The 2026-10-22 live review reopened visual acceptance. The page save actions had regressed to inline rows in page headers or section headings. They are now one shared floating surface at the page end on every edit route.

- The shared `control-save-bar` is rendered by the community, content, utilities, analytics, mappings, and workflows pages.
- The bar is sticky at `bottom: max(14px, env(safe-area-inset-bottom))`, with a 12px radius, translucent surface, hairline border, blur, and `--shadow-save-bar`.
- Short edit pages use a flex column with `min-height: calc(100dvh - 2rem)` and `margin-top: auto`. The bar pins to the viewport bottom without a JavaScript positioner.
- Announcement and Live save actions moved to the page end. Mapping save actions moved after suggestions. Workflow save actions moved out of the Configuration heading.
- The global changes tray clears the bar at widths below 1200px and on mobile.
- Asset versions are `control.css?v=19` and `control-features.css?v=8`.
- Asset-version assertions in `control-theme-surfaces.test.js` and `control-stage3-reconciliation.test.js` were updated to the new versions.

Verification on 2026-10-22: `npm run test:web` reports 248 tests, 248 pass. `npm run check:web` and `git diff --check` pass. Live visual acceptance is still pending.

The current review build is served by the custom finish server on `127.0.0.1:8787`. The launchd service `com.aedwon.marwie-server-web` is booted out for this review and must be restored after acceptance. The public host currently points at the review build.

The user accepted the live review and asked to commit and merge on 2026-10-22. Promotion to `web/rob-bot-site-production` is approved. The Discord bot and `main` are excluded.

The Vercel production site was stale at `control.css?v=8` because the production build failed. The build command reapplied review overlay scripts whose changes were already present in the branch, and the first script stopped on a missing anchor. The build command no longer invokes those scripts. Verification before promotion passed: `npm run check:web`, `npm run test:web` at 271 tests, `git diff --check`, and the Python gates under CPython 3.12.

The finish branch was merged into `web/rob-bot-site-production` at `60229be` and pushed, with the promotion record at `7149107`. The finish is also integrated into the local hosting checkout at merge commit `f0a52ca` with its runtime edits preserved. The production host is `https://aidevph.aedwon.site/control`, served from the operator's laptop through the Cloudflare Tunnel and the `com.aedwon.marwie-server-web` LaunchAgent. The public host serves `control.css?v=25`, `control-app.js?v=18`, and `control-features.css?v=10`.

Vercel is the rollback path, not the production host. Its failed build was also unblocked and deployed, but it does not define the production URL.
