# Rob-bot Control Design System

Date: 2026-10-16
Status: Complete design-system specification for redesign planning
Scope: Rob-bot Control website

## 1. Purpose and authority

This document defines the reusable visual, interaction, layout, accessibility, content, and component system for Rob-bot Control.

It turns the approved product direction into an implementation-ready design contract.

It derives from three sources:

1. **Mar Wie course site** for brand language, typography, color, shape, restraint, and visual character.
2. **Rob-bot Control information architecture** for feature-first organization, MECE grouping, complete feature ownership, canonical shared resources, and the three-region shell.
3. **Apple design principles** for clarity, hierarchy, consistency, familiarity, concise task flows, immediate feedback, progressive disclosure, accessibility, and restraint.

The Cloudflare dashboard reference informs compact administrative density and navigation ergonomics. It is not a visual brand source.

Read this with:

- `docs/superpowers/decisions/2026-10-16-control-interface-information-architecture.md`
- `docs/superpowers/decisions/2026-10-16-control-brand-and-visual-direction.md`
- `docs/superpowers/decisions/2026-10-16-control-apple-design-principles.md`

If an older Control styling decision conflicts with this specification, the 2026-10-16 design decisions and this specification take precedence for the redesign.

---

# 2. Core principles

## 2.1 Feature first

Users navigate by what they want to configure, not by implementation concepts.

A feature owns its complete normal configuration flow. Tickets owns ticket types, behavior, permissions, messages, and ticket-specific Discord resources. Global Resources remains an overview and troubleshooting surface, not a required step.

## 2.2 MECE navigation

Sidebar groups organize features without becoming configuration destinations. Groups should overlap as little as practical, cover the full operator-facing surface, and give each feature one clear home.

## 2.3 Clarity before decoration

Order, alignment, spacing, typography, contrast, borders, and state establish hierarchy before decoration. Every persistent element must justify the space it occupies.

## 2.4 Compact, not cramped

Control is an operations interface. Desktop density is intentionally compact. Compactness must not reduce legibility, accessible targets, or state clarity.

## 2.5 Brand restraint

Neutral structure dominates. Sky blue is brand and information color, not generic selection color. Semantic colors communicate meaning.

## 2.6 Familiarity and consistency

Prefer familiar web controls and native semantics. Similar objects behave the same way across every feature.

## 2.7 Immediate feedback

Actions communicate pending, success, conflict, failure, selected, disabled, and destructive states promptly and locally.

## 2.8 Progressive disclosure

Common settings stay visible. Advanced, destructive, diagnostic, and uncommon settings are disclosed deliberately.

## 2.9 Accessibility by default

Accessibility is part of each component contract. Target WCAG 2.2 AA.

## 2.10 Stable shell, adaptive workspace

Navigation and interaction conventions remain stable while the center workspace and contextual panel adapt to the feature.

---

# 3. Token architecture

Use three layers:

1. **Primitive tokens** for raw colors, spacing, radii, typography, and motion.
2. **Semantic tokens** for surfaces, text, borders, accents, focus, and states.
3. **Component tokens** for shell widths, row heights, and control geometry.

Components consume semantic or component tokens instead of raw values wherever practical.

Naming:

```css
--ds-color-*;
--ds-space-*;
--ds-radius-*;
--ds-font-*;
--ds-duration-*;

--surface-*;
--text-*;
--stroke-*;
--accent-*;
--status-*;
--focus-*;

--control-*;
```

---

# 4. Color

## 4.1 Light primitives

| Token | Value | Use |
|---|---:|---|
| `--ds-color-paper` | `#fcfcfb` | page |
| `--ds-color-white` | `#ffffff` | primary surface |
| `--ds-color-ink` | `#111113` | strong text, primary action |
| `--ds-color-ink-hover` | `#2a2a2e` | primary-action hover |
| `--ds-color-note` | `#3a3a3f` | strong secondary text |
| `--ds-color-body` | `#4a4a4f` | body text |
| `--ds-color-muted` | `#6e6e73` | tertiary text |
| `--ds-color-faint` | `#8a8a8f` | nonessential text only |
| `--ds-color-line` | `#ebebea` | hairline |
| `--ds-color-field` | `#dcdcda` | control border |
| `--ds-color-soft` | `#f4f4f2` | secondary surface |
| `--ds-color-hover` | `#f5f5f3` | neutral hover |
| `--ds-color-selected` | `#efefec` | neutral selection |
| `--ds-color-selected-line` | `#e4e4e0` | selected inset stroke |

## 4.2 Brand primitives

| Token | Value | Use |
|---|---:|---|
| `--ds-color-sky` | `#7db9e8` | brand accent |
| `--ds-color-sky-deep` | `#2f6fa3` | accessible info/focus text on light |
| `--ds-color-sky-tint` | `#eef6fd` | info surface |
| `--ds-color-sky-tint-strong` | `#dcebf8` | info border/avatar fill |
| `--ds-color-sky-dark-surface` | `#14273a` | dark info surface |

