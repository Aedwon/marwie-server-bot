# Control panel prototype plan

Status: prototype ready for review
Date: 2026-08-26
Spec: `docs/superpowers/specs/2026-08-26-control-panel-prototype.md`
Decision: `docs/superpowers/decisions/2026-08-26-control-panel-prototype.md`

## Files

| File | Change |
| --- | --- |
| `docs-site/control.html` | Third-page shell and operator navigation. |
| `docs-site/control.css` | Control-specific layout and dense form styling. |
| `docs-site/control.js` | Mock state, exhaustive resources/features and prototype interactions. |
| spec/decision/plan | Record prototype boundary and field coverage. |

## Completed

1. Rendered a clear prototype/no-write state and mock signed-in server context.
2. Added Overview health and permission state.
3. Added auto-setup discovery/review simulation.
4. Represented all 25 current resource mappings.
5. Represented all 14 feature switches.
6. Added ticket, reputation, quiz, AI feed, publishing, logging/automation and advanced field groups from current bot behavior.
7. Added local-only interactions and prototype notices for mutation buttons.
8. Verified an automatic Vercel preview is READY.

## Deferred until field/layout approval

- Link `/control` from the production handbook and command manual.
- Add an explicit `/control` rewrite if the production routing model changes; the current catch-all already serves `/control` in preview.
- Discord OAuth.
- Vercel API/backend routes.
- Neon reads/writes.
- Live SQLite → Postgres migration.
- Discord mutation queue / bot execution bridge.

## Verification

- No Neon writes after project creation.
- No Discord OAuth/API calls.
- No Bot-Hosting changes or restart.
- No bot runtime code changes.
- Exactly 25 resource mappings and 14 feature switches represented in `control.js`.
- Vercel preview deployment for the prototype branch is READY.
- The prototype buttons only open a local explanatory dialog; the page contains no `fetch()`/WebSocket/database client.