# Control Redesign Finish Implementation Plan

Date: 2026-10-21
Status: implemented; visual acceptance reopened after live review
Spec: `docs/superpowers/specs/2026-10-16-control-design-system.md`

Authoritative decisions:

- `docs/superpowers/decisions/2026-10-16-control-interface-information-architecture.md`
- `docs/superpowers/decisions/2026-10-16-control-brand-and-visual-direction.md`
- `docs/superpowers/decisions/2026-10-16-control-apple-design-principles.md`
- `docs/superpowers/decisions/2026-10-17-control-redesign-completion.md`
- `docs/superpowers/decisions/2026-10-17-control-legacy-removal.md`
- `docs/superpowers/decisions/2026-10-17-control-async-task-indicator.md`

This plan finishes the work described in `docs/superpowers/plans/2026-10-17-control-redesign-completion.md` and `docs/superpowers/plans/2026-10-17-control-legacy-removal-pass.md`. It does not change the approved design.

## Executive summary

The Control redesign is not finished, even though every web test passes. The tests check route lists, token names, and a few forbidden phrases. They never render a page. Several routes therefore show a title and an Edit button over an empty center, while the suite reports success.

The work also split into three lines that no longer match: the promotion commit on production, the legacy-removal work on the local hosting branch, and an unmerged style-cleanup branch that drifted from the approved design. The public site runs the local hosting line. The production branch is behind it. The design record describes a third state.

This plan does four things.

1. Consolidates the work onto one finish branch and stops the parallel cleanup efforts.
2. Replaces string tests with render-level tests for all 19 routes in read and edit modes.
3. Recomposes every route body from a fixed matrix, including page-specific context or no context at all.
4. Requires real screenshots of the signed-in local site before promotion.

What it costs: one manual port of two commits, a likely conflict in the stylesheet, and a route-by-route visual sign-off. The visual sign-off is the part that cannot be automated away, and it is the step the earlier passes skipped.

What is already decided: do not merge the off-spec cleanup branch, do not measure completion by test counts, and do not promote until every row of the acceptance table passes.

What you need to do: approve Task 0 to create the finish branch, then review the route screenshots at the end. No bot deploy and no change to `main` is involved.

Success means the acceptance table has no fails, and a signed-in operator can use every route in light, dark, and mobile without hitting an empty or legacy page.

## Goal

Make every canonical Control route render the October 2026 design system in both read and edit modes, with a page-specific contextual panel where useful, one canonical style layer, and rendered visual evidence that does not depend on string-matching tests.

## Why the previous attempts stopped

Recorded here so the implementation does not repeat the pattern.

1. Completion was measured by route, token, and copy tests that never rendered a page. All 259 web tests pass while some routes render a header over an empty center.
2. Route bodies were trimmed instead of recomposed. Mapping blocks were deleted and copy pointed at Context, but several centers were left without operational content.
3. The contextual panel became one generic resource list on every route instead of a per-feature panel with readiness, preview, or permissions.
4. The finishing work lives on three divergent lines: the promotion commit on `web/rob-bot-site-production`, legacy removal on `web/control-style-consolidation-r1` and `ops/local-web-hosting-r1`, and an unmerged, partly uncommitted canonical cleanup that also introduced off-spec tokens.
5. The visual review harness was a hand-written clone. It loaded stylesheets that the real page no longer loads, so its screenshots could not be trusted as acceptance evidence.
6. The completion plan's acceptance tasks remain unchecked and the execution ledger stopped after Task 1.

## Definition of done

A route is complete only when all of these are true:

1. Read mode shows the page's operational state and real data, not only a title and an edit button.
2. Edit mode shows every editable field that belongs to the feature, with Save and Discard.
3. The contextual panel contains only useful, page-specific context. A route with no useful context reserves no right column.
4. Render-level tests instantiate the page with a representative snapshot and assert the required content.
5. Wide desktop screenshots in light and dark, plus 390px, are reviewed and accepted for that route.
6. No page shows internal enum values, Mappings detour copy, dead placeholders, or a legacy timeline/card body that the design system does not call for.

Test counts alone are not completion evidence.

## Dependencies

- Current website production tip: `origin/web/rob-bot-site-production` at `c286a1b`.
- Current operator-facing build: `ops/local-web-hosting-r1` at `534eae2`, served at `http://127.0.0.1:8787` and through the Cloudflare hostname.
- Local runtime edits in `ops/local-web-hosting-r1` are uncommitted and must be preserved. Do not reset or clean that worktree.
- No database, API contract, authorization, CSRF, revision, or save-semantics change is required by this plan. If a route cannot be composed without one, stop and update the plan.
- Do not restart or deploy the Discord bot.

## Branch strategy

Target one delivery line and stop working on parallel Control branches.

1. Create `web/control-redesign-finish-r1` from `origin/web/rob-bot-site-production`.
2. Port `640fa16` (legacy presentation removal) and `534eae2` (async indicator motion) as commits.
3. Do not merge `web/control-canonical-cleanup-r1`. It duplicates the legacy-removal deletions and its CSS uses off-spec palette and type values. Re-implement only its valid goal (one style layer, no handbook dependency) in Task 9 using this spec's tokens.
4. Do all route work on the finish branch. Integrate into `ops/local-web-hosting-r1` only in Task 12, preserving the local runtime edits.
5. Promote the finish branch to `web/rob-bot-site-production` only after visual acceptance. Do not touch `main`.

Recommended because production stays authoritative, the local runtime work is not put at risk during composition, and the two cleanup attempts stop competing.

Cost: one manual port of two commits and a possible conflict in `control.css`. Resolve by taking the finish branch's structure and re-applying the motion values.

## Global constraints