Sky is appropriate for brand identity, informational emphasis, links where blue semantics are appropriate, focused state, and selected data marks. It is not the default navigation selection fill.

## 4.3 Light semantic states

| State | Foreground | Background | Border |
|---|---:|---:|---:|
| Success / healthy | `#1f7a4d` | `#eaf5ec` | `#cbe5d2` |
| Warning / attention | `#6b4600` | `#fdf3e1` | `#f3ddb0` |
| Error / destructive | `#b42318` | `#fdf0ef` | `#f4d3cf` |
| Informational | `#2f6fa3` | `#eef6fd` | `#dcebf8` |

Special-purpose colors remain constrained:

- `#e5a00d` amber: stars/ratings or a deliberate amber semantic only
- `#5865f2`: Discord logo/brand only
- course donation pink: not a general Control accent
- violet: not a general Control accent

## 4.4 Dark primitives and states

| Role | Value |
|---|---:|
| page | `#0f0f11` |
| primary surface | `#19191c` |
| secondary surface | `#1b1b1e` |
| hover | `#212125` |
| selected | `#242428` |
| strong text | `#ececee` |
| secondary strong text | `#c6c6cb` |
| body text | `#adadb3` |
| muted text | `#8b8b91` |
| faint text | `#737379` |
| subtle stroke | `#232327` |
| control stroke | `#34343a` |
| selected stroke | `#3d3d43` |
| brand/info accent | `#7db9e8` |

Dark semantic states:

| State | Foreground | Background | Border |
|---|---:|---:|---:|
| Success / healthy | `#5fd08a` | `#14241a` | `#234832` |
| Warning / attention | `#f3c568` | `#2a2112` | `#5a421a` |
| Error / destructive | `#f97066` | `#2b1718` | `#5a2a2c` |
| Informational | `#7db9e8` | `#14273a` | `#244a69` |

## 4.5 Semantic aliases

Light:

```css
--surface-page: #fcfcfb;
--surface-primary: #ffffff;
--surface-secondary: #f4f4f2;
--surface-hover: #f5f5f3;
--surface-selected: #efefec;

--text-primary: #111113;
--text-secondary: #4a4a4f;
--text-tertiary: #6e6e73;
--text-faint: #8a8a8f;

--stroke-subtle: #ebebea;
--stroke-control: #dcdcda;
--stroke-selected: #e4e4e0;

--accent-brand: #7db9e8;
--accent-info: #2f6fa3;
--focus-ring: #2f6fa3;

--status-success-fg: #1f7a4d;
--status-success-bg: #eaf5ec;
--status-success-stroke: #cbe5d2;
--status-warning-fg: #6b4600;
--status-warning-bg: #fdf3e1;
--status-warning-stroke: #f3ddb0;
--status-error-fg: #b42318;
--status-error-bg: #fdf0ef;
--status-error-stroke: #f4d3cf;
--status-info-fg: #2f6fa3;
--status-info-bg: #eef6fd;
--status-info-stroke: #dcebf8;
```

Dark:

```css
--surface-page: #0f0f11;
--surface-primary: #19191c;
--surface-secondary: #1b1b1e;
--surface-hover: #212125;
--surface-selected: #242428;

--text-primary: #ececee;
--text-secondary: #adadb3;
--text-tertiary: #8b8b91;
--text-faint: #737379;

--stroke-subtle: #232327;
--stroke-control: #34343a;
--stroke-selected: #3d3d43;

--accent-brand: #7db9e8;
--accent-info: #7db9e8;
--focus-ring: #7db9e8;

--status-success-fg: #5fd08a;
--status-success-bg: #14241a;
--status-success-stroke: #234832;
--status-warning-fg: #f3c568;
--status-warning-bg: #2a2112;
--status-warning-stroke: #5a421a;
--status-error-fg: #f97066;
--status-error-bg: #2b1718;
--status-error-stroke: #5a2a2c;
--status-info-fg: #7db9e8;
--status-info-bg: #14273a;
--status-info-stroke: #244a69;
```

## 4.6 Contrast rules

- Essential normal text meets WCAG AA.
- `#8a8a8f` on `#fcfcfb` is not valid for essential small text. Use it only for nonessential/decorative metadata or sufficiently large text.
- `#6e6e73` is the default light tertiary text color for readable secondary information.
- Dark faint text does not carry required information unless contrast is independently verified for the actual background.
- Color is never the sole state carrier. Pair color with text, icon, position, or shape.

---

# 5. Typography

## 5.1 Families

