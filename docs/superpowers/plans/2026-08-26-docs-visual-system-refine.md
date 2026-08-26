# Docs visual-system refinement plan

Status: in progress
Date: 2026-08-26

## Files

| File | Change |
| --- | --- |
| `docs-site/visual.css` | Shared border-light visual system for handbook and command manual. |
| `docs-site/index.html` | Load the shared visual layer. |
| `docs-site/commands.html` | Load the shared visual layer. |
| `docs-site/app.js` | Make Start a denser task launcher with workflow cues. |
| spec/decision/plan | Record the design contract. |

## Steps

1. Add shared surface, spacing, navigation, section, control, and callout refinements.
2. Replace individually outlined Start cards with one composed task launcher.
3. Reframe health and playbook presentation as structured operating rows instead of cards.
4. Remove outlined command-card styling while preserving scan-first disclosure and full detail.
5. Turn workflow paths into compact inline sequences.
6. Keep tables and dense lists structurally separated where dividers carry meaning.
7. Verify homepage and `/commands` previews, responsive behavior, dark/light themes, and all 45 commands.

## Verification

- No bot CI or Bot-Hosting restart.
- Canonical `docs-site/commands.md` stays unchanged.
- Vercel preview must be READY.
- Branch remains ahead-only from `rob-bot-docs-site`.