- Keep every canonical URL valid. Do not change navigation labels or groups again.
- Preserve one canonical resource state. Feature editors and Resources read and write the same `set_resource` and `clear_resource` actions.
- Do not add bulk save. Keep page-save revision, conflict, authorization, CSRF, and idempotency behavior unchanged.
- Use Figtree 400, 500, and 600. Use the semantic tokens in the spec. Do not import tokens from the handbook stylesheet.
- Wide desktop geometry: 240px left shell, flat center, optional 304px right shell, 12px inset and gap, 24px radius.
- Right shell appears only when useful. Center expands when it does not.
- Theme default stays System.
- Accessible targets, focus, reduced motion, forced colors, and 390px reflow are part of every route task, not a later polish pass.
- Use test-first development. A failing render contract must exist before route markup changes.
- Do not write raw SQL or touch bot cogs. This plan is website only.
- Do not claim a result that was not run.

## File table

| Path | Action | Purpose |
| --- | --- | --- |
| `docs/superpowers/decisions/2026-10-21-control-redesign-finish.md` | create | Record the finish boundary, rendered acceptance, and branch strategy |
| `docs/superpowers/plans/2026-10-21-control-redesign-finish.md` | create | This plan |
| `docs/superpowers/plans/2026-10-17-control-redesign-completion.md` | modify | Mark superseded for remaining execution and point to this plan |
| `docs-site/control.html` | modify | Single stylesheet link, asset versions |
| `docs-site/control.css` | modify | Canonical tokens, shell collapse, page anatomy, remove handbook dependency |
| `docs-site/control-features.css` | modify | Route anatomy and component styles in the one canonical layer |
| `docs-site/control-app.js` | modify | Shell context state, canonical header wiring, remove stale helpers |
| `docs-site/control-layout.js` | modify | Context availability, resize sync, column collapse |
| `docs-site/control-components.js` | modify | Shared header, state chip, section, definition list, empty state |
| `docs-site/control-community.js` | modify | Reputation, Quizzes, Voice & Coworking, Showcase bodies |
| `docs-site/control-content.js` | modify | Feeds, Announcements, Live bodies and context |
| `docs-site/control-utilities.js` | modify | Tickets, Notification roles, Anonymous Questions bodies |
| `docs-site/control-analytics.js` | modify | Metrics, chart, remove duplicate resource table |
| `docs-site/control-secondary.js` | modify | Activity and Commands page anatomy |
| `docs-site/control-workflows.js` | modify | Moderation feature page, Playbooks guidance anatomy |
| `docs-site/control-mappings.js` | modify | Resources header and tab anatomy |
| `docs-site/control-resource-bindings.js` | modify | Page-specific context composition |
| `docs-site/control-resource-contract.js` | modify | Declare context sections per page where useful |
| `web-tests/fixtures/control-route-snapshot.js` | create | One representative snapshot for render tests |
| `web-tests/control-route-render-contract.test.js` | create | Render-level acceptance for all 19 routes |
| `web-tests/control-redesign-completion.test.js` | modify | Keep route and navigation locks, drop superficial completion claims |
| `web-tests/control-legacy-removal.test.js` | modify | Update negative selectors to the final layer |
| `web-tests/control-legacy-removal-final-regressions.test.js` | modify | Update negative selectors to the final layer |
| `web-tests/control-community.test.js` | modify | Assert composed Engagement bodies |
| `web-tests/control-content-r1.test.js` | modify | Assert Publishing bodies and context |
| `web-tests/control-utilities-r1.test.js` | modify | Assert Support and Safety bodies |
| `web-tests/control-discord-preview.test.js` | create | Lock the Discord preview message, embed, and button contract |
| `web-tests/control-analytics-workflows.test.js` | modify | Assert Analytics, Moderation, Playbooks |
| `web-tests/control-secondary-integration.test.js` | modify | Assert Activity and Commands anatomy |
| `web-tests/control-mappings.test.js` | modify | Assert Resources anatomy and context behavior |
| `web-tests/control-foundation-contract.test.js` | modify | Assert single style layer and shell collapse |
| `web-tests/control-typography.test.js` | modify | Assert spec type roles |
| `web-tests/control-theme-surfaces.test.js` | modify | Assert spec surfaces without handbook tokens |
| `web-tests/control-sidebar-polish.test.js` | modify | Assert final navigation geometry |
| `web-tests/control-cleanup-wave11.test.js` | modify | Track deleted legacy assets |
| `web-tests/control-stage3-reconciliation.test.js` | modify | Update superseded assertions |
| `scripts/control_visual_review.mjs` | create | Capture the real authenticated routes at review sizes |
| `docs/operations/local-website-hosting.md` | modify | Add the visual and promotion verification steps |

Files outside this table require stopping and updating the plan first.

---

## Canonical route matrix

Every row is binding for this plan. Read means read mode with persisted state. Edit means edit mode with a draft.

