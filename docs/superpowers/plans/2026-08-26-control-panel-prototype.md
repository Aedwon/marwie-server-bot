# Control panel prototype plan

Status: in progress
Date: 2026-08-26
Spec: `docs/superpowers/specs/2026-08-26-control-panel-prototype.md`
Decision: `docs/superpowers/decisions/2026-08-26-control-panel-prototype.md`

## Files

| File | Change |
| --- | --- |
| `docs-site/control.html` | Third-page shell and operator navigation. |
| `docs-site/control.css` | Control-specific layout and dense form styling. |
| `docs-site/control.js` | Mock state, exhaustive resources/features and prototype interactions. |
| `docs-site/index.html` | Link to `/control`. |
| `docs-site/commands.html` | Link to `/control`. |
| `vercel.json` | Route `/control` to the new static page. |
| spec/decision/plan | Record prototype boundary and field coverage. |

## Steps

1. Render a clear prototype/no-write state and mock signed-in server context.
2. Add Overview health and permission state.
3. Add auto-setup discovery/review simulation.
4. Represent all 25 current resource mappings.
5. Represent all 14 feature switches.
6. Add ticket, reputation, quiz, AI feed, publishing, logging/automation and advanced field groups from current bot behavior.
7. Add local-only interactions and prototype notices for mutation buttons.
8. Link `/control` from the handbook and command manual.
9. Verify Vercel preview and exact field counts.

## Verification

- No Neon writes.
- No Discord OAuth/API calls.
- No Bot-Hosting changes or restart.
- No bot runtime code changes.
- Exactly 25 resource mappings and 14 feature switches represented.
- `/`, `/commands` and `/control` remain navigable from the preview.