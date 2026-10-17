# Control Brand and Visual Direction Decisions

Date: 2026-10-16

## Purpose

This document records the visual direction for the Rob-bot Control redesign.

It complements `2026-10-16-control-interface-information-architecture.md`, which remains authoritative for feature-first navigation, MECE grouping, complete feature ownership, the three-region shell, contextual right-panel behavior, and canonical shared resource state.

The visual direction intentionally combines two sources:

- the Mar Wie course site for brand language, typography, color, shape, motion, and visual character
- the Cloudflare dashboard reference for compact administrative density, spatial hierarchy, and navigation ergonomics

The goal is not to copy either source literally. Control should feel like a Mar Wie product while behaving like a purpose-built operations interface.

## Source-of-truth relationship

Decision: the course site is the primary brand and visual-language reference for Control.

Decision: the previously agreed Control information architecture and interaction model remain authoritative when a course-site pattern conflicts with administrative usability.

Decision: the Cloudflare dashboard is a reference for density, layout hierarchy, and compact navigation behavior. It is not a visual brand source.

## Brand foundations to adopt

Control should inherit the course site's core visual character:

- paper-and-ink neutrals
- off-white light background
- near-black text
- white primary surfaces
- 1px hairline borders
- restrained shadows
- Figtree as the primary UI typeface
- Newsreader italic as a selective accent face
- soft radii
- calm motion
- semantic color use instead of decorative color use

The primary brand accent is sky blue `#7db9e8`.

The established light neutrals should remain the starting point for the future token system:

- page background `#fcfcfb`
- surface `#ffffff`
- ink `#111113`
- body `#4a4a4f`
- muted `#6e6e73`
- faint `#8a8a8f`
- line `#ebebea`
- field `#dcdcda`
- soft `#f4f4f2`

Sky blue is used for brand and information. It should not be introduced everywhere simply to make the interface colorful.

Green remains semantic for healthy, successful, completed, or approved states. Amber remains semantic for warning or attention states. Red remains semantic for errors and destructive actions.

Pink remains a special-purpose course/donation color and should not become a general Control accent unless a future feature has a matching semantic reason.

## Theme priority

Decision: Control continues to support Light, Dark, and System themes.

Decision: System is the default preference.

Decision: Light is the canonical branded expression of the product.

Decision: Dark is a faithful token translation of the same system, not a separate visual aesthetic.

The dark theme should preserve hierarchy, density, semantic colors, border contrast, and component relationships from Light.

## Density

Decision: Control uses compact operational density on desktop.

Compact does not mean cramped. The interface should show more useful information at once than the course site while preserving clarity.

Guidelines:

- routine desktop rows and compact controls should generally target about 34 to 40px height
- supporting labels and metadata commonly use 12 to 14px text
- primary UI text commonly uses 14 to 16px text
- primary actions and touch-oriented controls should still preserve appropriate accessible hit areas
- dense tables, lists, mappings, and setting groups should minimize unnecessary vertical padding
- whitespace exists to establish hierarchy, not to make the interface feel airy
- large decorative section padding from the course site should not be transplanted into Control

## Shell treatment

Decision: use framed and floating side regions with a flatter center workspace.

The left navigation and right contextual panel should use subtly rounded, lightly elevated shells inspired by the course site's sidebar treatment.

The center workspace should remain comparatively flat and calm. It should not become another floating card inside the shell.

This creates a deliberate visual hierarchy:

- outer sidebars: branded, soft, framed, lightly elevated
- center workspace: functional, flat, information-led

## Left navigation density

Decision: the navigation inside the left shell should be compact and text-led, closer to the Cloudflare reference than the current Control navigation.

The outer sidebar may feel soft and branded. The inner navigation should feel efficient and utilitarian.

Desktop navigation targets:

