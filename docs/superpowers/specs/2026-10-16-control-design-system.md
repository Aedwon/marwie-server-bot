# Rob-bot Control Design System

Date: 2026-10-16
Status: Design-system specification
Scope: Rob-bot Control website

## 1. Purpose

This document defines the reusable visual, interaction, layout, accessibility, and component system for the Rob-bot Control website.

It turns the current product direction into an implementation-ready design contract.

It derives from three inputs:

1. **Mar Wie course site** for brand language, typography, color, shape, restraint, and visual character.
2. **Rob-bot Control information architecture decisions** for feature-first organization, MECE sidebar grouping, complete feature ownership, canonical shared resources, and the three-region shell.
3. **Apple design principles** for clarity, hierarchy, consistency, familiarity, concise task flows, immediate feedback, progressive disclosure, accessibility, and restraint.

The Cloudflare dashboard reference influences compact administrative density and navigation ergonomics. It is not a visual brand source.

This system does not visually copy Apple or Cloudflare.

## 2. Related decisions

This specification must be read with:

- `docs/superpowers/decisions/2026-10-16-control-interface-information-architecture.md`
- `docs/superpowers/decisions/2026-10-16-control-brand-and-visual-direction.md`
- `docs/superpowers/decisions/2026-10-16-control-apple-design-principles.md`

If an older Control styling decision conflicts with this specification, this specification and the above 2026-10-16 decisions take precedence for the redesign.

## 3. Design principles

### 3.1 Feature first

The user navigates by feature, not implementation concept.

A feature owns its complete normal configuration flow. Tickets owns ticket types, behavior, permissions, messages, and ticket-specific resource bindings. Global Resources exists for cross-feature visibility and troubleshooting, not as a required step.

### 3.2 MECE navigation

Sidebar categories organize features without becoming configuration destinations.

Categories should be mutually exclusive and collectively exhaustive as closely as practical. A feature should have one clear home.

### 3.3 Clarity before decoration

Hierarchy comes from order, alignment, spacing, type, contrast, borders, and state. Decorative treatment must not compensate for weak structure.

Every persistent element must justify its space.

### 3.4 Compact, not cramped

Control is an operations interface. Desktop density should expose useful information efficiently.

Compactness must not reduce legibility, target accessibility, or state clarity.

### 3.5 Brand restraint

Sky blue is the brand accent and information color. It is not a generic selection color.

Neutral structure should dominate the interface. Semantic colors should communicate meaning.

### 3.6 Familiar interactions

Prefer established web controls and native semantics. Avoid custom interaction behavior when a conventional pattern works.

### 3.7 Immediate feedback

Actions must communicate pending, success, conflict, failure, selected, disabled, and destructive states clearly and promptly.

### 3.8 Progressive disclosure

Common configuration is visible. Advanced, destructive, uncommon, and diagnostic configuration is disclosed deliberately.

### 3.9 Accessibility by default

Accessibility is part of every component contract. The target is WCAG 2.2 AA.

### 3.10 Stable shell, adaptive content

Navigation and interaction conventions remain stable between features. The center workspace and right panel adapt to the selected feature.

---

# 4. Token architecture

Use three token layers:

1. **Primitive tokens**: raw colors, sizes, spacing, radii, durations.
2. **Semantic tokens**: background, text, border, status, focus, selection.
3. **Component tokens**: nav row height, shell width, input height, panel padding.

Components should consume semantic or component tokens instead of raw primitives whenever practical.

CSS custom properties are the preferred implementation mechanism.

Naming convention:

```css
--ds-color-*       /* primitive colors */
--ds-space-*       /* spacing primitives */
--ds-radius-*      /* radius primitives */
--ds-font-*        /* typography primitives */
--ds-duration-*    /* motion primitives */

--surface-*        /* semantic surfaces */
--text-*           /* semantic text */
--border-*         /* semantic borders */
--status-*         /* semantic states */
--focus-*          /* focus semantics */

--control-*        /* component/layout tokens */
```

Do not encode component names into primitive tokens.

---

# 5. Color system

## 5.1 Light primitives

These values inherit the course site's paper-and-ink system.

| Token | Value | Purpose |
|---|---:|---|
| `--ds-color-paper` | `#fcfcfb` | page background |
| `--ds-color-white` | `#ffffff` | primary surface |
| `--ds-color-ink` | `#111113` | strongest text / primary action |
| `--ds-color-ink-hover` | `#2a2a2e` | dark action hover |
| `--ds-color-note` | `#3a3a3f` | strong secondary text |
| `--ds-color-body` | `#4a4a4f` | body text |
| `--ds-color-muted` | `#6e6e73` | secondary text |
| `--ds-color-faint` | `#8a8a8f` | decorative/nonessential text |
| `--ds-color-line` | `#ebebea` | hairline divider |
| `--ds-color-field` | `#dcdcda` | input/control border |
| `--ds-color-soft` | `#f4f4f2` | neutral soft fill |
| `--ds-color-hover` | `#f5f5f3` | hover fill |
| `--ds-color-selected` | `#efefec` | selected neutral fill |
| `--ds-color-selected-line` | `#e4e4e0` | selected inset border |

## 5.2 Brand primitives

