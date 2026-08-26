# Control panel prototype plan

Status: refined prototype ready for review
Date: 2026-08-26
Spec: `docs/superpowers/specs/2026-08-26-control-panel-prototype.md`
Decision: `docs/superpowers/decisions/2026-08-26-control-panel-prototype.md`

## Files

| File | Change |
| --- | --- |
| `docs-site/control.html` | Third-page shell, operator navigation, explicit field/action state hooks and live mock Discord previews. |
| `docs-site/control.css` | Control-specific layout, tonal input affordance, stateful actions, dense mappings and Discord preview styling. |
| `docs-site/control.js` | Mock state, exhaustive resources/features, dirty/valid state and local-only preview interactions. |
| spec/decision/plan | Record prototype boundary, field coverage and interaction refinement contract. |

## Completed

1. Rendered a clear prototype/no-write state and mock signed-in server context.
2. Added Overview health and permission state.
3. Added auto-setup discovery/review simulation.
4. Represented all 25 current resource mappings.
5. Represented all 14 feature switches.
6. Added ticket, reputation, quiz, AI feed, publishing, logging/automation and advanced field groups from current bot behavior.
7. Replaced large colored setup tiles with a compact status strip and quieter primary action treatment.
8. Simplified resource mappings so human purpose and selected Discord value dominate while internal keys/types are secondary.
9. Added changed-state indicators to resource mappings and feature switches.
10. Made role-panel refresh disabled at rest and enabled only after a relevant valid mapping change.
11. Reworked inputs/selects/textareas into unmistakably editable filled controls with select chevrons, hover/focus states and clearer placeholders.
12. Added dirty/valid button state for reputation thresholds, reputation adjustment, quiz schedule, quiz question authoring and AI source creation.
13. Added live mock Discord previews for announcement and Live publishing workflows; previews update from local form values.
14. Separated selected-value chips from `+ Add` actions in log exclusions and ticket-type controls.
15. Kept all prototype interactions local-only; review actions still perform no remote mutation.
16. Verified the automatic Vercel preview for commit `88f59fb57aaf907fe846a1adf1e33bc12dc00e1b` is READY.

## Deferred until field/layout approval

- Link `/control` from the production handbook and command manual.
- Add an explicit `/control` rewrite if the production routing model changes; the current catch-all serves `/control` in preview.
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
- Exactly 25 resource mappings and 14 feature switches remain represented in `control.js`.
- Branch remains ahead-only of `docs/command-manual-ui-refine`; changed paths are limited to the control prototype and its design records.
- Latest Vercel preview deployment is READY.
- `control.js` contains no network write path; the prototype boundary remains local DOM state only.
