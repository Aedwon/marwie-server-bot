# Control Legacy Removal Pass

**Goal:** Remove every remaining legacy Control presentation layer so all canonical routes visibly implement the 2026-10-16 Control design system on localhost.

**Authority:** `docs/superpowers/specs/2026-10-16-control-design-system.md`, `docs/superpowers/decisions/2026-10-17-control-legacy-removal.md`, and the existing Control redesign decisions.

## Constraints

- Preserve behavior, URLs, authorization, state ownership, page-save semantics, resource mappings, and local SQLite/runtime behavior.
- Delete obsolete Control presentation files/selectors/helpers when they are no longer needed.
- Do not keep parallel legacy and canonical visual systems.
- Use TDD for identified regressions.
- Work in an isolated branch/worktree derived from current website production, then integrate into the local-hosting worktree only after verification.
- Final acceptance target is `http://127.0.0.1:8787/control`.

## Tasks

1. **Root-cause inventory**
   - Capture all 19 canonical routes from localhost.
   - Inventory loaded Control CSS/JS assets and route-local class families.
   - Identify selectors/components/files responsible for remaining legacy visual language.
   - Compare legacy-looking routes with fully canonical routes and document concrete differences.

2. **Negative regression contracts**
   - Add tests that fail while identified legacy selectors, obsolete wrappers, duplicate visual tokens, or old route-body structures remain.
   - Add route-level contracts for canonical section/list/table/form anatomy where needed.

3. **Remove parallel presentation systems**
   - Delete or consolidate obsolete CSS and markup helpers.
   - Move reusable route anatomy into canonical shared components/tokens.
   - Keep domain JS focused on domain content/state instead of bespoke chrome.

4. **Recompose every route body**
   - Engagement: Reputation, Quizzes, Voice & Coworking, Showcase, Notification roles.
   - Publishing: Feeds, Announcements, Live.
   - Support & Safety: Tickets, Anonymous Questions, Moderation.
   - Insights: Analytics, Activity.
   - System: Resources Channels/Roles/Categories, Commands.
   - Playbooks: Ticket handling, Events.
   - Confirm no substantial legacy card-grid, attached-panel, mapping-block, typography, or density treatment remains.

5. **Full verification**
   - `npm run check:web`
   - `npm run test:web` with zero failures
   - `git diff --check`
   - all relevant Python Control tests if backend files changed

6. **Visual acceptance**
   - Capture all 19 routes at desktop.
   - Review representative light/dark, 900-1199px, <900px, 390px, reduced-motion, and forced-colors states.
   - Reject any route that still substantially resembles the legacy interface.

7. **Localhost integration**
   - Preserve local-hosting runtime work and untracked artifacts.
   - Integrate verified changes into `ops/local-web-hosting-r1`.
   - Restart only `com.aedwon.marwie-server-web` if required.
   - Verify `/healthz` and authenticated Control routes on localhost.
   - Do not call complete until localhost screenshots show the canonical design consistently across all routes.
