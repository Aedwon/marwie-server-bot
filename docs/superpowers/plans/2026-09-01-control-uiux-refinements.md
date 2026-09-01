# Control UI/UX Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Do not dispatch subagents for this assignment.

**Goal:** Implement the approved Rob-bot Control UI/UX refinements on `web/control-uiux-refinements-r1` without changing page-save semantics, authorization, CSRF, revision handling, or deployment state.

**Architecture:** Reuse the existing static Control modules and centralized `controlState` store. Add one shared shell-level tray driven by existing page dirty state; add a shared feature-header action pattern consumed by feature pages; keep Mappings page ownership unchanged while rendering summaries as semantic tables; extend the existing immediate Announcement action contract end-to-end so destination selection, message-only posts, optional embeds, images, and literal mention syntax remain safe under existing browser + worker authorization and consequence-confirmation checks.

**Tech Stack:** Vanilla ES modules/CSS, Node `node:test`, Vercel API handlers, Python/discord.py control-plane executor, pytest.

---

## Task 1: Lock UI contracts in focused RED tests

**Files:**
- Create: `web-tests/control-uiux-refinements.test.js`
- Modify: `web-tests/control-content-r1.test.js`
- Modify: `web-tests/control-mappings.test.js`

1. Add tests for a single floating global tray, compact/expanded markup, explicit minimize-only collapse, no unsaved-change dot, section counts as plain numerals, and reduced-motion CSS.
2. Add tests that feature pages use one top-right accessible feature state control beside `Edit settings`, with no visible `Feature status` label/card in read mode.
3. Add Mappings render tests requiring semantic `<table>`, explicit headers, plain status text with no badge/pill/dot wrapper, and deliberate `Manage mappings` actions in cross-page summaries.
4. Add Announcement tests for split composer/preview markup, raw mention preservation, preview mention resolution, destination selection, clear-preserves-destination behavior, field limits/counters, image URL, optional embed construction, and message-only posting.
5. Run focused Node tests and verify they fail for the expected missing behavior before production edits.

## Task 2: Add the shared global status/changes tray

**Files:**
- Create: `docs-site/control-tray.js`
- Modify: `docs-site/control.html`
- Modify: `docs-site/control-app.js`
- Modify: `docs-site/control.css`

1. Render the shell status and existing `controlState.dirtyPages()` into one persistent bottom-right tray mount. Remove the old repeated top workspace status presentation.
2. Implement compact and expanded states as one DOM surface. Compact shows one line with pending-change count; expanded shows one header, server freshness/connection state, grouped dirty-page counts, and a visible but non-operational bulk-save affordance because execution semantics remain under discussion.
3. Keep expanded state open during internal interaction; only the explicit `−` control minimizes it.
4. Use restrained width/height/radius/shadow spring-morph transitions plus delayed content settling; disable/near-disable them under `prefers-reduced-motion`.
5. Re-render tray after hydration, draft/page-state events, saves, conflicts, navigation, and status changes without duplicating page state.
6. Run focused tray tests to GREEN.

## Task 3: Standardize feature page headers and remove redundant status cards

**Files:**
- Modify: `docs-site/control-components.js`
- Modify: `docs-site/control-community.js`
- Modify: `docs-site/control-content.js`
- Modify: `docs-site/control-utilities.js`
- Modify: `docs-site/control-analytics.js`
- Modify: relevant domain CSS files and `docs-site/control.css`

1. Add a shared feature-header action renderer: a compact accessible Enabled/Disabled switch-style state beside a consistently positioned `Edit settings` action. Outside edit mode the feature state remains read-only; in edit mode the existing draft toggle remains the editable source of truth.
2. Replace standalone `Feature status` cards/labels on feature pages with the shared header presentation, preserving each module’s existing feature ownership and draft/save behavior.
3. Keep pages without a feature toggle on their existing header behavior.
4. Run focused page-header tests and existing Community/Content/Utilities/Analytics tests to GREEN.

## Task 4: Convert mapping summaries to the Classic admin table

**Files:**
- Modify: `docs-site/control-community.js`
- Modify: `docs-site/control-utilities.js`
- Modify: `docs-site/control-analytics.js` where mapping summary exists
- Modify: `docs-site/control-mappings.js`
- Modify: `docs-site/control-mappings.css`
- Modify: relevant domain CSS files

