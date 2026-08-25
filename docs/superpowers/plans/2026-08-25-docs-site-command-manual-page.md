# Command manual website page implementation plan

Status: in progress
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

This is static documentation-site work. Do not run the bot CI or restart Bot-Hosting for this change.

Static checks:

- `commands.md` uses the same blob SHA as `main:docs/commands.md` at implementation time.
- Commands page has a no-JavaScript fallback link to the raw local Markdown file.
- Commands page loads `styles.css`, `commands.css`, and local scripts only.
- Homepage contains the `/commands` navigation link.
- Branch is based only on `rob-bot-docs-site` and does not attempt to merge stale bot-runtime code into `main`.