- row height around 34 to 38px
- vertical padding around 5 to 7px
- horizontal padding around 8 to 12px
- sibling gaps around 2 to 4px
- nav-item radius around 8 to 10px
- icons around 16 to 18px and visually secondary to labels
- section labels separated primarily with spacing, not oversized padding
- nested items use indentation and, where useful, a restrained vertical guide instead of another bulky container

Hover and selected states should hug the navigation item closely. They should not look like large pills or cards.

Hover uses a subtle neutral fill.

Selected state uses a slightly stronger neutral fill and stronger text contrast.

Sky blue should not be used merely because an item is selected.

This supersedes any older Control styling that makes navigation rows feel oversized, heavily padded, or visually bulky.

## Typography direction

Decision: Figtree remains the default interface typeface, using 400, 500, and 600 weights.

Decision: Newsreader italic is intentionally rare in Control.

Appropriate Newsreader use includes:

- onboarding
- meaningful empty states
- occasional success or welcome copy
- selected brand moments

Routine administrative headings such as `Ticket types`, `Channel mappings`, or `Permissions` should remain in Figtree.

Decision: the future type system should use a 16px browser root and express typography tokens in `rem`.

The future scale should be role-based, not forced onto a geometric modular scale.

Current direction:

- 12px-equivalent text for fine metadata only
- 13px-equivalent text for supporting labels and compact secondary information
- 14px-equivalent text for normal compact UI
- 16px-equivalent text for body copy and form controls where readability or mobile zoom behavior matters
- restrained upper heading sizes suitable for an operations interface

Large titles may use responsive sizing when useful. Routine controls should remain stable.

Line heights should generally be unitless. Numeric data used in analytics, counts, and tables should use tabular numerals.

The exact typography token set is intentionally deferred to the dedicated design-system pass.

## Mascot use

Decision: use the pixel-cloud mascot minimally.

Appropriate uses:

- brand identity
- onboarding or first-run setup
- meaningful empty states
- occasional completion or success states

The mascot should not decorate routine configuration pages.

The mascot should not occupy the contextual right panel by default.

The moving-sky treatment from course flow pages should not be used behind the Control workspace.

## Borders, cards, and structural surfaces

The course site uses hairline-bordered cards while an older Control decision reduced decorative card outlines.

Decision: reconcile these by using hairlines for structural boundaries without turning every setting group into a card.

Use borders for:

- inputs
- meaningful panels
- shell boundaries
- rows where separation improves scanning
- popovers and dialogs
- structural grouping that would otherwise be ambiguous

Do not wrap every section, row, or setting in its own card merely to reproduce the course visual system.

This preserves the course site's crisp paper-and-ink character without reintroducing card-heavy dashboard clutter.

## Motion

Decision: retain calm, restrained motion.

Appropriate motion includes:

- short hover and pressed transitions
- restrained drawer and popover transitions
- one-time onboarding or first-load entrances where they improve polish

Avoid repeated decorative animation during normal configuration work.

`prefers-reduced-motion` remains mandatory.

## Design-system follow-up

This document records product-level visual direction. It is not the final token contract.

A separate design-system session and artifact should formalize the reusable system, including:

- color primitives and semantic aliases
- light and dark theme mappings
- type scale and semantic typography roles
- spacing scale
- sizing and density tokens
- radii
- borders
- shadows and elevation
- motion and easing
- breakpoints
- layout and grid rules
- buttons
- inputs and form controls
- navigation
- cards and panels
- tables and lists
- status and feedback patterns
- dialogs, popovers, and drawers
- contextual right-panel patterns
- three-region shell rules
- focus, hover, selected, disabled, loading, error, and destructive states
- responsive behavior
- accessibility requirements

The future design-system work should derive from this direction instead of rediscovering these decisions.

## Supersession notes

The feature-first information architecture supersedes older navigation concepts that depended on domain-parent navigation as the primary structure.

This visual direction supersedes older Control styling where navigation padding, card treatment, or density conflicts with the compact operational model defined here.

Older implementation details may still be useful as references, but they should not override the current IA and visual-direction decisions.