# Confirmation context and error-reporting decisions

Date: 2026-08-25
Status: active

## Replace generic confirmation copy with contextual confirmation copy

The previous confirmation text only asked `Run /command?`. That remains structurally safe but does not give the user enough information to make a meaningful approval decision.

Every confirmation now includes the command description and supplied option values. Commands may add a custom confirmation detail when the normal slash-command description is not sufficient to explain material side effects.

This supersedes only the presentation portion of the 2026-08-25 central confirmation decision. Central wrapping, invoker-only buttons, approval behavior, decline behavior, and the 60-second timeout remain unchanged.

## Keep custom side-effect explanations close to the command

A callback may carry a confirmation-detail annotation. The central wrapper reads that annotation and combines it with generic command metadata.

This keeps the common interaction logic centralized while letting feature owners describe command-specific side effects without a hard-coded command-name switch in the shared module.

## Use reference IDs for unexpected failures

Every unexpected approved-command exception gets a short random reference ID. The full traceback is logged together with that ID. Discord receives a generic failure message containing the same ID.

Arbitrary exception strings are not shown to users because they can contain implementation details or sensitive values.

## Translate known Discord setup failures into safe operational messages

`/setup auto` wraps Discord API failures with setup-stage context before they reach the central command wrapper. The user sees which resource or finalization stage failed and a safe Discord-facing reason.

The provisioner remains fail-fast. A failed resource is not silently skipped and the command does not claim setup completed when only part of it succeeded.

## Fold the pending Ruff alias fix into this branch

The previously prepared Python 3.12 type-alias modernization is included in this refinement branch so the next full CI run can exercise the confirmation changes on a lint-clean tree.
