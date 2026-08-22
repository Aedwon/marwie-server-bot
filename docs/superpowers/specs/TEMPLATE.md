# Feature spec template

Date: YYYY-MM-DD
Status: draft

## Goal

What should exist when this feature is finished?

## Context

Why is this feature needed? Link relevant community requirements, existing behavior, or reference implementation.

## Scope

Included:

- ...

Not included:

- ...

## User behavior

Describe commands, interactions, messages, permissions, and visible failure states.

## Data and persistence

Describe durable state, ownership by `guild_id`, retention, uniqueness, restart behavior, and deletion behavior.

## Architecture constraints

State which parts belong in the Discord layer, service layer, persistence layer, and background workers.

Call out any reference-bot behavior that is intentionally reused or intentionally dropped.

## Permissions and abuse controls

Cover caller permissions, bot permissions, hierarchy, cooldowns, rate limits, audit access, anonymity, and destructive operations where relevant.

## Failure and recovery

What happens if Discord returns `Forbidden` or `NotFound`? What happens after a restart? What work must be idempotent?

## Observability

What should be logged? Which failures need operator attention? What data should not be logged?

## Testing

List the behavior that must be proven before implementation is considered complete.

Include unhappy paths for administrative and durable features.

## Open questions

- ...

## Accepted decisions

Link the relevant entries under `docs/superpowers/decisions/`.
