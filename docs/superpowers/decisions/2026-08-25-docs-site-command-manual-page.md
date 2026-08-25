# Decision: dedicated workflow-first website command manual

Date: 2026-08-25

## Context

The documentation homepage already serves as a compact operational guide. Expanding it with exhaustive documentation for 45 slash commands would make the existing page difficult to scan.

A second issue is information architecture. Grouping commands by implementation feature or command family is useful for developers, but moderators and administrators usually arrive with a task: investigate a member, set up tickets, publish an announcement, check configuration, or review community operations.

## Decision

Publish the exhaustive command reference as a separate `/commands` page and link it from the existing sidebar.

The website presentation is workflow-first. It groups command entries by the moderator/admin task they support, even when that differs from the source module. `/anonwho`, for example, is presented with moderation and investigation.

The page reuses the existing static docs-site design. The canonical command content remains `main:docs/commands.md`; the website stores a local presentation copy so production rendering has no dependency on GitHub or a third-party Markdown service.

The website renderer extracts the unchanged exhaustive command entries from that local canonical copy and reorders them into the documented workflows. This avoids maintaining a second hand-written version of every parameter table and behavioral description.

## Consequences

- The homepage stays concise.
- Moderators and admins can browse by what they are trying to accomplish.
- Users who already know a command can search for it directly.
- Individual commands retain stable anchors.
- Source documentation can remain maintainable without dictating the website navigation model.
- A new slash command requires both canonical manual documentation and a workflow assignment for the website.
- Unassigned commands remain visible in a fallback section instead of disappearing.
- Publishing a command behavior change requires refreshing the website copy after the canonical manual changes.
- No bot restart is required for website-only changes.