| Token | Value | Purpose |
|---|---:|---|
| `--ds-color-sky` | `#7db9e8` | primary brand accent |
| `--ds-color-sky-deep` | `#2f6fa3` | accessible blue text/focus on light |
| `--ds-color-sky-tint` | `#eef6fd` | light information background |
| `--ds-color-sky-tint-strong` | `#dcebf8` | avatar/info accent background |
| `--ds-color-sky-dark-surface` | `#14273a` | dark information surface |

Sky is for brand identity, informational emphasis, selected data marks, links where blue semantics are appropriate, and focus indication.

Do not use sky blue simply because something is selected in navigation.

## 5.3 Semantic status primitives

| Meaning | Foreground | Background | Border |
|---|---:|---:|---:|
| Success / healthy | `#1f7a4d` | `#eaf5ec` | `#cbe5d2` |
| Warning / attention | `#6b4600` | `#fdf3e1` | `#f3ddb0` |
| Error / destructive | `#b42318` | `#fdf0ef` | `#f4d3cf` |
| Informational | `#2f6fa3` | `#eef6fd` | `#dcebf8` |

Additional course colors remain special-purpose only:

- amber `#e5a00d`: star/rating or explicit amber semantic only
- Discord `#5865f2`: Discord brand/logo only
- pink donation palette: not part of general Control semantics
- violet: not a general Control accent

## 5.4 Dark primitives

Dark is a translation of the light system, not a separate aesthetic.

| Semantic role | Dark value |
|---|---:|
| page | `#0f0f11` |
| surface | `#19191c` |
| surface raised | `#1b1b1e` |
| hover | `#212125` |
| text strong | `#ececee` |
| text secondary strong | `#c6c6cb` |
| text body | `#adadb3` |
| text muted | `#8b8b91` |
| text faint | `#737379` |
| border subtle | `#232327` |
| border control | `#34343a` |
| error | `#f97066` |
| success | `#5fd08a` |
| info accent | `#7db9e8` |
| info surface | `#14273a` |

Dark warning and destructive surfaces may use low-chroma, low-luminance variants derived from the semantic hue, but text contrast must remain AA.

## 5.5 Semantic color aliases

Light theme:

```css
--surface-page: var(--ds-color-paper);
--surface-primary: var(--ds-color-white);
--surface-secondary: var(--ds-color-soft);
--surface-hover: var(--ds-color-hover);
--surface-selected: var(--ds-color-selected);

--text-primary: var(--ds-color-ink);
--text-secondary: var(--ds-color-body);
--text-tertiary: var(--ds-color-muted);
--text-faint: var(--ds-color-faint);

--border-subtle: var(--ds-color-line);
--border-control: var(--ds-color-field);
--border-selected: var(--ds-color-selected-line);

--accent-brand: var(--ds-color-sky);
--accent-info: var(--ds-color-sky-deep);
--focus-ring: var(--ds-color-sky-deep);
```

Dark theme:

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

--border-subtle: #232327;
--border-control: #34343a;
--border-selected: #3d3d43;

--accent-brand: #7db9e8;
--accent-info: #7db9e8;
--focus-ring: #7db9e8;
```

## 5.6 Contrast rules

- Normal essential text must meet WCAG AA contrast.
- `#8a8a8f` on `#fcfcfb` does not meet 4.5:1 for small text. Use `--text-faint` only for nonessential/decorative metadata, disabled-like presentation, or appropriately large text.
- `#6e6e73` on `#fcfcfb` is acceptable for normal text and is the preferred light-theme tertiary text color.
- Dark faint text must not carry required information unless contrast is verified.
- Color cannot be the sole carrier of state. Pair semantic color with text, icon, shape, or position.

---

# 6. Typography

## 6.1 Font families

