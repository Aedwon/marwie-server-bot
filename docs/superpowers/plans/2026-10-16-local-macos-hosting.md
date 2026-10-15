# Local macOS Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Rob-bot persistently on the user's M4 MacBook Air under a macOS LaunchAgent with external secrets, fresh SQLite state, persistent logs, crash restart, and AC-only sleep prevention.

**Architecture:** Keep the application unchanged. Add one repository-owned operational helper that installs/checks the user-scoped runtime files and launches the bot under `caffeinate -s`, then document the manual `launchctl` activation/update workflow that the terminal relay is not allowed to execute.

**Tech Stack:** Python 3.12, macOS `launchd`, `/usr/bin/caffeinate`, SQLite, Alembic, pytest, Ruff, mypy.

**Spec:** `docs/superpowers/specs/2026-10-16-local-macos-hosting.md`

## Global Constraints

- The production bot line is `main`; website deployment remains on `web/rob-bot-site-production`.
- Do not commit Discord tokens or deployment-specific secret values.
- Use `~/.config/marwie-server-bot/production.env` for production environment values.
- Use the repository-local `.venv` with Python 3.12 or 3.13.
- Use the default local SQLite database at `data/marwie.db`.
- Do not use GitHub-hosted Actions for routine verification.
- Do not invoke or hide `launchctl` through the terminal relay.
- Preserve unrelated local files and do not edit outside this plan's file table.

## Review Focus

- Missing or empty `DISCORD_TOKEN` must fail before the bot starts and must never be printed.
- A non-production environment file must be refused by the local-host runtime.
- Re-running installation must preserve an existing production environment file.
- The generated plist must use absolute paths, restart behavior, persistent logs, and contain no secret values.
- Fresh SQLite migration must create the database successfully from the current migration chain before activation.

---

### Task 1: Record the deployment boundary change

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Create: `docs/local-hosting.md`
- Delete: `.github/workflows/restart-bot-hosting.yml`
- Delete: `.ops/bot-hosting-restart`

**Interfaces:**
- Consumes: accepted local-hosting spec and decision log.
- Produces: canonical operator instructions and current deployment ownership.

- [ ] **Step 1: Update deployment ownership**

Change the bot production target in `AGENTS.md` from Bot-Hosting to local macOS LaunchAgent hosting. Keep website/Vercel boundaries unchanged.

- [ ] **Step 2: Add the local-hosting runbook**

Document runtime paths, initial setup, production environment editing, install/check commands, one-time LaunchAgent activation, status/log inspection, stop/start/restart, safe code updates, `/setup auto`, sleep/lid limitations, and rollback/removal.

- [ ] **Step 3: Update README deployment guidance**

Replace active Bot-Hosting setup/restart instructions with a short pointer to `docs/local-hosting.md`. Do not delete historical superpowers documents.

- [ ] **Step 4: Remove obsolete active Bot-Hosting controls**

Delete the restart workflow and operations marker because no Bot-Hosting deployment exists.

- [ ] **Step 5: Verify documentation scope**

Run: `git diff --check`
Expected: exit 0.

### Task 2: Add the local-host runtime helper test-first

**Files:**
- Create: `scripts/local_hosting.py`
- Create: `tests/test_local_hosting.py`

**Interfaces:**
- Consumes: `.env.example`, repository root, macOS home directory.
- Produces: `production_env_template(example: str) -> str`, `build_launch_agent(repo_root: Path, home: Path) -> dict[str, object]`, `load_runtime_environment(env_path: Path, base_env: Mapping[str, str]) -> dict[str, str]`, `runtime_command(repo_root: Path) -> list[str]`, and CLI operations `install`, `check`, `run`.

- [ ] **Step 1: Write RED tests for environment handling**

Assert that the production template sets `ENVIRONMENT=production`, leaves `DISCORD_TOKEN` empty, and preserves the other example settings. Assert that runtime loading refuses missing/empty tokens and any environment other than `production` without exposing the token.

- [ ] **Step 2: Write RED tests for LaunchAgent generation**

