# Docs visual-system refinement

Date: 2026-08-26
Status: accepted

## Goal

Apply one restrained visual language across the Rob-bot handbook and command manual. Preserve the current operator-first information architecture and semantic density while removing component-library styling that makes every block look independently boxed.

## Reference principles

The supplied Aedwon portfolio screenshot is a design-philosophy reference, not a layout to copy. Its useful qualities are:

- hierarchy from spacing, scale, typography, and tonal surfaces;
- large grouped regions that read as one composition;
- cards distinguished by fill and contrast instead of visible outlines;
- sparse dividers used only where they clarify row structure;
- generous but purposeful whitespace;
- low visual competition between controls and content.

## Requirements

- Apply the visual system to both `/` and `/commands`.
- Keep all existing content, workflows, links, anchors, search behavior, disclosures, theme switching, and accessibility semantics.
- Remove visible borders from card-like components unless the boundary has structural meaning.
- Keep tables and dense row-based references legible with subtle internal separators.
- Prefer tonal fills, typography, spacing, and grouping over outlines.
- Avoid ornamental gradients, excessive shadows, glass effects, or decorative UI that reduces information density.
- Preserve responsive behavior and dark/light/system themes.
- Do not alter bot runtime behavior or the canonical command-manual Markdown.
