# Live control plane implementation plan

Status: implementation complete; final executable verification and production wiring pending
Date: 2026-08-27
Spec: `docs/superpowers/specs/2026-08-27-live-control-plane.md`
Decision: `docs/superpowers/decisions/2026-08-27-live-control-plane.md`
Free-tier wake refinement: `docs/superpowers/specs/2026-08-27-live-control-free-tier-wakeup.md`
Idle-safe scheduler refinement: `docs/superpowers/specs/2026-08-27-neon-idle-schedulers.md`
Scheduler decision: `docs/superpowers/decisions/2026-08-27-neon-idle-schedulers.md`

## Branch strategy

`feat/live-control-plane` is rooted at current `main`. The divergent prototype branch is not merged into runtime code. Only approved docs-site assets and design records are ported.

## Files / components

### Database

- `src/marwie_bot/db/models.py`: existing application persistence models.
- `src/marwie_bot/features/control_plane/models.py`: browser sessions, audited actions, guild snapshots and notification-role panel persistence.
- `migrations/versions/20260827_0003_live_control_plane.py`: live-control schema migration.
- `tools/migrate_sqlite_to_postgres.py`: one-shot staged SQLite → Neon migration with row-count, digest and sequence verification.
- `CUTOVER_READ_ONLY`: freezes slash-command/background writes and makes SQLite application sessions query-only during the final snapshot window.

### Bot control worker

- `src/marwie_bot/features/control_plane/` includes:
  - domain records/action types;
  - SQLAlchemy repository for action queue and control state;
  - atomic claim/finish/reject operations;
  - permission policy;
  - action dispatcher;
  - event-driven wake/drain handling;
  - guild-state snapshot builder;
  - persistent notification-role panel runtime.
- worker lifecycle is connected to bot startup/shutdown.
- action handlers reuse existing configuration, tickets, reputation, quizzes, AI feed and publishing services where available.
- Control does not continuously poll Neon. A private Discord incoming webhook is a wake notifier only; durable action authority remains in Neon and bot-side permission checks.
- startup drains queued actions once for missed-wake recovery.
- stale browser state uses the internal `refresh_snapshot` action instead of a recurring snapshot heartbeat.
- a failed wake leaves the durable action queued and the browser retries with the same idempotency key.

### Idle-safe background schedulers

The free-tier cutover also removes unrelated one- and five-minute database heartbeats that could prevent Neon from scaling to zero:

- Pomodoro completion is driven by the earliest persisted deadline plus an in-process wake event. No recurring database query runs when no timer exists.
- Quiz close/automatic-post scheduling is driven by persisted deadlines plus an in-process wake event. Slash-command and browser quiz/resource/feature changes wake the scheduler immediately.
- Temporary voice cleanup remains event-driven, with one startup reconciliation for downtime recovery and no five-minute heartbeat.
- AI feed polling remains at 30 minutes, analytics at 6 hours, and showcase at 12 hours because those jobs implement meaningful periodic product behavior and leave scale-to-zero windows.
- any future recurring database task at five minutes or less requires explicit cost review.

### Runtime extensions

- persistent configurable notification-role panel and role-safe buttons.
- announcement message-content and explicit mention allow-listing.
- explicit Live destination and optional ping-role selection; choosing no ping sends no fallback ping.
- AI feed add/edit/enable/disable/poll workflow.
- SQLite query-only cutover guard.

### Vercel API

- server-side Neon access with no database URL exposed to the browser.
- Discord OAuth start/callback/logout/session handlers.
- guild control-state, setup-discovery, action-create and action-status handlers.
- OAuth state, opaque sessions, CSRF validation, origin validation, idempotency, rate limiting and payload validation.
- bot token and hosting credentials remain bot-side only.

### Approved UI

The reviewed handbook/manual/control assets are ported onto the live branch and `/control` is API-backed while retaining the approved layout and interaction design:

- signed-out state and Discord login;
- guild selector;
- loading/error/stale-state handling;
- live resource/member/role selectors;
- setup review and mutation confirmation;
- queue progress and result states;
- live refresh after success;
- configurable notification-role panel;
- publishing, tickets, reputation, quizzes, feeds, logs and feature controls.

### Deployment docs

`docs/operations/live-control-cutover.md` contains the OAuth, Vercel, Neon, SQLite migration, Bot-Hosting cutover, smoke-test and rollback sequence.

OAuth may be configured before migration, but the first functional production-Neon Control login must happen only after SQLite → Neon migration is verified. Creating an OAuth session row before migration would correctly make the target non-empty and cause the migration tool to refuse overwrite.

## Implementation order

