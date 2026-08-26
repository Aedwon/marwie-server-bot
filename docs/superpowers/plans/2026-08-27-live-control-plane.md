# Live control plane implementation plan

Status: implementation complete; strict verification and production wiring pending
Date: 2026-08-27
Spec: `docs/superpowers/specs/2026-08-27-live-control-plane.md`
Decision: `docs/superpowers/decisions/2026-08-27-live-control-plane.md`

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
  - background worker loop;
  - guild-state snapshot builder;
  - persistent notification-role panel runtime.
- worker lifecycle is connected to bot startup/shutdown.
- action handlers reuse existing configuration, tickets, reputation, quizzes, AI feed and publishing services where available.

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

`docs/operations/live-control-plane-cutover.md` contains the OAuth, Vercel, Neon, SQLite migration, Bot-Hosting cutover, smoke-test and rollback sequence.

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
10. Run repository verification gates. **In progress: strict Vercel preview rerun pending after canonical Ruff formatting.**
11. Create/upgrade Neon schema and verify it. **Pending verified code/cutover stage; current target is intentionally empty.**
12. Ask operator for manual secret/console wiring only where connectors cannot write protected settings. **Pending strict verification.**
13. Run staged production SQLite → Neon migration and verify counts/invariants. **Pending.**
14. Cut Bot-Hosting `DATABASE_URL` to Neon and restart only after successful migration verification. **Pending.**
15. Verify bot startup, queue worker, OAuth login, live state and one low-risk production mutation. **Pending.**
16. Merge/deploy production only when runtime and control plane are verified together. **Pending explicit operator merge approval.**

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

Verified in earlier Vercel preview runs during implementation:

- JavaScript syntax checks passed.
- web contract suite: 6 passed.
- Python compileall passed.
- focused Python suite: 26 passed.
- Ruff source lint passed after removing one unused exception binding.
- Ruff canonical formatting was applied to all nine files reported by `ruff format --check`.

Still required before manual wiring:

- strict consolidated preview must pass Ruff lint, Ruff format-check, mypy, focused Python tests and web tests on the final branch head.

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
- `/control` never receives a bot token, database URL, OAuth client secret or hosting credential.

## Manual wiring checkpoints

Expected operator steps only:

1. Discord Developer Portal: add production OAuth redirect URI and obtain Client ID/Client Secret without pasting the secret into chat.
2. Vercel: add Discord OAuth and Neon environment variables because the available connector does not expose environment-variable writes.
3. Bot-Hosting: enable the short read-only migration window, add the temporary Neon migration target variable, then replace `DATABASE_URL` with the verified Neon URL. The assistant can trigger restarts through the existing restart bridge after the operator confirms the values are saved.

Do not ask the operator to paste secrets into chat.