```css
--font-sans: "Figtree", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-serif: "Newsreader", Georgia, serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

Figtree weights: 400, 500, 600.

Do not depend on 700 for routine UI hierarchy.

Newsreader is italic 400 only and is used sparingly.

## 6.2 Root size

The browser root remains `16px`.

All typography tokens use `rem`.

Do not alter the root font size to make the interface compact. Compactness comes from role-based font sizes, spacing, and component sizing.

## 6.3 Primitive type scale

The scale is role-based, not a geometric modular scale.

| Token | rem | px at 16px root |
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

`--font-size-display` is reserved for onboarding, empty-state, or exceptional product moments. Routine Control pages should not require it.

## 6.4 Semantic type roles

| Role | Size | Weight | Line height | Tracking |
|---|---:|---:|---:|---:|
| Page title | 28px | 500 | 1.2 | `-0.02em` |
| Major onboarding title | 32–36px | 500 | 1.15 | `-0.025em` |
| Section title | 18px | 600 | 1.3 | `-0.01em` |
| Subsection title | 16px | 600 | 1.35 | `-0.005em` |
| Panel title | 14px | 600 | 1.4 | normal |
| Body compact | 14px | 400 | 1.5 | normal |
| Body readable | 16px | 400 | 1.6 | normal |
| Label | 13px | 500 | 1.35 | normal |
| Metadata | 12px | 400/500 | 1.4 | normal |
| Button | 14px | 500 | 1 | normal |
| Nav item | 14px | 500 | 1.35 | normal |
| Nav group label | 12px | 500 | 1.3 | `0.01em` |
| Table header | 12px | 600 | 1.35 | `0.01em` |
| Code / identifier | 13px | 400 | 1.45 | normal |

Numbers in analytics, tables, counts, timestamps, and metrics should use `font-variant-numeric: tabular-nums`.

## 6.5 Newsreader usage

Allowed:

- one or two meaningful words in onboarding headings
- selected empty-state headings
- occasional completion/success copy
- rare brand moments

Not allowed:

- routine setting labels
- table headings
- nav items
- feature page titles
- form labels
- warnings/errors
- dense operational content

## 6.6 Text rules

- Use sentence case for navigation, buttons, headings, labels, and alerts unless a proper name requires otherwise.
- Prefer concise verbs for actions: `Save changes`, `Post announcement`, `Add ticket type`.
- Avoid cute or vague action labels.
- Use `text-wrap: balance` for larger headings and `text-wrap: pretty` for explanatory body copy where supported.
- Avoid all-caps except short data abbreviations or established compact kickers.
- Error text should explain the correction, not merely say `Invalid`.

---

# 7. Spacing

Use a compact 2px/4px-derived scale, with the course site's even spacing philosophy preserved.

| Token | Value |
|---|---:|
| `--space-0` | `0` |
| `--space-0-5` | `0.125rem` / 2px |
| `--space-1` | `0.25rem` / 4px |
| `--space-1-5` | `0.375rem` / 6px |
| `--space-2` | `0.5rem` / 8px |
| `--space-2-5` | `0.625rem` / 10px |
| `--space-3` | `0.75rem` / 12px |
| `--space-3-5` | `0.875rem` / 14px |
| `--space-4` | `1rem` / 16px |
| `--space-4-5` | `1.125rem` / 18px |
| `--space-5` | `1.25rem` / 20px |
| `--space-6` | `1.5rem` / 24px |
| `--space-7` | `1.75rem` / 28px |
| `--space-8` | `2rem` / 32px |
| `--space-10` | `2.5rem` / 40px |
| `--space-12` | `3rem` / 48px |
| `--space-14` | `3.5rem` / 56px |
| `--space-16` | `4rem` / 64px |

Guidelines:

- Use `gap` for component and layout spacing instead of ad hoc child margins.
- Default field stack gap: 8px.
- Label-to-control gap: 6px.
- Compact row horizontal padding: 10–12px.
- Main section separation: 24–32px.
- Right panel section separation: 16–20px.
- Avoid the course site's 96px marketing section spacing in Control.

---

# 8. Sizing and density

## 8.1 Desktop control heights

| Component | Height |
|---|---:|
| Compact icon button | 32px visual, minimum 32px target |
| Compact nav row | 36px |
| Compact text/select/input | 36px |
| Standard button | 38px |
| Standard row | 40px |
| Primary prominent action | 40–44px |
| Touch/mobile control | minimum 44px target |

Desktop visual density may be compact, but coarse-pointer layouts should expand interactive targets to at least 44px where practical.

## 8.2 Hit areas

A visual icon may be 16–18px while its interactive target is 32–36px on desktop and 44px on touch.

Do not shrink hit areas simply to achieve compact appearance.

---

# 9. Radius system

| Token | Value | Use |
|---|---:|---|
| `--radius-xs` | 6px | tooltip, code chip |
| `--radius-sm` | 8px | compact nav, icon button |
| `--radius-md` | 10px | compact panels, selects |
| `--radius-lg` | 12px | inputs, notes, inner panels |
| `--radius-xl` | 16px | medium structural panels |
| `--radius-card` | 18px | substantial cards where needed |
| `--radius-shell` | 24px | floating side shells |
| `--radius-pill` | 999px | tags, chips, primary pill actions where appropriate |

Do not make every control pill-shaped.

Pills are appropriate for:

- tags
- status chips
- segmented controls
- primary/secondary actions where the course brand treatment fits

Dense navigation, fields, rows, and context panels should use 8–12px radii.

---

# 10. Border system

```css
--border-width-hairline: 1px;
--border-subtle: 1px solid var(--border-subtle);
--border-control: 1px solid var(--border-control);
```

Use borders to clarify structure, not to decorate every surface.

Appropriate uses:

- shell boundaries
- fields
- tables and row separators
- popovers/dialogs
- meaningful context panels
- status callouts
- structural group boundaries

Avoid nested bordered boxes when spacing and alignment already establish hierarchy.

---

# 11. Elevation and shadows

The center workspace is primarily flat.

## 11.1 Card shadow

```css
--shadow-card: 0 1px 2px rgba(17, 17, 19, 0.04);
```

Use only for a true raised card.

## 11.2 Floating surface shadow

```css
--shadow-floating:
  0 0 0 1px var(--shadow-ring),
  0 4px 10px rgba(17, 17, 19, 0.06),
  0 24px 48px rgba(17, 17, 19, 0.16);
```

Use for menus, popovers, drawers, and dialogs.

## 11.3 Sidebar shell shadow

Light:

```css
--shadow-shell:
  inset 0 1px 0 #fff,
  0 1px 2px rgba(17, 17, 19, 0.05),
  0 18px 40px rgba(17, 17, 19, 0.09);
