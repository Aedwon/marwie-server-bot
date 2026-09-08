# Compromised Account Trap Execution Amendment 3

Date: 2026-09-09
Status: accepted for execution by explicit user continuation
Parent plan: `docs/superpowers/plans/2026-09-09-compromised-account-trap.md`

## Reason

Task 6 RED correctly requires `compromised_account_trap` to become a manually owned Channels mapping in the Control website.

The full website build also owns an existing canonical contract test, `web-tests/control-mappings.test.js`, whose `CHANNEL_KEYS` fixture hardcodes the prior exact Channels mapping set. Adding the accepted trap mapping without updating that fixture would leave the repository's canonical ownership assertion stale.

Changing production behavior to preserve the old fixture would conflict with the accepted feature contract because the trap must be visible and manually configurable under Channels.

## Scope amendment

The Control website file table is extended with exactly this existing test-contract file:

| Path | Action | Purpose |
| --- | --- | --- |
| `web-tests/control-mappings.test.js` | modify | Add `compromised_account_trap` to the canonical expected Channels mapping set |

No additional production files are authorized by this amendment.

## Repair contract

- `compromised_account_trap` remains present in the Channels mapping page.
- The trap remains manual-only and destructive.
- The trap remains excluded from mapping suggestions and apply payloads.
- Existing Channels, Roles, Categories, and excluded mapping ownership remains unchanged.
- This amendment only updates the stale canonical website test fixture required by Task 6.

This amendment does not authorize production merges, production deployment, direct database writes, or bot restarts.
