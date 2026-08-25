# Exhaustive command manual implementation plan

Status: implementation complete
Date: 2026-08-25
Spec: `docs/superpowers/specs/2026-08-25-command-manual.md`
Decision: `docs/superpowers/decisions/2026-08-25-command-manual.md`

## Scope

Documentation only. No slash-command implementation, database schema, permissions, or runtime behavior changes.

## Files

| File | Change |
| --- | --- |
| `docs/commands.md` | Add the canonical manual for all 45 slash commands and related interaction controls. |
| `README.md` | Keep the compact command inventory and link prominently to the full manual. |
| `AGENTS.md` | Require command changes to update the canonical manual. |
| spec/decision/plan files | Record the documentation contract and implementation status. |

## Implementation steps

1. Inventory every loaded extension from `src/marwie_bot/bot.py`.
2. Read each command callback plus relevant service code for validation, normalization, permissions, side effects, and defaults.
3. Write `docs/commands.md` with a common per-command structure.
4. Include an explicit command index and count of 45 slash commands.
5. Document global confirmation behavior and `/setup auto`'s second mutation confirmation once up front.
6. Add related-control sections for ticket buttons, announcement modal/preview, quiz answers, Live Notifications role button, and automatic temporary voice workspaces where they clarify command workflows.
7. Link the README command section to the manual.
8. Add the maintenance contract to `AGENTS.md`.
9. Cross-check the manual command inventory against the source inventory before handoff.

## Verification

Because this task changes documentation and agent instructions only, it does not require a bot restart and does not need Python runtime gates before handoff.

Completed static verification:

- `docs/commands.md` contains the full 45-command source inventory and 45 per-command syntax entries;
- each command entry includes permissions, behavior, parameters or an explicit no-parameter statement, and realistic example usage;
- validation edge cases were cross-checked against command and service code, including moderation hierarchy, ban message-deletion range, ticket-type normalization, reputation zero-point rejection, quiz duration/ranges, anonymous-question limits, AI-source URL validation, and setup resource typing;
- the README links to the canonical manual;
- `AGENTS.md` requires future command changes to update the manual in the same change;
- no runtime code, migration, dependency, or deployment file is intentionally changed by this task.

If the branch is later merged into `main`, the repository's normal main CI may run automatically, but no deployment restart is needed for this documentation-only task.
