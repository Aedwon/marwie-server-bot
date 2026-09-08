# Compromised account trap decision log

Date: 2026-09-09
Topic: Destructive trap-channel moderation behavior and configuration
Status: accepted

## Context

The server needs a warning channel that can catch compromised accounts that mass-post into every channel. Any human account that sends a new message in that channel should be treated as compromised.

The mechanism is intentionally destructive. It can ban users and delete up to 24 hours of recent messages. It therefore needs an explicit configuration model, predictable scope, hierarchy-aware failure behavior, and strong auditability.

The existing repository already has moderation cases, guild resource mappings, moderation logging, and a Control mappings editor. The choice was whether to build this as a focused moderation feature using those primitives, embed it directly in the moderation command cog, or introduce a broader automod/rule-engine system.

## Options considered

### Option A: Dedicated moderation trap component with a manual channel mapping

Add a `compromised_account_trap` guild resource mapping. A dedicated moderation listener watches only the exact mapped channel. The mapping itself arms or disarms the feature.

Any new human-authored message triggers a durable incident, a ban attempt with a fixed 24-hour native deletion request, and fallback server-wide 24-hour cleanup if the ban cannot be enforced.

This keeps the feature narrow, testable, and consistent with the repository's existing separation between Discord events, services, persistence, and Control mappings.

### Option B: Put the trap directly into the existing moderation command cog

The same event listener and enforcement behavior could live in the current moderation cog.

This would reduce the number of files but would make an already broad command cog responsible for automatic destructive event processing, cleanup orchestration, deduplication, cooldowns, and restart recovery. It would be harder to test and would weaken the repository's thin-cog architecture.

### Option C: Build a generic automod or rule engine

Model the trap as one configurable automod rule among many future event/action rules.

This is more extensible, but it adds abstractions, configuration, persistence, and operator complexity that the current request does not need. It would delay the security behavior and increase the chance of configuration mistakes.

## Decision

Choose Option A.

The feature is a focused moderation component backed by a manually selected `compromised_account_trap` channel mapping.

The accepted behavior is:

- mapping present means armed
- mapping absent means disabled
- there is no separate trap feature toggle
- only new messages in the exact mapped channel trigger
- reactions and other interactions with an existing warning message do not trigger
- child threads do not inherit the trap from the parent channel
- any human-authored message qualifies regardless of content type
- Rob-bot, other bots, webhooks, and Discord system/service messages are ignored
- there are no human privilege exemptions
- server owner, administrators, moderators, and ordinary members all trigger the same incident flow
- every triggering human account receives a ban attempt
- the native ban deletion request is fixed at 24 hours
- if the ban is rejected or otherwise fails, fallback cleanup still scans the previous 24 hours of that user's messages across accessible guild scopes
- fallback cleanup is best effort and continues after per-channel failures
- cleanup older than 24 hours is never attempted by this feature
- the trap mapping is manual only and excluded from auto-setup and suggested mappings
- arming and remapping require an explicit destructive confirmation in Control
- clearing the mapping is the immediate disarm path and does not require extra confirmation
- one full incident executes at a time per guild and user
- a fixed 60-second per-user cooldown suppresses repeated full sweeps after an incident
- incident state is durable before destructive work begins
- interrupted incidents are detected after restart but are not automatically replayed destructively
- one moderation-log summary represents the incident
- full triggering message content is not persisted as incident evidence

## Reason

The trap exists specifically to catch compromised accounts, including privileged accounts. Exempting moderators or administrators would create the largest gap in the mechanism because a compromised privileged account can cause more damage than an ordinary account.

Discord's hierarchy rules still constrain what the bot can enforce. Rob-bot cannot ban the server owner and cannot ban a member whose role is equal to or above the bot's highest role. Those platform restrictions are enforcement failures, not policy exemptions. The fallback cleanup path preserves useful containment even when the ban is impossible.

The cleanup window is fixed at 24 hours because the requested trap scope is recent compromise containment, not historical moderation. A fixed bound also limits destructive impact, API work, and accidental overreach.

The mapping itself is the arm state because a second toggle would create ambiguous configuration. A manual-only mapping prevents auto-setup from accidentally arming destructive moderation based on channel naming or discovery heuristics.

Exact-channel matching avoids surprising users in child threads or neighboring channels. Reactions remain safe because the purpose is to catch accounts that indiscriminately send messages, not users who acknowledge the warning.

A dedicated component preserves the repository's feature boundaries and keeps the existing moderation command cog focused on interaction-driven moderation commands.

## Consequences

The implementation must add coordinated runtime and Control changes while preserving the repository's split production branches.

A durable incident model or equivalent persistence extension is required because destructive work must be marked in progress before the first ban or cleanup action.

The runtime must support partial containment. It must never claim successful cleanup for channels or threads it could not access.

The server owner can trigger cleanup even though Discord will always reject the owner ban. A higher-role member can also trigger cleanup when hierarchy blocks the ban.

The bot's permissions determine how complete fallback cleanup can be. Operators must treat `partially_contained` as an actionable moderation state.

The feature must not depend on message-content inspection, so reactions remain non-triggers and user message text does not need to be stored for enforcement.

The implementation plan must include tests for exact trigger qualification, hierarchy failures, owner behavior, fallback cleanup, deduplication, cooldown, restart interruption, Control confirmation, and auto-setup exclusion.

## Later changes

None.
