# Control Redesign Completion Implementation Plan

> **Status:** Superseded for remaining execution by `docs/superpowers/plans/2026-10-21-control-redesign-finish.md`. The tasks below are retained for history.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the approved Rob-bot Control redesign across the entire canonical Control surface, not only shared shell components, and deploy the completed result to the current Cloudflare-to-local-Mac production path.

**Architecture:** Preserve all existing Control URLs, state ownership, authorization, CSRF, revision handling, and durable action semantics while replacing the partial legacy presentation with the approved feature-first three-region design. Decouple navigation grouping from URL families, add one shared page/context composition contract, and let feature pages edit their own canonical Discord resource bindings through the same `set_resource` / `clear_resource` state used by the global Resources view. The global Resources view remains the cross-feature overview and troubleshooting surface.

**Tech Stack:** Vanilla ES modules/CSS, Node `node:test`, existing Control API handlers, Python/discord.py control plane, local Node server on `127.0.0.1:8787`, Cloudflare Tunnel, headless Brave visual QA.

**Spec:** `docs/superpowers/specs/2026-10-16-control-design-system.md`

**Authoritative decisions:**
- `docs/superpowers/decisions/2026-10-16-control-interface-information-architecture.md`
- `docs/superpowers/decisions/2026-10-16-control-brand-and-visual-direction.md`
- `docs/superpowers/decisions/2026-10-16-control-apple-design-principles.md`
- `docs/superpowers/specs/2026-10-17-control-async-task-indicator.md`
- `docs/superpowers/decisions/2026-10-17-control-async-task-indicator.md`

## Global Constraints

- The October 16 design system is Control-wide and supersedes older visual/layout guidance.
- The September refinement plan's constraint that routine resource editing remains Mappings-only is superseded for this completion run by the October feature-ownership decision. Resource state remains canonical and shared; it is not duplicated.
- Keep every existing canonical Control URL valid. Navigation labels/grouping may change without breaking deep links.
- Preserve one canonical resource state. Feature-local resource editing and the global Resources view must read/write the same mapping values.
- Do not duplicate save state or create a second mapping store.
- Keep page-save revision/conflict behavior, authorization, CSRF, idempotency, and action validation intact.
- No bulk-save control or bulk-save semantics.
- Use Figtree 400/500/600 and the canonical semantic token foundation. Do not keep routine 650/700 UI weights.
- Wide desktop is a three-region shell: 240px left floating shell, flat center, 304px contextual right shell, each side inset 12px with 24px radius.
- At 900-1199px the right context becomes a temporary drawer. Below 900px left navigation also becomes a drawer. Below 640px feature layout becomes single-column and touch targets expand.
- Right context is shown only when useful. Do not fill it artificially.
- Default theme preference is System. Existing explicit user choice still persists.
- Phosphor Regular is the icon language where an icon is useful. Do not add decorative icon clutter.
- Preserve all current production-only mapping keys and local-runtime behavior when reconciling branches, including Anonymous Messages mappings and compromised-account-trap support.
- Do not restart or redeploy the Discord bot. Restart only the local website LaunchAgent when backend web modules changed and require process reload.
- Final completion means all repository web tests pass. A 240/242 or similar partial result is not acceptable.

## Canonical Navigation

Primary feature groups are non-destination organization layers. Existing URLs remain unchanged.

### Engagement
- Reputation -> `/control/community/reputation`
- Quizzes -> `/control/community/quizzes`
- Voice & Coworking -> `/control/community/voice-coworking`
- Showcase -> `/control/community/showcase`
- Notification roles -> `/control/utilities/notification-roles`

### Publishing
- Feeds -> `/control/content/feeds`
- Announcements -> `/control/content/announcements`
- Live -> `/control/content/live`

### Support & Safety
- Tickets -> `/control/utilities/ticket-configuration`
- Anonymous Questions -> `/control/utilities/anonymous-questions`
- Moderation -> `/control/workflows/moderation`

### Insights
- Analytics -> `/control/analytics`
- Activity -> `/control/activity`

### System
- Resources -> last-used `/control/mappings/{channels|roles|categories}`; center page exposes Channels / Roles / Categories tabs
- Commands -> `/control/commands`

