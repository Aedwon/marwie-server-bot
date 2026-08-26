# Live control plane implementation plan

Status: design complete; implementation branch pending
Date: 2026-08-27
Spec: `docs/superpowers/specs/2026-08-27-live-control-plane.md`
Decision: `docs/superpowers/decisions/2026-08-27-live-control-plane.md`

## Branch strategy

Create `feat/live-control-plane` from current `main`. Do not merge the divergent docs prototype branch into runtime code. Port only approved docs-site assets and the live design records onto the new branch.

## Files / components

### Database

- `src/marwie_bot/db/models.py`: control action/session-safe runtime models and notification-panel persistence models used by the bot side.
- `alembic/versions/*_live_control_plane.py`: schema migration.
- `tools/migrate_sqlite_to_postgres.py`: one-shot staged SQLite → Neon migration with verification.
- tests for migration-safe model behavior and queue semantics.

### Bot control worker

- `src/marwie_bot/features/control_plane/` new package:
  - domain records/action types;
  - SQLAlchemy repository for action queue and control state;
  - atomic claim/finish/reject operations;
  - permission policy;
  - action dispatcher;
  - background worker loop;
  - guild-state snapshot builder.
- hook worker lifecycle into bot startup/shutdown.
- action handlers call existing configuration, tickets, reputation, quizzes, AI feed, announcement/live and logging services where available.

### Runtime extensions

- configuration role-panel persistence and generic persistent role-button view.
- safe publishing mention resolution and message-content support.
- any small service extraction required so slash commands and browser actions share business logic.
- update `docs/commands.md` only when surrounding command behavior materially changes.

### Vercel API

- `package.json` for the minimal Neon serverless dependency if needed.
- `api/_db.js`, `api/_auth.js`, `api/_http.js`: shared server-side modules.
- `api/auth/discord/start.js`, `callback.js`, `logout.js`, `session.js`.
- `api/control/state.js`, `action.js`, `action-status.js`, `setup-discovery.js`.
- OAuth state, opaque session cookie, CSRF validation, origin validation, idempotency and payload schemas.
- never expose the bot token or connection-string secrets.

### Approved UI

Port the reviewed `docs-site` handbook/manual/control assets from `docs/control-panel-prototype` onto the live branch.

Replace mock control state with API-backed state while retaining the approved layout and interaction design.

- signed-out state;
- Discord login;
- guild selector;
- loading/error states;
- real resource/member/role selectors;
- queue progress and result states;
- live refresh after success;
- final confirmation before mutations.

### Deployment docs

Add a short operator deployment/cutover runbook covering Discord OAuth redirect, Vercel environment variables, Neon connection strings, staged database migration and Bot-Hosting database cutover.

## Implementation order

1. Create live branch from `main` and port design records.
2. Add tests for action queue/idempotency/permission policy and notification panel model.
3. Add database migration and control-plane repository/domain layer.
4. Add bot action worker with a minimal low-risk handler set, then expand handler coverage to every editable prototype workflow.
5. Add notification role-panel runtime generalization and publishing mention support with tests.
6. Add staged SQLite → Postgres migration utility and verification report.
7. Add Vercel OAuth/session/CSRF API and state/action endpoints.
8. Port approved UI and wire to API.
9. Add deployment/cutover runbook.
10. Run repository verification gates.
11. Create/upgrade Neon schema and verify it.
12. Ask operator for manual secret/console wiring only where connectors cannot write protected settings.
13. Run staged production SQLite → Neon migration and verify counts/invariants.
14. Cut Bot-Hosting `DATABASE_URL` to Neon and restart only after successful migration verification.
15. Verify bot startup, queue worker, OAuth login, live state and one low-risk production mutation.
16. Merge docs production branch only when runtime and control plane are verified together.

## Verification gates

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
python -m compileall -q src tests migrations main.py
alembic upgrade head
```

Additional focused verification:

- duplicate idempotency key creates no duplicate action;
- only one worker can claim an action;
- actor permission loss after OAuth causes bot-side rejection;
- malformed/unknown action payloads never reach a Discord handler;
- failed actions record a safe error plus internal error reference;
- persistent notification role buttons reconstruct after restart;
- role buttons cannot grant unconfigured roles or roles above the bot;
- announcement mention allow-list matches only explicitly resolved targets;
- SQLite migration preserves all source row counts and key guild configuration records;
- target PostgreSQL sequence state is valid after explicit-ID imports;
- OAuth callback rejects invalid state;
- mutation endpoint rejects missing/invalid CSRF and wrong origin;
- `/control` never receives a bot token, database URL, OAuth client secret or hosting credential.

## Manual wiring checkpoints

These are the only expected operator steps:

1. Discord Developer Portal: add production OAuth redirect URI and obtain Client ID/Client Secret without pasting the secret into chat.
2. Vercel: add Discord OAuth and control-session/Neon environment variables because the available connector does not expose environment-variable writes.
3. Bot-Hosting: add the temporary Neon migration target variable for the one-shot migration, then later replace `DATABASE_URL` with the verified Neon async URL. The assistant can trigger restarts through the existing restart bridge after the operator confirms the values are saved.

Do not ask the operator to paste any secret into chat.