```css
--font-sans: "Figtree", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-serif: "Newsreader", Georgia, serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

Figtree weights: 400, 500, 600.

Newsreader: italic 400 only.

Do not depend on 700 for routine UI hierarchy.

## 5.2 Root and primitive scale

Browser root: `16px`.

Do not change the root size to make the product compact.

| Token | rem | px |
|---|---:|---:|
| `--font-size-2xs` | `0.75rem` | 12 |
| `--font-size-xs` | `0.8125rem` | 13 |
| `--font-size-sm` | `0.875rem` | 14 |
| `--font-size-md` | `1rem` | 16 |
| `--font-size-lg` | `1.125rem` | 18 |
| `--font-size-xl` | `1.25rem` | 20 |
| `--font-size-2xl` | `1.5rem` | 24 |
| `--font-size-3xl` | `1.75rem` | 28 |
| `--font-size-4xl` | `2rem` | 32 |
| `--font-size-display` | `2.25rem` | 36 |

This is role-based instead of a geometric modular scale.

## 5.3 Semantic roles

| Role | Size | Weight | Line height | Tracking |
|---|---:|---:|---:|---:|
| Page title | 28px | 500 | 1.2 | `-0.02em` |
| Exceptional/onboarding title | 32–36px | 500 | 1.15 | `-0.025em` |
| Section title | 18px | 600 | 1.3 | `-0.01em` |
| Subsection title | 16px | 600 | 1.35 | `-0.005em` |
| Panel title | 14px | 600 | 1.4 | normal |
| Body compact | 14px | 400 | 1.5 | normal |
| Body readable | 16px | 400 | 1.6 | normal |
| Label | 13px | 500 | 1.35 | normal |
| Metadata | 12px | 400/500 | 1.4 | normal |
| Button | 14px | 500 | 1 | normal |
| Nav item | 14px | 500 | 1.35 | normal |
| Nav group | 12px | 500 | 1.3 | `0.01em` |
| Table header | 12px | 600 | 1.35 | `0.01em` |
| Code/identifier | 13px | 400 | 1.45 | normal |

Use tabular numerals for analytics, counts, timestamps, and tables.

## 5.4 Newsreader rule

Allowed only for:

- one or two words in onboarding headings
- selected meaningful empty states
- occasional completion/success copy
- rare brand moments

Do not use Newsreader for routine feature titles, settings, navigation, form labels, warnings, errors, or dense operational content.

## 5.5 Text rules

- Sentence case by default.
- Action labels use direct verbs.
- `text-wrap: balance` for larger headings where supported.
- `text-wrap: pretty` for explanatory prose where supported.
- Avoid all caps except short abbreviations or deliberate compact kickers.
- Error text tells the user how to recover.

---

# 6. Spacing

| Token | Value |
|---|---:|
| `--space-0` | 0 |
| `--space-0-5` | 2px |
| `--space-1` | 4px |
| `--space-1-5` | 6px |
| `--space-2` | 8px |
| `--space-2-5` | 10px |
| `--space-3` | 12px |
| `--space-3-5` | 14px |
| `--space-4` | 16px |
| `--space-4-5` | 18px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-7` | 28px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-14` | 56px |
| `--space-16` | 64px |

Rules:

- Use `gap` instead of ad hoc child margins.
- Label-to-control gap: 6px.
- Field stack gap: 8px.
- Compact row horizontal padding: 10–12px.
- Main section gap: 24–32px.
- Right-panel section gap: 16–20px.
- Do not transplant 96px marketing-section spacing into Control.

---

# 7. Density and sizing

| Component | Desktop | Touch/coarse pointer |
|---|---:|---:|
| Icon-button target | 32px | 44px |
| Nav row | 36px | 44px |
| Input/select | 36px | 44px |
| Compact button | 36px | 44px |
| Standard button | 38px | 44px |
| Standard data row | 40px | 44px minimum when interactive |
| Prominent action | 40–44px | 44–50px |

Visual icons are usually 16–18px inside larger hit areas.

---

# 8. Radius

| Token | Value | Use |
|---|---:|---|
| `--radius-xs` | 6px | tooltip/code chip |
| `--radius-sm` | 8px | compact nav/icon button |
| `--radius-md` | 10px | selects/compact panels |
| `--radius-lg` | 12px | inputs/notes/inner panels |
| `--radius-xl` | 16px | medium structural panels |
| `--radius-card` | 18px | substantial cards |
| `--radius-shell` | 24px | left/right floating shells |
| `--radius-pill` | 999px | tags/chips/selected branded actions |

Do not make every control pill-shaped. Dense navigation, fields, rows, and context panels use 8–12px radii.

---

# 9. Strokes and borders

```css
--stroke-width-hairline: 1px;
```

Use semantic stroke colors:

```css
border: 1px solid var(--stroke-subtle);
border: 1px solid var(--stroke-control);
```

Use borders for shell boundaries, inputs, tables/row separators, floating surfaces, callouts, and structural groups that would otherwise be ambiguous.

Do not box every settings section.

---

# 10. Elevation

## 10.1 Flat center

The center workspace is primarily flat.

## 10.2 Card

```css
--shadow-card: 0 1px 2px rgba(17,17,19,.04);
```

## 10.3 Floating surface

Light:

```css
--shadow-floating:
  0 0 0 1px rgba(17,17,19,.04),
  0 4px 10px rgba(17,17,19,.06),
  0 24px 48px rgba(17,17,19,.16);
```

Dark:

```css
--shadow-floating:
  0 0 0 1px rgba(255,255,255,.04),
  0 4px 10px rgba(0,0,0,.24),
  0 24px 48px rgba(0,0,0,.44);