### Secondary Playbooks
- Ticket handling -> `/control/workflows/ticket-handling`
- Events -> `/control/workflows/events`

Do not add a speculative Bot settings destination. Moderation becomes a Support & Safety feature destination; Ticket handling and Events remain guidance-only Playbooks.

## Feature-local canonical resource bindings

These are editable from the feature's contextual right panel and remain the same canonical values visible in Resources:

- Reputation: `builder_role`, `contributor_role`, `mentor_role`
- Quizzes: `quiz_channel`
- Voice & Coworking: `create_workspace_voice`, `coworking_lounge`, `temp_voice_category`
- Showcase: `showcase_forum`, `app_of_the_week`, `collab_lfg`
- Notification roles: `role_panel`
- Feeds: `ai_updates`
- Announcements: `announcements`
- Live: `live_announcements`, `live_ping_role`
- Tickets: `ticket_panel`, `ticket_logs`, `ticket_category`
- Anonymous Questions: `anon_questions`
- Moderation: `moderation_log`, `compromised_account_trap`
- Analytics: `analytics`

Any current production mapping without a feature page, including Anonymous Messages mappings and other system-only resources, remains editable in Resources only.

## Review Focus

1. **Branch reconciliation:** production-only mappings or local SQLite/runtime work must never be lost while porting the redesign.
2. **Canonical state:** editing a binding from a feature and then opening Resources must show exactly the same value and health state.
3. **Responsive context:** right-panel controls must remain reachable and keyboard-safe when converted to a drawer.
4. **Dirty/conflict handling:** mixed feature + resource changes must remain one revision-aware page save and survive conflicts without silent loss.
5. **Route completeness:** every one of the 19 canonical URLs must render the final design language, including Playbooks, Commands, Activity, and all three Resources subroutes.

---

### Task 1: Lock the completion decision and reconcile onto the current website-production baseline

**Files:**
- Create: `docs/superpowers/decisions/2026-10-17-control-redesign-completion.md`
- Branch/worktree only unless reconciliation conflicts require source edits

**Interfaces:**
- Consumes: current `origin/web/rob-bot-site-production`, verified Control commits `1e3a8ae...` and `2b478e6...`
- Produces: durable navigation/resource-ownership decision plus isolated `web/control-redesign-completion-r1` worktree with current production hotfixes and verified Control refinement work

- [ ] Read current `AGENTS.md`, `CLAUDE.md`, this plan, linked spec, and linked decisions from authoritative refs.
- [ ] Record the user-approved completion boundary in `2026-10-17-control-redesign-completion.md`: exact navigation matrix above, preserved URLs, Moderation under Support & Safety, Ticket handling + Events under secondary Playbooks, no speculative Bot settings, and feature-local editing of the same canonical resource state exposed by Resources.
- [ ] State explicitly in that decision that it supersedes the older Mappings-only routine-editing assumption while preserving canonical storage and existing safety semantics.
- [ ] Create an isolated worktree/branch `web/control-redesign-completion-r1` from the latest `origin/web/rob-bot-site-production` using `superpowers:using-git-worktrees`.
- [ ] Port the already-verified Control refinements without overwriting newer production mapping/resource changes. Reconcile `control-mappings.js`, page-save contracts, and tests deliberately instead of using an indiscriminate conflict strategy.
- [ ] Add/retain Anonymous Messages mapping keys and compromised-account-trap behavior present in current production/local hosting state.
- [ ] Run `npm run check:web` and `npm run test:web`. Expected: all web tests pass before new redesign work begins.
- [ ] Run `git diff --check` and record the clean baseline commit.

### Task 2: Lock the full-redesign contracts in RED tests

**Files:**
- Create: `web-tests/control-redesign-completion.test.js`
- Modify: `web-tests/control-routing.test.js`
- Modify: `web-tests/control-foundation-contract.test.js`
- Modify: the existing page-save ownership test
- Modify: existing domain tests as needed for route-specific contracts

**Interfaces:**
- Produces: route matrix, navigation grouping, three-region shell, contextual resource ownership, theme, typography, and legacy-removal assertions

