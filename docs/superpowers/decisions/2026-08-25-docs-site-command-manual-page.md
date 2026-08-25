# Decision: dedicated website command manual

Date: 2026-08-25

## Context

The documentation homepage already serves as a compact operational guide. Expanding it with exhaustive documentation for 45 slash commands would make the existing page difficult to scan.

## Decision

Publish the exhaustive command reference as a separate `/commands` page and link it from the existing sidebar.

The page will reuse the existing static docs-site design. The canonical command content remains `main:docs/commands.md`; the website stores a local presentation copy so production rendering has no dependency on GitHub or a third-party Markdown service.

## Consequences

- The homepage stays concise.
- Individual commands can have direct anchors.
- The manual can grow without making setup, hosting, and troubleshooting harder to navigate.
- Publishing a command behavior change requires refreshing the website copy after the canonical manual changes.
- No bot restart is required for website-only changes.