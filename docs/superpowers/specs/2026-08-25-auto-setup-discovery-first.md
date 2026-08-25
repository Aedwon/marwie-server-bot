# Discovery-first automatic setup specification

Date: 2026-08-25
Status: accepted for implementation

## Goal

Refine `/setup auto` so Rob-bot treats the existing Discord server as the source of truth before it creates infrastructure.

The command must search for existing channels, forums, categories, voice channels, and roles by logical name, including ordinary decorative emoji prefixes and separators. It must connect clear existing matches first. Creating or changing Discord resources is a fallback that requires a second explicit confirmation showing the proposed changes.

## Discovery behavior

After the normal command confirmation is approved, `/setup auto` performs a discovery pass over the guild.

Resource names are compared after normalization:

- case-insensitive;
- emoji and decorative punctuation are ignored;
- spaces, underscores, and hyphens are treated as equivalent separators;
- known concise aliases may be declared per resource when the server already uses a different but unambiguous name.

Examples:

- `🚨-announcements` matches `announcements`;
- `🤖-ai-updates` matches `ai-updates`;
- `🤝-collab-lfg` matches `collab-lfg`;
- `📱-app-of-the-week` matches `app-of-the-week`;
- `🤓-roles` matches `roles`;
- `🔴-live` may match the `live_announcements` alias `live`;
- `Create VC` may match the `create_workspace_voice` alias `create-vc`;
- `Coworking` may match the `coworking_lounge` alias `coworking`;
- the `general-questions` Forum Channel may match the build-help forum alias because it is the server's existing build/support questions forum.

Matching always requires the expected Discord object type. A category named `SHOWCASE` cannot satisfy a Forum Channel resource named `showcase`.

When multiple resources match the same logical name, prefer the oldest Discord snowflake. This makes an older founder-created channel win over a newer duplicate created by an earlier auto-setup run. A valid manual mapping whose current name does not itself match the automatic aliases remains authoritative and is not silently replaced.

## Binding behavior

The first approval authorizes discovery and non-destructive connection to existing resources.

Rob-bot may immediately save a clear existing match when the resource is currently unconfigured or the saved ID is stale. This changes only Rob-bot's stored binding; it does not edit the Discord resource.

A currently valid mapping is kept when:

- it points to the selected existing match; or
- its name does not match the automatic alias set, which indicates a likely intentional manual override.

If a valid automatic-style mapping points at a newer duplicate while an older matching resource exists, changing the saved mapping is a proposed remap and requires the second confirmation.

## Second confirmation

If discovery finds anything that would create or modify state beyond a safe first-time/stale binding, Rob-bot sends a second ephemeral Approve/Decline prompt.

The second prompt must list the exact proposed actions, including as applicable:

- remap a resource from one existing Discord object to another;
- create a missing text channel, voice channel, forum, category, or role;
- add the missing `Solved` tag to the selected build-help forum;
- post or refresh the Live Notifications self-role panel.

Approve performs only the listed mutations. Decline performs none of them; already-discovered safe bindings remain saved.

If no such mutations are required, `/setup auto` completes after the discovery pass without a redundant second confirmation.

## Creation behavior

A Discord resource is created only when:

1. no suitable existing resource was found;
2. no intentional valid manual mapping already satisfies the resource; and
3. the user explicitly approves the second mutation prompt.

Community mode is required only when the approved plan needs Rob-bot to create a Forum Channel. Existing Forum Channels can be discovered and bound without that creation preflight.

## Non-destructive guarantees

`/setup auto` must not automatically delete, rename, move, or merge existing Discord resources. In particular, duplicate resources created by older versions remain untouched even after Rob-bot remaps away from them.

## Reporting

The final private report distinguishes:

- existing bindings kept;
- existing resources connected;
- mappings remapped after approval;
- resources created after approval;
- mutations declined or still missing.

Known Discord API failures continue to use the safe error-reference behavior introduced by the confirmation/error-reporting refinement.
