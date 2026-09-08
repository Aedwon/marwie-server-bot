# Compromised Account Trap Execution Amendment 1

Date: 2026-09-09
Status: accepted for execution by explicit user continuation
Parent plan: `docs/superpowers/plans/2026-09-09-compromised-account-trap.md`

## Reason

Execution stopped because the untouched runtime base `44ed4bb88835845ea8599d3c9aab670839a71e16` already failed `tests/test_build_help_cleanup_wave11.py::test_cleanup_revision_follows_stage3_revision_and_is_head`.

The repository migration head is correctly `20260908_0005`, but that older Wave 11 test still asserted that `20260830_0004` must be the permanent Alembic head. The test therefore fails before the compromised-account-trap feature begins and blocks the parent plan's full verification gate.

## Scope amendment

The runtime file table is extended with exactly one pre-existing baseline-repair file:

| Path | Action | Purpose |
| --- | --- | --- |
| `tests/test_build_help_cleanup_wave11.py` | modify | Remove the stale permanent-head assertion while preserving the `0004 -> 0003` revision contract and all upgrade/downgrade safety coverage |

No production migration or runtime behavior changes are authorized by this amendment.

## Repair contract

- Keep the existing tests for empty upgrade, non-empty destructive abort, and downgrade schema restoration unchanged.
- Keep the assertion that migration `20260830_0004_remove_build_help.py` exists.
- Keep the assertion that revision `20260830_0004` has `down_revision == "20260827_0003"`.
- Remove only the assertion that `script.get_heads() == ["20260830_0004"]`, because later valid migrations must be allowed to become head.
- Re-run CI. The repaired baseline test must pass before feature GREEN implementation proceeds.

This amendment does not authorize merges, production database writes, or bot restarts.