# Discovery-first automatic setup decisions

Date: 2026-08-25
Status: active

## Normalize decorative Discord names

Automatic matching uses a normalized logical name built from alphanumeric runs. Case, emoji prefixes, punctuation, spaces, underscores, and hyphens do not distinguish resources.

This lets a founder-created channel such as `🚨-announcements` satisfy the logical resource `announcements` without hard-coding that specific emoji.

## Use explicit aliases, not fuzzy semantic guessing

Each resource may declare a small alias set for known server terminology such as `live`, `create-vc`, `coworking`, `tickets`, `anonymous`, and `general-questions`.

The implementation does not use unrestricted fuzzy similarity or topic inference. Type and normalized-name membership must both match.

## Prefer the oldest matching Discord object

If an older founder-created resource and a newer auto-created duplicate both normalize to a valid alias, the older Discord snowflake is the preferred discovery match.

A remap from a currently valid automatic-style binding to that older object is never silent; it is shown in the second mutation confirmation.

## Preserve intentional manual overrides

If the currently configured resource is valid but its name does not match any automatic alias, `/setup auto` treats it as an intentional manual override and keeps it.

This prevents automatic discovery from overriding custom mappings configured through the individual `/setup` commands.

## Separate safe binding from Discord mutation

The first `/setup auto` confirmation authorizes discovery and connecting unconfigured or stale mappings to already-existing Discord objects.

Creating resources, remapping an already-valid automatic-style binding, adding the Solved tag, or refreshing the self-role panel requires a second explicit confirmation listing the exact planned actions.

## Never auto-delete previous duplicates

Remapping away from an older auto-created duplicate does not delete that duplicate. Cleanup is a separate destructive operation and remains outside `/setup auto`.
