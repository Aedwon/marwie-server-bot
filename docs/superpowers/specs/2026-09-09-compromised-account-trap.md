# Compromised account trap spec

Date: 2026-09-09
Status: accepted

## Goal

Add a deliberately configured Discord trap channel that treats any new human-authored message in that exact mapped channel as a compromised-account incident. Rob-bot should attempt to ban the account and remove up to the previous 24 hours of that account's recent messages. If Discord prevents the ban, Rob-bot must still perform the 24-hour cleanup wherever its channel permissions allow.

## Context

The server wants a warning channel whose purpose is to catch compromised accounts that indiscriminately mass-post into every channel. Posting in the trap channel is itself the trigger. The feature is intentionally destructive and therefore must be explicit, auditable, bounded, and fail safely.

The repository already has moderation cases, moderation logging, guild resource mappings, Discord hierarchy checks, and a Control mappings editor. This feature should reuse those capabilities without embedding more unrelated behavior into the existing moderation command cog.

Production is split between the bot runtime on `main` and the Control website on `web/rob-bot-site-production`. The implementation plan must preserve that topology and coordinate compatible changes across both branches.

## Scope

Included:

- a new manually selectable channel resource key named `compromised_account_trap`
- mapping the resource arms the trap
- clearing the mapping disarms the trap
- no separate feature toggle for the trap
- exact-channel message matching
- any new human-authored message in the mapped channel as a trigger
- text, replies, attachments, stickers, and otherwise empty-content user messages as valid triggers
- reactions and reaction removal as non-triggers
- ignoring Rob-bot, other bot accounts, webhooks, and Discord system/service messages
- no human privilege exemptions, including server owner, administrators, and moderators
- automatic ban attempt for every triggering human account
- fixed 24-hour Discord-native ban message deletion when the ban succeeds
- fixed 24-hour best-effort server-wide cleanup when the ban cannot be enforced
- cleanup across accessible text channels and accessible active or archived threads where Discord permits history access and deletion
- moderation incident persistence, audit logging, deduplication, and restart-safe incomplete-incident handling
- explicit destructive confirmation in the Control mappings UI when arming or remapping the trap
- immediate disarm by clearing the mapping
- exclusion from automatic setup and suggested mapping flows

Not included:

- scanning historical trap-channel messages at startup
- triggering on reactions, buttons, or other interactions with an existing warning message
- message-content inspection or keyword rules
- configurable cleanup windows
- cleanup older than 24 hours
- automatic creation of a trap channel
- automatic discovery or suggestion of a trap mapping based on channel names
- human-role exemptions
- bypassing Discord's owner, hierarchy, or permission restrictions
- automatic destructive replay of interrupted incidents after a restart

## User behavior

### Arming and disarming

The Control mappings page exposes `Compromised account trap` under Channels.

A mapping from `Not connected` to a channel arms the trap and requires an explicit destructive confirmation. Remapping an already armed trap to a different channel also requires confirmation.

Clearing the mapping disarms the trap immediately and does not require a second confirmation. A missing or deleted mapped channel is shown as unavailable and the runtime treats the trap as disabled.

The mapping is the only arm/disarm state. Existing general moderation feature flags do not independently disable or enable the trap.

### Trigger qualification

Only a newly created Discord message event in the exact mapped channel qualifies.

A qualifying author is a human user. The trigger does not depend on message text and therefore includes text messages, replies, attachments, stickers, emoji-only messages, and user-authored messages with no normal text content.

The following do not trigger enforcement:

- Rob-bot's own messages
- messages from other bot accounts
- webhook-authored messages
- Discord system or service messages
- adding or removing reactions
- clicking a button or otherwise interacting with an existing warning message
- messages in unrelated channels
- messages in threads whose parent is the mapped trap channel, unless the thread itself is explicitly mapped
- historical messages that existed before the listener observed them

### Enforcement sequence

For a qualifying message, Rob-bot creates or claims one durable compromised-account incident for the `(guild_id, user_id)` execution window before destructive work begins.

The enforcement order is:

1. Deduplicate concurrent triggers for the same guild and user.
2. Persist minimal incident evidence and mark the incident in progress.
3. Attempt to ban the user with a fixed `delete_message_seconds=86400` request.
4. If the ban succeeds, treat Discord-native 24-hour deletion as the primary cleanup path and do not launch a redundant server-wide history sweep.
5. If the ban cannot be enforced, perform a best-effort manual cleanup of that user's messages from the previous 24 hours across accessible guild text channels and accessible active or archived threads.
6. Persist the final outcome and create the moderation/audit record.
7. Post one moderation-log summary for the incident.

The server owner and members whose role hierarchy prevents a ban still trigger the incident. Discord may reject their ban, but Rob-bot must continue to the fallback cleanup path.

### Cleanup behavior

The cleanup window is fixed at 24 hours and is not configurable.

Fallback cleanup only deletes messages authored by the triggering user and created within the previous 24 hours. A permission or API failure in one channel must not abort cleanup elsewhere.

Rob-bot may delete messages only where Discord grants the necessary channel visibility, message-history access, and message-management permissions. The final audit must distinguish full cleanup from partial cleanup and must identify inaccessible or failed channel scopes without claiming success for them.

### Duplicate triggers and cooldown

Only one full incident may execute at a time for the same `(guild_id, user_id)`.

A fixed 60-second per-user cooldown follows a completed, partial, or failed incident. Additional trap messages from the same user during that cooldown do not launch another full server-wide sweep or create duplicate incident cases. Rob-bot should still delete the newly posted trap message if it has permission to do so.

## Data and persistence

The mapping uses the existing guild resource storage keyed by `guild_id` and the new `compromised_account_trap` resource key. No separate arm-state table is required.

Compromised-account incidents require durable state before the first destructive action. The persistence shape may be a dedicated incident record or an extension that provides equivalent semantics, but it must support:

- guild ID
- target user ID
- triggering channel ID
- triggering message ID
- trigger timestamp
- execution status
- ban outcome and failure reason where applicable
- whether Discord-native 24-hour deletion was requested
- whether fallback cleanup ran
- cleanup counts where available
- failed or inaccessible cleanup scopes
- final containment status
- created and updated timestamps

The final containment status is one of:

- `contained`: enforcement completed with the intended 24-hour cleanup path and no known unhandled scope
- `partially_contained`: some cleanup or enforcement scopes could not be completed
- `failed`: the bot could not perform meaningful containment
- `interrupted`: the process stopped before reaching a final result

Incident uniqueness or idempotency must prevent concurrent duplicate execution for the same target during an active incident.

On startup, Rob-bot detects incidents left in an in-progress state and marks or reconciles them as interrupted. It must not blindly replay destructive actions from an old incident. Interrupted incidents require an operator-visible audit signal, and subsequent new triggers may start a fresh incident after normal deduplication and cooldown rules permit it.

The existing moderation case history should record the automated enforcement as a ban-related moderation incident when possible, with Rob-bot as the actor and structured metadata that identifies `source=compromised_account_trap`. The stored metadata must include IDs and outcomes, not full message content.

## Architecture constraints

The Discord event listener should be a focused component inside the moderation feature area, not additional command logic inside the already broad moderation command cog.

The Discord layer owns:

- receiving `on_message`
- qualifying the author and exact channel
- resolving Discord guild/member/channel objects
- invoking Discord ban and message-deletion APIs
- translating Discord `Forbidden`, `NotFound`, and HTTP failures into service outcomes

The service layer owns:

- trigger deduplication policy
- the 60-second cooldown policy
- incident state transitions
- enforcement orchestration
- cleanup-window rules
- containment classification
- audit metadata construction

The persistence layer owns:

- trap mapping lookup through guild resources
- durable incident state
- moderation case persistence

The Control website owns:

- exposing the new channel mapping
- destructive confirmation before arming or remapping
- immediate clear/disarm behavior
- armed, unavailable, and unmapped presentation

No hardcoded guild, channel, role, or user IDs are allowed.

The implementation must not depend on reading message content. It should work using Discord event metadata required to identify the guild, channel, author, message, and timestamps.

## Permissions and abuse controls

No human user is exempt because of role or privilege. The same trigger policy applies to the server owner, administrators, moderators, and ordinary members.