- [ ] Add an exact 19-route contract and assert every old deep link still resolves.
- [ ] Add the exact navigation groups and membership listed above, Resources last-child restoration, and Playbooks secondary placement.
- [ ] Assert the shell has left, center, and optional right regions with the locked widths/insets/radii/breakpoints.
- [ ] Assert the page registry supports optional contextual rendering and installation without a second page-state store.
- [ ] Assert feature resource ownership matches the exact binding list above and that Resources still exposes every canonical mapping key.
- [ ] Assert feature pages no longer tell users that routine resources "stay in Mappings" or require a `Manage mappings` detour.
- [ ] Assert default theme preference is System, routine UI weights are 400/500/600, and canonical semantic tokens are used.
- [ ] Run focused tests and confirm RED for the missing full-redesign behavior.

### Task 3: Decouple feature navigation from URL families

**Files:**
- Modify: `docs-site/control-router.js`
- Modify: `docs-site/control-navigation.js`
- Modify: `docs-site/control-components.js`
- Modify: `docs-site/control-app.js`
- Modify: `web-tests/control-routing.test.js`
- Modify: `web-tests/control-redesign-completion.test.js`

**Interfaces:**
- Produce: `CONTROL_NAV_GROUPS`, stable destination lookup by existing path, Resources child memory, and Playbooks secondary metadata

- [ ] Keep `CONTROL_DESTINATIONS` path-compatible while introducing navigation groups independent of path prefixes.
- [ ] Implement Engagement, Publishing, Support & Safety, Insights, and System exactly as listed above.
- [ ] Preserve the approved reveal-only section behavior with no chevron decoration and smooth child reflow; selecting a feature reveals its owning group without changing the route when a group label itself is activated.
- [ ] Make Resources one System navigation item whose target is the last-used channels/roles/categories route.
- [ ] Move Ticket handling and Events to a visually secondary Playbooks block; move Moderation into Support & Safety.
- [ ] Run routing/navigation tests to GREEN.

### Task 4: Build the canonical three-region shell and page composition API

**Files:**
- Create: `docs-site/control-layout.js`
- Modify: `docs-site/control.html`
- Modify: `docs-site/control-app.js`
- Modify: `docs-site/control-page-registry.js`
- Modify: `docs-site/control-navigation.js`
- Modify: `docs-site/control.css`
- Modify: `docs-site/control-theme.js`
- Modify: `web-tests/control-foundation-contract.test.js`
- Modify: `web-tests/control-redesign-completion.test.js`

**Interfaces:**
- Produce: page definition support for `renderContext({ state, snapshot })` and optional `install({ root, contextRoot, ... })`
- Produce: right-context mount, responsive drawer controller, context trigger, and content width modes

- [ ] Add the floating/framed 240px left shell, flat center workspace, and optional 304px right shell at `>=1200px`.
- [ ] Add right-context drawer behavior at 900-1199px and dual nav/context drawer behavior below 900px with focus trap, Escape close, and focus restoration.
- [ ] Hide the right region entirely when a page has no useful context and let center expand without placeholder space.
- [ ] Implement readable/form/standard/wide/fluid center width modes from the design spec.
- [ ] Change default theme preference from Dark to System while preserving explicit saved choices and live system changes.
- [ ] Normalize shared typography, focus, spacing, control heights, radii, shell elevation, reduced motion, and touch targets to the design-system tokens.
- [ ] Run shell/theme/accessibility tests to GREEN.

### Task 5: Add one canonical feature resource-binding editor

**Files:**
- Create: `docs-site/control-resource-contract.js`
- Create: `docs-site/control-resource-bindings.js`
- Modify: `docs-site/control-mappings.js`
- Modify: `docs-site/control-page-registry.js`
- Modify: `api/_lib/page-save.js`
- Modify: `web-tests/control-mappings.test.js`
- Modify: page-save ownership tests
- Modify: `web-tests/control-redesign-completion.test.js`

**Interfaces:**
- `FEATURE_RESOURCE_KEYS_BY_PAGE`: exact map from page key to canonical resource keys
- `withResourceBindings(pageDefinition, resourceKeys)`: extends persisted/draft/validation/diff behavior without duplicating resource state
- `resourceContextMarkup(...)`: renders current resource, type, health, editor, and recovery copy in the right panel

