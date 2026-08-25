# Contextual confirmations and setup error reporting plan

Date: 2026-08-25
Status: Implementation complete; executable verification pending merge
Spec: `docs/superpowers/specs/2026-08-25-confirmation-context-and-errors.md`
Decision log: `docs/superpowers/decisions/2026-08-25-confirmation-context-and-errors.md`

## Goal

Improve the existing central confirmation layer so every approval prompt explains what is being approved, and make `/setup auto` failures actionable from Discord without exposing unsafe exception details.

## Files

| File | Change |
| --- | --- |
| `src/marwie_bot/shared/confirmations.py` | Add contextual prompt formatting, command-specific detail annotations, and error references. |
| `src/marwie_bot/shared/errors.py` | Add the shared safe user-facing error contract and Discord API error translation. |
| `src/marwie_bot/features/configuration/cog.py` | Annotate `/setup auto` with detailed confirmation text, require Community before provisioning, and wrap role-panel finalization failures. |
| `src/marwie_bot/features/configuration/provisioning.py` | Wrap Discord provisioning failures with resource-stage context; retain pending type-alias lint fix. |
| `tests/test_auto_setup_blueprint.py` | Replace generic prompt assertion with contextual prompt, Community-preflight, and safe error-formatting coverage. |
| `README.md` | Document contextual confirmations and the Community prerequisite for automatic setup. |
| `docs/superpowers/specs/2026-08-25-confirmation-context-and-errors.md` | Define refined behavior. |
| `docs/superpowers/decisions/2026-08-25-confirmation-context-and-errors.md` | Record design decisions. |
| `docs/superpowers/plans/2026-08-25-confirmation-context-and-errors.md` | Track implementation and verification. |

## Implementation completed

1. Tests were updated first for the new pure confirmation helpers, Community preflight, and setup error formatting.
2. Added a callback annotation helper for command-specific confirmation details.
3. Confirmation text now includes the exact command, command description, custom side-effect detail, and parsed option values.
4. The existing central Approve/Decline flow remains intact.
5. Added a shared safe `UserFacingCommandError` contract and short random error reference IDs for unexpected exceptions.
6. `/setup auto` now stops before provisioning when Discord Community is disabled.
7. Discord HTTP failures during auto provisioning identify the failing resource and log the traceback.
8. Role-panel finalization failures return a setup-specific safe message.
9. The previously prepared Python 3.12 type-alias lint fix remains included.
10. README setup guidance now documents contextual confirmations and the Community prerequisite.

## Verification

Run the repository's full gates when the branch reaches `main`:

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
python -m compileall -q src tests migrations main.py
alembic upgrade head
```

Static verification completed:

- branch is ahead of `main` with no divergence;
- only planned files changed;
- generic failures do not send arbitrary exception text to Discord;
- `/setup auto` confirmation describes keep/adopt/create behavior, the Community requirement, and non-destructive limits;
- Community-disabled setup raises before any resource provisioning loop starts;
- option values are bounded to a short display length;
- the pending `TypeAlias` import is removed and Python 3.12 `type` alias syntax is present.

## Environment limitation

The local execution container does not currently have `discord.py`, and package installation is blocked by DNS resolution. Local pytest, Ruff, mypy, compile, and migration verification were therefore not run. The next GitHub CI run remains the executable verification environment.

## Deployment

This is runtime behavior and requires a Bot-Hosting restart after the change is merged to `main`. Use the dedicated restart bridge after merge. Do not restart for the lint-only commit by itself.