1. Render mapping summaries with semantic table headers and stable resource/current/status columns.
2. Render `Connected`, `Unavailable`, or `Not connected` as plain colored text only—no pill, dot, badge, border, or tinted enclosure.
3. Replace vague trailing `Mappings` links with deliberate section-level `Manage mappings` actions.
4. Preserve existing mapping edit/save/suggestion/consequence-confirmation behavior.
5. Run mapping and domain tests to GREEN.

## Task 5: Implement Announcement builder UI and pure client behavior

**Files:**
- Modify: `docs-site/control-content.js`
- Modify: `docs-site/control-content.css`
- Modify: `web-tests/control-content-r1.test.js`
- Modify: `web-tests/control-uiux-refinements.test.js`

1. Add a split builder/Discord-preview layout with `Post announcement` at the top of the preview and destructive text-only `Clear all` at the top-right of the composer.
2. Track immediate composer state locally (not in page-save drafts) so re-renders do not alter revision-aware feature settings. Destination defaults to the mapped Announcements channel when postable, then falls back to the first postable channel.
3. Offer only snapshot text channels where Rob-bot currently has Send Messages; expose embed capability separately for validation. Destination changes update the preview immediately and survive `Clear all`.
4. Keep raw message syntax exactly as typed. Parse `<@USER_ID>`, `<@!USER_ID>`, `<@&ROLE_ID>`, `<#CHANNEL_ID>`, `@everyone`, and `@here` only for allowed-mention metadata and Discord-like preview rendering. Do not rewrite the composer value.
5. Make postability require actual message/title/body content. Footer/color/image alone never creates an embed and never enables posting. Create an embed only when title and/or body is present.
6. Use Discord limits: message 2000, title 256, body/description 4096, footer 2048, total embed text 6000. Show trailing remaining-number counters only.
7. Add one image URL input (`1 max`) below Footer / Embed color. Add compact rounded color swatch that opens a viewport-clamped custom popover without reflow and restores focus when closed.
8. Use a high-contrast white/dark primary Post CTA, preserve current confirmation flow for consequential mentions, and clear composer content only through the explicit Clear all action; successful posting leaves the composer unchanged.
9. Run focused Announcement tests to GREEN.

## Task 6: Extend the immediate Announcement action safely end-to-end

**Files:**
- Modify: `api/_lib/actions.js`
- Modify: `src/marwie_bot/features/control_plane/snapshot.py`
- Modify: `src/marwie_bot/features/control_plane/validation.py`
- Modify: `src/marwie_bot/features/control_plane/executor.py`
- Modify: `web-tests/control-actions.test.js`
- Modify: `tests/test_control_plane_validation.py`
- Modify/add focused executor tests in the existing control-plane test owner

1. Add per-text-channel `send_messages` and `embed_links` capability to the authoritative snapshot from live `permissions_for(guild.me)`.
2. Change browser and Python action validation so Body is optional, at least one of message/title/body is required, embed total text is ≤6000, image URL is optional HTTP(S), and the exact selected channel snowflake is retained.
3. In the executor, resolve the selected guild text channel directly and recheck live Send Messages. Require Embed Links only when title/body creates an embed. Keep feature-enabled, guild membership, mention permission, and allowed-mentions protections intact.
4. Build no `discord.Embed` for message-only posts. Build one embed only for title/body; apply footer/color/image to that embed only.
5. Keep consequence confirmation based on real allowed mentions and preserve CSRF/idempotency/authorization at the existing browser action layer.
6. Run focused JS and Python validation/executor tests to GREEN.

## Task 7: Integrated verification and visual review

**Files:** verification only unless a regression is found.

1. Run `npm run check:web`.
2. Run `npm run test:web`.
3. Run focused Python tests covering control action validation, snapshot serialization, and announcement executor behavior.
4. Run `python -m compileall -q` on modified Python modules or the repo’s equivalent compile check.
5. Run `git diff --check` and inspect `git status --short --branch --untracked-files=all`.
6. Serve the real Control implementation locally and inspect representative tray, header, mappings, Announcement empty/message/embed/mention/destination/color/image states, narrow viewport, and light/dark themes in a browser. Fix only concrete regressions.
7. Self-review the diff against the Approved decision record and verify no Under discussion bulk-save semantics were implemented.

## Task 8: Commit, push, and final identity verification

1. Make coherent feature-branch commits.
2. Re-run fresh verification required by `verification-before-completion`.
3. Push only `web/control-uiux-refinements-r1` using the guarded relay push action.
4. Verify remote feature HEAD equals local HEAD.
5. Re-read `web/rob-bot-site-production` and `main` refs and confirm neither moved from their starting values.
6. Do not merge, deploy, or restart/redeploy the Discord bot.
