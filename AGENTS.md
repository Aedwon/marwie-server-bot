# AGENTS.md

Instructions for any agent implementing work in this repository.

If you are designing a feature, read `CLAUDE.md` too. If you were dispatched as a subagent, read `SUBAGENTS.md` first.

## Before writing code

For feature work, read these in full before touching implementation:

1. `AGENTS.md`
2. the active plan in `docs/superpowers/plans/`
3. the plan's linked spec in `docs/superpowers/specs/`
4. relevant entries in `docs/superpowers/decisions/`

If the plan or spec is missing, contradictory, or no longer matches the repository, stop and report it. Do not fill the gap with a plausible implementation.

Questions are not approval to change code. Answer the question and stop unless the user explicitly asked for implementation.

## Specs, plans, and decisions

Feature design happens before implementation.

- Specs define the behavior and constraints.
- Plans define the implementation steps, files, tests, and verification.
- Decision logs record material choices and later reversals.

Do not redesign a feature while executing its plan. If the design needs to change, update the design record first.

## Architecture rules

This bot is being rebuilt cleanly. Do not copy the structure of the old Discord bot wholesale.

- Keep Discord cogs thin. They handle commands, listeners, permission checks, and Discord responses.
- Put business rules in domain services.
- Put persistence behind repositories or clearly scoped data-access modules.
- Do not put raw SQL in cogs.
- Treat `guild_id` as first-class data for server-owned state.
- Do not hardcode channel IDs, role IDs, guild IDs, or feature flags in feature code.
- Centralize runtime resource configuration.
- Durable state belongs in the database unless a spec explicitly documents another storage choice.
- Schema changes must use migrations. Do not mutate schema opportunistically during normal bot startup.
- Keep database code portable between SQLite and PostgreSQL unless a spec accepts a database-specific feature.
- Do not silently swallow unexpected exceptions. Expected Discord failures may be handled quietly, but unexpected failures need contextual logs.
- Background tasks must survive restarts safely. Persist enough state to reconcile interrupted work.
- Persistent Discord views must be registered on startup when their interactions are expected to survive a restart.
- Avoid giant feature files. Split a feature when Discord UI, business logic, persistence, or rendering can be tested separately.

## Discord safety and permissions

Moderation and administrative actions need explicit checks.

- Check the caller's permissions.
- Check Discord role hierarchy where it applies.
- Check the bot's own permissions and hierarchy before making a destructive call.
- Prefer Discord-native timeout behavior for temporary mutes.
- Keep moderation history independent from reputation, XP, quizzes, or other community systems.
- Log destructive actions with enough context to audit them later.
- Do not expose anonymous identities publicly. Staff audit access must be deliberate and permission-gated.

## Database changes

A schema change and its migration belong to the same task.

Before changing the schema:

1. read the latest migration state
2. confirm the plan still matches it
3. write or update the migration
4. test upgrade behavior
5. verify a clean database can be created from migrations

Do not catch migration errors with a blanket `except` and continue.

## Task loop

Use test-first development for feature code unless the plan explains why it cannot apply.

For each task:

1. Write the failing test first.
2. Run it and confirm it fails for the expected reason.
3. Write the smallest implementation that makes it pass.
4. Run the task's focused tests.
5. Run the repository's full verification gates.
6. Report the actual results.

Once the Python toolchain is established, the active plan must name the exact test, lint, format, and type-check commands. Do not invent a green result you did not run.

## Subagent isolation

Dispatched agents work in their own git worktree or otherwise isolated branch. One active plan per agent workspace.

Do not edit files outside the plan's file table without stopping and reporting why the plan is incomplete.

Do not merge your own work.

## Commits

Do not commit or push unless the user or active execution plan explicitly asks for it.

When commits are requested:

- explain why the change exists
- do not add AI attribution or `Co-Authored-By` trailers
- keep unrelated changes out of the commit

## How to report

Use plain language. State what changed, what was verified, and what is blocked.

- One idea per sentence.
- No em dashes.
- Avoid `rather than`; use `instead of` or rewrite.
- Do not add side comments or inflated wording.
- Do not claim a test passed unless you ran it.
- Keep short status replies short. Put implementation detail in the spec and plan.
