# Command manual UI refinement plan

Status: complete
Date: 2026-08-26

## Files

| File | Change |
| --- | --- |
| `docs-site/commands.html` | Tighten page chrome, search, and navigation labels. |
| `docs-site/commands.css` | Replace document-like styling with compact command cards and disclosures. |
| `docs-site/commands.js` | Structure each command card, live-filter search, and direct-link expansion. |
| spec/decision/plan | Record the UX contract. |

## Completed

1. Preserved workflow grouping and all 45 commands.
2. Removed redundant page copy and the Go-style search interaction.
3. Extracted Syntax, Permission, and What happens into each collapsed command card.
4. Moved parameters, prerequisites, side effects, conditions, and examples into native `<details>` disclosures.
5. Added live full-text filtering with result count, clear action, `/` focus shortcut, and Escape clearing.
6. Empty workflow sections hide while filtering.
7. Direct `#command-*` links open and focus the target command.
8. Global manual guidance is available in a compact `Using this manual` disclosure instead of occupying the main reading path.

## Verification

- No bot CI or Bot-Hosting restart was used.
- Vercel preview for commit `84bdfb5bcc2753b9658bddf7a29f6a0b77240bf0` is READY.
- `docs-site/commands.md` remains blob `2b76ad477712069b102920bb5cdabb91b243ab09`, unchanged from production.
- The renderer retains the existing 45-command source/assignment/runtime completeness guard.
- Static source review confirms the command cards preserve the existing `command-*` anchors and use native `<details>/<summary>` controls.
- Comparison against `rob-bot-docs-site` contains only the three planned docs-site presentation files plus these design records.

A production visual smoke test remains appropriate after merge because the feature branch deployment is a preview and client-side rendering cannot be fully exercised by the connector's static fetch.