# Control legacy-removal acceptance

Date: 2026-10-17
Status: Active
Scope: Rob-bot Control website

## Context

The Control redesign was promoted, but the operator reported that many routes still visibly resemble the previous interface. Passing route, behavior, and shell tests is therefore not sufficient evidence that the Control-wide design system has been implemented.

The 2026-10-16 Control design system remains authoritative. This entry does not change the approved design. It tightens the completion boundary.

## Decision

A Control route is not complete merely because it uses the new shell, navigation, semantic tokens, contextual resource state, or shared save tray. Its feature body must also use the approved visual language and page anatomy.

Legacy Control presentation code may be deleted when it is no longer required for behavior or compatibility. Obsolete CSS, markup helpers, wrapper components, and route-local presentation layers should not be retained solely to minimize the diff.

The implementation may consolidate route-specific styles into shared canonical components when doing so reduces legacy duplication without changing behavior.

## Acceptance

Completion requires a route-by-route visual comparison of all canonical Control destinations. No route may retain a substantial legacy body layout, decorative card grid, old attached-panel treatment, obsolete mapping block, inconsistent typography hierarchy, or parallel visual token system unless the current design specification explicitly calls for it.

Automated tests must include negative contracts for identified legacy selectors/patterns so the old presentation cannot silently return.

The local `http://127.0.0.1:8787/control` instance is the final operator-facing acceptance target before production promotion.
