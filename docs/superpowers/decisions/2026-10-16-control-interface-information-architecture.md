# Control Interface Information Architecture Decisions

Date: 2026-10-16

## Context

Rob-bot Control currently separates several resource mappings from the features that depend on them. This forces operators to understand implementation concepts and move between pages to finish one configuration task.

The redesign should make configuration intuitive by organizing the interface around what the operator is trying to configure. It should remain scalable as more features are added without turning the sidebar or individual pages into cluttered dashboards.

The Cloudflare dashboard reference discussed during design is inspiration for information architecture, spatial hierarchy, density, and the three-region shell. It is not a visual reference to copy.

## Feature-first navigation

Decision: Control uses a feature-first information architecture.

Features are the actual navigation destinations. Sidebar section labels exist only to organize those destinations and reduce scanning cost. They do not own configuration.

The sidebar should follow MECE principles as closely as practical:

- categories should not overlap in purpose
- every operator-facing feature should have a clear home
- a feature should not need to appear in multiple sections

The initial grouping direction is:

- Engagement
- Publishing
- Support & Safety
- Insights
- System

The exact feature membership may be refined during the full redesign spec.

## Complete feature ownership

Decision: a feature page owns the complete normal configuration workflow for that feature.

An operator configuring Tickets should be able to configure Tickets without leaving the Tickets interface. This includes feature behavior and the Discord resources required by that behavior, such as its panel channel, category, and log destination.

The same rule applies to other features. Operators should not need to understand or visit a separate mappings system to finish routine setup.

## Canonical resource state

Decision: contextual resource editing does not create duplicate configuration.

Channel, role, category, and similar resource bindings remain canonical shared state. Editing a resource from a feature page updates the same underlying value exposed by the global resource view.

The feature page is the preferred editing surface for normal work. A global Resources or Mappings surface remains available for cross-feature overview, troubleshooting, and advanced administration.

## Three-region shell

Decision: Control uses a stable three-region desktop layout.

### Left region: navigation

The left sidebar is persistent and contains the grouped feature navigation. Groups may be collapsible when that improves scanability, and collapse state should be remembered when practical.

### Center region: primary workspace

The center is the main configuration surface for the selected feature. Primary settings, data, workflows, and actions belong here.

### Right region: contextual panel

The right panel contains secondary information or controls that help the current task without competing with the main workspace.

Its contents depend on the selected feature. Appropriate uses include:

- channel, role, and category bindings
- feature health and readiness
- Discord output previews
- dependency status
- permission warnings
- recent activity
- quick actions
- contextual help

The right panel is not a separate configuration system. It is another view into the same feature and canonical state.

Where a right panel adds no useful information, it may be omitted instead of being filled artificially.

## Primary and secondary hierarchy

Decision: common and task-defining configuration belongs in the center. Supporting configuration belongs in the contextual panel.

Do not move an important setting to the right panel merely to preserve a layout. The hierarchy follows operator intent, not visual symmetry.

## Progressive disclosure

Decision: keep common configuration immediately visible while advanced, destructive, or uncommon settings remain behind deliberate disclosure.

The interface should expose enough information for confident operation without presenting every available control at once.

## Configuration in context

Decision: show dependencies, missing permissions, validation failures, and resource problems where they affect the operator.

Do not require users to visit a separate diagnostics page to discover why a feature cannot work. Global diagnostics may aggregate these issues, but the affected feature must surface them locally.

## Immediate state clarity

Decision: each feature should make its operational state obvious.

Where applicable, users should be able to identify quickly whether a feature is:

- enabled or disabled
- configured or incomplete
- healthy or degraded
- waiting for attention

Status presentation should be restrained and semantic instead of decorative.

## Stable shell, adaptive workspace

Decision: navigation, layout, and interaction conventions stay stable while feature-specific content changes.

Operators should not need to relearn the interface when moving between Tickets, Quizzes, Announcements, Analytics, or another feature.

## Restrained visual system

Decision: the redesign prioritizes hierarchy over decoration.

Use typography, spacing, alignment, borders, grouping, and state indicators to establish structure. Avoid excessive card nesting, gradients, oversized illustrations, and decorative dashboard elements that do not carry operational value.

The target is information-dense but calm. Every persistent element should justify the space it occupies.

## Responsive behavior

Decision: the three-region layout must degrade gracefully.

The contextual right panel may collapse on narrower desktop layouts and should become a drawer or equivalent temporary surface when there is not enough horizontal space. The main configuration workflow must remain usable without requiring a wide viewport.

## Minimize navigation cost

Decision: routine configuration should require as little cross-page movement as possible.

A user should finish a coherent task where they started it. Global views should aggregate and inspect state, not become mandatory intermediate steps.

## Design test

A proposed Control change should pass these questions before implementation:

1. What feature does the operator believe they are configuring?
2. Can they complete the normal task without leaving that feature?
3. Is every setting shown in the most relevant context?
4. Does any visible control duplicate state instead of editing canonical state?
5. Is the right panel genuinely useful for this feature?
6. Does the sidebar category clarify navigation without becoming another configuration layer?
7. Can the operator understand feature health and blockers without hunting elsewhere?
8. Is the interface using hierarchy and spacing before adding decoration?

If a design fails these questions, revise the information architecture before implementation.