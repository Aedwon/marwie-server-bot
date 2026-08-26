# Neon idle-safe background schedulers

Date: 2026-08-27
Status: approved implementation prerequisite for live Control cutover
Parent: `docs/superpowers/specs/2026-08-27-live-control-free-tier-wakeup.md`

## Problem

Removing Control's two-second queue poll is not sufficient for Neon Free scale-to-zero if unrelated bot maintenance loops query the same database inside Neon's five-minute idle window.

The scheduler audit found:

- Coworking Pomodoro completion: every 1 minute.
- Quiz close/automatic-post scheduler: every 5 minutes.
- Temporary voice reconciliation: every 5 minutes.
- AI feed polling: every 30 minutes.
- Analytics automation: every 6 hours.
- Showcase automation: every 12 hours.

The one- and five-minute loops can keep compute continuously active. The longer loops leave meaningful idle windows and are retained for now.

## Required changes

### Pomodoro

Replace the one-minute database poll with a due-time worker.

- Query and process sessions already due.
- Query the earliest active `ends_at` value.
- Sleep in memory until that timestamp or until a local scheduler wake event fires.
- Starting or stopping a Pomodoro wakes the scheduler so the next deadline is recalculated.
- On bot restart, the worker immediately processes overdue sessions before sleeping.
- No recurring database poll occurs when no Pomodoro is active.

### Quizzes

Replace the five-minute database poll with a due-time worker.

- Process already-due quiz sessions immediately.
- Compute the earliest open quiz close time.
- Compute the earliest configured automatic quiz post time from each guild's interval and `last_posted_at`.
- Sleep in memory until the earliest deadline or a local scheduler wake event.
- Slash-command and browser-control changes to quiz schedule/question state wake the scheduler.
- Creating a manual quiz wakes the scheduler so its close deadline is tracked.
- If an automatic post is due but no question exists, do not spin; block that guild until question/schedule state changes or the bot restarts.
- On restart, overdue closes/posts are processed before sleeping.

### Temporary voice recovery

Remove the five-minute reconciliation heartbeat.

Normal cleanup is already event-driven through voice-state and channel-delete listeners. Perform one reconciliation after the bot first becomes ready to recover stale records/orphaned empty temporary channels left by downtime. Do not poll afterward.

## Retained periodic jobs

AI feed polling at 30 minutes, analytics at 6 hours, and showcase at 12 hours remain because they implement genuinely periodic product behavior and leave windows longer than Neon's scale-to-zero threshold.

Any future recurring database task with an interval at or below five minutes requires explicit cost review.

## Safety and behavior invariants

- Pomodoro completion remains tied to its persisted `ends_at` time and may fire immediately after restart if overdue.
- Quiz answers still reject after persisted `closes_at`, independent of when the close announcement is posted.
- Quiz automatic intervals retain their configured hour-based cadence.
- Voice temporary channels still delete immediately on normal empty-state events; startup reconciliation is recovery only.
- `CUTOVER_READ_ONLY=true` continues to disable background workers.
- No scheduler correctness depends on browser Control being open.

## Verification

Before cutover:

- no `tasks.loop` at 1 or 5 minutes remains for Pomodoro, quizzes, or voice reconciliation;
- Pomodoro next-deadline query returns the earliest active session;
- quiz next-close query returns the earliest open session;
- scheduler wake events recalculate deadlines after command/control changes;
- an empty/no-question quiz schedule does not busy-loop;
- voice reconciliation runs once after ready and not periodically;
- existing focused/full tests remain green;
- static review confirms remaining periodic database jobs are 30 minutes or longer.
