# Control async task indicator

**Date:** 2026-10-17
**Status:** Approved

## Authority and related records

This decision is component-specific. It is subordinate to, and should be interpreted with, the broader Control redesign records:

- `docs/superpowers/specs/2026-10-16-control-design-system.md`
- `docs/superpowers/decisions/2026-10-16-control-interface-information-architecture.md`
- `docs/superpowers/decisions/2026-10-16-control-brand-and-visual-direction.md`
- `docs/superpowers/decisions/2026-10-16-control-apple-design-principles.md`

Detailed indicator behavior is in `docs/superpowers/specs/2026-10-17-control-async-task-indicator.md`, and implementation is sequenced in `docs/superpowers/plans/2026-09-01-control-uiux-refinements.md`.

## Context

The earlier Control state-review prototype used a thicker circular indicator and a travelling-arc motion that felt visually heavy and choppy in context. The indicator was then reviewed inside a max-fidelity Control page with an interactive stroke-width study and a separate smooth-motion study.

## Decision

Use one proportional circular indicator across Rob-bot Control async states.

- **Reference size:** 22 px diameter with a **2.5 px rendered stroke**.
- **Scaling:** stroke scales with the circle. Use one 24 × 24 SVG geometry (`cx=12`, `cy=12`, `r=8.5`, stroke ≈ 2.7273 viewBox units) and scale it naturally at the approved **22, 18, and 16 px** sizes. Do not use `vector-effect: non-scaling-stroke`.
- **Indeterminate running motion:** continuous **linear 1.45 s rotation** plus a separate gentle arc-length breathing cycle. The loop must have no visible reset, snap, stall, or fake percentage.
- **Determinate progress:** same ring, starting at 12 o'clock and filling clockwise from real progress only.
- **Completion:** full-diameter solid circle using the semantic success token, with a proportionally scaled **white check** inside; the transition uses the existing `--duration-medium` (200 ms) motion token.
- **Visual character:** clean, quiet, intuitive, and integrated with the compact interface. No chunky donut, glow, gradient, oversized shadow, or decorative loading treatment.
- **Reduced motion:** remove continuous orbit/breathing and show a stable partial running arc.

The detailed geometry and lifecycle are specified in `docs/superpowers/specs/2026-10-17-control-async-task-indicator.md`.

## Consequences

- Async consumers should reuse one shared renderer/style contract instead of feature-specific spinner markup.
- Ring thickness is judged as a proportion of rendered diameter, so compact contexts remain optically balanced.
- Completion must use a filled green checked circle, not a green outline with a check.
- Existing user-visible status copy remains the primary semantic description; the indicator supplements it and must not create redundant status text.

## Supersedes

This supersedes the earlier thick/choppy async-ring treatment used in the temporary Control state-review companion. It does not change the already-approved state-location hierarchy or save/conflict semantics.

## Implementation clarification

- Consume the semantic token contract from `2026-10-16-control-design-system.md`; do not add component-specific raw palette values or a parallel palette. Dark mode follows the dark semantic tokens automatically.
- Treat 22 px, 18 px, and 16 px as the approved indicator sizes. Preserve the same geometry ratio at each size.
- Queued is static. Initial page hydration remains shell-first/staged; the ring is for task/action work and background refresh with existing data preserved.
- Reserve the indicator slot to avoid layout shift, and keep adjacent visible status copy as the semantic owner whenever it is already present.
- The indicator is presentational and stateless; owning flows retain polling, timers, transitions, persistence, auto-dismissal, and live-region behavior.
