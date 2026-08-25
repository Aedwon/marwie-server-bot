# Auto setup and command confirmations implementation plan

Date: 2026-08-25
Status: active
Spec: `docs/superpowers/specs/2026-08-25-auto-setup-confirmations.md`
Branch: `web/setup-auto-confirmations`

## Goal

Implement centralized slash-command confirmation, idempotent `/setup auto`, an opt-in Live Notifications role button, and clear first-run documentation.

## Files

- `docs/superpowers/specs/2026-08-25-auto-setup-confirmations.md`
- `docs/superpowers/plans/2026-08-25-auto-setup-confirmations.md`
- `docs/superpowers/decisions/2026-08-25-auto-setup-confirmations.md`
- `src/marwie_bot/config/resources.py`
- `src/marwie_bot/shared/confirmations.py`
- `src/marwie_bot/features/configuration/provisioning.py`
- `src/marwie_bot/features/configuration/role_panel.py`
- `src/marwie_bot/features/configuration/cog.py`
- `src/marwie_bot/bot.py`
- `tests/test_auto_setup_blueprint.py`
- `README.md`

## Steps

1. Add a `role_panel` channel resource key.
2. Add a central confirmation view and command-wrapper installer.
3. Install wrappers after all extensions load and before command sync.
4. Define a typed, testable auto-setup blueprint.
5. Implement Discord provisioning that keeps valid configured resources, adopts canonical matches, or creates missing objects.
6. Add `/setup auto` and `/setup role-panel` to the configuration cog.
7. Add a persistent Live Notifications toggle view and register it on startup.
8. Add focused blueprint tests.
9. Rewrite the README first-run setup section so `/setup auto` is the primary path and manual `/setup` commands are documented as overrides.
10. Run verification gates that are available in the execution environment and report any gate that could not be run.

## Verification gates

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
python -m compileall -q src tests migrations main.py
alembic upgrade head
```

Do not manually trigger GitHub Actions for this task.
