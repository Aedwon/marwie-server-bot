# Control command center redesign plan

Date: 2026-11-23
Status: stages 1-4 built; awaiting owner review
Spec: `docs/superpowers/specs/2026-11-23-control-command-center-redesign.md`
Decisions: `docs/superpowers/decisions/2026-11-23-control-command-center-redesign.md`
Branch: `web/uiux-hillclimb-r1`, cut from `ops/local-web-hosting-r1` at `e16fa49`
Worktree: `/Users/aedwon/Documents/Projects/marwie-server-bot-wt-uiux-hillclimb-r1`

## Goal

Deliver the spec in four stages. Each stage leaves every route working and all gates green.

## Dependencies

- None external. No API, snapshot or save-request shape changes.
- Visual reference: `docs/superpowers/specs/assets/2026-11-23-control-c2-prototype.html`. Its motion and indicator code is the reference implementation for Stage 1. Its element layout is direction only; the spec's element rules win.

## Global constraints

- Follow `AGENTS.md` and `SUBAGENTS.md`. Stay inside the file table.
- Vanilla ES modules and CSS as today. No build step, no new runtime dependency.
- Keep `control-state.js` save semantics. A page save request must be byte-for-byte the shape it is today for the same draft.
- Every removed test assertion is replaced by one that locks the new behavior. Do not delete a test to get green.
- Bump the `?v=` query on every changed CSS or JS import so local hosting serves fresh files.
- Motion: only the tokens in the spec. No `linear` except spinners. No infinite animation outside loading indicators.
- No `stateChipMarkup`, no dotted pills, no borderless inputs.

## Verification commands

```bash
npm run check:web
```

```bash
npm run test:web
```

Visual: run the read-only audit server and capture tool from the lead (scratchpad tooling, not committed). Implementers report gate results; the lead runs visual acceptance.

## File table

| Path | Action | Purpose |
| --- | --- | --- |
| `docs-site/control.html` | modify | New shell markup: top bar, sidebar, main, menus, palette, live region |
| `docs-site/commands.html` | modify | Same shell; Commands content in main |
| `docs-site/index.html` | modify | Same shell; Handbook content in main |
| `docs-site/control.css` | modify | Tokens, shell, nav, rail, drawer, menus, palette, save bar, page model |
| `docs-site/control-features.css` | modify | Page-level styles moved to the page model; remove context panel styles |
| `docs-site/commands.css` | modify | Commands content inside the shell |
| `docs-site/styles.css`, `docs-site/home.css`, `docs-site/visual.css` | modify | Handbook content inside the shell; drop duplicated shell rules |
| `docs-site/control-shell.js` | create | Shared shell for all three documents: nav render, indicator, accordion, rail, peek, drawer, menus, palette |
| `docs-site/control-palette.js` | create | Palette index and filtering (pure) plus DOM install |
| `docs-site/control-app.js` | modify | Use the shared shell; remove context drawer wiring; page entrance; save bar states; blocked navigation |
| `docs-site/control-components.js` | modify | Page header, settings row, master switch row, problem line, disclosure, select markup; remove `stateChipMarkup`, context helpers |
| `docs-site/control-layout.js` | delete | Context drawer wiring retired |
| `docs-site/control-shell-layout.js` | modify | Resolver without the context column |
| `docs-site/control-nav-motion.js`, `docs-site/control-nav-hover.js` | modify or delete | Replaced by CSS-only rail plus peek in `control-shell.js` |
| `docs-site/control-navigation.js`, `docs-site/control-router.js` | modify | Overview route, Resources top-level, Reference links, `/control/commands` redirect |
| `docs-site/control-account.js`, `docs-site/control-theme.js` | modify | Account menu in top bar with Appearance and Sign out |
| `docs-site/control-community.js`, `control-content.js`, `control-utilities.js`, `control-workflows.js`, `control-analytics.js`, `control-mappings.js`, `control-secondary.js`, `control-resource-bindings.js` | modify | Page model per spec; context content moved into pages |
| `docs-site/control-overview.js` | create | Overview page and the problems model |
| `docs-site/control-problems.js` | create | Pure: snapshot to problem list (feature, title, cause, fix target) |
| `docs-site/commands.js`, `docs-site/app.js` | modify | Use the shared shell; row disclosure in Commands; section tracking in Handbook |
| `server/local-server.js` | modify | `/control/commands` redirects to `/commands` |
| `web-tests/*.test.js` | modify / create | Lock new behavior; replace obsolete markup assertions |