Assert absolute repository/venv/script paths, `RunAtLoad`, keep-alive behavior, restart throttle, repository working directory, Library log paths, and absence of `DISCORD_TOKEN` or token values in the plist.

- [ ] **Step 3: Run RED tests**

Run: `.venv/bin/pytest tests/test_local_hosting.py -q`
Expected: FAIL because the helper does not exist yet.

- [ ] **Step 4: Implement the smallest helper**

`install` creates owner-scoped config/log directories, creates but never overwrites `production.env`, chmods it `0600`, and writes a plist with `plistlib` without calling `launchctl`.

`check` validates required files, venv, environment settings, plist shape, and file permissions while reporting only set/unset status for secret fields.

`run` loads the external environment, changes to the repository root, and `exec`s `/usr/bin/caffeinate -s <repo>/.venv/bin/python <repo>/main.py`.

- [ ] **Step 5: Run focused GREEN tests**

Run: `.venv/bin/pytest tests/test_local_hosting.py -q`
Expected: PASS.

### Task 3: Prepare and verify the local runtime

**Files:**
- Local ignored/runtime only: `.venv/`, `data/marwie.db`
- User-scoped runtime only: `~/.config/marwie-server-bot/production.env`, `~/Library/LaunchAgents/com.aedwon.marwie-server-bot.plist`, `~/Library/Logs/marwie-server-bot/`

**Interfaces:**
- Consumes: Task 2 helper and current dependency/migration files.
- Produces: installed, unactivated local production runtime awaiting only real Discord configuration and `launchctl` activation.

- [ ] **Step 1: Create the Python 3.12 virtual environment**

Run: `~/.local/bin/python3.12 -m venv .venv`
Expected: `.venv/bin/python --version` reports Python 3.12.x.

- [ ] **Step 2: Install verification dependencies**

Run: `.venv/bin/python -m pip install -r requirements-dev.txt`
Expected: exit 0.

- [ ] **Step 3: Run repository verification**

Run, in order:

- `.venv/bin/pytest`
- `.venv/bin/ruff check .`
- `.venv/bin/ruff format --check .`
- `.venv/bin/mypy src tests`
- `.venv/bin/python -m compileall -q src tests migrations main.py scripts`

Expected: all exit 0.

- [ ] **Step 4: Upgrade a fresh local SQLite database**

Run Alembic with a temporary non-secret placeholder token only for settings validation and the default local database URL.
Expected: exit 0 and `data/marwie.db` exists.

- [ ] **Step 5: Install user-scoped runtime files**

Run: `.venv/bin/python scripts/local_hosting.py install`
Expected: external environment template, plist, and log directory are created with correct permissions and no secrets.

- [ ] **Step 6: Validate installation before activation**

Run: `.venv/bin/python scripts/local_hosting.py check`
Expected before the real token is supplied: a clear nonzero result stating `DISCORD_TOKEN` is unset, without printing any secret value.

### Task 4: Final verification and activation handoff

**Files:**
- No additional repository files unless verification exposes a scoped defect.

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: exact local activation instructions and verified branch state.

- [ ] **Step 1: Run final repository gates after all edits**

Repeat the Task 3 verification commands plus `git diff --check`.
Expected: all exit 0.

- [ ] **Step 2: Inspect repository state**

Confirm only plan-approved files changed and no credentials/database/venv/logs are tracked.

- [ ] **Step 3: Record the remaining secret-dependent step**

The owner supplies `DISCORD_TOKEN` and optionally `COMMAND_GUILD_ID` in `~/.config/marwie-server-bot/production.env`, then reruns `check`.

- [ ] **Step 4: Activate outside the relay**

Run locally after `check` is green:

`launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aedwon.marwie-server-bot.plist`

`launchctl kickstart -k gui/$(id -u)/com.aedwon.marwie-server-bot`

Then inspect `launchctl print`, logs, Discord connection, `/ping`, `/setup auto`, and `/setup status`.

- [ ] **Step 5: Commit/push only if explicitly authorized**

Do not merge the branch automatically. Preserve the exact verification evidence in the handoff.