| Route | Center read | Center edit | Context |
| --- | --- | --- | --- |
| `/control/community/reputation` | Feature state, tier progression with thresholds | State toggle, three threshold fields, Save and Discard | Three role bindings, role readiness, one-line dependency note |
| `/control/community/quizzes` | Feature state, schedule, last posted, question bank list with category, prompt, and rotation state | State toggle, interval, question editors, Save and Discard | Quiz channel binding, channel readiness, schedule note |
| `/control/community/voice-coworking` | Feature state, Temporary voice behavior summary, current category name | State toggle, Save and Discard | Three voice bindings with readiness |
| `/control/community/showcase` | Feature state, Showcase behavior summary, current destination names | State toggle, Save and Discard | Three Showcase bindings with readiness |
| `/control/utilities/notification-roles` | Panel title, description, rendered Discord-style preview, button list with role name, emoji, and humanized style | Title and description, button editor, live preview, Save and Discard | Role panel binding and readiness |
| `/control/content/feeds` | Feature state, source table with URL, last checked, state; destination as a value | State toggle, source editors, Save and Discard | AI updates binding, readiness, last poll note |
| `/control/content/announcements` | Composer with message, title, body, footer, color, image; Post action | Same composer; page-save owns only canonical settings | Destination binding, send permission readiness, Discord preview |
| `/control/content/live` | Dispatch flow with destination, topic, ping role, Post action | Same flow; no page-save for publish | Live destination, ping role, readiness |
| `/control/utilities/ticket-configuration` | Feature state, ticket types table with key, description, status | Type editor with create, edit, disable, re-enable, Save and Discard | Panel, logs, category bindings and readiness |
| `/control/utilities/anonymous-questions` | Feature state and intake behavior summary | State toggle, Save and Discard | Anonymous questions binding and readiness |
| `/control/workflows/moderation` | Feature state, configuration summary, then operational guidance as a secondary section | State toggle, Save and Discard | Moderation log and compromised-account-trap bindings, trap confirmation |
| `/control/analytics` | Range control, metrics, real-series chart, no duplicate resource table | Same view with reporting toggle | Report destination, readiness, latest report state |
| `/control/activity` | Canonical page header, chronological list, pagination, async indicator | Not editable | None. Center expands. |
| `/control/mappings/channels` | Resources header, Channels, Roles, Categories tabs, full table | Edit panel for the selected resource | None by default. Center expands. |
| `/control/mappings/roles` | Same as Channels | Same as Channels | None by default. Center expands. |
| `/control/mappings/categories` | Same as Channels | Same as Channels | None by default. Center expands. |
| `/control/commands` | Canonical page header, task table, manual link | Not editable | None. Center expands. |
| `/control/workflows/ticket-handling` | Playbook header and step list | Not editable | None. Center expands. |
| `/control/workflows/events` | Playbook header and step list | Not editable | None. Center expands. |

Rules that apply to every row:

- Read mode never hides feature state behind Edit settings.
- Internal identifiers and enum values never appear as labels. Humanize style, status, and action values.
- No feature page tells the operator to go to Mappings for a resource it owns.
- "Not connected" copy names the exact resource and links to the owning page only when the feature does not own it.
- Empty data uses the approved empty state, not a blank region.

---

## Task 0: Record the finish decision and create the finish branch

### Files

- Create: `docs/superpowers/decisions/2026-10-21-control-redesign-finish.md`
- Create: `docs/superpowers/plans/2026-10-21-control-redesign-finish.md`
- Modify: `docs/superpowers/plans/2026-10-17-control-redesign-completion.md`

### Behavior

The decision record states:

- rendered route evidence is mandatory for completion
- the three delivery lines are consolidated into `web/control-redesign-finish-r1`
- canonical cleanup is not merged wholesale
- the spec's tokens and geometry remain authoritative
- the route matrix above is the scope boundary

Add a short status note at the top of the 2026-10-17 completion plan: execution continues in this plan, with the original tasks retained for history.

### Steps

```bash
git fetch origin
git worktree add ../marwie-server-bot-wt-control-redesign-finish-r1 -b web/control-redesign-finish-r1 origin/web/rob-bot-site-production
```

Then, in the new worktree:

```bash
git merge --ff-only 640fa16
git cherry-pick 534eae2
```

`640fa16` is a direct child of the production tip, so it should fast-forward. If `control.css` conflicts during the second step, keep the finish branch's file structure and re-apply the two motion values from `534eae2` by hand.

### Verify

```bash
npm run check:web
npm run test:web
git diff --check
```

Expected: all tests pass, zero failures, clean whitespace check. Record the baseline count. The finish branch starts at 235 passing web tests. The 259 count belongs to the local hosting line.

Stop if the port loses production-only mapping keys, Anonymous Messages behavior, or compromised-account-trap support.

---

## Task 1: Capture the baseline and reproduce the gaps

### Files

- Create: `scripts/control_visual_review.mjs`
- Output only: `.visual-companion/control-finish-review/screenshots/`

### Behavior

The script opens the real local site in a headed browser with a dedicated profile, waits for an authenticated session, and captures each of the 19 routes at:

- 1440x900, dark
- 1440x900, light
- 1024x800, dark, context drawer closed and open
- 390x844, dark, page and context drawer

It writes a manifest with route, size, theme, and timestamp. It never builds a replica page. The operator signs in once; the profile persists.

### Steps

```bash
node scripts/control_visual_review.mjs --out .visual-companion/control-finish-review/screenshots
```

Capture the current build before any route change.

### Verify

Expected findings, already observed during investigation:

- Voice & Coworking and Showcase centers contain only the header and save bar.
- Anonymous Questions read mode contains only the header, a note, and Save.
- Notification roles read mode prints raw style values and has no preview.
- Feeds center says "Change the destination in Mappings."
- Commands and Activity reserve an empty 304px right column.
- Analytics repeats the report resource in the center and the context.

Record the actual screenshot paths and any additional gap found. This is the baseline that later screenshots are compared against.

---

## Task 2: Lock render-level contracts in RED tests

### Files

- Create: `web-tests/fixtures/control-route-snapshot.js`
- Create: `web-tests/control-route-render-contract.test.js`
- Modify: `web-tests/control-redesign-completion.test.js`

### Behavior

The fixture exports one coherent snapshot with:

- every canonical resource key, connected
- role, channel, and category objects with names
- feature states
- quiz schedule and at least two questions
- ticket types
- notification panel with two buttons using different styles
- moderation, analytics, and activity data
- page revisions

The test renders each registered page and context through the page registry with persisted state and with an edit draft.

Assertions per route come from the matrix:

- required section headings and data are present in read mode
- feature state is visible in read mode
- edit mode includes the expected inputs
- context contains the required resource keys and page-specific sections
- no route returns a header-only center
- no raw enum values are rendered as labels
- no `Mappings` detour copy appears on a feature that owns the resource
- Commands, Activity, Resources, and Playbooks return empty context
- every context-bearing route returns non-empty, page-specific context

Also assert shell behavior:

- `control.html` links exactly one Control stylesheet group and no handbook stylesheet
- the shell omits the right column when context is empty
- the context trigger is visible at widths below 1200

### Test first

```bash
node --test web-tests/control-route-render-contract.test.js
```

Expected: multiple failures naming the incomplete routes. Record the failure list.

### Implement

