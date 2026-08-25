# Command manual website page implementation plan

Status: complete
Date: 2026-08-25
Spec: `docs/superpowers/specs/2026-08-25-docs-site-command-manual-page.md`
Decision: `docs/superpowers/decisions/2026-08-25-docs-site-command-manual-page.md`

## Files

| File | Change |
| --- | --- |
| `docs-site/index.html` | Add a prominent link to the dedicated command manual. |
| `docs-site/commands.html` | Add the standalone command manual page shell and category navigation. |
| `docs-site/commands.md` | Copy the canonical `main:docs/commands.md` content into the deployed site. |
| `docs-site/commands.js` | Render the local trusted Markdown and provide theme/mobile/sidebar behavior. |
| `docs-site/commands.css` | Add manual-specific tables, command sections, anchors, and loading/error styles while reusing the base stylesheet. |
| spec/decision/plan | Record the site publication contract. |

## Steps

1. Copy the exact canonical command-manual blob from `main` into `docs-site/commands.md`.
2. Create the dedicated Commands page using the current Rob-bot docs shell.
3. Render headings, paragraphs, lists, tables, inline code, and strong text from the local manual without third-party runtime dependencies.
4. Generate stable heading IDs and update the URL/hash behavior for direct command links.
5. Add category navigation for System and setup, Moderation, Tickets and announcements, Reputation and build-help, Quizzes and anonymous questions, Coworking and collaboration, and AI updates/analytics/showcase.
6. Link the homepage sidebar to `/commands`.
7. Verify all 45 slash-command headings are present in the copied manual and that the page contains no external Markdown-rendering dependency.
8. Compare the feature branch against `rob-bot-docs-site` and confirm only planned docs-site and design-record files changed.

## Verification

This is static documentation-site work. The bot CI was not run and Bot-Hosting was not restarted.

Completed static checks:

- `docs-site/commands.md` has blob SHA `2b76ad477712069b102920bb5cdabb91b243ab09`, exactly matching the canonical `main:docs/commands.md` blob used for this publication.
- The copied manual states and documents 45 current slash commands.
- `commands.html` has a no-JavaScript fallback link to the local `/commands.md` file.
- The formatted page loads only local `styles.css`, `commands.css`, `commands.js`, the local Markdown payload, and existing local Rob-bot artwork. No third-party Markdown renderer is used.
- The renderer provides category anchors, stable `command-*` anchors, command search, theme persistence, mobile navigation, and a 45-command runtime count check.
- The homepage sidebar and Start here section both link to `/commands`.
- Comparison against `rob-bot-docs-site` shows the branch is ahead only and changes only the planned five docs-site files plus the three design-record files.
- No bot runtime files, database files, host configuration, or GitHub Actions workflows were changed.

A production visual smoke test remains appropriate after the docs-site branch is updated because the feature branch itself is not the production Vercel branch.