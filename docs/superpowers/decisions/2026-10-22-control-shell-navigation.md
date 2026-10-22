# Control shell navigation and panel layout

Date: 2026-10-22
Status: Approved
Scope: Rob-bot Control website shell

## Context

The October 2026 design system describes three floating regions at a fixed 240px left width. The finish build added a 900px to 1199px top bar with a Context button. That top bar is not in the approved design. The left navigation also had no compact mode, so a context column could force the center below a readable width.

The live review approved a shell that keeps the left navigation present, gives it a labeled and an icon-only form, and lets the right context panel stay visible for as long as the center can remain readable.

## Decision

### Layout model

The shell uses three named widths and a 600px floor for the center workspace.

```css
--control-rail-width: 4rem;    /* 64px */
--control-left-width: 15rem;   /* 240px */
--control-right-width: 19rem;  /* 304px */
--control-shell-gap: .75rem;   /* 12px */
--control-edge-gap: .75rem;    /* 12px */
--control-center-min: 37.5rem; /* 600px */
```

The right context panel is a column while the left navigation and the right panel can fit around a center of at least 600px. Below that width the right panel becomes a drawer. The left navigation becomes an icon rail before it becomes a drawer. These thresholds are derived from the widths above and are not hand-picked viewport bands.

- Labeled navigation plus context column: 240 + 304 + 600 + two 12px gaps + two 12px insets = 1192px.
- Icon rail plus context column: 64 + 304 + 600 + two 12px gaps + two 12px insets = 1016px.
- Icon rail plus center, no context: 64 + 600 + one 12px gap + two 12px insets = 700px.
- Labeled navigation plus center, no context: 240 + 600 + one 12px gap + two 12px insets = 876px.

The shell is driven by `data-nav-mode` and `data-context-mode` attributes. A small pure resolver computes both modes from the available width, whether the page has context, and the saved navigation preference. CSS does not use 900px or 1200px bands.

### Left navigation

- The labeled form is 240px and shows Phosphor icons, labels, and the current feature group.
- The current feature group is marked with primary text color. It does not use a leading dot, so the group label stays left-aligned.
- The icon rail is 64px and shows only Phosphor icons. Every destination stays visible. Group headers become hairline dividers.
- One toggle sits at the top right of the navigation. It uses a sidebar panel icon and remembers the operator's choice.
- The brand sits at the top left beside the toggle. The signed-in account and appearance controls form a fixed footer, and the account menu opens upward.
- The automatic default collapses the navigation to the rail when the labeled form would push the center below 600px. An explicit choice wins until the viewport is narrow enough that the navigation must become a drawer.
- The navigation becomes a drawer below 700px, where the rail plus a 600px center no longer fits.
- The drawer shows labels. The toggle is hidden in the drawer. The close control and Escape close it.

### Right context panel

- The panel renders only when the page has meaningful context.
- It is a 304px column while it fits. It becomes a drawer below 1016px when the left navigation is a rail.
- If the operator explicitly expands the labeled navigation at a width where the labeled navigation, the panel, and a 600px center cannot coexist, the panel becomes a drawer. The operator can collapse the navigation to restore the column.
- The drawer is opened from a Context control in the page header at widths where the navigation is not a drawer. At widths where the navigation is a drawer, the Context control moves to the top bar.
- The old 900px to 1199px top bar is removed. The top bar appears only when the navigation is a drawer.
- At widths where both the navigation and the context panel are drawers, opening one closes the other so only one overlay is active.
- The panel does not reserve an empty column. Pages without context expand the center.

### Content layout

Page grids respond to the center width, not the viewport. `.control-main` is an inline-size container. Header stacking, field grids, command rows, activity rows, and compact table presentation use container queries. The fixed changes tray keeps a viewport query because it is positioned against the viewport, not the center.

### Icons

Navigation icons come from Phosphor Icons (MIT) and are inlined as SVG. They are not a runtime dependency. Icons are decorative and every destination keeps a text label for assistive technology.

## Consequences

The shell needs a layout resolver, a persistent navigation preference, and state-driven drawer controllers. The right panel and the left rail keep their positions across the new thresholds instead of disappearing at a single breakpoint. The page layout no longer changes just because the browser is narrow when the center is still wide.

The icon rail needs a persistent account menu that can escape the rail bounds. The rail body scrolls while the head and footer stay fixed.

## Verification

- Unit tests cover the resolver at 699, 700, 875, 876, 1015, 1016, 1120, 1191, and 1192px with and without context.
- Render tests cover icon rail markup, the navigation toggle, and the page header Context trigger.
- CSS tests cover the state attributes, the rail width, and the container query root.
- The signed-in fixture is checked at 1120, 1000, 900, 700, and 390px in light and dark.