- [ ] Move the exact feature resource map into one pure browser/server-importable contract module.
- [ ] Extend page definitions so feature-local resource selections join the same draft and the same logical `Save changes` request as the feature's other settings.
- [ ] Emit only existing `set_resource` / `clear_resource` actions; do not add a second persistence mechanism.
- [ ] Extend page-save ownership so only the listed feature page may mutate each listed resource, while global Resources retains cross-feature ownership by kind.
- [ ] Reuse the existing resource-kind filtering, stale-resource handling, and validation copy from Mappings.
- [ ] Keep destructive compromised-account-trap confirmation behavior intact when edited from Moderation.
- [ ] Test feature -> save -> Resources and Resources -> save -> feature round trips against one canonical snapshot.
- [ ] Run mapping/page-save tests to GREEN.

### Task 6: Finish Engagement pages

**Files:**
- Modify: `docs-site/control-community.js`
- Modify: `docs-site/control-community.css`
- Modify: `docs-site/control-utilities.js`
- Modify: `docs-site/control-utilities.css`
- Modify: relevant Community/Utilities tests

- [ ] Recompose Reputation as flat center configuration plus right-side tier role bindings/readiness.
- [ ] Recompose Quizzes as schedule + question-bank center content plus quiz channel/readiness context.
- [ ] Recompose Voice & Coworking with its two feature states in center and three canonical Discord bindings in context.
- [ ] Recompose Showcase with feature behavior in center and forum/destination bindings in context.
- [ ] Recompose Notification roles so the center owns panel copy and button configuration while the right context owns the role-panel destination and readiness. Remove the bottom mapping table shown in the legacy page.
- [ ] Remove legacy summary-card/mapping-card presentation where the design system calls for flat sections, lists, or tables.
- [ ] Run focused Engagement tests to GREEN.

### Task 7: Finish Publishing pages

**Files:**
- Modify: `docs-site/control-content.js`
- Modify: `docs-site/control-content.css`
- Modify: relevant Content tests

- [ ] Recompose Feeds with source management in center and AI-updates destination/readiness context.
- [ ] Move Announcement destination, permissions/readiness, and Discord preview into the contextual right region while keeping composer/embed editing in center. Preserve all prior announcement safety contracts.
- [ ] Recompose Live with publishing controls in center and live destination + ping role context.
- [ ] Keep immediate publishing state out of revision-aware page-save drafts except canonical settings/resources.
- [ ] Run focused Publishing tests to GREEN.

### Task 8: Finish Support & Safety pages

**Files:**
- Modify: `docs-site/control-utilities.js`
- Modify: `docs-site/control-utilities.css`
- Modify: `docs-site/control-workflows.js`
- Modify: `docs-site/control-analytics-workflows.css`
- Modify: relevant Utilities/Workflows tests

- [ ] Rename the visible `Ticket configuration` destination to `Tickets` while preserving its existing URL and semantics.
- [ ] Recompose Tickets with ticket types/behavior in center and panel/log/category bindings plus readiness in context.
- [ ] Recompose Anonymous Questions with feature behavior in center and destination/readiness context.
- [ ] Treat Moderation as the Support & Safety feature destination, retaining its existing URL, feature state, operational guidance, moderation log, and compromised-account-trap context.
- [ ] Keep Ticket handling and Events as guidance-only Playbooks with the new page anatomy and no page-save ownership.
- [ ] Run focused Support & Safety/Playbooks tests to GREEN.

### Task 9: Finish Insights and System surfaces

**Files:**
- Modify: `docs-site/control-analytics.js`
- Modify: `docs-site/control-analytics-workflows.css`
- Modify: `docs-site/control-secondary.js`
- Modify: `docs-site/control-secondary.css`
- Modify: `docs-site/control-mappings.js`
- Modify: `docs-site/control-mappings.css`
- Modify: relevant Analytics/Activity/Commands/Mappings tests

