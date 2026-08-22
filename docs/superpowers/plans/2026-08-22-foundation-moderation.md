# Foundation and moderation implementation plan

Date: 2026-08-22
Status: active
Spec: `docs/superpowers/specs/2026-08-22-foundation-moderation.md`

## Goal

Deliver a deployable Discord bot foundation with database migrations, per-guild resource configuration, and persistent warning/history commands.

## Dependencies

- Discord application token for live deployment only
- a Discord development guild for live command testing only
- bot-hosting.net account for deployment only

Local and CI implementation must not require those secrets.

## Global constraints

- Follow `AGENTS.md` and `SUBAGENTS.md`.
- Do not redesign the linked spec while executing this plan.
- Keep Discord handlers thin.
- Keep durable state in SQLAlchemy repositories.
- Add Alembic migrations for schema changes.
- Use test-first development for pure feature logic.
- Do not enable privileged Discord intents in this milestone.
- Do not add features outside the linked spec.

## Verification gates

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
python -m compileall -q src tests
alembic upgrade head
```

Expected: every command exits 0. CI runs the migration gate against a temporary SQLite database.

## File table

| Path | Action | Purpose |
| --- | --- | --- |
| `pyproject.toml` | create | Python metadata and tool configuration |
| `requirements.txt` | create | bot-hosting.net runtime dependencies |
| `requirements-dev.txt` | create | test and quality dependencies |
| `.env.example` | create | documented environment variables |
| `.gitignore` | create | ignore secrets, caches, local DB data |
| `README.md` | create | local and bot-hosting.net setup |
| `alembic.ini` | create | Alembic configuration |
| `migrations/env.py` | create | async migration environment |
| `migrations/script.py.mako` | create | migration template |
| `migrations/versions/20260822_0001_foundation.py` | create | foundation schema |
| `src/marwie_bot/__init__.py` | create | package marker |
| `src/marwie_bot/__main__.py` | create | hosting entry point |
| `src/marwie_bot/bot.py` | create | bot lifecycle and extension loading |
| `src/marwie_bot/config/__init__.py` | create | config package marker |
| `src/marwie_bot/config/settings.py` | create | typed environment settings |
| `src/marwie_bot/config/resources.py` | create | resource keys and types |
| `src/marwie_bot/db/__init__.py` | create | database package marker |
| `src/marwie_bot/db/base.py` | create | SQLAlchemy declarative base |
| `src/marwie_bot/db/models.py` | create | foundation ORM models |
| `src/marwie_bot/db/session.py` | create | async engine/session lifecycle |
| `src/marwie_bot/db/migrations.py` | create | startup migration runner |
| `src/marwie_bot/features/__init__.py` | create | feature package marker |
| `src/marwie_bot/features/configuration/__init__.py` | create | configuration feature marker |
| `src/marwie_bot/features/configuration/repository.py` | create | guild resource persistence |
| `src/marwie_bot/features/configuration/service.py` | create | resource behavior |
| `src/marwie_bot/features/configuration/cog.py` | create | `/setup` commands |
| `src/marwie_bot/features/moderation/__init__.py` | create | moderation feature marker |
| `src/marwie_bot/features/moderation/repository.py` | create | moderation case persistence |
| `src/marwie_bot/features/moderation/service.py` | create | moderation behavior |
| `src/marwie_bot/features/moderation/cog.py` | create | `/warn` and `/history` |
| `src/marwie_bot/features/system.py` | create | `/ping` |
| `src/marwie_bot/shared/__init__.py` | create | shared package marker |
| `src/marwie_bot/shared/logging.py` | create | logging setup |
| `src/marwie_bot/shared/permissions.py` | create | pure hierarchy validation |
| `tests/test_database_url.py` | create | database URL tests |
| `tests/test_permissions.py` | create | hierarchy tests |
| `tests/test_resource_service.py` | create | resource service tests |
| `tests/test_moderation_service.py` | create | moderation service tests |
| `.github/workflows/ci.yml` | create | repository verification gates |
| `.superpowers/sdd/progress.md` | modify | execution ledger |

Files outside this table require the plan to be updated before implementation.

## Task 1: Establish the Python toolchain and configuration

### Behavior

Create the package metadata, runtime/development dependency lists, environment settings, logging setup, and database URL normalization. The package must not need Discord secrets merely to import pure modules or run unit tests.

### Test first

Write `tests/test_database_url.py` for SQLite, plain PostgreSQL, and already-normalized PostgreSQL URLs.

Expected first failure: the database helper does not exist.

### Implement

Add package metadata and typed settings. Keep the Discord token required only when constructing the bot runtime settings, not at module import time.

### Verify

Run the focused test and compile the new modules.

## Task 2: Add migrations and database lifecycle

### Behavior

Create the four foundation tables from Alembic. Prepare the SQLite parent directory before migration or connection. Startup migration failure must propagate.

### Test first

CI will create a temporary SQLite database, run `alembic upgrade head`, and inspect the resulting migration state through Alembic's exit code.

### Implement

Add ORM models, async session management, Alembic environment, and the initial migration.

### Verify

Run the migration gate plus source compilation.

## Task 3: Add guild resource configuration

### Behavior

Resource service reads and writes named guild resources. `/setup resource` stores the moderation log channel. `/setup status` reports configured or stale state.

### Test first

Write a fake repository test proving set/get behavior and missing resources.

Expected first failure: the service does not exist.

### Implement

Add resource key/type definitions, repository, service, and setup cog.

### Verify

Run the focused service test and repository-wide gates.

## Task 4: Add moderation cases and hierarchy rules

### Behavior

Pure hierarchy validation rejects the cases defined in the spec. Moderation service creates warning cases and lists member history through a repository contract.

### Test first

Write hierarchy and service tests with fake repositories.

Expected first failure: the hierarchy validator and moderation service do not exist.

### Implement

Add the moderation repository, service, and pure permission helper.

### Verify

Run moderation-focused tests and all current gates.

## Task 5: Add Discord commands and lifecycle

### Behavior

Create the bot class, extension loading, command sync, global error handling, `/ping`, `/setup`, `/warn`, and `/history`. Startup applies migrations before connecting. Shutdown closes the engine.

### Test first

The Discord layer is syntax/type checked in this milestone. Network integration is deferred because it requires a live token and guild.

### Implement

Keep cogs limited to Discord interaction handling and service calls. Register no privileged intents.

### Verify

Run all gates.

## Task 6: Add deployment docs and CI

### Behavior

Document GitHub deployment to bot-hosting.net, required environment variables, startup entry file, and migration behavior. CI installs runtime and dev dependencies and runs every gate.

### Verify

Run all locally available gates. Confirm the GitHub Actions workflow completes successfully after the branch is pushed.

## Final verification

Run every verification gate in this plan. Record actual results in `.superpowers/sdd/progress.md`.

## Stop conditions

Stop if:

- the spec and plan conflict
- an unexpected file appears in the implementation paths
- an unplanned dependency is required
- Alembic cannot create a clean database
- CI reveals a pre-existing failure unrelated to this branch
- a live deployment step requires a Discord token or host secret that has not been supplied
