# Command manual UI refinement plan

Status: in progress
Date: 2026-08-26

## Files

| File | Change |
| --- | --- |
| `docs-site/commands.html` | Tighten page chrome, search, and navigation labels. |
| `docs-site/commands.css` | Replace document-like styling with compact command cards and disclosures. |
| `docs-site/commands.js` | Structure each command card, live-filter search, and direct-link expansion. |
| spec/decision/plan | Record the UX contract. |

## Steps

1. Preserve workflow grouping and all 45 commands.
2. Remove redundant page copy and the Go-style search interaction.
3. Extract Syntax, Permission, and What happens into each command card summary.
4. Move remaining command detail into native `<details>` disclosures.
5. Add live full-text filtering with visible result count and clear action.
6. Hide empty workflow sections while filtering.
7. Open and focus a command when reached through `#command-*`.
8. Verify the Vercel preview serves `/commands`, all 45 commands remain assigned, and the canonical Markdown blob is unchanged.

## Verification

- No bot CI or Bot-Hosting restart.
- Vercel preview must be READY.
- `docs-site/commands.md` must remain unchanged.
- Comparison against `rob-bot-docs-site` must contain only planned files and design records.
