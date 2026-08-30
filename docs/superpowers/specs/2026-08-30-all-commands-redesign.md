# All Commands redesign

Date: 2026-08-30
Status: accepted for implementation

## Starting state

- Assigned branch: `web/site-commands-redesign-r1`.
- Exact base: `8c3695c389edbedbb05500c78a41815bf2155c66`.
- Website production branch: `web/rob-bot-site-production`, starting at the same SHA.
- `main` is outside this task and must not move.

## Goal

Redesign the public `/commands` route as **All Commands**, a complete unauthenticated command reference that visually and behaviorally belongs to the redesigned Rob-bot Control site while preserving the existing canonical command-manual content and deep links.

## Information architecture

- `/` remains the redesigned Control site.
- `/commands` is the redesigned full All Commands reference.
- `/control/commands` remains the authenticated guidance for the three administrative tasks that must stay Discord-command-only.
- `/handbook` remains the legacy/reference handbook.

## Presentation contract

The page uses the Control design language and shared patterns instead of the handbook shell:

- dark appearance by default, with Dark, Light, and System choices;
- Control typography hierarchy, surfaces, borders, spacing, responsive behavior, and focus treatment;
- no handbook sidebar, handbook mobile navigation, or legacy appearance chrome;
- a natural link back to `/`;
- page title and primary heading `All Commands`;
- public access with no Discord sign-in requirement.

## Command-reference contract

`docs/commands.md` remains authoritative. The existing rendering path should be preserved instead of duplicating command content. The rendered page must retain all documented commands, syntax, permissions, inputs, prerequisites, side effects, examples, confirmation behavior, operational notes, search/filter behavior, and every existing `command-*` deep-link anchor. Existing `/control/commands` links such as `#command-reputation-award`, `#command-ticket-panel-post`, and `#command-ai-source-poll` must continue to resolve.

Removed Build Help content and stale pre-Wave-11 wording must not be reintroduced.

## Typography and accessibility

- Metadata is 13px / 18px where appropriate.
- Routine UI text is never below 13px.
- WCAG 2.2 AA target.
- Visible keyboard focus and semantic controls.
- State is not conveyed only by color.
- Layout remains usable near 200% zoom and wraps at narrow widths.
- Primary interactive controls target about 44px where applicable.
- Reduced-motion preferences are respected.
- Drawer behavior must not create hidden-focus traps.

## Non-goals and ownership

Do not change slash-command behavior, bot runtime, migrations, Discord OAuth configuration, bot hosting, or production refs. Do not promote Vercel Production. The worker may only commit and push `web/site-commands-redesign-r1`; the coordinator owns release.

## Verification

Use TDD. Add focused regressions that fail against the legacy shell first, then implement the minimum presentation/shell change. Run the focused tests plus `npm run check:web`, `npm run test:web`, `npm run build`, and `git diff --check`. Verify a Vercel Preview for the exact final worker SHA reaches READY before handoff.
