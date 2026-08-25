# Command manual website page implementation plan

Status: complete
Date: 2026-08-25
Spec: `docs/superpowers/specs/2026-08-25-docs-site-command-manual-page.md`
Decision: `docs/superpowers/decisions/2026-08-25-docs-site-command-manual-page.md`

## Files

| File | Change |
| --- | --- |
| `docs-site/index.html` | Add prominent links to the dedicated command manual. |
| `docs-site/commands.html` | Add the standalone workflow-first command manual shell and workflow navigation. |
| `docs-site/commands.md` | Copy the canonical `main:docs/commands.md` content into the deployed site. |
| `docs-site/commands.js` | Render the local trusted Markdown, regroup command entries by operator workflow, and provide search/theme/mobile behavior. |
| `docs-site/commands.css` | Add workflow, command-entry, table, anchor, and responsive styles while reusing the base stylesheet. |
| spec/decision/plan | Record the site publication and workflow-information-architecture contract. |

## Steps

1. Copy the exact canonical command-manual blob from `main` into `docs-site/commands.md`.
2. Create the dedicated Commands page using the current Rob-bot docs shell.
3. Render headings, paragraphs, lists, tables, inline code, and strong text from the local manual without third-party runtime dependencies.
4. Extract the exhaustive command entries and regroup them into moderator/admin workflows without rewriting their behavioral content.
5. Add workflow navigation for setup/health, moderation/investigation, tickets, publishing, reputation/build-help, learning/anonymous Q&A, coworking/collaboration, and feeds/analytics/showcase.
6. Add a typical-path summary to each workflow and keep stable `command-*` direct anchors.
7. Keep command-name search for operators who already know what command they need.
8. Link the homepage sidebar and Start here section to `/commands`.
9. Verify the workflow map accounts for all 45 slash commands and retains a fallback for future unassigned commands.
10. Compare the feature branch against `rob-bot-docs-site` and confirm only planned docs-site and design-record files changed.

## Verification

This is static documentation-site work. The bot CI was not run and Bot-Hosting was not restarted.

Completed static checks:

- `docs-site/commands.md` has blob SHA `2b76ad477712069b102920bb5cdabb91b243ab09`, exactly matching the canonical `main:docs/commands.md` blob used for this publication.
- The copied manual states and documents 45 current slash commands.
- The workflow map contains 45 command assignments across eight workflows, with no intended duplicate assignment.
- The renderer counts source, assigned, rendered, and unassigned commands at runtime and warns if the expected complete assignment changes.
- Any future command omitted from the workflow map is rendered under a visible `Other commands` fallback instead of being lost.
- `/anonwho` is deliberately presented with moderation/investigation, demonstrating that website placement follows operator intent instead of source module ownership.
- `commands.html` has a no-JavaScript fallback link to the local `/commands.md` file.
- The page loads only local base/manual CSS, local JavaScript, the local Markdown payload, and existing local Rob-bot artwork. No third-party Markdown renderer is used.
- The homepage sidebar and Start here section both link to `/commands`.
- No bot runtime files, database files, host configuration, or GitHub Actions workflows were changed.

A production visual smoke test remains appropriate after the docs-site branch is updated because the feature branch itself is not the production Vercel branch.