Only the fixture and tests in this task. Do not change route markup yet.

### Verify

```bash
node --test web-tests/control-route-render-contract.test.js
```

Expected: RED for the intended reasons, no import or fixture errors.

---

## Task 3: Shared page anatomy and read-mode state

### Files

- Modify: `docs-site/control-components.js`
- Modify: `docs-site/control.css`
- Modify: `docs-site/control-features.css`
- Modify: all domain modules that build a local page header

### Behavior

One shared header component provides:

- title, 28px, weight 500, tracking -0.02em
- concise description
- visible feature state in read mode, as text plus a state chip where useful
- one primary action, normally Edit settings
- state toggle only in edit mode

One shared section component provides:

- heading, description, optional action
- hairline separated sections, 24 to 32px gaps
- no decorative card wrapper

Replace the six near-duplicate page headers. Keep page-specific markup in the domain modules.

### Test first

Extend the render contract:

- read mode contains `Enabled` or `Disabled` for every feature page
- every feature page uses the same header class contract
- Commands, Activity, Resources, and Playbooks use the shared non-editable header

Run the focused test and confirm RED.

### Implement

Add `controlPageHeaderMarkup` and `controlSectionMarkup` to `control-components.js`. Update domain modules to call them.

### Verify

```bash
node --test web-tests/control-route-render-contract.test.js
npm run test:web
```

Expected: render contracts move to GREEN for header behavior, full suite still passes.

---

## Task 4: Finish Engagement routes

### Files

- Modify: `docs-site/control-community.js`
- Modify: `docs-site/control-utilities.js` (Notification roles)
- Modify: `docs-site/control-features.css`
- Modify: `web-tests/control-community.test.js`
- Modify: `web-tests/control-utilities-r1.test.js`

### Behavior

Reputation:

- read mode shows the three thresholds as a progression
- edit mode shows three threshold fields with range help
- state is visible in both modes

Quizzes:

- read mode shows schedule, last posted, total and enabled counts, and a read-only question list with category and prompt
- edit mode keeps the interval and question editors
- no question editor is shown in read mode

Voice & Coworking:

- read mode shows state, behavior summary, and the current temporary voice category
- edit mode shows the state toggle and save actions
- center is never header-only

Showcase:

- read mode shows state, behavior summary, and the three current destination names
- edit mode shows the state toggle and save actions

Notification roles:

- read mode renders the Discord-style preview and a button list with role name, emoji, and humanized style labels (`Primary`, `Secondary`, `Success`, `Danger`)
- edit mode keeps the editor and live preview
- no raw enum value appears in the DOM

### Test first

Add assertions from the matrix to the two domain tests, then run:

```bash
node --test web-tests/control-community.test.js web-tests/control-utilities-r1.test.js
```

Expected: RED for missing read content and raw enum labels.

### Implement

Recompose the five route bodies. Keep existing save, validation, and resource binding behavior.

### Verify

```bash
node --test web-tests/control-community.test.js web-tests/control-utilities-r1.test.js
npm run test:web
node scripts/control_visual_review.mjs --routes /control/community,/control/utilities/notification-roles
```

Expected: focused and full tests pass. Review the five routes and reject any header-only center or raw value.

---

## Task 5: Finish Publishing routes

### Files

- Modify: `docs-site/control-content.js`
- Modify: `docs-site/control-resource-bindings.js`
- Modify: `docs-site/control-features.css`
- Modify: `web-tests/control-content-r1.test.js`
- Modify: `web-tests/control-announcement-channel-compat.test.js`

### Behavior

Feeds:

- destination is rendered as a value, not as a link to Mappings
- remove every `in Mappings` string from this module
- source table and editors remain

Announcements:

- center owns the composer and Post action
- context owns destination binding, send readiness, and the Discord preview
- on screens below 1200, the preview is reachable in the context drawer
- immediate publish remains outside page-save

Live:

- center owns the dispatch flow and Post action
- context owns destination and ping role readiness
- no `in Mappings` copy

### Test first

Assert:

- `control-content.js` contains no `in Mappings` copy
- Feeds read mode prints the destination name
- Announcements context includes the preview and destination
- Live context includes both bindings
- posting controls remain outside page-save actions

```bash
node --test web-tests/control-content-r1.test.js web-tests/control-announcement-channel-compat.test.js
```

Expected: RED for copy and context placement.

### Implement

Move the preview and destination markup into the page's `renderContext`, keep composer and dispatch in the center, and delete the dead `mappingSummary` and `resourceSummaryMarkup` stubs.

### Verify

```bash
node --test web-tests/control-content-r1.test.js web-tests/control-announcement-channel-compat.test.js
npm run test:web
node scripts/control_visual_review.mjs --routes /control/content
```

Expected: focused and full tests pass. Announcements preview is usable from the context drawer at 1024 and 390.

---

## Task 6: Finish Support & Safety and Playbooks

### Files

- Modify: `docs-site/control-utilities.js`
- Modify: `docs-site/control-workflows.js`
- Modify: `docs-site/control-features.css`
- Modify: `web-tests/control-utilities-r1.test.js`
- Modify: `web-tests/control-analytics-workflows.test.js`

### Behavior

Tickets:

- read mode shows state, ticket types, and behavior summary
- edit mode keeps the full type editor
- context keeps the three bindings and readiness

Anonymous Questions:

- read mode shows state and a short intake behavior summary
- edit mode shows the state toggle and save actions
- the anonymity note remains

Moderation:

- uses the standard feature page header and state
- configuration is the primary section
- operational guidance is a secondary section, not the whole page
- the playbook timeline pattern is not the page's primary layout
- context keeps log and trap bindings with the existing trap confirmation

Ticket handling and Events:

- remain guidance-only Playbooks
- use the shared non-editable header and step anatomy
- no save, no context, no state toggle

### Test first

Assert the required sections, visible state, trap confirmation, and playbook structure.

```bash
node --test web-tests/control-utilities-r1.test.js web-tests/control-analytics-workflows.test.js
```

