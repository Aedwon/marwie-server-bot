# Neon idle-safe scheduler decisions

Date: 2026-08-27
Spec: `docs/superpowers/specs/2026-08-27-neon-idle-schedulers.md`

## Decision

Use persisted deadlines plus in-memory wake events for short-timer features instead of fixed database polling intervals.

## Chosen behavior

- Pomodoro sleeps until the earliest active session end or a local state-change wake.
- Quizzes sleep until the earliest session close, automatic post deadline, or a local state-change wake.
- Voice recovery reconciles once after Discord readiness; normal voice/channel events remain authoritative during runtime.
- AI feeds, analytics and showcase retain their 30-minute-or-longer periodic behavior.

## Why

The short polling loops were operational recovery mechanisms, not product requirements. With SQLite they were inexpensive, but after the planned Neon cutover they can prevent five-minute scale-to-zero and consume the Free compute allowance while the server is otherwise idle.

Persisted deadlines preserve restart recovery, while in-memory sleeps avoid database traffic between actual due times. A wake event is advisory only: persisted database state remains authoritative whenever a worker recalculates its deadline.

## Browser-control integration

Browser actions that change quiz scheduling/question availability must wake the existing `QuizzesCog` scheduler after the action succeeds. This is an in-process notification only; it does not change browser authorization or queue semantics.

## Failure handling

A scheduler task failing one due item must log the failure without turning into a tight retry loop. Restart recovery remains available because all due state is persisted.