- [ ] Recompose Analytics as wide center metrics/reporting content with report destination, collection/readiness, and useful latest-state context.
- [ ] Move Activity into Insights navigation and retain the canonical async indicator for genuine queued/running/completed states.
- [ ] Move Commands into System navigation without duplicating the canonical command manual.
- [ ] Present the three existing Mappings URLs as one `Resources` System feature with Channels/Roles/Categories in-page tabs, preserving deep links and every current production resource key.
- [ ] Fix the current Anonymous Messages mapping contract so the full web suite is green.
- [ ] Keep Resources as overview/troubleshooting; feature-owned resources remain editable there and from their owning feature without duplication.
- [ ] Run focused Insights/System tests to GREEN.

### Task 10: Remove legacy visual language and complete accessibility/responsiveness

**Files:**
- Modify: `docs-site/control.css`
- Modify: all Control domain CSS files touched above
- Modify: `docs-site/control.html`
- Modify: relevant foundation/accessibility tests

- [ ] Remove attached-sidebar assumptions, legacy card grids used only for decoration, obsolete mapping-summary styles, raw palette fallbacks, and routine 650/700 weights.
- [ ] Apply the design-system type scale, 36/38px desktop controls, 44px coarse-pointer targets, 12px metadata only where nonessential, and tabular numerals for operational values.
- [ ] Use the approved restrained neutral selection treatment and coherent Phosphor Regular icon language where icons improve scanning.
- [ ] Verify focus-visible, keyboard order, drawer behavior, 200% zoom/reflow, reduced motion, forced colors, and no horizontal overflow at 390px.
- [ ] Bump Control static asset version query strings so the production browser cannot remain on stale CSS/JS after release.
- [ ] Run foundation/accessibility tests to GREEN.

### Task 11: Whole-Control verification and visual review

**Files:** verification only unless a regression is found.

- [ ] Run `npm run check:web`.
- [ ] Run `npm run test:web`. Expected: all tests pass, with zero known Control failures.
- [ ] Run relevant Python Control tests through the repository's existing `uv`/requirements workflow and compile modified Python only if Python changed.
- [ ] Run `git diff --check` and inspect full tracked/untracked status.
- [ ] Serve the real completion worktree and capture every one of the 19 canonical routes at wide desktop in at least one theme.
- [ ] Capture representative routes for Light, Dark, System, 900-1199px context-drawer mode, <900px dual-drawer mode, 390px mobile, reduced motion, and forced colors.
- [ ] Use the configured visual companion/reviewer on the actual rendered screenshots. Review shell consistency, hierarchy, right-panel usefulness, density, clipping, stale legacy surfaces, and route-to-route consistency.
- [ ] Specifically verify Notification roles no longer resembles the legacy screenshot: floating left shell, redesigned center anatomy, contextual right resource panel, no bottom `Discord mappings` table, and correct pending-changes tray behavior.
- [ ] Fix concrete visual regressions and rerun the affected automated + visual checks.

### Task 12: Promote to the real local production path and verify live

**Files:** integration/deployment only unless a compatibility regression is found.

- [ ] Re-read the current `ops/local-web-hosting-r1` worktree and preserve every pre-existing local SQLite/runtime change and untracked artifact.
- [ ] Port the completed website commits into the local-hosting worktree without resetting/cleaning it. Resolve overlaps in `control-app.js`, API/runtime files, and mappings explicitly.
- [ ] Run the complete web suite in the live-hosting worktree. Expected: all tests pass.
- [ ] Run `node scripts/local_web_hosting.mjs check` and verify `http://127.0.0.1:8787/healthz`.
- [ ] If backend web modules changed, restart only `com.aedwon.marwie-server-web`; do not restart the Discord bot or Cloudflare tunnel unless their own health check fails for an unrelated reason.
- [ ] Verify the public domain serves the new cache-busted assets and inspect representative authenticated Control routes through `https://aidevph.aedwon.site`.
- [ ] Verify Notification roles, Announcements, Tickets, Analytics, Resources, Activity, and one Playbook live.
- [ ] Push the completed website branch and update the repository's website-production line only after live verification, keeping `main` unchanged.
- [ ] Record final commit SHAs, live-hosting SHA, production ref, test counts, and visual-review result. Do not call the redesign complete unless every acceptance item above is green.
