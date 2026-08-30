# Rob-bot Control Sidebar Polish

## Status

Approved for implementation on 2026-08-31. The localhost visual companion at the end of the design session is the visual acceptance reference. The implementation must reproduce that presentation and interaction as closely as the real Control layout permits.

## Goal

Make the Control sidebar cleaner and more deliberate, remove the disclosure-chevron/accordion feel, eliminate navigation flicker, group direct destinations coherently, and apply the approved borderless/interactive visual polish across Control surfaces.

## Approved navigation structure

Primary section switchers, in order:

1. Community
2. Content
3. Utilities
4. Workflows
5. Mappings

Direct destinations, separated below the primary sections:

1. Analytics
2. Commands
3. Activity

Analytics must use the same typography, weight, spacing, hover treatment, and direct-link behavior as Commands and Activity. It is not an expandable section.

## Parent-section behavior

- Remove all disclosure chevrons/glyphs.
- Exactly one expandable section is revealed at a time.
- Clicking a primary section reveals its child list only. It does not navigate or change the current page.
- Clicking the already-revealed section does nothing. It does not collapse.
- The currently loaded page and the revealed section are independent states.
- When a direct destination is current, the last revealed expandable section remains remembered.

## Current-page marker

- The vertical marker belongs to the domain of the currently loaded page, not merely the revealed section.
- If Community / Reputation is current and Content is revealed, Community keeps the marker while Content receives only the subtle open-section surface.
- When a child in Content is selected, the marker moves to Content.
- The incoming marker uses the approved short fade, approximately 120 ms ease-out.
- A direct destination has no expandable-domain marker.

## Motion

Section reveal uses the approved smooth reflow treatment:

- Child-list visibility changes immediately.
- Neighboring primary sections animate to their new positions with a FLIP-style transform.
- Reflow duration: approximately 190 ms.
- Reflow easing: `cubic-bezier(.2,.8,.2,1)`.
- Newly revealed children use a restrained opacity fade of approximately 120 ms ease-out.
- No bounce, spring, stagger, rotating icon, or height-accordion animation.
- `prefers-reduced-motion: reduce` removes effective motion.

## No-flicker child navigation

The current implementation rebuilds the entire navigation on every route change by replacing `shell.nav.innerHTML` inside the navigation render path. That rebuild is the root cause of the visible jitter/flicker when switching children inside one revealed section.

Approved behavior:

- Switching Reputation -> Quizzes -> Voice & Coworking -> Showcase must not rebuild, hide, reveal, fade, or reflow the sidebar.
- Only the current-child selection state changes.
- The marker does not replay when the current domain is unchanged.
- The main page may rerender independently.
- Cross-domain child selection updates the marker without replaying the section-reveal animation.

## Footer and appearance controls

- Replace the two-line `Rob-bot` / `Control` brand lockup with one line: `Rob-bot Control Panel`.
- Keep the Rob-bot image.
- Theme choices are icon-only controls in Dark, Light, System order.
- Use moon, sun, and display/system icons respectively.
- Each icon-only control must keep an accessible name and tooltip/title.
- The selected theme remains exposed through `aria-pressed`.
- Approved visual target: approximately 42 px circular hit targets, tonal selected state, stronger hover state, and a small pressed-state compression.

## Borderless surface treatment

Decorative card borders are removed. Card-like Control surfaces must rely on spacing, tonal hierarchy, radius, and restrained elevation/shadow instead of a visible outline.

This applies to card/panel surfaces such as Community summary/field/question/mapping surfaces, Content cards, Analytics settings, Mappings rows/editors/suggestion surfaces, Utilities editor/floating save surfaces, and equivalent Control card containers.

This does not ban functional separators or control boundaries. Form-field borders, table/list dividers, focus rings, rail separators, validation borders, and other boundaries that communicate structure or state may remain.

## Interaction cues

Buttons and clickable navigation must read as interactive without decorative card outlines.

- Hover states become visibly stronger than the current subtle treatment.
- Pressed states use a restrained scale/compression and stronger tonal fill.
- Keyboard focus remains clearly visible with the Control focus color.
- Primary action buttons retain clear contrast and hierarchy.
- Disabled controls remain clearly disabled and must not animate as if active.
- Motion feedback must respect reduced-motion preferences.

## Accessibility

- Parent section buttons retain correct `aria-expanded`.
- Hidden child groups remain unavailable to normal navigation/focus.
- Current page links retain `aria-current="page"`.
- Theme icon buttons retain accessible names despite having no visible text.
- Focus-visible treatment remains at least as clear as the current Control implementation.
- Existing mobile drawer focus management remains unchanged.

## Non-goals

- No route changes.
- No server/API/database changes.
- No Discord bot runtime changes or restart.
- No changes to save/revision/conflict semantics.
- No unrelated page IA redesign.
- No removal of structural separators that are not decorative card borders.

## Acceptance

The change is acceptable when automated tests prove the state/markup contracts, same-domain child navigation no longer rebuilds the sidebar, the full web suite is green from a dependency-complete workspace, `npm run check:web` is green, `git diff --check` is clean, and a localhost visual pass matches the approved companion for navigation, footer, theme controls, borderless surfaces, and interaction states.
