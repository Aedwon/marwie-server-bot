# Command manual website page

Date: 2026-08-25
Status: accepted

## Goal

Expose the exhaustive Rob-bot slash-command manual on the existing documentation website as its own first-class page optimized for moderators and administrators using it as an operational reference.

## Source of truth

The command behavior documented in `main:docs/commands.md` is authoritative. The website copy must not invent or simplify command constraints in ways that contradict that manual.

The canonical Markdown may remain organized for source maintenance. The website presentation must instead organize commands by the workflow the operator is trying to perform.

## Required behavior

- Add a dedicated Commands page to `docs-site/`.
- Keep the existing documentation homepage concise.
- Link the Commands page prominently from the homepage sidebar.
- Preserve the existing visual system, mobile sidebar, theme switcher, typography, and static Vercel deployment model.
- Include all 45 current slash commands with syntax, permissions, behavior, parameters, side effects, prerequisites, and examples.
- Group the rendered command reference by moderator/admin workflow, not by implementation module or arbitrary command type.
- Provide stable direct anchors for individual commands.
- Provide command-name search for users who already know the command.
- Keep the rendered manual local to the deployed site. Do not depend on GitHub, a third-party Markdown renderer, or another network request at runtime.
- Do not change bot runtime behavior or hosting configuration.

## Workflow information architecture

The rendered website groups commands into these operator tasks:

1. Set up and check Rob-bot health.
2. Moderate members and investigate incidents.
3. Set up and run support tickets.
4. Publish community updates.
5. Manage reputation and build-help recognition.
6. Run quizzes and anonymous Q&A.
7. Coordinate coworking and collaboration.
8. Maintain feeds, analytics, and showcase operations.

Commands belong where staff would look for them. For example, `/anonwho` belongs under moderation and investigation even though its implementation is part of the anonymous-question feature.

Each workflow starts with a short description, intended operator audience, and a typical sequence before showing the exhaustive command entries.

## Content architecture

`docs-site/commands.html` is the dedicated page. A local `docs-site/commands.md` copy of the canonical manual provides the authoritative content payload.

Page JavaScript renders the trusted local Markdown into semantic HTML, extracts each slash-command entry, and places that unchanged entry into the relevant workflow. Shared source context is retained with the corresponding operational area. Newly added commands that are not yet assigned to a workflow must remain visible in a fallback section instead of being silently dropped.

The renderer only supports the Markdown constructs used by the manual and escapes source text before adding supported inline formatting.

## Safety and maintenance

The website manual is a presentation copy. Future command changes should update `main:docs/commands.md` first, then refresh the website copy when publishing docs-site changes.

The website workflow map must also be updated whenever a command is added or its operational purpose materially changes. The renderer should warn if the expected 45-command set is not completely assigned.

No Bot-Hosting restart is needed because this changes only the documentation site.