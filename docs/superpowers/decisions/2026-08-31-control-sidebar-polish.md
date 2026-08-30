# 2026-08-31 — Control sidebar interaction and visual polish

## Context

The existing Control sidebar used literal downward chevrons on expandable domains and rebuilt its entire navigation markup after every route change. The resulting presentation read as a conventional accordion and produced visible jitter when switching child pages. Analytics also sat alone as a direct item among expandable domains, which made the hierarchy look inconsistent.

The user reviewed multiple localhost visual companions and selected the final treatment directly.

## Decisions

- Use the section-switcher visual model with no disclosure chevrons.
- Parent domain buttons reveal children only and never navigate.
- Keep exactly one expandable domain revealed.
- Keep the current-page domain marker independent from the revealed domain.
- Use smooth FLIP-style reflow when the revealed domain changes, with an approximately 190 ms `cubic-bezier(.2,.8,.2,1)` transform and a restrained 120 ms child fade.
- Do not rebuild or animate the sidebar when navigating between children in the same domain.
- Move Analytics into the direct secondary group with Commands and Activity.
- Render `Rob-bot Control Panel` as a one-line footer brand.
- Use icon-only Dark, Light, and System theme controls with accessible names.
- Remove decorative card outlines and use spacing, surface tone, radius, and restrained elevation for card separation.
- Make interactive states more legible through stronger hover fills, subtle pressed compression, and clear focus-visible treatment.

## Alternatives rejected

- Keep a refined accordion with plus/minus controls: still preserves the disclosure interaction the user disliked.
- Show all child groups permanently: visually heavier and less focused.
- Let parent clicks navigate to a remembered child: conflicts with the selected reveal-only behavior.
- Move the marker to the revealed domain: hides where the currently loaded page belongs.
- Animate same-domain child switches: caused the jitter/flicker the user explicitly asked to remove.

## Consequences

Navigation code must separate revealed-domain state from current-route state. The initial nav can still be rendered from markup, but ordinary route changes must synchronize current states in place instead of replacing the whole nav tree. Decorative borders remain valid for functional controls and separators; the borderless rule applies specifically to card-like surfaces.
