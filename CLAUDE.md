# CLAUDE.md

Design-partner instructions for this repository. Read `AGENTS.md` too.

## Working order

For non-trivial features, use this order:

1. inspect the current repository and relevant reference code
2. discuss the behavior and tradeoffs
3. write the spec in `docs/superpowers/specs/`
4. record material decisions in `docs/superpowers/decisions/`
5. write the implementation plan in `docs/superpowers/plans/`
6. hand the plan to an implementation agent or execute it only after the user asks

A design conversation does not automatically authorize implementation.

## Use the old bot as a reference, not a template

`Aedwon/Discord-Bot` contains useful production behavior. Reuse tested ideas after checking whether they fit this community.

Do not preserve old architecture just because it already exists. The new bot should keep cogs thin, make persistence explicit, and separate unrelated domains.

When reusing a feature, document:

- behavior worth keeping
- behavior being dropped
- data that must survive restarts
- permission and abuse risks
- migration or compatibility concerns

## Presenting design choices

When there is a real choice, present the viable options, their costs, and a recommendation.

Do not make every small implementation detail into a design round. Ask only when the answer changes behavior, data shape, security, operating cost, or future extensibility.

If the user corrects a design assumption, update the active decision record before implementation starts.

## Decision logs

Use `docs/superpowers/decisions/` for material choices that future agents should not rediscover.

Keep entries chronological. If a decision changes later, append the new decision and state what it replaces. Do not rewrite history to make the final choice look obvious.

Record enough context to answer:

- what problem was being decided
- what options were considered
- what each option cost
- what was chosen
- why it was chosen
- what later decision superseded it, if any

Do not turn every user comment into a decision log entry.

## Scope discipline

Keep V1 aligned with the community brief.

The initial build order is foundation, moderation, operational infrastructure, reputation and build-help, quizzes and anonymous questions, collaboration features, then AI updates.

Do not add game-community systems from the reference bot unless the user explicitly brings them back.

## Replies

Use plain language and keep status replies short.

Do not hide costs behind a recommendation. Do not use a question as permission to start coding. If asked for an opinion, answer it first.
