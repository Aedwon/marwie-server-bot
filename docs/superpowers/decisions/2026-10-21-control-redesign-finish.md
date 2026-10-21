# Control redesign finish boundary

Date: 2026-10-21
Status: Active
Scope: Rob-bot Control website

## Context

The approved Control design system was promoted, then followed by a legacy-removal pass. Passing tests did not prevent several routes from rendering a header over an empty center. The work also split across three lines that no longer match:

- `web/rob-bot-site-production` carries the promotion commit.
- `ops/local-web-hosting-r1` carries the legacy-removal work and uncommitted local runtime edits.
- `web/control-canonical-cleanup-r1` carries overlapping cleanup, is unmerged, and uses a palette and type scale that differ from the approved spec.

The 2026-10-16 Control design system and the 2026-10-17 completion decisions remain authoritative. This entry tightens execution. It does not change the approved design.

## Decision

### Completion evidence

A route is complete only when a render-level test and a reviewed screenshot both show the required page anatomy in read and edit modes. Route lists, token names, and forbidden-string checks are necessary but not sufficient.

The route matrix in `docs/superpowers/plans/2026-10-21-control-redesign-finish.md` is the scope boundary for this pass.

### Delivery line

Work continues on one finish branch, `web/control-redesign-finish-r1`, derived from `origin/web/rob-bot-site-production`. The legacy-removal commits are ported onto it. The local hosting worktree is integrated only after visual acceptance, and its uncommitted runtime edits are preserved.

### Style layer

One canonical Control style layer remains. It uses the semantic tokens and geometry in the 2026-10-16 design system. The handbook stylesheet is not a dependency.

`web/control-canonical-cleanup-r1` is not merged wholesale. Its valid goal, removing the handbook dependency and keeping one style layer, is re-implemented against the approved tokens. Its palette and type values are rejected.

### Promotion

Promotion to `web/rob-bot-site-production` happens only after the acceptance table has no failing routes. `main` is not touched. The Discord bot is not deployed.

## Consequences

The finish pass costs one manual port of two commits, a possible stylesheet conflict, and route-by-route visual review. In exchange, production stays authoritative, the local runtime work is not put at risk during composition, and the parallel cleanup attempts stop competing.

## Acceptance

Completion requires:

1. All 19 canonical routes pass the render contract in read and edit modes.
2. Every route is captured from the real signed-in local site at wide light, wide dark, 1024, and 390.
3. No route shows a header-only center, a reserved empty right column, raw enum labels, Mappings detour copy, or a legacy body layout.
4. `npm run check:web`, `npm run test:web`, and `git diff --check` pass.
5. The production and local-hosting promotion is recorded with commit identifiers and verification output.