```

## 10.4 Side shell

Light:

```css
--shadow-shell:
  inset 0 1px 0 rgba(255,255,255,.95),
  0 1px 2px rgba(17,17,19,.05),
  0 18px 40px rgba(17,17,19,.09);
```

Dark:

```css
--shadow-shell:
  inset 0 1px 0 rgba(255,255,255,.04),
  0 1px 2px rgba(0,0,0,.24),
  0 18px 40px rgba(0,0,0,.34);
```

Large card shadows are not used throughout the center workspace.

---

# 11. Motion

| Token | Value | Use |
|---|---:|---|
| `--duration-instant` | 80ms | press |
| `--duration-fast` | 120ms | hover/color |
| `--duration-standard` | 160ms | selection/disclosure |
| `--duration-medium` | 200ms | drawer/panel |
| `--duration-slow` | 300ms | dialog/one-time entrance |

```css
--ease-standard: cubic-bezier(.2,.8,.2,1);
--ease-hover: ease;
```

Rules:

- Hover: 120–150ms.
- Press scale may reach `.98` on buttons when appropriate.
- Drawers/popovers move quickly and quietly.
- No large repeated page-transition animations.
- One-time onboarding/empty-state entrances may use the course site's restrained pop-in.
- No continuous decorative motion in Control.
- Reduced-motion preference disables nonessential animation and minimizes required transitions.

---

# 12. Focus and interaction states

Default focus-visible treatment:

```css
outline: 2px solid var(--focus-ring);
outline-offset: 2px;
```

Large focusable regions may use 3px.

Every interactive component defines:

- default
- hover
- active/pressed
- focus-visible
- selected/checked/current if relevant
- disabled
- loading if relevant
- error if relevant

Selected and focused are distinct and can coexist.

Disabled controls keep recognizable structure. Do not use opacity so aggressively that labels become unreadable. Explain non-obvious disabled high-value actions.

---

# 13. Three-region layout

## 13.1 Wide desktop

```css
--control-left-width: 15rem;   /* 240px */
--control-right-width: 19rem;  /* 304px */
--control-shell-gap: .75rem;   /* 12px */
--control-edge-gap: .75rem;    /* 12px */
```

```css
grid-template-columns:
  var(--control-left-width)
  minmax(0,1fr)
  var(--control-right-width);