1. Port approved docs assets and live design records onto the live branch. **Complete.**
2. Add tests for action queue/idempotency/permission policy and notification-panel model. **Complete.**
3. Add database migration and control-plane repository/domain layer. **Complete.**
4. Add bot action worker and editable-prototype action coverage. **Complete.**
5. Add notification role-panel runtime generalization and publishing mention support. **Complete.**
6. Add staged SQLite → Postgres migration utility and verification report. **Complete.**
7. Add Vercel OAuth/session/CSRF API and state/action endpoints. **Complete.**
8. Wire approved UI to API. **Complete.**
9. Add deployment/cutover runbook. **Complete.**
10. Replace Control polling and short database-heartbeat schedulers with the approved event/deadline-driven free-tier architecture. **Complete.**
11. Run repository verification gates. **Pending final executable run on the consolidated head. Vercel Hobby currently reports a deployment build-rate limit and will not run another preview for approximately 24 hours; this is an infrastructure quota blocker, not a code result.**
12. Create/upgrade Neon schema and verify it. **Pending verified code/cutover stage; current target is intentionally empty.**
13. Ask operator for manual secret/console wiring only where connectors cannot write protected settings. **Pending strict verification.**
14. Run staged production SQLite → Neon migration and verify counts/invariants. **Pending.**
15. Cut Bot-Hosting `DATABASE_URL` to Neon and restart only after successful migration verification. **Pending.**
16. Verify bot startup, queue worker, OAuth login, live state and one low-risk production mutation. **Pending.**
17. Merge/deploy production only when runtime and control plane are verified together. **Pending explicit operator merge approval.**

## Verification gates

Normal repository gates:

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
python -m compileall -q src tests migrations tools main.py
alembic upgrade head
```

Preview verification is intentionally scoped to repository-owned Python paths because Vercel injects binary Python packages built under a different interpreter. The normal GitHub CI remains authoritative for the full SQLite repository integration suite after merge approval.

Verified in Vercel preview runs during implementation:

- JavaScript syntax checks passed.
- web contract tests passed in the previews that reached them; the latest executed preview ran 7 tests and all 7 passed.
- Python compileall passed in the latest executed preview.
- focused Python suite passed in an earlier preview with 26 passing tests.
- Ruff source lint passed in the latest executed preview.
- Ruff canonical formatting fixes were applied as preview failures identified them.

Latest executed preview evidence:

- commit `d7d3a5564886656a7ca81aa2e4e417e7dd8bc622` reached `ruff format --check` after JavaScript tests, Python compile and Ruff lint had passed;
- it stopped on a formatting-only finding in `src/marwie_bot/features/control_plane/cog.py` around the initial snapshot logging call;
- newer source commits include the formatter repair and scheduler hardening;
- the consolidated branch head has not completed the same executable gate because Vercel rejected the deployment for build-rate quota.

Still required before manual wiring:

- strict consolidated verification must pass Ruff lint, Ruff format-check, mypy, focused Python tests and web tests on the final branch head;
- scheduler-focused tests must cover deadline/wake behavior and the no-busy-loop cases introduced by the idle-safe redesign;
- full repository verification remains required before production cutover.

Additional focused verification:

- duplicate idempotency key creates no duplicate action;
- only one worker can claim an action;
- actor permission loss after OAuth causes bot-side rejection;
- malformed/unknown action payloads never reach a Discord handler;
- failed actions record a safe error plus internal error reference;
- persistent notification role buttons reconstruct after restart;
- role buttons cannot grant unconfigured roles or roles above the bot;
- announcement mention allow-list matches only explicitly resolved targets;
- explicit Live ping selection is authoritative, including no-ping;
- SQLite migration preserves source row counts and deterministic table digests;
- target PostgreSQL sequence state is reset after explicit-ID imports;
- OAuth callback rejects invalid state;
- mutation endpoint rejects missing/invalid CSRF and wrong origin;
- `/control` never receives a bot token, database URL, OAuth client secret or hosting credential;
- enqueueing a new action sends one wake request;
- idempotent retry re-sends wake without duplicating the action;
- wake delivery failure leaves the action queued;
- only the configured Discord webhook ID can trigger queue draining;
- startup drains queued work without a wake;
- no recurring Control action poll or snapshot heartbeat remains;
- stale/missing snapshots refresh through the durable wake path while ordinary mutations still require fresh state;
- Pomodoro scheduling sleeps until the earliest persisted deadline or a local wake and performs no recurring DB query when idle;
- quiz scheduling sleeps until the earliest close/post deadline or a local wake and does not busy-loop when no question is available;
- temporary voice reconciliation runs once after ready and not periodically;
- static review confirms retained periodic DB jobs are 30 minutes or longer.

## Manual wiring checkpoints

Expected operator steps only:

1. Discord Developer Portal: add production OAuth redirect URI and obtain Client ID/Client Secret without pasting the secret into chat.
2. Vercel: add Discord OAuth, Neon and wake-webhook environment variables because the available connector does not expose environment-variable writes.
3. Bot-Hosting: add the numeric `CONTROL_WAKE_WEBHOOK_ID`, enable the short read-only migration window, add the temporary Neon migration target variable, then replace `DATABASE_URL` with the verified Neon URL. The assistant can trigger restarts through the existing restart bridge after the operator confirms the values are saved.

Do not ask the operator to paste secrets into chat.
