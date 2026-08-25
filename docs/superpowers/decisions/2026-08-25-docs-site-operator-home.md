# Decision: make the docs homepage an operator reference

Date: 2026-08-25

## Context

The existing docs homepage grouped information by feature type. That made it possible to browse the bot, but it made moderators and administrators do extra work to answer operational questions such as "what should I check first?" and "what is the normal sequence for this task?"

The new `/commands` page already serves as the exhaustive syntax reference. The homepage no longer needs to duplicate that role.

## Decision

Reorganize the homepage around administrator and moderator workflows.

The top of the page will prioritize task selection, a quick health check, first-time setup, and day-to-day playbooks. Permissions/hierarchy and troubleshooting remain prominent because they resolve common operational failures. Member-facing features, automatic behavior, the resource map, and hosting details remain available lower in the page as supporting reference material.

The setup checklist will be rewritten for discovery-first `/setup auto` instead of instructing administrators to pre-create the entire standard channel structure.

## Consequences

- Staff can enter the documentation from the task they are trying to complete.
- Exact command syntax remains centralized on `/commands`.
- The homepage becomes shorter in command detail but stronger in operational sequence and diagnostic guidance.
- Hosting information stays accessible without dominating moderator navigation.
- No runtime behavior changes are implied by the documentation redesign.