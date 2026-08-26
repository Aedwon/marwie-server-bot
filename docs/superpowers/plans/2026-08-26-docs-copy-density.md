# Operator homepage copy-density plan

Status: complete
Date: 2026-08-26

## Scope

- `docs-site/index.html`: remove redundant labels and compress static copy.
- `docs-site/app.js`: compress route, health, setup, playbook, member-support, automation, resource, and troubleshooting copy without changing behavior or links.
- No command-manual content changes.
- No bot-runtime changes.

## Verification

- Preserved homepage anchors and DOM IDs used by `app.js`.
- Preserved command-manual links.
- Preserved setup confirmation, permissions, privacy, hierarchy, Community/forum, and error-reference guidance.
- Removed section kickers and redundant CTA language.
- Shortened navigation, headings, cards, setup steps, playbooks, support copy, automation copy, resource labels, troubleshooting, and hosting notes.
- No GitHub Actions or Bot-Hosting restart required.
