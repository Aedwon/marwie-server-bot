# Contextual confirmations and setup error reporting specification

Date: 2026-08-25
Status: accepted for implementation

## Goal

Make command confirmations informative enough to support an actual decision, and make `/setup auto` failures actionable from Discord even when the hosting console is unavailable.

This refines the accepted `2026-08-25-auto-setup-confirmations.md` behavior. The requirement that every slash command receives an Approve/Decline gate remains unchanged.

## Confirmation content

Every slash-command confirmation must identify all of the following before approval:

- the exact slash command being approved;
- what the command does, using the command description as the universal fallback;
- the concrete option values supplied by the user when options exist;
- any command-specific side effects that materially improve the decision.

The confirmation remains ephemeral, invoker-only, and expires after 60 seconds.

Long option values must be truncated so the confirmation remains within Discord message limits. Discord objects should render as readable names instead of Python representations.

### `/setup auto`

`/setup auto` requires a command-specific explanation. Before approval it must state that it will:

- inspect existing configured Discord resources;
- keep valid existing bindings;
- adopt matching standard channels, forums, categories, voice channels, roles, and the Solved tag when present;
- create missing standard resources;
- save the selected resource IDs;
- post or refresh the Live Notifications self-role panel;
- not delete, rename, or move unrelated server resources.

This confirmation is a behavior summary. It does not claim which individual resources will be created because discovery happens only after approval.

## Failure reporting

Unexpected command exceptions must still be logged with a traceback.

The user-facing failure response must include a short error reference ID so a failure can be correlated with logs. It must not expose arbitrary exception text by default.

Known safe operational failures may provide an actionable explanation in Discord. `/setup auto` must identify the stage/resource that failed when Discord rejects a provisioning action.

Examples:

- `Could not configure moderation_log: Discord denied the action.`
- `Could not create/adopt solved_tag in build-help: Discord API error 50013 (Missing Permissions).`
- `Resources were configured, but the notification role panel could not be refreshed.`

A partial setup failure must not be reported as complete. The provisioner continues to fail fast on the first unexpected resource error instead of silently skipping it.

## Safety

- Do not expose tokens, database URLs, SQL statements, raw tracebacks, request headers, or arbitrary exception payloads to Discord users.
- Discord `Forbidden`, `NotFound`, and `HTTPException` failures may be translated into concise safe messages.
- Generic exceptions receive only the error reference ID in Discord and the full traceback in application logs.
- Existing permission checks continue to run before confirmation.

## Testing

Add focused tests for:

- generic confirmation content containing the exact command, description, and supplied options;
- `/setup auto` custom confirmation details;
- option-value truncation;
- safe user-facing error formatting;
- preservation of the existing auto-setup blueprint tests.

Full verification remains:

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
python -m compileall -q src tests migrations main.py
alembic upgrade head
```
