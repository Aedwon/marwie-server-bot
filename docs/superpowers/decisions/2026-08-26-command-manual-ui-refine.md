# Decision: compact command cards with disclosure details

Date: 2026-08-26

## Context

The command manual is complete but visually behaves like one long expanded Markdown document. That is inefficient for moderators and administrators who usually need to identify a command quickly, confirm its permission/syntax, then inspect details only when necessary.

## Decision

Keep workflow grouping, but render each command as a compact card with:

- command name;
- permission badge;
- syntax;
- visible behavior summary;
- native expandable details for parameters, prerequisites, side effects, conditions, and examples.

Search will filter the command cards live across command names and documentation text. Empty workflows disappear while filtering. Direct command anchors open the target card automatically.

## Why

This preserves the exhaustive manual while changing the default visual state from "everything expanded" to "scan first." Native `<details>` controls keep keyboard and accessibility behavior simple and robust.

## Consequences

- The canonical Markdown remains unchanged.
- The site renderer becomes slightly more structured because it classifies labeled manual paragraphs such as Syntax, Permission, and What happens.
- Future commands that follow the manual template automatically inherit the same compact presentation.
- No bot restart is required.