Files outside this table require stopping and updating the plan first.

## Stage 1: Shell and motion

Behavior:

1. Motion tokens per spec replace `--duration-*` and `--ease-standard`. Old names alias to new tokens until Stage 4 removes them.
2. One shell markup in all three documents. Top bar: collapse toggle (or menu button under 760px), server switcher, offline notice, search trigger, account button. Signed out: the top bar shows "Sign in with Discord" in place of the server switcher and account.
3. Sidebar renders the same DOM in expanded and rail modes. Rail is CSS only (width, label opacity). No re-render on mode change. Icons keep their x position.
4. Accordion uses `grid-template-rows` 0fr to 1fr. Collapsed children get `tabindex="-1"`.
5. Selection indicator: one element, positioned from `getBoundingClientRect` relative to the nav scroll container. Slides with transform on same-group moves. While any `grid-template-rows` transition runs inside the nav, it samples position each animation frame with its transform transition off, then restores it. Port `placeInd`, `track` and `accordionMoving` from the prototype.
6. Peek on rail hover (150ms in, 200ms out, focus keeps it open). Drawer under 760px with scrim, `inert` background, focus trap and return.
7. Account menu and server menu as popovers. Palette dialog with destination and command index.
8. Page entrance animation on the page container only. No per-block stagger.
9. Context column removed from layout. Until Stage 2 moves each page's context, `renderContext` output renders at the end of the page inside a closed disclosure "Details". No capability is lost between stages.
10. Save bar restyle and state machine per spec, including blocked navigation with nudge, failure with Retry, conflict with Reload.
11. Theme: Appearance in the account menu. View Transition cross-fade when supported.
12. Cross-document View Transitions between Control, Commands and Handbook (`@view-transition { navigation: auto; }`), with the sidebar and top bar given stable `view-transition-name`s so they do not flash.

Tests first: indicator target (current row, collapsed group fallback), rail renders no different DOM than expanded, drawer focus and inert, palette filtering and keyboard, save bar transitions (clean, dirty, saving, saved, failed, conflict, blocked), shell markup parity across the three documents, CSS scan for allowed durations and easings, no `infinite` outside spinner selectors.

## Stage 2: Page model and pages

Behavior:

1. Components: page header with optional lede, settings row, master switch row, problem line, bordered select for channel, role and category, number with unit, composer, disclosure.
2. Pages enter edit state on mount (`beginEdit` after hydrate). Read-only markup paths are removed. Draft updates come from the rows. The page save request is unchanged.
3. Per-page conversion from the page inventory below. Each page's former context sections are placed as the inventory says. The temporary "Details" disclosure from Stage 1 is removed per page as it converts.
4. Problems come from `control-problems.js` and render as row problems. `stateChipMarkup` and its call sites are removed.
5. Resources replaces Mappings in navigation as a top-level item with Channels, Roles and Categories tabs.

Tests first: problems model from snapshot fixtures (deleted channel, missing permission, role above bot, healthy), master switch dims rows and still marks draft, every page renders without the context drawer, no `stateChipMarkup` usage, save request equality for each page given the same draft edits as before.

## Stage 3: Overview, Commands, Handbook

Behavior:

1. Overview at `/control` and `/control/overview`, default landing. Attention list from the problems model, last-7-days bars from the analytics snapshot, healthy-feature disclosure with live summaries.
2. Commands in the shell with search, groups and row disclosure from `docs/commands.md` data already used by `commands.js`. `/control/commands` redirects to `/commands`.
3. Handbook in the shell with 64ch reading width and "On this page" tracking.
4. Palette index includes every command.

Tests first: Overview attention list and empty state, redirect, Commands row disclosure keyboard behavior, Handbook section tracking.

## Stage 4: Acceptance

1. Visual captures for every destination, three sizes, two themes. Frame captures for every motion in the spec table at one-tenth speed.
2. Remove alias tokens and dead CSS. CSS scan passes.
3. Keyboard pass and live-region pass.
4. Owner review on the running site.

## Page inventory

Source: code map of 2026-11-23 (15 registered pages plus Activity, Commands and two playbooks). "Channels" below means a section titled by what it holds ("Channels", "Roles", "Channels and roles", "Channels and category") that lists the page's resource bindings from `featureResourceKeys(pageKey)` as select rows. It is always visible and sits after the feature settings. It replaces the context Readiness section and the generic "Discord resources" context select. Dependency prose from the context panel is dropped unless the snapshot reports the dependency as broken, in which case it is a row problem.

