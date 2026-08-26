# Operator homepage copy-density plan

Status: implementation pending
Date: 2026-08-26

## Scope

- `docs-site/index.html`: remove redundant labels and compress static copy.
- `docs-site/app.js`: compress route, health, setup, playbook, member-support, automation, resource, and troubleshooting copy without changing behavior or links.
- No command-manual content changes.
- No bot-runtime changes.

## Verification

- Preserve all existing homepage anchors and DOM IDs used by `app.js`.
- Preserve all command-manual links.
- Preserve safety-critical setup, permissions, privacy, hierarchy, and error-reference guidance.
- No GitHub Actions or Bot-Hosting restart required.