Expected: RED for the missing Moderation feature layout and thin Bodies.

### Implement

Recompose the three feature routes and the two playbooks. Keep `set_feature` and resource behavior unchanged.

### Verify

```bash
node --test web-tests/control-utilities-r1.test.js web-tests/control-analytics-workflows.test.js
npm run test:web
node scripts/control_visual_review.mjs --routes /control/utilities/ticket-configuration,/control/utilities/anonymous-questions,/control/workflows
```

Expected: focused and full tests pass. Moderation reads as a feature page with guidance, not as a copy of the playbooks.

---

## Task 7: Finish Insights and System surfaces

### Files

- Modify: `docs-site/control-analytics.js`
- Modify: `docs-site/control-secondary.js`
- Modify: `docs-site/control-mappings.js`
- Modify: `docs-site/control-features.css`
- Modify: `web-tests/control-analytics-workflows.test.js`
- Modify: `web-tests/control-secondary-integration.test.js`
- Modify: `web-tests/control-mappings.test.js`

### Behavior

Analytics:

- center keeps range, metrics, and chart
- the duplicate report resource table is removed
- context owns report destination and readiness

Activity:

- shared non-editable page header
- list, pagination, loading, error, and async indicator preserved
- no context column reserved

Commands:

- shared non-editable page header
- table and manual link preserved
- no context column reserved

Resources:

- shared header with the three tabs in a stable position
- table and edit panel preserved
- no context column reserved
- all production-only keys remain, including Anonymous Messages

### Test first

Assert the shared header contract, the removed duplicate table, and empty context for the four surfaces.

```bash
node --test web-tests/control-analytics-workflows.test.js web-tests/control-secondary-integration.test.js web-tests/control-mappings.test.js
```

Expected: RED for header and duplication behavior.

### Implement

Apply the shared header and section components. Remove the Analytics duplicate table. Do not change resource keys or page-save ownership.

### Verify

```bash
node --test web-tests/control-analytics-workflows.test.js web-tests/control-secondary-integration.test.js web-tests/control-mappings.test.js
npm run test:web
node scripts/control_visual_review.mjs --routes /control/analytics,/control/activity,/control/commands,/control/mappings
```

Expected: focused and full tests pass. Center fills the space when context is absent.

---

## Task 8: Make the contextual panel page-specific

### Files

- Modify: `docs-site/control-resource-contract.js`
- Modify: `docs-site/control-resource-bindings.js`
- Modify: `docs-site/control-layout.js`
- Modify: `docs-site/control-app.js`
- Modify: `docs-site/control.css`
- Modify: `web-tests/control-route-render-contract.test.js`
- Modify: `web-tests/control-foundation-contract.test.js`

### Behavior

Each page declares its context sections:

- resource bindings
- readiness
- preview
- permissions
- recent activity
- concise help

The generic resource editor remains the shared primitive. Pages add only the sections that help the task.

Shell behavior:

- if context is empty, the right column is removed from the grid and the center expands
- at 900 to 1199, context is a drawer with a visible Context trigger
- below 900, the trigger remains visible and the drawer traps focus, closes on Escape, and restores focus
- resizing across 1200 re-syncs trigger visibility and drawer state
- no empty right shell, no artificial filler

### Test first

Assert:

- Commands, Activity, Resources, and Playbooks produce no context and no reserved column
- Announcements, Analytics, Moderation, Tickets, and Notification roles produce page-specific sections beyond resource rows
- context trigger visibility updates on a simulated media change
- drawer focus and Escape behavior

```bash
node --test web-tests/control-route-render-contract.test.js web-tests/control-foundation-contract.test.js
```

Expected: RED for the generic panel and column reservation.

### Implement

Add a context declaration to the page contract, compose sections in `withResourceBindings`, set a shell data attribute for context presence, and add the matching CSS. Add a `change` listener for the context media query.

### Verify

```bash
node --test web-tests/control-route-render-contract.test.js web-tests/control-foundation-contract.test.js
npm run test:web
```

Expected: GREEN. Keyboard check at 1024 and 390: open Context, Tab stays inside, Escape closes, focus returns to the trigger.

---

## Task 9: Install the single canonical style layer

### Files

- Modify: `docs-site/control.html`
- Modify: `docs-site/control.css`
- Modify: `docs-site/control-features.css`
- Modify: `docs-site/control-app.js`
- Delete: `docs-site/control-emoji-picker.css` only if the picker is fully covered by the canonical layer
- Delete: unused domain stylesheets if any remain after the port
- Modify: `web-tests/control-foundation-contract.test.js`
- Modify: `web-tests/control-typography.test.js`
- Modify: `web-tests/control-theme-surfaces.test.js`
- Modify: `web-tests/control-cleanup-wave11.test.js`
- Modify: `web-tests/control-legacy-removal.test.js`

### Behavior

- Remove the `/styles.css` link and every dependency on `--surface`, `--border`, `--muted`, `--quiet`, and handbook `sr-only`.
- Define every required token in `control.css` using the spec values. Do not use the canonical-cleanup palette.
- Provide `.sr-only` in the Control layer.
- Keep one stylesheet group: `control.css` for foundation and shell, `control-features.css` for route anatomy, or merge them if the split no longer earns its place. Do not ship two competing visual systems.
- Remove the domain stylesheet loader.
- Correct the type roles to the spec: page title 28px/500, section 18px/600, body 14px/400, metadata 13px where readable.
- Correct geometry to spec: 36px nav rows, 36px desktop controls, 44px coarse-pointer targets, 240 and 304px shells, 12px inset and gap, 24px radius.
- Bump every changed asset query string in `control.html` in the same commit.

### Test first

Assert:

- `control.html` contains no `styles.css`
- every `var(--...)` used by Control is defined in the Control layer
- no `font-weight: 650` or `700` remains in Control files
- page title computes from the 28px role, not a 40px clamp
- asset query strings changed relative to the previous values

