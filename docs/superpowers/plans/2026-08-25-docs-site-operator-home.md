# Operator-focused documentation homepage plan

Status: complete
Date: 2026-08-25
Spec: `docs/superpowers/specs/2026-08-25-docs-site-operator-home.md`
Decision: `docs/superpowers/decisions/2026-08-25-docs-site-operator-home.md`

## Files

| File | Change |
| --- | --- |
| `docs-site/index.html` | Reorder and relabel homepage sections around operator tasks. |
| `docs-site/app.js` | Replace feature-type datasets with health-check, onboarding, playbook, support, automation, resource, and troubleshooting data. |
| `docs-site/home.css` | Add restrained homepage-only task-card, workflow, health-check, and reference styles on top of the existing shared stylesheet. |
| spec/decision/plan | Record the operator-first information architecture. |

## Implementation

1. Replace the top-level sidebar taxonomy with Start, Operate, and Reference groups.
2. Rewrite the hero copy so the homepage is clearly an admin/moderator operating handbook.
3. Add four Start here entry points: first-time setup, moderator on duty, community operations, and troubleshooting.
4. Add a compact Quick health check section before any long reference material.
5. Rewrite the setup checklist for discovery-first `/setup auto` and reduce it to the current required onboarding sequence.
6. Add short on-duty playbooks for moderation, tickets, publishing, community programs, and maintenance.
7. Move role hierarchy/permissions ahead of member-facing and infrastructure reference sections.
8. Reframe member commands as member-facing behavior staff may need to support.
9. Keep automatic behavior and resource mappings as supporting reference, with current setup-auto terminology.
10. Reorganize troubleshooting around symptom → first check → next reference.
11. Keep hosting settings last and clearly mark them for deployment owners.
12. Preserve existing setup-checklist local persistence, theme state, mobile navigation, and section tracking.

## Verification

No bot runtime CI or Bot-Hosting restart was used.

Completed static verification:

- the homepage links to `/commands` and exposes Start, Quick health check, First-time setup, On-duty playbooks, Permissions and hierarchy, Member-facing behavior, Automatic behavior, Channel and role map, Troubleshooting, and Hosting sections;
- the old instruction to pre-create Discord resources before setup is gone;
- onboarding now describes discovery-first `/setup auto`, clear-match binding, and the second mutation confirmation;
- every DOM ID queried by `app.js` exists in `index.html`;
- sidebar hash links resolve to existing static section IDs, and playbook deep links target IDs generated synchronously when `app.js` renders the playbook list;
- `app.js` contains no `fetch()` or other network request;
- theme persistence, mobile sidebar behavior, section tracking, and setup-checklist local persistence remain implemented;
- comparison against `rob-bot-docs-site` is ahead-only and contains the operator-home files plus the already-in-scope command-manual website files and their design records;
- no bot runtime files, database files, Bot-Hosting configuration, or GitHub Actions workflows changed.

Executable browser rendering was not run in this chat environment. A production visual smoke test remains appropriate after `rob-bot-docs-site` is updated.