# Implementation plan template

Date: YYYY-MM-DD
Status: draft
Spec: `docs/superpowers/specs/YYYY-MM-DD-topic.md`

## Goal

One sentence describing what this plan will deliver.

## Dependencies

List required earlier work, migrations, secrets, Discord resources, or external APIs.

If a dependency has not landed, implementation must stop.

## Global constraints

- Follow `AGENTS.md` and `SUBAGENTS.md`.
- Do not redesign the linked spec while executing this plan.
- Keep Discord handlers thin.
- Keep durable state in the approved persistence layer.
- Add or update migrations for schema changes.
- Use test-first development for feature logic.

## File table

| Path | Action | Purpose |
| --- | --- | --- |
| `...` | create / modify / delete | ... |

Files outside this table require stopping and updating the plan first.

## Task 1: ...

### Files

- Create: `...`
- Modify: `...`

### Behavior

Describe the exact behavior this task introduces.

### Test first

Write the failing test that proves the behavior does not exist yet.

Run:

```bash
<focused test command>
```

Expected: fails for the intended reason.

### Implement

Describe the smallest implementation needed for this task.

### Verify

Run:

```bash
<focused test command>
<full verification commands required at this point>
```

Expected results must be stated explicitly.

## Task 2: ...

Repeat the same structure for each task. Execute tasks in order.

## Final verification

Run every repository gate required for this plan and record the actual results.

At minimum, once the Python toolchain exists, plans should cover:

- tests
- lint
- formatting check
- type check
- migration verification when schema changed

## Stop conditions

Stop if:

- the repository does not match the plan's assumptions
- a dependency is missing
- the spec and plan conflict
- migration state changed
- unrelated verification is already failing
- required secrets or Discord resources are unavailable
