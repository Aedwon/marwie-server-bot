# Contextual confirmations and setup error reporting plan

Date: 2026-08-25
Status: In progress
Spec: `docs/superpowers/specs/2026-08-25-confirmation-context-and-errors.md`
Decision log: `docs/superpowers/decisions/2026-08-25-confirmation-context-and-errors.md`

## Goal

Improve the existing central confirmation layer so every approval prompt explains what is being approved, and make `/setup auto` failures actionable from Discord without exposing unsafe exception details.

## Files

| File | Change |
| --- | --- |
| `src/marwie_bot/shared/confirmations.py` | Add contextual prompt formatting, custom detail annotations, safe error references, and safe user-facing command errors. |
| `src/marwie_bot/features/configuration/cog.py` | Annotate `/setup auto` with detailed confirmation text and wrap role-panel finalization failures. |
| `src/marwie_bot/features/configuration/provisioning.py` | Wrap Discord provisioning failures with resource-stage context; retain pending type-alias lint fix. |
| `tests/test_auto_setup_blueprint.py` | Replace generic prompt assertion with contextual prompt and safe error-formatting coverage. |
| `docs/superpowers/specs/2026-08-25-confirmation-context-and-errors.md` | Define refined behavior. |
| `docs/superpowers/decisions/2026-08-25-confirmation-context-and-errors.md` | Record design decisions. |
| `docs/superpowers/plans/2026-08-25-confirmation-context-and-errors.md` | Track implementation and verification. |

## Implementation order

1. Update tests first for the new pure confirmation helpers and setup error formatting.
2. Add a callback annotation helper for command-specific confirmation details.
3. Build confirmation text from exact command name, command description, custom detail, and parsed option values.
4. Keep the existing central Approve/Decline flow and use the richer prompt when sending the initial response.
5. Add a safe `UserFacingCommandError` contract plus short error reference IDs for unexpected exceptions.
6. Wrap Discord HTTP failures in auto provisioning with the resource key and a safe message.
7. Wrap role-panel finalization failures with a setup-specific safe message.
8. Confirm the existing Python 3.12 type-alias lint fix remains present.
9. Review the branch diff for unrelated changes.

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

Before merge, perform static verification through the repository connector:

- confirm only planned files changed;
- confirm no raw exception body is sent for generic errors;
- confirm `/setup auto` confirmation explicitly describes additive/adopt/create behavior and non-destructive limits;
- confirm option values are bounded in length;
- confirm the pending `TypeAlias` import is removed and the Python 3.12 `type` alias syntax remains.

## Deployment

This is runtime behavior and requires a Bot-Hosting restart after the change is merged to `main`. Use the dedicated restart bridge after merge. Do not restart for the lint-only commit by itself.