```

Dark should use lower-opacity black and a subtle inner highlight appropriate to the dark surface.

Do not place large card shadows throughout the center workspace.

---

# 12. Motion

## 12.1 Durations

| Token | Value | Use |
|---|---:|---|
| `--duration-instant` | 80ms | press feedback |
| `--duration-fast` | 120ms | hover/color transitions |
| `--duration-standard` | 160ms | selection, compact disclosure |
| `--duration-medium` | 200ms | drawer/panel movement |
| `--duration-slow` | 300ms | dialog/first-load entrance |

## 12.2 Easing

```css
--ease-standard: cubic-bezier(.2, .8, .2, 1);
--ease-hover: ease;
```

## 12.3 Rules

- Hover transitions: 120–150ms.
- Press feedback may scale to approximately `.98` only on buttons where it feels natural.
- Drawers/popovers should feel immediate, not theatrical.
- Do not animate routine same-context navigation with large entrance effects.
- One-time onboarding/empty-state entrances may use the course site's restrained pop-in treatment.
- No continuous decorative motion in Control.
- `prefers-reduced-motion: reduce` disables nonessential animation and minimizes essential transitions.

---

# 13. Focus and interaction states

## 13.1 Focus

Use an explicit focus ring for keyboard focus:

```css
outline: 2px solid var(--focus-ring);
outline-offset: 2px;
```

Large regions may use a 3px ring when needed for visibility.

Do not suppress focus without providing an equally visible replacement.

## 13.2 Standard state sequence

Every interactive component must define:

- default
- hover
- active/pressed
- focus-visible
- selected/checked/current when applicable
- disabled
- loading when applicable
- error when applicable

Selected and focused are distinct states and may coexist.

## 13.3 Disabled

Disabled controls should retain recognizable structure but reduce prominence. Do not rely solely on opacity if it makes labels unreadable.

Explain why a high-value action is unavailable when the reason is not obvious.

---

# 14. Layout system

## 14.1 Three-region desktop shell

Wide desktop layout:

```css
--control-left-width: 15rem;   /* 240px */
--control-right-width: 19rem;  /* 304px */
--control-shell-gap: 0.75rem;  /* 12px */
--control-edge-gap: 0.75rem;   /* 12px */
```

Grid:

```css
grid-template-columns:
  var(--control-left-width)
  minmax(0, 1fr)
  var(--control-right-width);
