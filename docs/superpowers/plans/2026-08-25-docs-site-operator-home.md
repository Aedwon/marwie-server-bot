# Operator-focused documentation homepage plan

Status: in progress
Date: 2026-08-25
Spec: `docs/superpowers/specs/2026-08-25-docs-site-operator-home.md`
Decision: `docs/superpowers/decisions/2026-08-25-docs-site-operator-home.md`

## Files

| File | Change |
| --- | --- |
| `docs-site/index.html` | Reorder and relabel homepage sections around operator tasks. |
| `docs-site/app.js` | Replace feature-type datasets with health-check, onboarding, playbook, support, automation, resource, and troubleshooting data. |
| `docs-site/styles.css` | Add restrained task-card, workflow, health-check, and reference styles while preserving the existing visual system. |
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

No bot runtime CI or Bot-Hosting restart is required.

Static verification:

- homepage contains links to `/commands` and all new operator sections;
- setup copy no longer tells admins to pre-create all channels before `/setup auto`;
- `/setup auto` copy reflects discovery-first plus second mutation confirmation;
- all DOM IDs referenced by `app.js` exist in `index.html`;
- sidebar hash links resolve to existing section IDs;
- JavaScript remains self-contained and uses no network requests;
- compare against `rob-bot-docs-site` shows only planned docs-site/design-record files plus the already-in-scope command-manual website work.

A production visual smoke test remains appropriate after `rob-bot-docs-site` is updated.