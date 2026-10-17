# Control Async Task Indicator Specification

**Status:** Approved
**Date:** 2026-10-17
**Scope:** Rob-bot Control async task/loading indicator only. This does not redefine page skeletons, the state-location hierarchy, or save semantics.

## Authority and related records

This component specification is intentionally narrow and must be read with the canonical Control redesign records:

- `docs/superpowers/specs/2026-10-16-control-design-system.md` — authoritative visual, token, motion, accessibility, and component-system contract.
- `docs/superpowers/decisions/2026-10-16-control-interface-information-architecture.md` — feature ownership, three-region shell, contextual placement, and state clarity.
- `docs/superpowers/decisions/2026-10-16-control-brand-and-visual-direction.md` — brand/visual direction and restraint.
- `docs/superpowers/decisions/2026-10-16-control-apple-design-principles.md` — interaction principles and accessibility expectations.
- `docs/superpowers/decisions/2026-10-17-control-async-task-indicator.md` — the approved component-specific decision record.
- `docs/superpowers/plans/2026-09-01-control-uiux-refinements.md` — implementation sequence and verification.

The 2026-10-16 Control redesign records govern the interface generally. This 2026-10-17 spec narrows only the async task indicator. It does not reopen or replace broader shell, state-location, brand, save/conflict, or accessibility decisions.

## Intent

Use one clean circular status primitive for queued work, indeterminate running work, real determinate progress, and completion. It must feel calm and polished inside the compact Control interface, never like a generic browser spinner or a chunky progress donut.

## Geometry

- Canonical rendered diameter: **22 px**.
- Canonical rendered stroke at 22 px: **2.5 px**.
- Scale stroke with circle diameter instead of keeping a fixed 2.5 px at smaller sizes. The locked proportion is `2.5 / 22 = 0.113636…` of rendered diameter.
- Use a **24 × 24 SVG viewBox** with circle center **`cx=12`, `cy=12`**, radius **`r=8.5`**, and stroke width approximately **2.7273 viewBox units**. Allow the SVG to scale naturally and do **not** use `vector-effect: non-scaling-stroke` on the ring. At the approved smaller sizes this yields approximately **2.05 px at 18 px** and **1.82 px at 16 px**.
- Use `pathLength="100"` for progress geometry so determinate progress uses exact percentages rather than circumference approximations.
- Track is a quiet neutral from the Control design tokens. Active running/progress uses the established sky-blue semantic accent. No glow, gradient, oversized shadow, or decorative halo.

## Design-system integration

- Use the existing Control semantic tokens: `--stroke-subtle` for the track, `--status-info-fg` for active/progress, `--status-success-fg` for success, `--status-warning-fg` for warning/blocked, and `--status-error-fg` for failure. Do not introduce new raw palette values for this component. Component aliases may point to these semantic tokens when useful.
- The canonical Control token foundation from `2026-10-16-control-design-system.md` is a prerequisite. If those semantic tokens are not yet present in the implementation branch, establish/reconcile that foundation first instead of inventing indicator-local fallback colors or a parallel palette.
- Approved rendered sizes are **22 px**, **18 px**, and **16 px**. Use the same 24 x 24 SVG geometry at each size so stroke weight and internal glyph spacing scale proportionally; do not invent intermediate sizes without a concrete layout need.
- Reserve the indicator slot at the chosen size so queued, running, progress, and completion transitions do not shift adjacent text or controls.
- Use this ring for task/action work and compact background refresh while existing data remains visible. Initial page/content hydration keeps the already-approved shell-first staged loading treatment instead of replacing it with a spinner.

## Ownership

The indicator is presentational and stateless. It renders state supplied by its owning feature/action; it does not own polling, timers, task transitions, auto-dismissal, persistence, or live-region announcements. The owning async flow controls what state is shown and for how long.

Where adjacent visible status copy already names the state, that copy remains the semantic/accessibility owner and the SVG is decorative. A standalone indicator may expose the supplied accessible label.

## Lifecycle

### Queued

- Show the neutral ring only.
- No rotation.
- Do not animate the queued state.

### Running, unknown duration

Use the approved smooth-motion prototype:

- The active arc is short and rounded.
- Rotate the arc continuously with a **linear 1.45 s revolution**. The loop must be visually seamless with no dash-offset snap or reset.
- Animate arc length separately with a gentle breathing cycle, approximately `18 82 → 28 72 → 22 78 → 18 82`, using an eased curve around `cubic-bezier(.45, 0, .2, 1)`.
- Rotation and breathing are separate animations. Do not fake percentage progress when no real progress value exists.
- The result should read as continuous motion, not a spinner that repeatedly accelerates, stalls, or jumps.
- Continuous running motion must use transform/stroke animation only and must not cause layout movement.

### Running, known progress

- Stop orbital/breathing animation.
- Start at 12 o'clock and fill clockwise from the real progress value.
- Use `pathLength="100"`; the visible meter is the real percentage only.
- Do not interpolate invented progress between backend updates.

### Completion

- Resolve into a **solid success-green circle** using `--status-success-fg`; do not hardcode a light-theme hex.
- The completed disc fills the **full selected rendered component diameter** (22, 18, or 16 px), rather than filling only the ring path geometry.
- Draw a **white check** inside with balanced optical padding. The check, its stroke, and internal padding scale with the component.
- Use the existing design-system **`--duration-medium` (200 ms)** for the complete resolve → fill → check transition. Do not add a component-specific completion duration. No bounce, glow, confetti, or exaggerated overshoot.

### Failure and blocked states

- Preserve the same circular geometry and sizing.
- Use existing semantic error/warning colors and plain-language status/recovery text.
- Do not introduce a second spinner/progress language.

## Reduced motion

Under `prefers-reduced-motion: reduce`:

- Remove continuous rotation and arc-length breathing.
- Represent unknown running work as a stable partial active arc.
- Determinate progress remains a static truthful percentage.
- Completion may switch directly to the filled green checked circle or use only a minimal opacity transition.

## Accessibility

- Do not rely on the circle color alone; visible status copy must carry the state where the indicator appears in a row or action.
- If adjacent text already names the state, mark the SVG decorative. If the indicator stands alone, provide an accessible state label.
- Preserve keyboard/focus behavior of the owning control; the indicator itself is not an interactive target.
- In forced-colors/high-contrast modes, preserve visible track/meter/check contrast using system colors or equivalent token fallbacks.

## Non-goals

- No universal percentage for indeterminate work.
- No multiple spinner styles by feature.
- No fixed 2.5 px stroke at every diameter.
- No large decorative loading screen added solely to showcase the animation.
