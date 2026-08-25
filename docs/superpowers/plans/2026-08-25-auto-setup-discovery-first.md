# Discovery-first automatic setup implementation plan

Date: 2026-08-25
Status: In progress
Spec: `docs/superpowers/specs/2026-08-25-auto-setup-discovery-first.md`

## Goal

Make `/setup auto` bind the existing server layout before it proposes any Discord resource creation or remapping, then require a second explicit confirmation for those mutations.

## Files

| File | Change |
| --- | --- |
| `src/marwie_bot/features/configuration/provisioning.py` | Add name normalization, aliases, discovery plans, safe binding application, and mutation application. |
| `src/marwie_bot/features/configuration/cog.py` | Replace direct ensure flow with discovery report plus a second mutation confirmation view. |
| `tests/test_auto_setup_blueprint.py` | Cover normalization, aliases, oldest-match selection, manual-override preservation, and mutation-plan summaries. |
| `README.md` | Document discovery-first behavior and the second confirmation. |
| `docs/superpowers/decisions/2026-08-25-auto-setup-discovery-first.md` | Record matching and safety decisions. |

## Implementation order

1. Add pure resource-name normalization and blueprint aliases.
2. Add discovery plan dataclasses and deterministic oldest-match selection.
3. Preserve custom manual mappings whose names do not match automatic aliases.
4. Apply only unconfigured/stale-to-existing bindings after the first command confirmation.
5. Represent remaps, creates, Solved-tag changes, and role-panel refresh as pending mutations.
6. Add an invoker-only second Approve/Decline view with exact mutation details.
7. Apply approved mutations and produce a final private report.
8. Update tests/docs and review the branch diff.

## Verification

Use the repository CI gates after merge:

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
python -m compileall -q src tests migrations main.py
alembic upgrade head
```

Do not restart Bot-Hosting until CI passes.