```bash
node --test web-tests/control-foundation-contract.test.js web-tests/control-typography.test.js web-tests/control-theme-surfaces.test.js
```

Expected: RED for handbook dependency, weights, and type sizes.

### Implement

Port the semantic tokens already approved in the spec. Delete the alias block that reads from the handbook. Remove the dead files. Update tests that referenced the deleted layers.

### Verify

```bash
npm run check:web
npm run test:web
node scripts/control_visual_review.mjs --themes light,dark
```

Expected: full suite passes. Control renders identically with the handbook stylesheet absent. No unstyled or miscolored component appears in the screenshots.

---

## Task 10: Responsive, accessibility, and standards sweep

### Files

- Modify: `docs-site/control.css`
- Modify: `docs-site/control-features.css`
- Modify: page modules where markup order or labels are wrong
- Modify: relevant foundation and accessibility tests

### Behavior

- 1200 and up: three regions when context exists, two when it does not
- 900 to 1199: left and center, context drawer
- below 900: top bar, navigation drawer, context drawer
- below 640: single-column feature layout, 44px targets, 16px inputs
- no horizontal overflow at 390
- 200 percent zoom reflows without clipped controls
- focus visible on every interactive element
- reduced motion disables orbit and breathe animation
- forced colors preserves boundaries and current state
- heading order and landmark order are correct
- nav child rows meet 36px

### Test first

Extend the foundation and route contracts for the breakpoints, target sizes, heading order, and reduced motion. Run:

```bash
node --test web-tests/control-foundation-contract.test.js web-tests/control-route-render-contract.test.js
```

Expected: RED for any remaining off-spec value.

### Implement

Fix the CSS and markup. Do not add JavaScript for effects that CSS can do.

### Verify

```bash
npm run test:web
node scripts/control_visual_review.mjs --sizes 1440x900,1024x800,390x844 --themes light,dark --motion reduced,forced-colors
```

Expected: no overflow, no clipped controls, no motion under reduced motion, readable forced colors.

---

## Task 11: Whole-Control visual acceptance

### Files

- Output only: `.visual-companion/control-finish-review/screenshots/`
- Modify: this plan's acceptance table

### Behavior

Capture every route from the finish branch at:

- wide desktop, light and dark
- 1024 with context closed and open
- 390 with context closed and open, where context exists

Review each route against the matrix and the design QA checklist in section 40 of the spec.

Record one of these per route:

- pass
- fail with a concrete defect
- not applicable

A route fails if it has a header-only center, a reserved empty right column, raw enum values, Mappings detour copy, inconsistent header anatomy, clipped content, or a legacy card/timeline body where the spec calls for flat sections.

Do not accept screenshots from a hand-built replica. Use the script against the authenticated local site.

### Verify

Review every captured route with the operator. Fix defects and recapture the affected routes until every row passes.

Automated gates:

```bash
npm run check:web
npm run test:web
git diff --check
```

Expected: zero failures and a clean whitespace check.

---

## Task 12: Promote and verify live

### Files

- Modify: `docs/superpowers/decisions/2026-10-21-control-redesign-finish.md` (acceptance record)
- Modify: this plan's checkboxes
- Modify: `docs/operations/local-website-hosting.md` if verification steps changed

### Behavior

Promotion order:

1. Push `web/control-redesign-finish-r1`.
2. Merge it into `web/rob-bot-site-production`.
3. Integrate the same commits into `ops/local-web-hosting-r1` without resetting or cleaning the runtime edits.
4. Run the full web suite in the local-hosting worktree.
5. Restart only `com.aedwon.marwie-server-web` if backend web modules changed.
6. Verify `/healthz`.
7. Verify the public host serves the new asset versions.
8. Inspect every canonical route on the public host, signed in.
9. Do not deploy the bot. Do not merge anything into `main`.

### Verify

```bash
npm run check:web
npm run test:web
git diff --check
node scripts/local_web_hosting.mjs check
curl -fsS http://127.0.0.1:8787/healthz
```

Expected: healthy JSON, all tests pass, public host serves the bumped asset versions.

Record the finish branch SHA, production SHA, local-hosting SHA, test count, and the visual acceptance result.

---

## Task 13: Close out the records

### Files

- Modify: `docs/superpowers/plans/2026-10-21-control-redesign-finish.md`
- Modify: `docs/superpowers/decisions/2026-10-21-control-redesign-finish.md`

### Behavior

- Tick every completed task.
- Record the actual commands and results.
- Record any route accepted with a known limitation, and why.
- Link the screenshot folder and the manifest.
- State that the 2026-10-17 completion plan is fully superseded.

Do not claim completion unless the visual acceptance table has no fails.

---

## Final verification

Run from the finish branch:

```bash
npm run check:web
npm run test:web
git diff --check
```

Run from the local-hosting worktree after integration:

```bash
npm run check:web
npm run test:web
node scripts/local_web_hosting.mjs check
curl -fsS http://127.0.0.1:8787/healthz
```

Python checks are not required unless a Python file changes. If one changes, run the repository's Python gates named in `package.json` and record the results.

## Stop conditions

Stop and report if:

- the finish branch cannot be created from the current production tip
- porting the legacy removal changes loses Anonymous Messages or compromised-account-trap behavior
- a route cannot satisfy its matrix row without a new API or persistence change
- the save, revision, authorization, or CSRF contracts would need to change
- the visual review requires a feature that does not exist in the product
- the local runtime worktree conflicts in a way that risks the uncommitted operator changes
- an unrelated test failure already exists before the task starts

## Acceptance table

Status on 2026-10-22: live read and edit captures completed against the real local server through `https://aidevph.aedwon.site` on 2026-10-21. That hostname routes to the local origin at `127.0.0.1:8787` and uses the same database and backend. The read capture is in `.visual-companion/control-finish-review/live-read` (162 images). The edit capture is in `.visual-companion/control-finish-review/live-edit` (300 images).

