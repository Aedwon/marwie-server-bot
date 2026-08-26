# Command manual UI refinement

Date: 2026-08-26
Status: accepted

## Goal

Make `/commands` fast to scan and pleasant to use as a moderator/admin reference without reducing the exhaustiveness or accuracy of the canonical command manual.

## Principles

- Scan first; expand details on demand.
- Workflow is the primary navigation model.
- Command name, permission, syntax, and behavior should be visible before expansion.
- Parameters, prerequisites, side effects, conditions, and examples remain available without navigating to another page.
- Search filters the manual live; it should not behave like a form requiring a Go button.
- Avoid duplicated headings, ornamental labels, and oversized containers.
- Preserve stable command anchors and the 45-command completeness guard.
- Preserve keyboard, mobile, reduced-motion, and theme behavior.

## Required behavior

- Keep all 45 commands and canonical `commands.md` content unchanged.
- Convert each rendered command into a compact reference card.
- Extract permission and syntax into compact metadata visible when collapsed.
- Keep the command's behavior summary visible when collapsed.
- Put the remaining detailed documentation in a native disclosure control.
- Opening a direct `#command-*` URL must reveal the targeted command.
- Live search must match command names and command content, hide nonmatching entries, hide empty workflows, and report the result count.
- `/` remains directly reachable from the Commands page.
- Sidebar workflow navigation remains usable on desktop and mobile.

## Non-goals

- Rewriting command behavior or changing the canonical manual.
- Changing bot runtime behavior.
- Adding a documentation framework or external client dependency.