Shared store changes: pages call `beginEdit` on mount; `discard` and a saved outcome keep `mode: 'edit'`; the in-app navigation guard blocks route changes while the current page is dirty.

| Page | Up front | Disclosed | Channels section | Actions |
| --- | --- | --- | --- | --- |
| Overview (new) | Needs attention or "Everything is running."; last 7 days bars | Healthy features with summaries | none | Fix buttons route to the broken control |
| Reputation | Master "Award reputation"; Builder, Contributor, Mentor thresholds (pts) | none | Roles: three tier roles | none |
| Quizzes | Master "Post quizzes on a schedule"; Posts every (hours) | Each question's fields (category, prompt, four options, correct, explanation, include in rotation) | Quiz channel | Add question opens a new expanded question |
| Voice & Coworking | Master "Create voice rooms"; lede names the creator channel | none | Join to create, New rooms go in, Coworking lounge | none |
| Showcase | Master "Run showcase spotlights" | none | Showcase forum, App of the week, Collaboration | none |
| Notification roles | Panel title, description; buttons list | Each button's role, label, emoji, style | Role panel channel | Discord preview beside the form at main width 1100px and up, below it otherwise |
| Feeds | Master "Check feeds"; sources table with add | Each source's fields | AI updates channel | Lede: "Post new items with /ai-source poll in Discord." |
| Announcements | Master "Send announcements from Control"; composer: destination, title, message | More options: footer, color, image URL | none (destination is in the composer) | Preview beside composer as Notification roles; Send keeps the mention confirmation |
| Live | Master "Post live notices"; composer: topic, ping switch, Post live notice | none | Posts to, Ping role | Send permission problem shows on Posts to |
| Tickets | Master "Open tickets from the panel"; ticket types table | Each type's fields | Ticket panel, Ticket logs, Ticket category | Add ticket type |
| Anonymous Questions | Master "Accept anonymous questions"; lede states the intake rule | none | Anonymous questions channel | none |
| Moderation | Master "Log moderation actions" | "How moderation works" (the operating guide) | Moderation log, Compromised account trap (keeps the destructive confirmation) | none |
| Analytics | Range control; lead total and Updated time; chart; breakdown; coverage sentence only when incomplete | none | Weekly report: master "Post the weekly report", Posts to | none |
| Activity | Changes newest first: what, who, when | Each change's detail | none | Load more |
| Resources | Tabs Channels, Roles, Categories; table with select per row; broken rows first | Suggested matches review (opened by the header action) | n/a | Suggest matches, Apply reviewed matches |
| Ticket handling, Events | Numbered steps with one-line summary | Each step's checks and failure conditions | none | Links to the pages each step names |
| Commands | Search, groups, rows | Each row's syntax, options, example | none | `/control/commands` redirects here |

## Test impact

Markup-locking suites expected to change: `control-route-render-contract`, `control-uiux-refinements` (and `-r2`, `-r3`), `control-sidebar-polish`, `control-redesign-completion`, `control-community`, `control-community-r2`, `control-content-r1`, `control-discord-preview`, `control-utilities-r1`, `control-mappings`, `control-mappings-r2`, `control-analytics-workflows`, `control-analytics-v2`, `control-secondary-surfaces`, `control-secondary-integration`, `control-uiux-domain-adoption`, `control-cleanup-wave11`, `control-foundation-contract`, `control-page-registry`, `control-stage3-reconciliation`, `control-main-focus-ux`, `control-typography`, `control-visual-audit-regressions`, `control-theme-surfaces`, `public-pages-design-system`, `commands-redesign`, `commands-r3`, `control-nav-motion`, `control-nav-hover`, `control-shell-layout`. Version-string assertions update with each bump.

Logic suites that must stay green without edits: `control-state` (except the discard and saved mode change, which gets new assertions), `control-page-save`, `control-page-save-endpoint`, `control-actions`, `control-action-status`, `control-api-client`, `control-guild-state-refresh`, `control-local-sqlite`, `control-activity`, `control-mapping-suggestion-groups`, `control-announcement-channel-compat`, `control-anonymous-message-mappings`, `control-compromised-account-trap`, `control-foundation-r3`, `local-server` (plus the redirect test), `local-web-hosting`, `site-production-routing`, `vercel-static-output`.
