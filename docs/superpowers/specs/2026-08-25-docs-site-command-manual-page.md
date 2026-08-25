# Command manual website page

Date: 2026-08-25
Status: accepted

## Goal

Expose the exhaustive Rob-bot slash-command manual on the existing documentation website as its own first-class page.

## Source of truth

The command behavior documented in `main:docs/commands.md` is authoritative. The website copy must not invent or simplify command constraints in ways that contradict that manual.

## Required behavior

- Add a dedicated Commands page to `docs-site/`.
- Keep the existing documentation homepage concise.
- Link the Commands page prominently from the homepage sidebar.
- Preserve the existing visual system, mobile sidebar, theme switcher, typography, and static Vercel deployment model.
- Include all 45 current slash commands with syntax, permissions, behavior, parameters, side effects, prerequisites, and examples.
- Provide category-level navigation and stable anchors so commands can be linked directly.
- Keep the rendered manual local to the deployed site. Do not depend on GitHub, a third-party Markdown renderer, or another network request at runtime.
- Do not change bot runtime behavior or hosting configuration.

## Content architecture

`docs-site/commands.html` is the dedicated page. A local `docs-site/commands.md` copy of the canonical manual provides the content payload, and page JavaScript renders that trusted local Markdown into semantic HTML. The renderer only supports the Markdown constructs used by the manual and escapes source text before adding supported inline formatting.

## Safety and maintenance

The website manual is a presentation copy. Future command changes should update `main:docs/commands.md` first, then refresh the website copy when publishing docs-site changes.

No Bot-Hosting restart is needed because this changes only the documentation site.