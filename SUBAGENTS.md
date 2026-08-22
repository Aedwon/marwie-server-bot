# SUBAGENTS.md

Contract for dispatched implementation agents.

`AGENTS.md` governs how the repository is built. This file governs how a dispatched run is executed.

## Read order

Before touching code, read in full:

1. `AGENTS.md`
2. your assigned plan
3. the spec linked by that plan
4. relevant decision logs

If any required document is missing, unreadable, contradictory, or stale against the repository, stop and report it.

## Isolation

Work in your own git worktree or isolated branch.

- One plan per workspace.
- Do not write into another agent's workspace.
- Do not edit files outside the plan's file table without stopping first.
- Do not merge your own work.
- Do not push unless explicitly asked.

## Task loop

Execute one task at a time in plan order.

For code tasks:

1. Write the failing test.
2. Run it and confirm the failure is meaningful.
3. Implement the smallest change that satisfies the task.
4. Run the focused tests.
5. Run all verification gates named by the plan.
6. Update the progress ledger.
7. Continue only if the task is green.

Do not batch several tasks and verify them at the end.

## Database tasks

For schema work, confirm the current migration head before starting.

The migration and the code that depends on it belong in the same task. Verify both upgrade behavior and clean-database creation.

If the migration state is not what the plan expects, stop. Another change may have landed first.

## Discord tasks

When a task changes moderation, tickets, permissions, persistent views, or background recovery, test the failure path too.

Examples include:

- missing bot permission
- target above the bot in role hierarchy
- deleted channel or role
- restart while durable work is pending
- duplicate interaction or retry
- stale configured Discord resource

Do not treat a successful happy path as enough for an administrative feature.

## Stop conditions

Stop and report if:

- the plan conflicts with the spec
- the repository no longer matches the plan
- a required dependency is missing and the plan did not authorize adding it
- a file the plan says to create already exists with meaningful content
- a migration head or schema assumption changed
- unrelated tests are already failing
- a required Discord ID, secret, or deployment value is unavailable
- implementing the task would require changing an architectural decision

Do not invent a workaround and continue.

## Reporting

Report:

- tasks completed
- files changed
- focused test results
- full verification results
- blockers or deviations

Use actual command results. Do not report a gate as clean without running it.