```

Left and right are floating/framed shells. Center remains flat.

## 13.2 Left shell

- width: 240px
- viewport inset: 12px
- outer radius: 24px
- outer frame padding: 5px
- inner panel horizontal padding: 10px
- inner panel top/bottom padding: 12px
- independent scroll when required
- sticky or fixed within viewport, preserving the same visual result

## 13.3 Center workspace

Center uses available width.

Content modes:

| Mode | Max width | Use |
|---|---:|---|
| Readable | 42rem / 672px | prose/help |
| Form | 48rem / 768px | settings forms |
| Standard | 60rem / 960px | mixed configuration |
| Wide | 72rem / 1152px | tables/analytics |
| Fluid | none | data-heavy layouts |

Desktop center horizontal padding: 24px by default; may reduce to 20px on constrained desktop and increase to 32px on very wide workspaces.

## 13.4 Right shell

- width: 304px
- viewport inset: 12px
- radius: 24px
- outer frame padding: 5px
- inner padding: 14px
- independent scroll when needed
- sticky on wide desktop
- sections use whitespace and hairlines instead of nested cards by default

## 13.5 Breakpoints

| Width | Behavior |
|---|---|
| `>=1200px` | full three-region shell |
| `900–1199px` | left + center; right becomes drawer/popover |
| `<900px` | left becomes drawer; compact top bar; right temporary surface |
| `<640px` | single-column feature layout; touch targets expand |

The 900px breakpoint intentionally matches the course site's main responsive breakpoint.

Essential feature configuration remains available when side regions collapse.

---

# 14. Left navigation

## 14.1 Structure

Feature-first groups:

- Engagement
- Publishing
- Support & Safety
- Insights
- System

Group labels organize navigation only.

## 14.2 Geometry

```css
--nav-row-height: 2.25rem;     /* 36px */
--nav-padding-y: .375rem;      /* 6px */
--nav-padding-x: .625rem;      /* 10px */
--nav-gap: .125rem;            /* 2px */
--nav-radius: .5rem;           /* 8px */
--nav-icon-size: 1.0625rem;    /* 17px */
```

Rows may reach 38px only when label rendering requires it.

Group label: 12px/500, tertiary or faint text where contrast permits.

Group spacing: 14–16px before a new group and 4px between group label and first item.

## 14.3 States

- Default: transparent.
- Hover: `--surface-hover`.
- Current: neutral selected fill + stronger text + optional subtle inset stroke.
- Focus: independent focus ring.
- No sky-blue active pill.
- No oversized selected padding.

Preferred light current treatment:

```css
background: linear-gradient(#f7f7f5,#efefec);
box-shadow:
  inset 0 0 0 1px #e4e4e0,
  inset 0 1px 0 #fff,
  0 1px 2px rgba(17,17,19,.06);
```

A flat `--surface-selected` fill is valid if visual QA finds the gradient too ornamental.

## 14.4 Nested items

Use indentation and, where helpful, one subtle vertical guide. Do not put child items in another rounded container.

## 14.5 Collapsible groups

- remember state when practical
- expanding a group does not change route
- collapsing the current feature's group must preserve enough group-level state to maintain orientation

## 14.6 Search

If present, quick search is 36–38px tall and searches user-facing features, settings, and actions. Results show feature context. Internal keys are secondary metadata, never primary labels.

---

# 15. Page anatomy

Normal feature page order:

1. feature header
2. operational state and primary action
3. core configuration/data
4. secondary or advanced sections
5. contextual right-panel support

Routine feature pages do not use decorative hero banners.

## 15.1 Header

Contains feature title, concise description when useful, feature state when applicable, and at most one local primary action.

## 15.2 Sectioning

Prefer heading + spacing + divider before cards.

Section gap: 24–32px.

## 15.3 Save model

When explicit save is used:

- dirty state is visible
- `Save changes` is primary
- `Discard` is secondary/tertiary
- Cmd/Ctrl+S may save when valid and safe
- unsaved navigation is protected
- success can appear inline
- conflicts explain that server state changed and provide a safe resolution path

---

# 16. Buttons

## 16.1 Primary

Single primary action in a local context.

Light: ink background, white text.

Dark: light primary-text background, dark page text.

Primary does not default to sky blue.

## 16.2 Secondary

Primary surface + control stroke + primary text.

## 16.3 Tertiary

Transparent, no border, primary or tertiary text according to importance.

## 16.4 Destructive

Use destructive semantics only for destructive actions. A destructive confirmation may use a solid destructive primary action.

## 16.5 Geometry

- compact: 36px
- standard: 38px
- prominent: 40–44px desktop
- touch: at least 44px target

Pill radius is valid for branded primary/secondary actions. Dense toolbar actions use 8–10px radius.

## 16.6 Loading

Preserve width, show spinner plus useful label where possible, set `aria-busy`, and prevent duplicate submission.

---

# 17. Form controls

## 17.1 Inputs/selects

Desktop:

- height: 36px
- radius: 10px
- font: 14px
- horizontal padding: 10–12px

Touch/mobile:

- minimum target: 44px
- text inputs: 16px to avoid iOS zoom behavior

## 17.2 Labels

Always explicit. Placeholder is a hint, not a label.

## 17.3 Validation

- validate at a useful time
- error appears beside affected control/group
- text explains how to recover
- use `aria-invalid` and associated description
- do not unexpectedly move focus

## 17.4 Selects/comboboxes

Use native `<select>` when sufficient. Use custom combobox only for search, grouping, resource metadata, or large sets.

Discord selectors should filter invalid resource kinds before selection where practical and display enough context to identify the resource.

## 17.5 Checkboxes/radios

Use native semantics and label hit area. Do not substitute a switch unless the setting is genuinely binary and immediate.

## 17.6 Switches

Visual control may be compact. Container target is at least 36px desktop and 44px touch. Label state in text when ambiguity exists.

## 17.7 Textareas

Use for long text. Show meaningful limits before submission. Resizing must not break the shell.

---

# 18. Segmented controls

Use for a small set of mutually exclusive peer modes, such as Light / Dark / System or compact range choices.

- soft neutral track
- 3px internal padding
- selected option on raised primary surface
- compact height

Do not use segmented controls for unrelated destinations.

---

# 19. Tables and lists

Use lists/tables for repeated operational data instead of card grids.

Geometry:

- header: 32–36px
- standard row: 40px
- dense row: 36px when content permits
- cell horizontal padding: 10–12px
- subtle row separators
- no zebra striping by default
- hover only when row is interactive

Persistent selected rows stay selected when they represent current navigation/context. Transient actions do not leave selection behind.

Sort direction is conveyed by icon plus accessible text. Empty filtered state distinguishes `no data` from `no results`.

On small screens, prioritize columns, then use controlled horizontal scroll or compact stacked rows without hiding critical data.

---

# 20. Cards and panels

A card must represent a meaningful object, summary, or independent action area.

### Flat section

No card. Heading + spacing + optional divider. Default for settings.

### Structural panel

1px subtle stroke, 12–16px radius, no or minimal shadow.

### Raised card

18px radius + `--shadow-card`. Rare.

### Floating shell

24px radius + `--shadow-shell`. Reserved for left/right side regions and deliberate floating surfaces.

No card-inside-card hierarchy unless the inner object is truly independent.

---

# 21. Contextual right panel

The right panel supports the center task and never becomes an unrelated dashboard.

Approved patterns:

- resource bindings
- health/readiness
- dependencies
- Discord/output preview
- permission warnings
- recent activity
- quick actions
- concise contextual help

Section treatment:

- inner padding: 14px
- section title: 13–14px/600
- section gap: 16–20px
- hairline separator where needed
- no per-section nested card by default

Do not fill the panel artificially when a feature has no useful secondary context.

---

# 22. Status and feedback

## 22.1 Status chips

Allowed for concise states such as Enabled, Disabled, Healthy, Needs setup, Degraded, Draft.

Compact and semantic, never decorative.

## 22.2 Inline success

Use near the changed area when acknowledgement matters.

## 22.3 Warning

Use warning tokens for actionable caution. State consequence and next action.

## 22.4 Error

Operation-level errors use error callout. Field errors remain beside fields.

## 22.5 Toast

Toast may acknowledge lightweight transient success. It is never the only presentation of validation failure, destructive failure, permission problem, conflict, or required next step.

---

# 23. Dialogs, popovers, drawers, menus, tooltips

## 23.1 Dialog

Prefer native `<dialog>` where practical.

Use for destructive confirmation, focused short workflows, and decisions requiring an explicit response.

Typical width: 360–480px.

Do not modalize information that works inline.

## 23.2 Popover

Use for lightweight contextual menus, selectors, and option surfaces. Radius 8–12px with floating shadow.

## 23.3 Drawer

Used for responsive navigation and right-panel content.

A modal drawer:

- traps focus
- closes on Escape
- restores focus to trigger
- has an accessible name
- does not silently discard unsaved state

## 23.4 Menu

- row height: 34–36px
- outer padding: 6px
- radius: 8–10px
- keyboard operable
- destructive actions visually separated or clearly marked
- common primary actions are not hidden only in overflow

## 23.5 Tooltip

- radius: 6px
- concise
- available by keyboard focus and hover
- no essential interactive content
- never required to understand primary workflow

---

# 24. Search and command surfaces

Search uses user-facing terms and can locate features, settings, and actions.

Results show hierarchy, e.g. `Logs channel → Tickets › Discord resources`.

Internal keys such as `ticket_logs` are secondary developer metadata only.

---

# 25. Empty, loading, error, and destructive states

## 25.1 Empty

Distinguish:

- no data ever existed
- feature disabled
- setup incomplete
- filter has no matches
- data failed to load

Include a clear next action when one exists.

Mascot is reserved for meaningful onboarding/empty/success states, not every empty table.

## 25.2 Loading

Use skeletons when structure is predictable and spinners for action-level indeterminate waits.

Refresh only the changing region when possible. Preserve valid previous data during background refresh when safe.

## 25.3 Error copy

Answer:

1. what failed
2. what remained safe/unchanged
3. what the user can do next

Example: `Couldn’t save ticket types. Your unsaved changes are still here. Try again.`

## 25.4 Destructive actions

- name the object/consequence
- distinguish destructive intent
- confirm substantial or difficult-to-reverse effects
- avoid generic `Are you sure?`
- preserve auditability when the product supports it

---

# 26. Icons and mascot

Use one coherent line-icon family or internally consistent SVG set.

- routine icons: 16–18px
- consistent stroke treatment
- icons support labels instead of replacing them unless meaning is universally familiar and an accessible name exists
- official brand marks may retain brand color
- no multicolor decorative icon system

Pixel cloud mascot usage is minimal:

Allowed:

- brand identity
- onboarding/first run
- meaningful empty state
- occasional completion/success

Not default:

- routine feature headers
- nav decoration
- right-panel decoration
- tables
- repeated settings

Pixel art preserves crisp edges. The moving-sky background is not used behind Control.

---

# 27. Charts and analytics

Charts prioritize data over framing.

Requirements:

- data is visually strongest
- axes/descriptions are secondary
- consistent series colors
- labels/meaning do not depend on color
- accessible summary and value context
- tabular numerals
- unambiguous date/time formatting
- compact plot padding

Prefer compact metric rows/grids over oversized metric cards.

---

# 28. Discord preview

Publishing features may show a Discord preview in the right panel or center when preview is central to the task.

Preview is clearly labeled as preview and must not be so literal that it can be mistaken for live content.

Reflect message text, mentions, embed title/body/footer, color accent, and supplied image where supported.

Validation appears beside editor fields, not only in preview.

---

# 29. Resource bindings

Resource bindings include channels, roles, and categories.

Feature-local editing is preferred. Each binding shows:

- user-facing label
- current Discord resource
- resource type
- missing/deleted/permission state if relevant
- edit control

The global Resources view displays the exact same canonical state.

No duplicate mapping state is permitted.

---

# 30. Permissions and dependencies

Show issues at the affected feature.

Three levels:

1. **Informational**: feature works, optional capability absent.
2. **Attention**: partial degradation.
3. **Blocking**: action/configuration cannot function.

State names the missing resource or permission and gives a direct recovery action where possible.

---

# 31. Activity

Activity is chronological and concise.

Each event may include action, actor, timestamp, status, and failure reason/reference.

Statuses: queued, in progress, completed, failed, rejected.

Compact lists may use relative time with full absolute timestamp available on focus/hover/detail.

---

# 32. Theme behavior

Modes: Light, Dark, System.

Default: System.

Light is the canonical branded expression. Dark is a faithful token translation, not a different aesthetic.

System follows OS preference live where practical. Explicit user choice persists locally.

Theme changes do not alter layout, density, or component dimensions.

---

# 33. Accessibility

Target: WCAG 2.2 AA.

## 33.1 Keyboard

- logical Tab order
- Enter/Space activation as appropriate
- Escape for dismissible modal surfaces
- arrow-key behavior where the ARIA pattern requires it
- Cmd/Ctrl+S only where explicitly supported

## 33.2 Screen readers

- semantic landmarks
- one clear page heading
- explicit field labels
- `aria-current` for current navigation
- live regions only for meaningful async updates
- state labels independent of icon/color
- charts provide value and contextual descriptions

## 33.3 Targets

Compact desktop visual geometry may be 32–40px when a precise pointer is expected. Coarse-pointer/touch targets expand to at least 44px where practical. Critical icon-only controls never use tiny hit areas.

## 33.4 Motion

Respect reduced motion.

## 33.5 Zoom/reflow

Usable at 200% browser zoom without loss of functionality.

## 33.6 Contrast

Essential text, focus indicators, form boundaries, and meaningful states meet applicable AA contrast. Faint colors do not carry essential small text.

---

# 34. Responsive behavior

### Wide desktop

All three regions visible.

### Medium 900–1199px

Right context becomes drawer. Center retains complete normal task capability.

### Narrow <900px

Left nav becomes drawer. Compact top bar provides menu trigger, current feature/product orientation, and only an essential contextual action if needed. Right context remains reachable through a labeled trigger.

### Small <640px

- single-column feature layouts
- paired controls stack
- buttons wrap/stack while preserving primary hierarchy
- text inputs use 16px
- touch targets expand
- tables prioritize columns then scroll or transform without hiding critical data

---

# 35. Content design

Voice: plain, calm, competent, non-technical where possible.

Use user-goal terms instead of implementation terms. Prefer `Ticket logs channel` over `ticket_logs`.

Buttons use direct verbs: `Save changes`, `Add source`, `Post announcement`, `Retry`, `Choose channel`.

Avoid vague labels such as `Proceed`, `Submit`, or `Okay` when a specific action name exists.

Errors state what happened and what to do next. Do not blame or scold.

Help is placed near the setting it explains. Deeper docs are linked only when inline explanation would become too long.

---

# 36. Apple principles as review constraints

Apply Apple's fundamentals without copying Apple's UI:

- **Clarity:** primary task, interactive elements, and results are obvious.
- **Hierarchy:** order, spacing, alignment, and contrast communicate importance.
- **Consistency:** comparable components behave identically across features.
- **Familiarity:** use established web interaction patterns unless deviation clearly improves the task.
- **Concision:** reduce redundant content and unnecessary steps.
- **Feedback:** actions produce immediate, proportionate, understandable responses.
- **Progressive disclosure:** advanced detail appears when useful.
- **Directness:** edit relevant objects in context when practical.
- **Reversibility/safety:** recovery is easy where possible; destructive intent is explicit.
- **Accessibility/inclusion:** the product works with keyboard, assistive technology, touch, reduced motion, and plain language.

These are behavior and usability constraints, not instructions to mimic native Apple Settings, materials, glass, navigation bars, or control styling.

---

# 37. Component composition rules

1. Do not nest cards unless the inner object is independently meaningful.
2. Do not place two visually primary actions side by side.
3. Do not use blue merely to increase visual interest.
4. Do not move essential configuration to the right panel for symmetry.
5. Do not require Resources for routine feature setup.
6. Do not hide ordinary settings under Advanced just to make a page sparse.
7. Do not invent custom interaction when a familiar pattern is sufficient.
8. Do not use modal UI when inline editing is practical.
9. Do not use tooltips for required instructions.
10. Do not use toast as the sole presentation of an important failure.
11. Do not use mascot/illustration to fill unused space.
12. Do not shrink the root font size to create density.

---

# 38. Feature composition examples

## Tickets

Center:

- feature state
- ticket types
- panel behavior
- lifecycle behavior
- claim/close/reopen configuration where supported
- user-facing messages
- advanced settings

Right:

- ticket category
- ticket panel channel
- ticket logs channel
- health/readiness
- relevant recent activity

## Announcements

Center:

- message composer
- embed fields
- color/image
- mention behavior
- post action

Right:

- destination channel
- Discord preview
- permission/status

## Reputation

Center: enablement, thresholds, earning/behavior rules.

Right: tier role bindings and health.

## Quizzes

Center: enablement, schedule, question bank, editing.

Right: quiz channel, scheduler status, last/next run.

## Analytics

Center: date range, metrics, chart/table data, reporting settings.

Right: report destination, collection status, latest report/activity.

Examples define composition patterns, not final business scope.

---

# 39. Canonical token starter

This is the canonical token baseline for implementation. File organization may differ, but semantic values and relationships must remain equivalent unless a later design decision supersedes them.

```css
:root {
  color-scheme: light;

  --surface-page: #fcfcfb;
  --surface-primary: #ffffff;
  --surface-secondary: #f4f4f2;
  --surface-hover: #f5f5f3;
  --surface-selected: #efefec;

  --text-primary: #111113;
  --text-secondary: #4a4a4f;
  --text-tertiary: #6e6e73;
  --text-faint: #8a8a8f;

  --stroke-subtle: #ebebea;
  --stroke-control: #dcdcda;
  --stroke-selected: #e4e4e0;

  --accent-brand: #7db9e8;
  --accent-info: #2f6fa3;
  --focus-ring: #2f6fa3;

  --status-success-fg: #1f7a4d;
  --status-success-bg: #eaf5ec;
  --status-success-stroke: #cbe5d2;
  --status-warning-fg: #6b4600;
  --status-warning-bg: #fdf3e1;
  --status-warning-stroke: #f3ddb0;
  --status-error-fg: #b42318;
  --status-error-bg: #fdf0ef;
  --status-error-stroke: #f4d3cf;
  --status-info-fg: #2f6fa3;
  --status-info-bg: #eef6fd;
  --status-info-stroke: #dcebf8;

  --font-sans: "Figtree", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-serif: "Newsreader", Georgia, serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-card: 18px;
  --radius-shell: 24px;
  --radius-pill: 999px;

  --control-left-width: 15rem;
  --control-right-width: 19rem;
  --control-shell-gap: .75rem;
  --control-edge-gap: .75rem;
  --control-nav-row: 2.25rem;
  --control-input-height: 2.25rem;

  --duration-instant: 80ms;
  --duration-fast: 120ms;
  --duration-standard: 160ms;
  --duration-medium: 200ms;
  --duration-slow: 300ms;
  --ease-standard: cubic-bezier(.2,.8,.2,1);
}

[data-theme="dark"] {
  color-scheme: dark;

  --surface-page: #0f0f11;
  --surface-primary: #19191c;
  --surface-secondary: #1b1b1e;
  --surface-hover: #212125;
  --surface-selected: #242428;

  --text-primary: #ececee;
  --text-secondary: #adadb3;
  --text-tertiary: #8b8b91;
  --text-faint: #737379;

  --stroke-subtle: #232327;
  --stroke-control: #34343a;
  --stroke-selected: #3d3d43;

  --accent-brand: #7db9e8;
  --accent-info: #7db9e8;
  --focus-ring: #7db9e8;

  --status-success-fg: #5fd08a;
  --status-success-bg: #14241a;
  --status-success-stroke: #234832;
  --status-warning-fg: #f3c568;
  --status-warning-bg: #2a2112;
  --status-warning-stroke: #5a421a;
  --status-error-fg: #f97066;
  --status-error-bg: #2b1718;
  --status-error-stroke: #5a2a2c;
  --status-info-fg: #7db9e8;
  --status-info-bg: #14273a;
  --status-info-stroke: #244a69;
}
```

---

# 40. Design QA checklist

## IA

- One clear feature owner?
- Normal task completable without leaving feature?
- Shared resources canonical?

## Hierarchy

- Main task obvious?
- Center dominates right context?
- Alignment/spacing used before extra cards?

## Density

- Nav rows compact?
- Forms/tables efficient without being cramped?
- Unnecessary vertical padding removed?

## Brand

- Mar Wie paper-and-ink character preserved?
- Sky blue restrained and meaningful?
- Newsreader rare?
- Mascot minimal?

## Apple principles

- Clear and concise?
- Familiar and consistent interactions?
- Immediate local feedback?
- Progressive disclosure appropriate?
- Destructive actions clear and safe?

## Accessibility

- Keyboard complete?
- Focus visible?
- AA contrast?
- Semantic labels?
- No color-only state?
- Reduced motion supported?
- Touch targets expanded appropriately?

## Responsive

- Three-region wide layout works?
- Right drawer works?
- Left drawer works?
- Main task remains complete when side regions are hidden?

---

# 41. Out of scope

This system does not determine:

- feature business logic
- which existing settings remain in the redesign
- backend/API shape
- exact icon library
- final copy for every screen
- final illustration assets

Those belong to feature specifications and implementation plans.

---

# 42. Completeness definition

This design system is complete for redesign planning because it defines:

- product and usability principles
- Apple-derived review constraints
- light/dark color primitives and semantic aliases
- exact semantic status colors
- typography scale and roles
- spacing
- density and target sizing
- radii
- borders/strokes
- exact light/dark elevation
- motion
- focus and interaction states
- breakpoints and three-region layout
- compact feature-first navigation
- page anatomy and save behavior
- buttons
- form controls
- segmented controls
- tables/lists
- cards/panels
- contextual right panel
- feedback/callouts
- dialogs/popovers/drawers/menus/tooltips
- search
- empty/loading/error/destructive states
- icons and mascot
- analytics/charts
- Discord previews
- resource bindings
- permissions/dependencies
- activity
- theme behavior
- accessibility
- responsive rules
- content design
- component composition rules
- feature composition examples
- canonical implementation tokens
- QA gates

Any later change to these foundations must update this specification or append a superseding decision instead of silently drifting in implementation.
