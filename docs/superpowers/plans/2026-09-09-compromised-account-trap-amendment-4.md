# Compromised Account Trap Execution Amendment 4

Date: 2026-09-09
Status: accepted for execution by explicit user continuation
Parent plan: `docs/superpowers/plans/2026-09-09-compromised-account-trap.md`

## Reason

Task 7 final review found that the accepted Task 4 implementation note used `message.delete(reason=...)` for fallback history cleanup. In discord.py 2.7.1, `Message.delete()` accepts `delay` but does not accept an audit-log `reason` keyword. The duplicate/cooldown trigger deletion was already corrected to use the supported signature; the same correction is required for fallback history deletion.

Leaving the unsupported keyword would cause a runtime `TypeError` during fallback cleanup and could prevent the best-effort 24-hour sweep from completing.

## Scope amendment

No file-table expansion is required. The already-authorized Task 4 files remain the only implementation/test files involved:

- `src/marwie_bot/features/moderation/compromise_trap.py`
- `tests/test_compromised_account_trap_cog.py`

## Repair contract

- History cleanup must call the supported discord.py message deletion API without an unsupported `reason` keyword.
- The cleanup window, target filtering, permission checks, deletion count, per-scope failure behavior, active/archived-thread coverage, and containment semantics remain unchanged.
- A test double must reject unexpected deletion keyword arguments so this discord.py signature mismatch cannot regress silently.
- This amendment does not authorize production merges, deployment, direct database writes, or bot restarts.
