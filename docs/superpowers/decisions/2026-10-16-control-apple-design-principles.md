# Control Apple Design Principles

Date: 2026-10-16

## Purpose

Rob-bot Control should use Apple's design principles as product-design fundamentals without copying Apple's visual interface, platform chrome, component styling, or proprietary visual language.

This decision supplements:

- `2026-10-16-control-interface-information-architecture.md`
- `2026-10-16-control-brand-and-visual-direction.md`

The Mar Wie course site remains the brand and visual-language source. The Cloudflare dashboard reference remains useful for compact administrative hierarchy and navigation ergonomics. Apple contributes interaction and usability principles.

## Sources

Current Apple Human Interface Guidelines and WWDC design guidance were reviewed for principles, including:

- Layout: https://developer.apple.com/design/human-interface-guidelines/layout
- Writing: https://developer.apple.com/design/human-interface-guidelines/writing
- Inclusion: https://developer.apple.com/design/human-interface-guidelines/inclusion
- Lists and tables: https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- Gestures: https://developer.apple.com/design/human-interface-guidelines/gestures
- Principles of great design, WWDC26: https://developer.apple.com/videos/play/wwdc2026/250/

These references inform the principles below. They do not make Control an Apple-styled product.

## Clarity before decoration

Decision: every screen should make three things obvious with minimal interpretation:

1. what matters now
2. what can be interacted with
3. what will happen when the user acts

Use hierarchy, order, spacing, contrast, alignment, and concise language before adding decorative treatment.

Every persistent element must earn the space it occupies. Remove redundant labels, duplicated status, ornamental cards, and controls that do not support the current task.

## Strong visual hierarchy

Decision: order interface content by operator importance, not implementation order.

The most important information and primary action should appear first in normal reading order. Alignment and indentation should communicate relationships. Related controls should be grouped visually and semantically.

The three-region Control layout applies this hierarchy:

- left: navigation and orientation
- center: primary task
- right: supporting context

The right panel must not visually compete with the center workspace.

## Familiarity and consistency

Decision: use familiar web interaction patterns unless a custom interaction clearly reduces effort or ambiguity.

The same kind of object should behave the same way throughout Control. Buttons, toggles, selects, tables, disclosures, dialogs, drawers, status indicators, and navigation states should not change interaction rules from feature to feature.

Use native platform and web semantics where practical, including `button`, `a`, `dialog`, `details`, form labels, tables, and accessible disclosure patterns.

## Concision and task economy

Decision: minimize the number of steps and page transitions needed to complete a coherent administrative task.

This reinforces complete feature ownership. A user configuring Tickets should complete normal ticket configuration inside Tickets instead of navigating through implementation-oriented pages.

Interface copy should be concise, direct, and action-oriented. Labels should describe what an action does. Avoid clever or vague wording when a plain verb is clearer.

## Progressive disclosure

Decision: show the information needed for the current task first and reveal advanced detail when requested or required.

Do not hide normal configuration behind excessive navigation. Do not expose every advanced control simply because it exists.

Advanced, destructive, diagnostic, and uncommon settings should be deliberately disclosed and clearly labeled.

## Immediate and proportionate feedback

Decision: every meaningful interaction should provide timely feedback proportional to the action.

Examples:

- selected navigation state changes immediately
- saving shows pending, success, conflict, or failure state
- validation appears beside the affected field or group
- destructive actions communicate consequences before confirmation
- asynchronous actions preserve context and make progress visible

Do not rely on transient toast messages as the only evidence of failure or a required next step.

## Directness and reversibility

Decision: allow users to act on the object or configuration they are looking at whenever practical.

Resource mappings shown inside a feature should be editable there when the user has permission. Users should not have to translate a visible problem into a separate global configuration workflow.

Where actions are reversible, make recovery straightforward. For destructive or difficult-to-reverse actions, require clear intent and show the effect before execution.

## Accessibility as a system property

Decision: accessibility is part of the component contract, not a later polish pass.

Control targets WCAG 2.2 AA and should also follow platform conventions that improve keyboard, screen-reader, touch, and reduced-motion use.

Requirements include:

- semantic structure and landmarks
- visible keyboard focus
- complete keyboard operation
- programmatic labels and descriptions
- no essential meaning conveyed by color alone
- adequate text and non-text contrast
- reduced-motion support
- touch targets that expand appropriately on coarse-pointer devices
- errors described in text and associated with the affected control
- charts and visual data accompanied by accessible names, values, and context

## Inclusive, plain language

Decision: interface language should be understandable without specialized knowledge of the bot's implementation.

Prefer familiar terms, short sentences, active voice, and consistent vocabulary. Avoid unnecessary jargon. When technical vocabulary is unavoidable, explain it in context.

Error messages should explain what happened and what the user can do next. They should not blame or scold the user.

## Respect platform expectations without visual imitation

Decision: Control should feel natural in a modern browser and on macOS/iOS without trying to look like a native Apple Settings app.

Do not copy Apple navigation bars, materials, glass effects, control shapes, or platform-specific layouts merely for resemblance.

Instead, carry over the underlying principles: clarity, hierarchy, consistency, familiarity, concise flows, immediate feedback, accessibility, and restraint.

## Design review questions

A proposed screen or component should answer these before implementation:

1. What is the user's primary task here?
2. Is the most important information visually obvious?
3. Is there unnecessary duplication or decoration?
4. Does the interaction behave like similar interactions elsewhere?
5. Can the user complete the task with fewer transitions or steps?
6. Are advanced details disclosed only when useful?
7. Is feedback immediate and understandable?
8. Can errors or destructive actions be recovered from safely?
9. Does the experience work by keyboard and assistive technology?
10. Are we applying Apple principles without visually copying Apple?
