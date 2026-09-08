# Compromised Account Trap Execution Amendment 2

Date: 2026-09-09
Status: accepted for execution by explicit user continuation
Parent plan: `docs/superpowers/plans/2026-09-09-compromised-account-trap.md`

## Reason

Task 1 GREEN implementation correctly introduces `compromised_account_trap` as a manual-only resource that is owned by the Mappings page but excluded from Auto Setup and mapping suggestions.

Full CI then exposed two existing tests whose invariants predate manual-only mappings:

- `tests/test_auto_setup_blueprint.py` assumes every `ResourceKey` must appear in `AUTO_SETUP_RESOURCES`.
- `tests/test_control_mappings.py` hardcodes the prior exact set of Mappings-owned channel keys.

Those expectations conflict with the accepted feature contract. Changing production behavior to satisfy them would incorrectly make the destructive trap auto-setup eligible or remove it from manual Mappings ownership.

## Scope amendment

The runtime file table is extended with exactly these test-contract files:

| Path | Action | Purpose |
| --- | --- | --- |
| `tests/test_auto_setup_blueprint.py` | modify | Encode that all resources except explicitly manual-only `compromised_account_trap` remain covered by Auto Setup |
| `tests/test_control_mappings.py` | modify | Add `compromised_account_trap` to the expected manually owned Channels mapping set |

No additional production files are authorized by this amendment.

## Repair contract

- Auto Setup must continue to cover every existing non-manual-only resource.
- `compromised_account_trap` must remain absent from `AUTO_SETUP_RESOURCES`.
- The trap must remain present in `APPROVED_MAPPING_KEYS` and `CHANNEL_MAPPING_KEYS` for ordinary manual mapping.
- The trap must remain absent from `SUGGESTIBLE_MAPPING_KEYS` and suggestion serialization/validation.
- Existing excluded message-log resources remain excluded from Mappings.

This amendment does not authorize production merges, deployment, direct database writes, or bot restarts.