```

The left and right regions are framed/floating shells. The center is not placed inside another floating card.

## 14.2 Left shell

- width: 240px
- viewport inset: 12px
- radius: 24px
- shell padding: approximately 5px outer frame plus 10–12px internal panel padding
- sticky/fixed within viewport depending on implementation
- independent vertical scroll when content exceeds viewport

## 14.3 Center workspace

The center uses available width.

Do not apply one arbitrary global max-width to all feature content.

Use content modes:

| Mode | Max width | Use |
|---|---:|---|
| Readable | 42rem / 672px | prose/help |
| Form | 48rem / 768px | settings forms |
| Standard | 60rem / 960px | mixed configuration |
| Wide | 72rem / 1152px | tables/analytics |
| Fluid | none | data-heavy layouts |

Feature pages choose the mode that fits their task.

Main workspace horizontal padding: 20–32px on desktop depending on width.

## 14.4 Right contextual shell

- width: 304px
- radius: 24px
- compact vertical layout
- independent scroll if needed
- sticky within viewport on wide screens
- sections separated with whitespace and hairlines, not nested cards by default

Right-panel content can include:

- resource bindings
- feature status/health
- dependencies
- preview
- recent activity
- permission warnings
- quick actions
- contextual help

Do not fill the panel artificially when a feature has no useful secondary context.

## 14.5 Responsive breakpoints

| Breakpoint | Behavior |
|---|---|
| `>= 1200px` | full three-region shell |
| `900–1199px` | left shell + center; right panel becomes drawer/popover |
| `< 900px` | left nav becomes drawer; compact top bar appears; right panel is temporary surface |
| `< 640px` | single-column feature layouts; tables may adapt/scroll; touch targets expand |

The 900px breakpoint intentionally aligns with the course site's primary responsive breakpoint.

## 14.6 Mobile priority

Mobile must preserve full configuration capability where practical. Do not hide essential settings just because the right panel becomes a drawer.

---

# 15. Left navigation

## 15.1 Purpose

The navigation is feature-first and compact.

The outer shell is soft and branded. The inner nav is efficient and utilitarian.

## 15.2 Group structure

Initial group direction:

- Engagement
- Publishing
- Support & Safety
- Insights
- System

Group labels are organization only. They are not configuration destinations unless a future explicit overview page is designed for a real user task.

## 15.3 Item geometry

```css
--nav-row-height: 2.25rem;       /* 36px */
--nav-padding-y: 0.375rem;       /* 6px */
--nav-padding-x: 0.625rem;       /* 10px */
--nav-gap: 0.125rem;             /* 2px */
--nav-radius: 0.5rem;            /* 8px */
--nav-icon-size: 1.0625rem;      /* 17px */
```

Allow row height up to 38px when labels or platform rendering require it.

## 15.4 States

Default: transparent.

Hover: `--surface-hover`.

Selected/current:

- neutral selected fill
- stronger text
- optional subtle inset hairline
- no sky-blue pill
- no oversized padding

Example light selected treatment:

```css
background: linear-gradient(#f7f7f5, #efefec);
box-shadow:
  inset 0 0 0 1px #e4e4e0,
  inset 0 1px 0 #fff,
  0 1px 2px rgba(17,17,19,.06);
```

Use this sparingly. A flat `--surface-selected` fill is also valid if the gradient feels too ornamental in implementation.

## 15.5 Nested items

Nested items use indentation and optionally one subtle vertical guide.

Do not place children inside another rounded card.

## 15.6 Collapsible groups

Groups may collapse to manage length.

- remember state when practical
- group expansion does not change the selected feature
- collapsing a group containing the current feature must not make orientation ambiguous; the group label should still communicate current membership

## 15.7 Search

If quick search is retained or added:

- compact 36–38px field
- searches features/settings/actions, not arbitrary content only
- keyboard shortcut may be displayed as secondary metadata
- results should identify feature context

---

# 16. Page anatomy

A normal feature page should follow this order:

1. feature header
2. operational state and primary action
3. core configuration/data
4. advanced or secondary sections
5. contextual right-panel information

## 16.1 Feature header

Contains:

- feature title
- one concise description when useful
- enabled/disabled/attention state when applicable
- primary action only when the page has a clear primary action

Do not add decorative hero banners to routine feature pages.

## 16.2 Sectioning

Use section headings + spacing + hairline separation before reaching for cards.

Common section gap: 24–32px.

## 16.3 Save model

When a page uses explicit save:

- dirty state must be visible
- `Save changes` is the primary action
- `Discard` is secondary/tertiary
- Cmd/Ctrl+S may save when valid and safe
- navigation away from dirty state requires deliberate protection
- success may be shown inline without forcing a toast
- conflicts must explain that server state changed and offer a safe resolution path

---

# 17. Buttons

## 17.1 Variants

### Primary

Use for the single primary action in a local context.

Light:

- background: `--text-primary` / ink
- text: white/paper

Dark:

- background: `--text-primary` / light ink
- text: dark page

Primary buttons do not default to sky blue.

### Secondary

- surface background
- 1px control border
- primary text

### Tertiary / text

- transparent
- no border
- primary or tertiary text depending importance

### Destructive

Use semantic destructive styling only when the action is destructive.

A destructive confirmation dialog may use a solid destructive primary button.

## 17.2 Geometry

Compact button: 36px.

Standard button: 38–40px.

Prominent flow action: 44–50px only when the context justifies it.

Pill radius is allowed for primary/secondary branded actions. Dense toolbar buttons may use 8–10px radius instead.

## 17.3 Loading

- preserve button width
- show spinner + stable action label where space allows
- set `aria-busy="true"`
- disable duplicate submission
- do not replace useful labels with an unlabeled spinner

---

# 18. Form controls

## 18.1 Inputs

Desktop:

- height: 36px
- radius: 10–12px
- font: 14px for compact UI
- horizontal padding: 10–12px

Mobile/touch:

- minimum visual/interactive height: 44px
- text inputs use 16px font to prevent iOS zoom

## 18.2 Labels

Labels are always explicit.

Placeholder text is a hint/example, not a substitute for a label.

Required/optional state should be understandable without relying on color.

## 18.3 Validation

- validate at a useful time, not aggressively on every keystroke unless necessary
- show error beside the affected control/group
- error text states how to fix the issue
- use `aria-invalid` and associated descriptions
- move focus only when it helps recovery and does not surprise the user

## 18.4 Selects and comboboxes

Use native `<select>` when its behavior is sufficient.

Use a custom combobox only when search, grouped resources, metadata, or large option sets require it.

Discord resource selectors should display resource type/context and exclude invalid resources before selection where practical.

## 18.5 Checkbox and radio

Use familiar native semantics and large enough label hit areas.

Do not use a switch when the choice is not an immediate on/off setting.

## 18.6 Switch

Switches are for binary feature or behavior state that takes effect as a setting.

Visual switch may remain compact, but the containing hit area should be at least 36px desktop and 44px touch.

Label the state in text when ambiguity is possible.

## 18.7 Textareas

Use for message bodies, descriptions, explanations, and long text.

Show character limits when they matter before submission.

Resize behavior should not break the page layout.

---

# 19. Segmented controls

Use for a small set of mutually exclusive peer modes, such as Light / Dark / System or chart ranges when a segmented treatment is more appropriate than tabs.

Track:

- soft neutral background
- 3px internal padding
- selected option on raised surface
- compact height

Do not use segmented controls for unrelated navigation destinations.

---

# 20. Tables and lists

## 20.1 Default preference

Use lists/tables for repeated operational data instead of building a grid of cards.

## 20.2 Table geometry

- header height: 32–36px
- standard row: 40px
- dense row: 36px when content permits
- horizontal cell padding: 10–12px
- subtle row separators
- no zebra striping by default
- hover only for interactive rows

## 20.3 Selection

Persistent selected rows should remain visibly selected when they represent navigation/current context.

Transient action rows should not remain selected after the action unless selection itself is state.

## 20.4 Sorting/filtering

- indicate sort direction in text/accessible label and icon
- preserve current filter state across relevant navigation when useful
- empty filtered states should distinguish `no data exists` from `no results match`

## 20.5 Overflow

Prefer responsive column prioritization before horizontal scroll, but do not hide critical data.

On small screens, allow a controlled horizontal scroll or convert records to compact stacked rows when that preserves comprehension.

---

# 21. Cards and panels

## 21.1 Structural rule

A card must represent a meaningful object, summary, or independent action area.

Do not put every settings section inside a card.

## 21.2 Card types

### Flat section

No outer card. Uses section heading, spacing, and divider.

Default for most settings.

### Structural panel

Border + 12–16px radius. No or minimal shadow.

Use for grouped content that needs a boundary.

### Raised card

18px radius + minimal card shadow.

Use rarely for genuinely independent objects or dashboards.

### Floating shell

24px radius + shell elevation.

Reserved for left/right side regions and temporary floating surfaces.

---

# 22. Contextual right panel

## 22.1 Purpose

The right panel supports the center task. It never becomes a second unrelated dashboard.

## 22.2 Approved content patterns

### Resource bindings

Example: Tickets shows panel channel, category, and logs channel.

The controls edit canonical mapping state directly.

### Health

Show configured/incomplete/healthy/degraded with concise supporting detail.

### Dependencies

Show missing permissions, missing resource, unavailable bot capability, or required prerequisite.

### Preview

Use when the feature produces visual Discord output, such as announcements.

### Activity

Show the few most relevant recent events, with a route to full Activity if needed.

### Contextual help

Short task-specific guidance only. Avoid generic documentation walls.

## 22.3 Section treatment

- panel padding: 14–16px
- section heading: 13–14px / 600
- section gap: 16–20px
- hairline separator where needed
- no nested card per section by default

---

# 23. Status, feedback, and callouts

## 23.1 Status chip

Use for concise state such as:

- Enabled
- Disabled
- Healthy
- Needs setup
- Degraded
- Draft

Chips are compact and semantic. Do not use them as decorative labels.

## 23.2 Inline success

Use a concise message near the changed area when persistence succeeds and the acknowledgement matters.

## 23.3 Warning callout

Use amber semantic surface for actionable caution.

Warnings explain consequence and next action.

## 23.4 Error callout

Use red semantic treatment for operation-level failure that cannot be tied to one field.

Field errors stay beside fields.

## 23.5 Toasts

Toasts may acknowledge lightweight transient success.

Toasts must not be the only presentation of:

- validation error
- destructive failure
- permission problem
- unresolved conflict
- required next step

---

# 24. Dialogs, popovers, and drawers

## 24.1 Dialog

Prefer native `<dialog>` where practical.

Use for:

- destructive confirmation
- focused short workflow
- critical decision requiring explicit response

Dialog width should fit content, commonly 360–480px.

Do not use a modal for information that can live inline.

## 24.2 Popover

Use for lightweight contextual menus, selectors, or small option surfaces.

Popover uses floating shadow and 8–12px radius.

## 24.3 Drawer

Use for responsive navigation and contextual right-panel content when there is insufficient horizontal space.

Drawer must:

- trap focus when modal
- close on Escape
- restore focus to trigger
- have an accessible name
- avoid losing unsaved state when closed accidentally

---

# 25. Menus

Menus should be compact and action-oriented.

- row height: 34–36px
- radius: 8–10px
- padding: 6px outer
- destructive actions separated or clearly marked
- keyboard navigation supported
- avoid placing common primary actions only inside overflow menus

---

# 26. Tooltips

Tooltips explain unfamiliar icons or terse technical terms.

- radius: 6px
- concise text
- not required to understand primary workflow
- available by keyboard focus as well as hover
- never contain essential interactive content

For more substantial help, use popover/help text instead.

---

# 27. Search and command surfaces

Search should help users locate features, settings, and actions using user-facing terminology.

Results should include enough hierarchy to disambiguate duplicate terms.

Example:

`Logs channel` → `Tickets › Discord resources`

Do not expose internal key names such as `ticket_logs` as the primary label unless shown as developer metadata.

---

# 28. Empty states

Empty states distinguish:

- no data has ever existed
- feature is disabled
- setup is incomplete
- current filters return no results
- data failed to load

Mascot use is allowed only for meaningful empty/onboarding/success states, not every empty table.

Empty states include a clear next action when one exists.

---

# 29. Loading and skeletons

Prefer skeletons when the structure is predictable.

Use compact shimmer/neutral skeleton bars without excessive animation.

Use spinners for indeterminate action-level waits.

Avoid replacing an entire stable page with a loading screen when only one region is refreshing.

Preserve previous valid data during background refresh when safe, and indicate that refresh is in progress.

---

# 30. Error states

Errors should answer:

1. what failed
2. what remains safe/unchanged
3. what the user can do next

Examples:

- `Couldn’t save ticket types. Your unsaved changes are still here. Try again.`
- `Rob-bot can’t post in #announcements. Give the bot Send Messages permission or choose another channel.`

Avoid internal error codes in the primary message. A reference identifier may appear as secondary detail for support.

---

# 31. Destructive actions

Destructive actions include deletion, disabling behavior with meaningful consequences, compromised-account enforcement configuration, and irreversible publication where applicable.

Requirements:

- label consequence clearly
- distinguish destructive action visually
- confirm when consequence is substantial or difficult to reverse
- avoid generic `Are you sure?`
- name the affected object in the confirmation
- preserve auditability where the product already supports it

---

# 32. Icons

Use one coherent line-icon family or internally consistent SVG set.

Guidelines:

- routine nav/action icons: 16–18px
- stroke should remain visually consistent across the set
- icons support labels instead of replacing them unless the meaning is universally familiar and an accessible name is present
- brand logos keep official brand color where appropriate
- do not introduce multicolor decorative icons throughout the admin interface

The pixel mascot is not the general icon system.

---

# 33. Mascot and illustration

The pixel-cloud mascot is deliberately minimal.

Allowed:

- brand identity
- onboarding
- first-run setup
- meaningful empty state
- occasional success/completion

Not allowed by default:

- routine feature headers
- nav decoration
- every right-panel section
- tables
- repeated setting cards

Pixel art must preserve crisp edges.

The course site's moving sky background is not used behind Control.

---

# 34. Charts and analytics

Charts prioritize data over framing.

Requirements:

- strongest visual emphasis on the data
- axes/descriptions secondary
- consistent series colors
- semantic labels independent of color
- accessible summary/description
- tabular numerals for metric values
- concise date/time formats without ambiguity
- compact chart padding to maximize useful plot area

Do not place each metric inside a large decorative card when a compact metric row or grid is clearer.

---

# 35. Discord preview pattern

Features that publish Discord content may use a preview in the right panel or center when preview is central to the task.

Preview must be visually identifiable as a preview and should not imitate Discord so closely that users confuse it for live content.

It should reflect:

- message text
- mentions
- embed title/body/footer
- color accent
- image when supplied

Preview errors or unsupported states should appear beside the relevant editor field, not only inside preview.

---

# 36. Resource binding pattern

Resource bindings include channels, roles, and categories.

Feature-local binding is the preferred editing surface.

Each binding should show:

- human-facing label
- current Discord resource
- resource type
- missing/deleted/permission state when relevant
- edit control

The global Resources view shows the same canonical values across features.

No duplicated mapping state is permitted.

---

# 37. Permission and dependency pattern

Missing permissions or dependencies appear at the affected feature.

Use three levels:

1. **Informational**: feature works, but optional capability is absent.
2. **Attention**: feature is partially degraded.
3. **Blocking**: action/configuration cannot function.

State should include the specific resource or permission and a direct recovery action where possible.

---

# 38. Activity pattern

Activity is chronological and concise.

Each event may include:

- action summary
- actor
- timestamp
- state: queued / in progress / completed / failed / rejected
- failure reason/reference when applicable

Use relative time in compact lists with full absolute timestamp available on hover/focus/detail.

---

# 39. Theme behavior

Theme options:

- Light
- Dark
- System

Default: System.

Light is the canonical branded expression.

System follows OS preference live when practical.

User choice is persisted locally.

Theme changes should not alter information architecture, density, or component dimensions.

---

# 40. Accessibility

## 40.1 Standard

Target WCAG 2.2 AA.

## 40.2 Keyboard

All interactive behavior must be keyboard-operable.

Expected support includes:

- logical Tab order
- Enter/Space activation where appropriate
- Escape for dismissible modal surfaces
- arrow-key behavior for components whose ARIA pattern requires it
- Cmd/Ctrl+S save where explicitly supported

## 40.3 Screen readers

- landmarks for navigation/main/context where appropriate
- one clear page heading
- explicit field labels
- `aria-current` for current navigation
- live regions only for meaningful asynchronous updates
- status labels that do not depend on icon/color
- charts described with useful value context

## 40.4 Target size

Compact desktop controls may use 32–40px visible geometry when pointer precision is expected.

On coarse-pointer/touch layouts, targets should expand toward at least 44px.

No critical control may have a tiny icon-only hit target.

## 40.5 Motion

Respect reduced-motion preferences.

## 40.6 Zoom/reflow

The interface must remain usable at 200% browser zoom and should reflow without losing functionality.

## 40.7 Contrast

Do not use the faint token for essential small text.

Focus, form boundaries, state indicators, and text must meet applicable contrast requirements.

---

# 41. Responsive behavior

## 41.1 Wide desktop

Three regions visible.

## 41.2 Medium desktop/tablet landscape

Right context collapses to a drawer. The center retains full task capability.

## 41.3 Narrow/tablet/mobile

Left nav becomes a drawer. A compact top bar provides:

- menu trigger
- current feature or product identity
- contextual action when essential

Right context remains accessible through a clearly labeled trigger.

## 41.4 Small-screen forms

- fields become full width
- paired controls stack when necessary
- button groups wrap/stack without losing hierarchy
- input text remains at least 16px where browser zoom behavior requires it

---

# 42. Content design

## 42.1 Voice

Plain, calm, competent, non-technical where possible.

## 42.2 Labels

Use user-goal terminology instead of implementation terminology.

Prefer `Ticket logs channel` over `ticket_logs`.

## 42.3 Buttons

Use verbs or clear verb phrases.

Good:

- Save changes
- Add source
- Post announcement
- Retry
- Choose channel

Avoid:

- Proceed
- Submit
- Okay
- Do it

unless the context makes them unambiguous.

## 42.4 Errors

State what happened and what to do next.

Do not scold.

## 42.5 Help

Put short help next to the setting it explains. Link to deeper documentation only when the explanation cannot remain concise.

---

# 43. Component composition rules

1. Do not nest cards inside cards unless the inner object is truly independent.
2. Do not place two visually primary buttons side by side.
3. Do not use blue simply to increase visual interest.
4. Do not move essential configuration into the right panel solely for symmetry.
5. Do not make the user visit Resources to complete routine feature setup.
6. Do not hide ordinary settings under `Advanced` to keep a screen visually empty.
7. Do not add a custom interaction if a familiar native/web pattern is sufficient.
8. Do not use a modal when inline editing is practical.
9. Do not use a tooltip for required instructions.
10. Do not use a toast as the sole presentation of an important error.

---

# 44. Feature-page examples

## 44.1 Tickets

Center:

- feature status
- ticket types
- panel behavior
- lifecycle behavior
- permissions/claim/close/reopen settings when configurable
- user-facing messages
- advanced settings

Right:

- ticket category
- ticket panel channel
- ticket logs channel
- health/readiness
- recent ticket activity if useful

## 44.2 Announcements

Center:

- message composer
- embed fields
- color/image configuration
- mention behavior
- post action

Right:

- destination channel
- Discord preview
- permission/status

## 44.3 Reputation

Center:

- enable state
- thresholds
- earning/behavior rules

Right:

- tier role bindings
- health/readiness

## 44.4 Quizzes

Center:

- enable state
- schedule
- question bank
- question editing

Right:

- quiz channel
- scheduler status
- last/next run

## 44.5 Analytics

Center:

- date range
- metrics
- chart/table data
- reporting settings

Right:

- report destination
- collection status
- most recent report/activity

These examples define composition patterns, not final feature scope.

---

# 45. Design QA checklist

Every implementation should be reviewed against the following.

## Information architecture

- Is the screen owned by one clear feature?
- Can the normal task be completed without leaving the feature?
- Are shared resources canonical instead of duplicated?

## Hierarchy

- Is the main task obvious?
- Is the center visually dominant over the right panel?
- Are related controls grouped by alignment/spacing before card borders?

## Density

- Are nav rows compact?
- Are forms/tables efficient without feeling cramped?
- Is there unnecessary vertical padding?

## Brand

- Does the page feel consistent with the Mar Wie course visual language?
- Is sky blue restrained and meaningful?
- Is Newsreader used only in approved moments?
- Is the mascot minimal?

## Apple principles

- Is the interface clear and concise?
- Are familiar interactions used consistently?
- Does feedback appear immediately and locally?
- Are advanced details progressively disclosed?
- Are destructive actions clear and recoverable where possible?

## Accessibility

- Keyboard complete?
- Visible focus?
- AA contrast?
- Semantic labels?
- No color-only meaning?
- Reduced motion?
- Touch targets appropriate on touch layouts?

## Responsive

- Three-region wide layout works?
- Right panel becomes usable drawer?
- Left navigation becomes usable drawer?
- Main task still works without side regions visible?

---

# 46. Implementation token starter

The final implementation may organize files differently, but the semantic contract should approximately expose:

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

  --border-subtle: #ebebea;
  --border-control: #dcdcda;
  --border-selected: #e4e4e0;

  --accent-brand: #7db9e8;
  --accent-info: #2f6fa3;
  --focus-ring: #2f6fa3;

  --status-success: #1f7a4d;
  --status-error: #b42318;
  --status-warning: #6b4600;

  --font-sans: "Figtree", system-ui, sans-serif;
  --font-serif: "Newsreader", Georgia, serif;

  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-card: 18px;
  --radius-shell: 24px;
  --radius-pill: 999px;

  --control-left-width: 15rem;
  --control-right-width: 19rem;
  --control-shell-gap: 0.75rem;
  --control-edge-gap: 0.75rem;
  --control-nav-row: 2.25rem;
  --control-input-height: 2.25rem;

  --duration-fast: 120ms;
  --duration-standard: 160ms;
  --duration-medium: 200ms;
  --ease-standard: cubic-bezier(.2, .8, .2, 1);
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

  --border-subtle: #232327;
  --border-control: #34343a;
  --border-selected: #3d3d43;

  --accent-brand: #7db9e8;
  --accent-info: #7db9e8;
  --focus-ring: #7db9e8;

  --status-success: #5fd08a;
  --status-error: #f97066;
}
```

This starter is a contract reference, not authorization to paste it blindly into the current stylesheet. Implementation should reconcile existing CSS safely through a dedicated plan.

---

# 47. What is intentionally not specified here

This design system does not finalize:

- feature business logic
- which existing settings remain in V1
- backend data shape
- API behavior
- exact icon library
- final copy for every page
- final illustration assets

Those belong to feature specifications or implementation plans.

The visual and interaction rules in this document are complete enough to design and implement the Control redesign consistently.

---

# 48. Definition of design-system completeness

The Control design system is considered complete for redesign planning when all of the following exist in this document:

- visual principles
- Apple-derived usability principles
- color primitives and semantic mappings
- light/dark theme rules
- typography scale and semantic roles
- spacing scale
- density and sizing
- radii
- borders
- shadows/elevation
- motion
- breakpoints/layout
- navigation
- buttons
- form controls
- segmented controls
- tables/lists
- cards/panels
- contextual right panel
- status/feedback
- dialogs/popovers/drawers
- menus/tooltips
- search
- empty/loading/error/destructive states
- icons/mascot
- charts
- previews
- resource bindings
- permissions/dependencies
- activity
- responsive behavior
- content design
- accessibility
- composition rules
- QA checklist

Any later change to these foundations should update this spec or append a superseding decision instead of silently drifting in implementation.