Discord platform restrictions still apply. Rob-bot cannot ban the server owner and cannot ban members whose highest role is equal to or above Rob-bot's highest role. A rejected ban is an enforcement outcome, not an exemption, and must cause fallback cleanup.

Fallback cleanup proceeds only where Rob-bot has the permissions needed for each channel or thread. Missing permissions produce partial containment and operator-visible audit detail.

Bots, webhooks, and Discord system messages are excluded to prevent automation loops and non-human false positives.

The trap mapping is intentionally excluded from auto-setup and mapping suggestions. Only an explicit administrator selection in Control may arm or remap it.

The Control UI must make the destructive effect clear before arming or remapping. Disarming must remain easy and immediate.

## Failure and recovery

If the trap mapping is absent or resolves to a deleted channel, the runtime fails closed and performs no enforcement.

If the target leaves the guild after triggering but before enforcement completes, Rob-bot should still attempt a user-ID ban where Discord permits it and then continue with any cleanup paths that remain possible.

If `guild.ban` returns `Forbidden`, `NotFound`, or another Discord/API failure, Rob-bot records the failure and proceeds to fallback cleanup. The failure of the ban must not suppress cleanup.

If fallback deletion fails in one channel, Rob-bot records that scope and continues scanning the remaining eligible scopes.

If the destructive Discord action succeeds but the final moderation case or audit persistence fails, Rob-bot must not undo the successful containment action. It must emit structured application logging with enough IDs to reconcile the missing audit data later.

If the process restarts during an incident, stale in-progress state is treated as interrupted. No destructive action is automatically replayed solely because an interrupted record exists.

All enforcement orchestration must be idempotent enough that rapid repeated message events do not create multiple simultaneous bans, sweeps, or duplicate cases for the same incident window.

## Observability

Each full incident produces one moderation-log summary. It should include:

- target mention or user ID
- trap channel
- triggering message ID or jump context when available
- ban result
- cleanup path used
- cleanup count where available
- inaccessible or failed scopes
- final containment status
- incident/case identifier

Expected hierarchy failures for an owner or higher-role target should be clearly described as ban failures with fallback cleanup, not as successful bans.

Application logs should include structured guild ID, user ID, channel ID, message ID, incident ID, Discord error class, and containment status where relevant.

Do not persist or log the full triggering message content as part of the incident. The feature needs identity and event metadata, not message text.

## Testing

Implementation is not complete until tests prove at least the following:

- a human-authored message in the exact mapped channel triggers enforcement
- text, replies, attachments, stickers, and empty-content human messages qualify
- reactions do not trigger enforcement
- Rob-bot, other bots, webhooks, and system messages do not trigger enforcement
- messages in child threads do not inherit the trap from the parent channel
- no mapping means disabled
- a stale/deleted mapped channel fails closed
- mapping arms and clearing disarms
- auto-setup cannot create or suggest the trap mapping
- Control requires explicit confirmation before arming or remapping
- Control permits immediate clearing without destructive confirmation
- successful ban requests exactly 86,400 seconds of native message deletion
- successful ban does not also start a redundant fallback history sweep
- owner and hierarchy-rejected ban paths still execute fallback cleanup
- fallback cleanup deletes only the triggering user's messages and only within the previous 24 hours
- cleanup continues after individual channel failures
- accessible active and archived thread cleanup is attempted where supported
- multiple rapid messages create only one in-flight full incident
- cooldown suppresses repeated full sweeps while allowing deletion of a new trap message when possible
- durable incident state exists before destructive work
- restart handling does not blindly replay interrupted destructive operations
- containment status accurately reports complete, partial, failed, and interrupted outcomes
- moderation logging and structured metadata do not store full triggering message content
- failure to persist a final audit after successful containment does not cause an automatic rollback

Repository verification must include the active Python gates (`pytest`, Ruff checks, formatting check, mypy, compileall, and Alembic upgrade) plus the relevant Control website test/build gates defined by the implementation plan.

## Open questions

None. The behavior above was explicitly reviewed and approved on 2026-09-09.

## Accepted decisions

See `docs/superpowers/decisions/2026-09-09-compromised-account-trap.md`.