One defect was found in Notification roles edit mode and fixed on 2026-10-22: the page rendered an inert Disabled feature toggle in edit mode and no state chip in read mode. The page has no `notification_roles` feature flag. The edit-mode toggle was removed, a render contract test was added, and the fixed views were recaptured live in `.visual-companion/control-finish-review/live-edit-notification-roles4` (20 images). The live edit images were copied into `live-edit` and accepted.

| Route | Wide light | Wide dark | 1024 context | 390 | Result |
| --- | --- | --- | --- | --- | --- |
| Reputation | Live pass | Live pass | Live pass | Live pass | Accepted (read and edit) |
| Quizzes | Live pass | Live pass | Live pass | Live pass | Accepted (read and edit) |
| Voice & Coworking | Live pass | Live pass | Live pass | Live pass | Accepted (read and edit) |
| Showcase | Live pass | Live pass | Live pass | Live pass | Accepted (read and edit) |
| Notification roles | Live pass | Live pass | Live pass | Live pass | Accepted (read and edit) |
| Feeds | Live pass | Live pass | Live pass | Live pass | Accepted (read and edit) |
| Announcements | Live pass | Live pass | Live pass | Live pass | Accepted (read and edit) |
| Live | Live pass | Live pass | Live pass | Live pass | Accepted (read and edit) |
| Tickets | Live pass | Live pass | Live pass | Live pass | Accepted (read and edit) |
| Anonymous Questions | Live pass | Live pass | Live pass | Live pass | Accepted (read and edit) |
| Moderation | Live pass | Live pass | Live pass | Live pass | Accepted (read and edit) |
| Analytics | Live pass | Live pass | Live pass | Live pass | Accepted (read and edit) |
| Activity | Live pass | Live pass | N/A | Live pass | Accepted (read only) |
| Resources Channels | Live pass | Live pass | N/A | Live pass | Accepted (read and mapping edit) |
| Resources Roles | Live pass | Live pass | N/A | Live pass | Accepted (read and mapping edit) |
| Resources Categories | Live pass | Live pass | N/A | Live pass | Accepted (read and mapping edit) |
| Commands | Live pass | Live pass | N/A | Live pass | Accepted (read only) |
| Ticket handling | Live pass | Live pass | N/A | Live pass | Accepted (read only) |
| Events | Live pass | Live pass | N/A | Live pass | Accepted (read only) |

## Review follow-up (2026-10-22)

The acceptance table above is the earlier capture record. The 2026-10-22 live review reopened it.

The page save actions are now one shared floating save bar at the page end on every edit route. The bar is sticky at `bottom: max(14px, env(safe-area-inset-bottom))`, with a 12px radius, translucent surface, hairline border, blur, and `--shadow-save-bar`. Short pages use a flex column with `min-height: calc(100dvh - 2rem)` and `margin-top: auto` so the bar pins to the viewport bottom. The global changes tray clears the bar below 1200px and on mobile.

Files changed: `control-features.css`, `control.css`, `control.html`, the six page modules, `control-route-render-contract.test.js`, `control-redesign-completion.test.js`, `control-legacy-removal.test.js`, `control-theme-surfaces.test.js`, and `control-stage3-reconciliation.test.js`.

Verification: `npm run test:web` 248 pass, `npm run check:web` pass, `git diff --check` pass. Visual acceptance was later completed on 2026-10-22.

## Review follow-up: shell navigation and panel layout (2026-10-22)

The live review approved a shell with an icon rail, one navigation toggle, a content-gated context panel, and no 900px to 1199px top bar. The approved model is recorded in `docs/superpowers/decisions/2026-10-22-control-shell-navigation.md` and section 13 of the design system.

### Files

- Create: `docs/superpowers/decisions/2026-10-22-control-shell-navigation.md`
- Create: `docs-site/control-icons.js`
- Create: `docs-site/control-shell-layout.js`
- Modify: `docs-site/control.html`
- Modify: `docs-site/control.css`
- Modify: `docs-site/control-features.css`
- Modify: `docs-site/control-app.js`
- Modify: `docs-site/control-layout.js`
- Modify: `docs-site/control-navigation.js`
- Modify: `docs-site/control-components.js`
- Modify: `docs-site/control-router.js`
- Modify: `web-tests/control-sidebar-polish.test.js`
- Modify: `web-tests/control-foundation-regressions.test.js`
- Modify: `web-tests/control-route-render-contract.test.js`
- Create: `web-tests/control-shell-layout.test.js`

### Behavior

1. Add a pure layout resolver with the 240px labeled width, 64px rail, 304px panel, and 600px center floor.
2. Set `data-nav-mode` and `data-context-mode` from the resolver. Do not add fixed 900px or 1200px bands.
3. Add Phosphor icons to every navigation destination and group. Inline the SVG paths.
4. Add the 64px rail markup. Keep all destinations visible, use hairline dividers, and keep the account menu reachable.
5. Add one navigation toggle at the top right. Save the operator's choice. Use the automatic collapse when no choice is saved.
6. Keep the context panel a column while it fits. Move the Context trigger to the page header when the panel is a drawer and the navigation is not a drawer. Use the top bar only when the navigation is a drawer.
7. Replace page layout media queries with container queries against the center width.
8. Remove the 900px to 1199px top bar rules.
9. At drawer widths, opening one drawer closes the other so only one overlay is active.

### Verify

```bash
npm run test:web
npm run check:web
git diff --check
```

Result on 2026-10-22:

- `npm run test:web`: 266 pass, 0 fail.
- `npm run check:web`: pass.
- `git diff --check`: pass.
- Signed-in fixture checked at 1120, 1000, 900, 700, and 390px in light and dark. At 1120 the rail and context column are visible. At 1000 and 900 the context panel is a drawer with a page header trigger. At 700 the rail and context drawer are visible. Below 700 the navigation is a drawer and the top bar has Menu and Context. Drawer open, close, Escape, and focus return were checked. The account menu paints above the center. The narrow context drawer fills the content viewport without horizontal overflow.
- The user accepted the live build on 2026-10-22 and asked to commit and merge.

