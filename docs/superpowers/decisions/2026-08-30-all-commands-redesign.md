# All Commands site shell

Date: 2026-08-30
Status: accepted

## Context

The canonical website root now uses the redesigned Control experience, while `/commands` still renders through the older handbook shell. The public command manual must remain complete and unauthenticated because `/control/commands` intentionally covers only three Discord-command-only administrative tasks.

## Decision

Keep `docs/commands.md` and the existing command renderer/search path as the single command-content source, but replace the `/commands` presentation shell with a sibling of Control.

The redesigned page will reuse the shared Control stylesheet plus the shared `control-theme.js` and `control-navigation.js` behavior for dark-default appearance and accessible responsive drawer handling. `commands.css` remains responsible only for command-reference-specific layout and card/table styling.

The `/commands` page will use the Control navigation language, expose `All Commands` as the page identity, link naturally to `/`, retain workflow hash navigation, and stay readable without authentication. Existing command-anchor generation and search/filter behavior remain intact.

## Why

Reusing the existing content/rendering path prevents command-documentation drift, while reusing Control shell primitives avoids introducing a third site design system. Keeping `/commands` public preserves the intended distinction between exhaustive reference documentation and authenticated Control operations.

## Rejected alternatives

Replacing `/commands` with `/control/commands` is rejected because it would remove most of the public command reference. Forking `docs/commands.md` into new page-specific data is rejected because it would create a second command-content source. Retaining handbook shell components and only recoloring them is rejected because it would not satisfy the approved Control sibling experience.