### Review follow-up: status pills, current group, and toggle icon (2026-10-22)

The live review asked for three visual corrections.

1. Remove the leading dot from `Enabled` and the other status chips.
2. Stop the current feature group label from centering and remove its leading dot.
3. Replace the double-chevron navigation toggle with a sidebar panel icon.

Files changed: `docs-site/control.css`, `docs-site/control-app.js`, `docs-site/control.html`, `web-tests/control-sidebar-polish.test.js`, `web-tests/control-theme-surfaces.test.js`, the design system, the shell decision record, and this plan.

Result on 2026-10-22:

- `npm run test:web`: 267 pass, 0 fail.
- `npm run check:web`: pass.
- `git diff --check`: pass.
- Signed-in fixture checked at 1236, 1120, 1000, and 390px in light and dark. The status chip has no leading dot. The current group label starts at the navigation content edge. No `.control-nav-marker` exists. The toggle has one sidebar panel icon in both labeled and rail states. No horizontal overflow.
- Layout thresholds are unchanged. The earlier 700px live check still applies.

### Review follow-up: Discord preview fidelity (2026-10-22)

The live review asked for the announcement embed and notification role panel previews to read like the Discord messages they approximate. The two previews previously used a generic dark card, a letter avatar, a block message layout, browser-default disabled buttons, and a fixed accent color for the embed edge.

Changes:

1. Render both previews as Discord messages with a channel header, 40px bot avatar, Rob-bot name, APP tag, preview timestamp, message body, and embed surface.
2. Reflect the announcement composer color through `--embed-color` and style the title, body, footer, and image on the Discord embed surface.
3. Use Discord blurple for the notification panel embed and render its buttons with Discord primary, secondary, success, and danger colors, 32px height, 3px radius, and action rows of at most five.
4. Keep the Preview labels and notes. Keep preview buttons disabled.
5. Use `/rob-robin.jpg?v=1` as the bot avatar in both previews.
6. Use the 12px metadata floor for the APP tag instead of Discord's 10px label.

Files changed: `control-content.js`, `control-utilities.js`, `control-features.css`, `control.html`, `control-legacy-removal.test.js`, `control-stage3-reconciliation.test.js`, the design system, and this plan. Create `web-tests/control-discord-preview.test.js`.

Result on 2026-10-22:

- `npm run test:web`: 270 pass, 0 fail.
- `npm run check:web`: pass.
- `git diff --check`: pass.
- Signed-in fixture checked at 1236px in light and dark. The announcement preview was checked in the context column with a title, body, footer, image, and selected embed color. The notification preview was checked in read and edit modes. The context drawer was forced open at the same fixed 304px panel width; the preview width and overflow are unchanged.
- Policy read: `Aedwon/Pantas` main at `17db830f931574f38530c51aed37c7d8ba2645e1`; repository policy read from `origin/main`.
- The user accepted the live build on 2026-10-22 and asked to commit and merge.

### Review follow-up: sidebar brand and account swap (2026-10-22)

The live review asked to swap the signed-in profile block with the Rob-bot Control Panel brand block.

Changes:

1. Move the brand into the fixed head beside the navigation toggle.
2. Move the signed-in account and appearance controls into a fixed footer below the scrolling navigation body.
3. Open the account menu upward in the labeled and drawer forms, and to the right in the rail.
4. Keep the drawer close control in the head and keep the toggle hidden in the drawer.
5. Bump `control.css` to `v=25`.

Files changed: `docs-site/control.html`, `docs-site/control.css`, `web-tests/control-sidebar-polish.test.js`, `web-tests/control-foundation-regressions.test.js`, `web-tests/control-theme-surfaces.test.js`, the design system, the shell decision record, and this plan.

Result on 2026-10-22:

- `npm run test:web`: 271 pass, 0 fail.
- `npm run check:web`: pass.
- `git diff --check`: pass.
- Signed-in fixture checked at 1236px in light and dark. The brand is at the top with the toggle. The account and appearance controls are in the footer. The account menu opens upward over the navigation body.
- Width checks used a same-origin viewport frame so the shell resolver saw the intended width. At 1000px with the labeled navigation and context drawer, the brand, toggle, and footer keep their order. At 1000px with the rail, the brand is a 44px mark above the toggle, the footer keeps the account and appearance controls, and the account menu opens right and upward. At 390px the drawer opens with the brand and close control at the top, the account and appearance controls at the bottom, and no horizontal overflow.

### Promotion and build repair (2026-10-22)

The user accepted the live review and asked to commit and merge. Promotion targets `web/rob-bot-site-production`. The Discord bot and `main` remain unchanged.

The Vercel production deployment was stale at `control.css?v=8`. The production deployment record showed a failed build for `c286a1b`. The cause was the `npm run build` command, which still invoked three anonymous-review overlay scripts. Those scripts were written for an earlier review baseline. Parts of their changes were already present, so the first script stopped on a missing anchor. The build command now runs the verification gates and copies the site output without reapplying the overlay scripts.

Verification before promotion:

- `npm run check:web`: pass.
- `npm run test:web`: 271 pass, 0 fail.
- `git diff --check`: pass.
- Python gates under `uv` with CPython 3.12: compileall pass, Ruff check pass, Ruff format pass, mypy pass, 37 focused tests pass.

Promotion record on 2026-10-22:

- Finish branch: `60229be`.
- Production branch: `60229be`.
- Vercel deployment: `dpl_DRy82sYUU7H6c7pjQTCZCztLsuzE`.
- Local-hosting worktree: `534eae2` plus the preserved runtime edits. It was not reset, cleaned, or modified.
- Live URL: `https://rob-bot-team-guide.vercel.app/control`.
- Live asset versions: `control.css?v=25`, `control-app.js?v=18`, and `control-features.css?v=10`.
- The Vercel project had automatic custom-domain assignment disabled. The custom domain was assigned to the new deployment manually, then automatic assignment was enabled so future production deployments update the same domain.
