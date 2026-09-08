# Compromised Account Trap Implementation Plan

Date: 2026-09-09
Status: accepted for execution
Spec: `docs/superpowers/specs/2026-09-09-compromised-account-trap.md`
Decision: `docs/superpowers/decisions/2026-09-09-compromised-account-trap.md`

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Goal

Implement a manually mapped compromised-account trap channel that treats any new human-authored message in that exact channel as a durable moderation incident, attempts a ban with a fixed 24-hour Discord-native deletion window, falls back to best-effort 24-hour server-wide cleanup when the ban cannot be enforced, and exposes the destructive mapping safely in Control.

## Architecture

The feature stays inside the moderation domain but does not expand the existing command cog. A dedicated Discord listener receives and qualifies message events. A trap service owns claim/deduplication, cooldown, enforcement sequencing, incident state transitions, containment classification, and audit metadata. A dedicated repository persists incidents before destructive work begins. The existing guild-resource system owns the trap mapping, and the existing moderation service owns the final moderation case. The Control website exposes the mapping with a deliberate destructive confirmation and keeps the trap out of all auto-setup or suggested-mapping flows.

Runtime and website production remain intentionally split. Runtime work targets `main`; Control website work targets `web/rob-bot-site-production`. Do not use one production branch as a substitute for the other.

## Tech stack

- Python `>=3.12,<3.14`
- `discord.py >=2.6,<3.0`
- SQLAlchemy 2 async
- Alembic
- pytest + pytest-asyncio
- Ruff
- mypy
- Vanilla JavaScript ES modules
- Node 20+ built-in test runner
- Vercel static Control site

## Dependencies

- Accepted spec: `docs/superpowers/specs/2026-09-09-compromised-account-trap.md`
- Accepted decision: `docs/superpowers/decisions/2026-09-09-compromised-account-trap.md`
- Runtime base at planning time: `main` = `44ed4bb88835845ea8599d3c9aab670839a71e16`
- Website base at planning time: `web/rob-bot-site-production` = `5efd0ff109b6290a6e54f1657cc07ed5c11d468b`
- Migration head at planning time: `20260908_0005`
- Existing moderation log mapping and moderation case persistence
- Existing Control `set_resource` / `clear_resource` save path

If either production branch, the migration head, or the relevant Control save contracts have materially changed before execution begins, stop and reconcile this plan before editing code.

## Global constraints

- Follow `AGENTS.md` and `SUBAGENTS.md` in full.
- Read this plan, the linked spec, and the linked decision before touching code.
- Use an isolated git worktree for each production target.
- Do not edit files outside the file table without stopping and updating this plan first.
- Do not redesign accepted behavior while executing this plan.
- Use test-first development for every behavior change.
- Keep Discord handlers thin. Policy belongs in services. Persistence belongs in repositories.
- Do not hardcode guild, channel, role, or user IDs.
- Do not inspect or persist trigger message content.
- Reactions are never trap triggers.
- No human account receives a role- or privilege-based exemption.
- Do not pre-reject owner or hierarchy targets. Attempt the ban and treat Discord rejection as a failed enforcement attempt that activates fallback cleanup.
- The cleanup window is exactly 86,400 seconds and is not configurable.
- A successful ban must not also launch a redundant server-wide history sweep.
- A stale or deleted trap mapping fails closed.
- Child threads do not inherit trap behavior from a mapped parent channel.
- The trap is manual-only. Auto Setup and mapping suggestions must not be able to arm it, including through crafted backend payloads.
- No direct production database writes during development or verification.
- Applying the Alembic migration to production occurs only through the normal runtime deployment/startup path after an authorized merge/restart.
- Do not merge production branches or restart the bot without explicit user authorization.

## Production branch and worktree topology

Execution should use two isolated worktrees.

### Runtime worktree

Create from the then-current `main` after confirming the expected base or updating this plan if it moved materially.

Suggested branch: `web/compromised-account-trap-runtime-r1`

This branch owns Python runtime, persistence, migrations, backend mapping validation, runtime tests, and the accepted spec/decision/plan documents needed to make the change self-describing when merged to `main`.

### Control website worktree

Create from the then-current `web/rob-bot-site-production`.

Suggested branch: `web/compromised-account-trap-control-r1`

This branch owns Control mapping UX and web tests. It must not be based on `main` merely to reuse runtime files. If compatibility constants must exist in both branches, implement them independently against each branch's current state and verify the resulting API contract matches.

## File table

Files outside this table require stopping and updating this plan before proceeding.

| Path | Action | Purpose |
| --- | --- | --- |
| `docs/superpowers/specs/2026-09-09-compromised-account-trap.md` | carry into runtime branch | Accepted feature contract |
| `docs/superpowers/decisions/2026-09-09-compromised-account-trap.md` | carry into runtime branch | Accepted security/architecture decision |
| `docs/superpowers/plans/2026-09-09-compromised-account-trap.md` | carry into runtime branch | Execution contract |
| `src/marwie_bot/config/resources.py` | modify | Add the trap resource key and channel type |
| `src/marwie_bot/features/control_plane/mappings.py` | modify | Expose manual mapping while excluding it from suggestion plans |
| `src/marwie_bot/features/control_plane/validation.py` | modify | Reject crafted suggestion payloads that try to arm the trap |
| `src/marwie_bot/db/models.py` | modify | Add durable compromised-account incident model |
| `migrations/versions/20260909_0006_compromised_account_incidents.py` | create | Create incident table and constraints |
| `src/marwie_bot/features/moderation/compromise_trap_repository.py` | create | Incident claim/finalize/restart reconciliation persistence |
| `src/marwie_bot/features/moderation/compromise_trap_service.py` | create | Pure orchestration policy and containment classification |
| `src/marwie_bot/features/moderation/compromise_trap.py` | create | Discord listener, ban adapter, cleanup adapter, incident summary logging |
| `src/marwie_bot/bot.py` | modify | Load the trap extension |
| `tests/test_control_mapping_groups.py` | modify | Prove manual mapping ownership and suggestion exclusion |
| `tests/test_control_plane_validation.py` | modify | Prove crafted suggestion payload rejection |
| `tests/test_compromised_account_trap_repository.py` | create | Prove durable claim, cooldown, finalize, interruption behavior |
| `tests/test_compromised_account_trap_service.py` | create | Prove orchestration, ban/fallback choice, classification, metadata |
| `tests/test_compromised_account_trap_cog.py` | create | Prove event qualification, exact-channel behavior, Discord cleanup paths, audit integration |
| `tests/test_sqlite_postgres_cutover.py` | modify only if needed by existing migration contract | Cover new table in existing clean-schema/cutover assertions |
| `docs-site/control-mappings.js` | modify on Control branch | Add mapping, warning, armed state, explicit destructive confirmation |
| `web-tests/control-compromised-account-trap.test.js` | create on Control branch | Prove destructive mapping UX and manual-only behavior |
| `web-tests/control-mapping-suggestion-groups.test.js` | modify only if needed | Defensive proof that trap never renders as a suggestion |

## Runtime interfaces to implement

Use these names and value contracts unless execution uncovers an existing repository convention that requires a mechanically equivalent name. A naming-only adjustment is allowed; a semantic adjustment requires plan review.

```python
TRAP_DELETE_SECONDS = 86_400
TRAP_COOLDOWN_SECONDS = 60


class IncidentStatus(StrEnum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    INTERRUPTED = "interrupted"


class ContainmentStatus(StrEnum):
    CONTAINED = "contained"
    PARTIALLY_CONTAINED = "partially_contained"
    FAILED = "failed"
    INTERRUPTED = "interrupted"


class BanStatus(StrEnum):
    SUCCEEDED = "succeeded"
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class TrapTrigger:
    guild_id: int
    user_id: int
    channel_id: int
    message_id: int
    triggered_at: datetime


@dataclass(frozen=True, slots=True)
class BanAttempt:
    succeeded: bool
    error: str | None = None


@dataclass(frozen=True, slots=True)
class CleanupFailure:
    scope_id: int
    scope_name: str
    error: str


@dataclass(frozen=True, slots=True)
class CleanupResult:
    deleted_count: int
    scanned_scopes: int
    failures: tuple[CleanupFailure, ...]
```

The repository claim result must distinguish `claimed`, `in_flight`, and `cooldown`. The service execution result must expose enough state to build one moderation case and one moderation-log summary without persisting full message content.

## Incident persistence shape

Add `CompromisedAccountIncident` with these fields:

```text
id                      integer primary key
 guild_id                bigint, non-null, indexed
 target_id               bigint, non-null, indexed
 trigger_channel_id      bigint, non-null
 trigger_message_id      bigint, non-null, unique
 triggered_at            timezone-aware datetime, non-null
 status                  string(32), non-null
 containment_status      string(32), nullable
 ban_status              string(32), nullable
 ban_error               text, nullable
 native_delete_requested boolean, non-null, default false
 fallback_cleanup_run    boolean, non-null, default false
 deleted_message_count   integer, non-null, default 0
 failed_scopes_json      JSON, nullable
 active_key              string(100), nullable, unique
 cooldown_until          timezone-aware datetime, nullable, indexed
 created_at              timezone-aware datetime, non-null, server default now
 updated_at              timezone-aware datetime, non-null, server default now/on update
```

While an incident is active, set `active_key=f"{guild_id}:{target_id}"`. Finalization or restart interruption clears `active_key`. The nullable unique constraint provides a database-level cross-process guard on simultaneous active incidents for the same guild/user without relying on partial indexes. Cooldown is durable through `cooldown_until`.

---

## Task 1: Add a manual-only trap mapping contract

### Files

- Modify: `src/marwie_bot/config/resources.py`
- Modify: `src/marwie_bot/features/control_plane/mappings.py`
- Modify: `src/marwie_bot/features/control_plane/validation.py`
- Modify: `tests/test_control_mapping_groups.py`
- Modify: `tests/test_control_plane_validation.py`

### Behavior

`compromised_account_trap` is a valid text-channel resource for ordinary manual `SET_RESOURCE` / `CLEAR_RESOURCE` operations. It appears in the manual Channels mapping group. It is excluded from serialized mapping suggestions and from the backend list of keys accepted by `APPLY_MAPPING_SUGGESTIONS` so a crafted request cannot arm it.

### Test first

- [ ] Add assertions that `ResourceKey.COMPROMISED_ACCOUNT_TRAP` exists, has channel type, and is included in `CHANNEL_MAPPING_KEYS`.
- [ ] Add assertions that it is excluded from a new `SUGGESTIBLE_MAPPING_KEYS` collection.
- [ ] Add a validation test that manual `SET_RESOURCE` accepts `compromised_account_trap`.
- [ ] Add a validation test that `APPLY_MAPPING_SUGGESTIONS` rejects an item whose key is `compromised_account_trap`.
- [ ] Add a validation test that `confirmed_keys=["compromised_account_trap"]` is rejected.

Run:

```bash
PYTHONPATH=src pytest tests/test_control_mapping_groups.py tests/test_control_plane_validation.py -q
```

Expected: the new tests fail because the resource and manual/suggestible split do not exist yet.

### Implement

- [ ] Add:

```python
class ResourceKey(StrEnum):
    ...
    COMPROMISED_ACCOUNT_TRAP = "compromised_account_trap"
```

- [ ] Add `ResourceKey.COMPROMISED_ACCOUNT_TRAP: ResourceType.CHANNEL` to `RESOURCE_TYPES`.
- [ ] Add the key to `CHANNEL_MAPPING_KEYS`.
- [ ] Introduce:

```python
MANUAL_ONLY_MAPPING_KEYS: tuple[ResourceKey, ...] = (ResourceKey.COMPROMISED_ACCOUNT_TRAP,)
SUGGESTIBLE_MAPPING_KEYS: tuple[ResourceKey, ...] = tuple(
    key for key in APPROVED_MAPPING_KEYS if key not in MANUAL_ONLY_MAPPING_KEYS
)
_SUGGESTIBLE_MAPPING_KEY_SET = frozenset(SUGGESTIBLE_MAPPING_KEYS)
```

- [ ] Change only suggestion serialization/scoping to use `_SUGGESTIBLE_MAPPING_KEY_SET`.
- [ ] Keep ordinary `mapping_group()` and `APPROVED_MAPPING_KEYS` aware of the trap so the manual page owns it.
- [ ] Change suggestion validation to accept only `SUGGESTIBLE_MAPPING_KEYS`, while leaving ordinary `SET_RESOURCE` / `CLEAR_RESOURCE` validation based on `ResourceKey` unchanged.

### Verify

Run:

```bash
PYTHONPATH=src pytest tests/test_control_mapping_groups.py tests/test_control_plane_validation.py -q
ruff check src/marwie_bot/config/resources.py src/marwie_bot/features/control_plane/mappings.py src/marwie_bot/features/control_plane/validation.py tests/test_control_mapping_groups.py tests/test_control_plane_validation.py
ruff format --check src/marwie_bot/config/resources.py src/marwie_bot/features/control_plane/mappings.py src/marwie_bot/features/control_plane/validation.py tests/test_control_mapping_groups.py tests/test_control_plane_validation.py
```

Expected: focused tests pass and Ruff reports no issues.

### Commit

```bash
git add src/marwie_bot/config/resources.py src/marwie_bot/features/control_plane/mappings.py src/marwie_bot/features/control_plane/validation.py tests/test_control_mapping_groups.py tests/test_control_plane_validation.py
git commit -m "feat(control): add manual-only compromise trap mapping"
```

---

## Task 2: Persist trap incidents before destructive work

### Files

- Modify: `src/marwie_bot/db/models.py`
- Create: `migrations/versions/20260909_0006_compromised_account_incidents.py`
- Create: `src/marwie_bot/features/moderation/compromise_trap_repository.py`
- Create: `tests/test_compromised_account_trap_repository.py`
- Modify: `tests/test_sqlite_postgres_cutover.py` only if the existing migration assertions enumerate expected schema objects

### Behavior

The repository can atomically claim one active incident per `(guild_id, target_id)`, reject concurrent duplicates, honor a durable 60-second cooldown, finalize outcomes while clearing the active lock, and mark stale in-progress incidents interrupted after restart without replaying destructive actions.

### Test first

- [ ] Create a temporary SQLite database through the repository's normal migration/test helpers.
- [ ] Test that `claim_incident()` persists trigger metadata with `status="in_progress"` before returning `claimed`.
- [ ] Test that a second claim for the same guild/user while the first is active returns `in_flight` and does not create a second active incident.
- [ ] Test that a different user can be claimed concurrently.
- [ ] Test that finalization clears `active_key`, stores enforcement outcome fields, and writes `cooldown_until=finalized_at + 60 seconds`.
- [ ] Test that a new same-user claim before `cooldown_until` returns `cooldown` without creating a new incident.
- [ ] Test that a same-user claim after cooldown expiry creates a new incident.
- [ ] Test that startup reconciliation converts every stale `in_progress` row to `interrupted`, sets `containment_status="interrupted"`, clears `active_key`, and returns only rows it changed.
- [ ] Call startup reconciliation twice and prove the second call returns no rows.
- [ ] Test unique `trigger_message_id` behavior so a duplicate event cannot create a second durable incident.

Run:

```bash
PYTHONPATH=src pytest tests/test_compromised_account_trap_repository.py -q
```

Expected: collection or assertions fail because the model/repository/migration do not exist.

### Implement

- [ ] Add the `CompromisedAccountIncident` SQLAlchemy model using the exact persistence shape in this plan.
- [ ] Create migration `20260909_0006` with `down_revision="20260908_0005"`.
- [ ] Use names for indexes/unique constraints that are stable on SQLite and PostgreSQL.
- [ ] Implement immutable incident record and claim-result dataclasses in `compromise_trap_repository.py` or import shared records from the service module only if that does not create a circular dependency.
- [ ] Implement `claim_incident()` inside a transaction:
  - inspect the latest same-user incident for a future `cooldown_until`;
  - attempt to insert an in-progress row with `active_key=f"{guild_id}:{target_id}"`;
  - flush/commit;
  - translate a unique `active_key` or duplicate `trigger_message_id` `IntegrityError` into a non-destructive `in_flight` disposition after rollback.
- [ ] Implement `finalize_incident()` to update the exact claimed incident, clear `active_key`, persist outcomes, set `status="completed"`, and set durable cooldown.
- [ ] Implement `mark_in_progress_interrupted(now)` as an idempotent restart reconciliation operation. It updates rows, clears their active keys, and never invokes Discord.

### Verify

Run:

```bash
PYTHONPATH=src pytest tests/test_compromised_account_trap_repository.py tests/test_sqlite_postgres_cutover.py -q
alembic upgrade head
python -m compileall -q src/marwie_bot/features/moderation/compromise_trap_repository.py src/marwie_bot/db/models.py migrations/versions/20260909_0006_compromised_account_incidents.py tests/test_compromised_account_trap_repository.py
ruff check src/marwie_bot/db/models.py src/marwie_bot/features/moderation/compromise_trap_repository.py migrations/versions/20260909_0006_compromised_account_incidents.py tests/test_compromised_account_trap_repository.py
```

Expected: focused tests pass, migration upgrades from `0005` to `0006`, and compilation/Ruff are clean.

### Commit

```bash
git add src/marwie_bot/db/models.py migrations/versions/20260909_0006_compromised_account_incidents.py src/marwie_bot/features/moderation/compromise_trap_repository.py tests/test_compromised_account_trap_repository.py tests/test_sqlite_postgres_cutover.py
git commit -m "feat(moderation): persist compromise trap incidents"
```

If `tests/test_sqlite_postgres_cutover.py` was not changed, omit it from `git add`.

---

## Task 3: Implement the pure trap enforcement service

### Files

- Create: `src/marwie_bot/features/moderation/compromise_trap_service.py`
- Create: `tests/test_compromised_account_trap_service.py`
- Modify: `src/marwie_bot/features/moderation/compromise_trap_repository.py` only if type imports must be aligned with the service interfaces

### Behavior

The service owns claim/deduplication, the exact 24-hour window, ban-first sequencing, fallback selection, containment classification, cooldown finalization, and moderation metadata. It does not depend on Discord classes and does not read message content.

### Test first

Create fake repository and fake enforcer implementations and prove:

- [ ] `claimed` triggers call ban with exactly `delete_message_seconds=86_400`.
- [ ] Successful ban sets `native_delete_requested=True`, does not call fallback cleanup, finalizes as `contained`, and records zero manual deletions unless the adapter reports otherwise.
- [ ] Failed ban calls fallback cleanup with `since == trigger.triggered_at - timedelta(seconds=86_400)`.
- [ ] Failed ban + cleanup with at least one scanned scope and no failures finalizes `contained`.
- [ ] Failed ban + some successful scope work plus failures finalizes `partially_contained`.
- [ ] Failed ban + zero successfully scanned scopes finalizes `failed`.
- [ ] `in_flight` and `cooldown` dispositions do not call ban, cleanup, or finalization and return a result that tells the Discord layer to best-effort delete only the new trap message.
- [ ] Service metadata includes `automated=True`, `source="compromised_account_trap"`, incident ID, trigger channel/message IDs, ban result, cleanup path, deletion count, failed scope IDs, and containment status.
- [ ] Metadata does not include trigger message content or a content-like field.
- [ ] If fallback cleanup raises an unexpected adapter exception, the service records a failed/partial outcome and still attempts to finalize the durable incident before re-raising only when repository integrity requires operator attention. Prefer converting expected enforcement failures to typed results instead of exceptions.

Run:

```bash
PYTHONPATH=src pytest tests/test_compromised_account_trap_service.py -q
```

Expected: fails because the service module does not exist.

### Implement

- [ ] Add `TRAP_DELETE_SECONDS = 86_400` and `TRAP_COOLDOWN_SECONDS = 60`.
- [ ] Add the enum/dataclass contracts listed under Runtime interfaces.
- [ ] Define an enforcer protocol with methods equivalent to:

```python
class TrapEnforcer(Protocol):
    async def ban(self, user_id: int, reason: str, delete_message_seconds: int) -> BanAttempt: ...
    async def cleanup(self, user_id: int, since: datetime) -> CleanupResult: ...
```

- [ ] Implement `CompromiseTrapService.execute(trigger, enforcer, *, moderator_id, now=None)`.
- [ ] Claim durable state before the first enforcer call.
- [ ] Use a stable reason such as `Automatic compromised-account trap enforcement: user posted in the configured trap channel.`
- [ ] Do not encode Discord owner or role-hierarchy checks in the service.
- [ ] Build moderation metadata from IDs/outcomes only.
- [ ] Finalize every claimed incident exactly once with a durable cooldown.

### Verify

Run:

```bash
PYTHONPATH=src pytest tests/test_compromised_account_trap_service.py tests/test_compromised_account_trap_repository.py -q
ruff check src/marwie_bot/features/moderation/compromise_trap_service.py src/marwie_bot/features/moderation/compromise_trap_repository.py tests/test_compromised_account_trap_service.py
ruff format --check src/marwie_bot/features/moderation/compromise_trap_service.py src/marwie_bot/features/moderation/compromise_trap_repository.py tests/test_compromised_account_trap_service.py
mypy src/marwie_bot/features/moderation/compromise_trap_service.py src/marwie_bot/features/moderation/compromise_trap_repository.py tests/test_compromised_account_trap_service.py tests/test_compromised_account_trap_repository.py
```

Expected: all focused tests and static checks pass.

### Commit

```bash
git add src/marwie_bot/features/moderation/compromise_trap_service.py src/marwie_bot/features/moderation/compromise_trap_repository.py tests/test_compromised_account_trap_service.py tests/test_compromised_account_trap_repository.py
git commit -m "feat(moderation): orchestrate compromise trap enforcement"
```

---

## Task 4: Add the Discord listener, ban adapter, and 24-hour fallback cleanup

### Files

- Create: `src/marwie_bot/features/moderation/compromise_trap.py`
- Modify: `src/marwie_bot/bot.py`
- Create: `tests/test_compromised_account_trap_cog.py`

### Behavior

Only a newly received normal/reply human message in the exact live mapped text channel starts enforcement. Bots, webhooks, Discord service/system messages, unrelated channels, stale mappings, and child threads are ignored. A reaction is safe because no reaction listener is registered. Successful bans request exactly 24 hours of native deletion. Failed bans cause a 24-hour best-effort cleanup across accessible text channels and accessible active/archived threads. Per-scope failures do not stop other scopes.

### Test first: trigger qualification

- [ ] Test no mapping means no service call.
- [ ] Test a mapping whose Discord object no longer resolves as a live `discord.TextChannel` means no service call.
- [ ] Test exact mapped text-channel human message calls service.
- [ ] Parameterize user-authored messages representing text, reply, attachment-only, sticker-only, emoji-only, and no normal text content. Every case qualifies without reading `.content`.
- [ ] Test `author.bot=True` is ignored, including Rob-bot itself and another bot.
- [ ] Test `webhook_id` is ignored.
- [ ] Test Discord system/service message types are ignored.
- [ ] Test a normal message in another channel is ignored.
- [ ] Test a message in a thread whose parent is the mapped channel is ignored because `message.channel.id != mapped.discord_id`.
- [ ] Verify there is no `on_reaction_add` / `on_raw_reaction_add` enforcement listener in the new cog contract.

Run:

```bash
PYTHONPATH=src pytest tests/test_compromised_account_trap_cog.py -q
```

Expected: fails because the listener does not exist.

### Implement trigger qualification

- [ ] Create a dedicated `CompromisedAccountTrapCog`.
- [ ] Look up `ResourceKey.COMPROMISED_ACCOUNT_TRAP` on each candidate message.
- [ ] Resolve the mapped ID through `guild.get_channel()` and require `discord.TextChannel`; a stale mapping fails closed.
- [ ] Match `message.channel.id` exactly.
- [ ] Accept only `discord.MessageType.default` and `discord.MessageType.reply` for enforcement.
- [ ] Require `message.webhook_id is None` and `not message.author.bot`.
- [ ] Never reference message text for qualification.

### Test first: ban and fallback cleanup

- [ ] Test the Discord enforcer invokes:

```python
await guild.ban(
    discord.Object(id=user_id),
    reason=reason,
    delete_message_seconds=86_400,
)
```

and reports success.
- [ ] Parameterize `discord.Forbidden`, `discord.NotFound`, and `discord.HTTPException` ban failures and prove each returns a failed `BanAttempt` instead of suppressing fallback.
- [ ] Test no owner/hierarchy pre-check occurs before `guild.ban`.
- [ ] Test fallback cleanup uses the exact `since` provided by the service.
- [ ] Test text channels lacking any of `view_channel`, `read_message_history`, or `manage_messages` are recorded as inaccessible failed scopes and do not abort remaining scopes.
- [ ] Test accessible text-channel history deletes only messages whose `author.id == target_id` and whose history iterator is bounded by `after=since`.
- [ ] Test successful deletion increments the exact deletion count.
- [ ] Test per-message `Forbidden`/`HTTPException` records a scope failure and processing continues.
- [ ] Test active threads are scanned once.
- [ ] Test archived threads returned by discord.py's archived-thread iterator are scanned when accessible.
- [ ] Deduplicate thread IDs so an already-seen active thread is not scanned again if surfaced elsewhere.
- [ ] Test a failure fetching archived threads records the parent/channel scope failure and does not stop cleanup of other channels.

### Implement Discord enforcement

- [ ] Implement a small Discord enforcer class in `compromise_trap.py` bound to the triggering guild.
- [ ] For ban, always use a user-ID object so enforcement can still be attempted if the member leaves between trigger and action.
- [ ] Convert expected Discord exceptions to typed `BanAttempt` failures with a concise error class/message.
- [ ] For cleanup, iterate guild text channels and accessible thread scopes with permission checks using `guild.me` / `channel.permissions_for(bot_member)`.
- [ ] Use `history(limit=None, after=since)` and direct `message.delete(reason=...)` for matching target messages.
- [ ] Never inspect or compare message content.
- [ ] Keep scope failure data bounded to IDs, names, and concise error descriptions.

### Duplicate/cooldown trigger behavior

- [ ] When the service returns `in_flight` or `cooldown`, best-effort delete only the newly posted trap message.
- [ ] Catch `discord.Forbidden`, `discord.NotFound`, and `discord.HTTPException` from this single-message cleanup and log without starting another incident.

### Load the extension

- [ ] Add `"marwie_bot.features.moderation.compromise_trap"` to `EXTENSIONS` in `src/marwie_bot/bot.py` after the moderation command cog.
- [ ] In `setup(bot)`, require the initialized `Database`, instantiate resource/incident/moderation services, and register the new cog.

### Verify

Run:

```bash
PYTHONPATH=src pytest tests/test_compromised_account_trap_cog.py tests/test_compromised_account_trap_service.py tests/test_compromised_account_trap_repository.py -q
python -m compileall -q src/marwie_bot/features/moderation/compromise_trap.py src/marwie_bot/bot.py tests/test_compromised_account_trap_cog.py
ruff check src/marwie_bot/features/moderation/compromise_trap.py src/marwie_bot/bot.py tests/test_compromised_account_trap_cog.py
ruff format --check src/marwie_bot/features/moderation/compromise_trap.py src/marwie_bot/bot.py tests/test_compromised_account_trap_cog.py
mypy src/marwie_bot/features/moderation/compromise_trap.py src/marwie_bot/features/moderation/compromise_trap_service.py tests/test_compromised_account_trap_cog.py
```

Expected: all focused behavior and static checks pass.

### Commit

```bash
git add src/marwie_bot/features/moderation/compromise_trap.py src/marwie_bot/bot.py tests/test_compromised_account_trap_cog.py
git commit -m "feat(moderation): enforce compromise trap messages"
```

---

## Task 5: Add durable restart reconciliation and one audit record per incident

### Files

- Modify: `src/marwie_bot/features/moderation/compromise_trap.py`
- Modify: `src/marwie_bot/features/moderation/compromise_trap_service.py` only if audit-result types need a final field
- Modify: `tests/test_compromised_account_trap_cog.py`
- Modify: `tests/test_compromised_account_trap_service.py` only if metadata/result assertions need alignment

### Behavior

Every full claimed incident creates one automated moderation case after enforcement and one moderation-log summary. Restarted stale incidents are marked interrupted and surfaced to operators without destructive replay. If enforcement succeeds but final case/audit persistence fails, the containment action is never rolled back.

### Test first: moderation case

- [ ] Test a full incident calls `ModerationService.create_case()` exactly once with:
  - action `"ban"`;
  - target ID from the trigger;
  - moderator ID equal to Rob-bot's user ID;
  - automatic trap reason;
  - structured metadata from the service.
- [ ] Test metadata contains incident/trigger/outcome IDs and no message content.
- [ ] Test `in_flight` and `cooldown` triggers do not create moderation cases.
- [ ] Test case-persistence failure after a successful ban is logged and does not call `guild.unban` or otherwise rollback containment.

### Test first: moderation log summary

- [ ] Test one summary embed is posted to the mapped moderation log for one full incident.
- [ ] Test summary includes target, trap channel, trigger message ID, ban result, cleanup path, deletion count, failed/inaccessible scopes, containment status, and incident/case identifier where available.
- [ ] Test absent/stale moderation log leaves the durable incident/case intact.
- [ ] Test posting `Forbidden`/`HTTPException` is logged and does not alter containment state.

### Test first: startup reconciliation

- [ ] Seed one stale in-progress incident.
- [ ] Invoke the cog's ready/reconciliation hook and prove the repository marks it interrupted.
- [ ] Verify no ban or cleanup enforcer call occurs for the stale incident.
- [ ] Verify one operator-visible interrupted summary is attempted.
- [ ] Invoke ready/reconciliation again and prove no duplicate interrupted summary is generated.

### Implement

- [ ] After the service returns a completed full incident, create the moderation case through the existing `ModerationService` using the service metadata.
- [ ] Post a dedicated compromise-trap summary embed to `ResourceKey.MODERATION_LOG`. Do not call private methods on `ModerationCog`; keep this component independent and reuse only services/resource lookup.
- [ ] Use `bot.user.id` as the automated actor. If `bot.user` is unexpectedly unavailable, preserve incident outcome and log the missing actor instead of fabricating an ID.
- [ ] Add an idempotent startup reconciliation method called from `on_ready` or an equivalent listener. It calls `mark_in_progress_interrupted(datetime.now(UTC))` and only reports rows returned by that state transition.
- [ ] Never call ban or cleanup from startup reconciliation.
- [ ] Structured logs must include guild ID, user ID, channel ID, message ID, incident ID, error class where relevant, and containment status.

### Verify

Run:

```bash
PYTHONPATH=src pytest tests/test_compromised_account_trap_cog.py tests/test_compromised_account_trap_service.py tests/test_compromised_account_trap_repository.py tests/test_moderation_service.py -q
ruff check src/marwie_bot/features/moderation tests/test_compromised_account_trap_cog.py tests/test_compromised_account_trap_service.py tests/test_compromised_account_trap_repository.py
ruff format --check src/marwie_bot/features/moderation tests/test_compromised_account_trap_cog.py tests/test_compromised_account_trap_service.py tests/test_compromised_account_trap_repository.py
mypy src/marwie_bot/features/moderation tests/test_compromised_account_trap_cog.py tests/test_compromised_account_trap_service.py tests/test_compromised_account_trap_repository.py
```

Expected: all focused tests pass. No test observes automatic destructive replay during restart reconciliation.

### Commit

```bash
git add src/marwie_bot/features/moderation/compromise_trap.py src/marwie_bot/features/moderation/compromise_trap_service.py tests/test_compromised_account_trap_cog.py tests/test_compromised_account_trap_service.py
git commit -m "feat(moderation): audit and recover compromise trap incidents"
```

Only add files actually modified.

---

## Task 6: Add destructive trap mapping UX to Control

**Execution location:** Control website worktree based on `web/rob-bot-site-production`, not the runtime worktree.

### Files

- Modify: `docs-site/control-mappings.js`
- Create: `web-tests/control-compromised-account-trap.test.js`
- Modify: `web-tests/control-mapping-suggestion-groups.test.js` only if needed for defensive suggestion filtering

### Behavior

The Channels mapping page exposes `Compromised account trap`. A healthy live mapping reads `Armed`; a stale mapping reads `Unavailable`; an absent mapping reads `Not connected`. Edit mode displays the destructive warning. Arming or remapping requires an explicit acknowledgement before Save can execute. Clearing the mapping requires no acknowledgement and remains the immediate disarm path. The website defensively excludes the trap from suggestions even if a malformed/stale snapshot contains it.

### Test first

- [ ] Import the mapping page helpers in a new Node test file.
- [ ] Test `CHANNEL_KEYS`/page definition includes `compromised_account_trap` as a text-channel selector.
- [ ] Test read markup for a valid trap mapping contains `Armed`.
- [ ] Test stale mapping contains `Unavailable`.
- [ ] Test unmapped state contains `Not connected`.
- [ ] Test edit markup includes this exact safety meaning: `Any human who sends a new message in this channel will trigger automatic compromised-account enforcement.` Minor punctuation changes are acceptable only if the assertion is updated to preserve the same meaning.
- [ ] Test changing trap from null to a channel requires destructive confirmation and Save remains disabled before acknowledgement.
- [ ] Test changing trap from channel A to channel B resets/requires destructive confirmation.
- [ ] Test changing trap from channel A to null does not require confirmation and Save can proceed immediately when the ordinary draft is valid.
- [ ] Test changing another mapping does not require the trap confirmation.
- [ ] Test a crafted `snapshot.mappings_review.proposed` entry for `compromised_account_trap` is filtered from suggestion groups and apply payloads.

Run:

```bash
node --test web-tests/control-compromised-account-trap.test.js web-tests/control-mapping-suggestion-groups.test.js
```

Expected: the new tests fail because the mapping and destructive confirmation do not exist.

### Implement

- [ ] Add `compromised_account_trap` to `CHANNEL_KEYS`.
- [ ] Add a resource definition equivalent to:

```js
compromised_account_trap: Object.freeze({
  label: 'Compromised account trap',
  group: 'channels',
  kind: 'text',
  manualOnly: true,
  destructive: true,
  warning: 'Any human who sends a new message in this channel will trigger automatic compromised-account enforcement.',
}),
```

- [ ] Add a pure helper that detects only an arm/remap transition:

```js
export function requiresDestructiveMappingConfirmation(persisted, draft) {
  const key = 'compromised_account_trap';
  const current = persisted?.[key]?.id == null ? null : String(persisted[key].id);
  const selected = draft?.[key] == null || draft?.[key] === '' ? null : String(draft[key]);
  return selected !== null && selected !== current;
}
```

- [ ] Add per-page destructive acknowledgement state tied to the selected trap ID. Changing the selected target invalidates the previous acknowledgement.
- [ ] Render an accessible warning and checkbox only when an arm/remap transition is pending.
- [ ] Gate Save on both the existing `store.canSave(pageKey)` result and the destructive acknowledgement when required.
- [ ] Do not gate clearing to `null`.
- [ ] For the trap row only, render healthy status as `Armed`; retain existing Connected behavior for ordinary mappings.
- [ ] Defensively filter any `manualOnly` definition out of `mappingSuggestionGroups()`, `approvedProposals()`, and the resulting suggestion apply payload.

### Verify

Run:

```bash
node --test web-tests/control-compromised-account-trap.test.js web-tests/control-mapping-suggestion-groups.test.js web-tests/control-mappings.test.js web-tests/control-mappings-r2.test.js
npm run check:web
npm run test:web
```

Expected: focused and full web tests pass and JavaScript syntax checks are clean.

### Commit

```bash
git add docs-site/control-mappings.js web-tests/control-compromised-account-trap.test.js web-tests/control-mapping-suggestion-groups.test.js
git commit -m "feat(control): add compromised account trap mapping"
```

Only add `control-mapping-suggestion-groups.test.js` if modified.

---

## Task 7: Run full runtime verification and prepare separate production PRs

### Runtime files

No implementation changes are expected in this task. If a verification failure requires code outside the file table, stop and update the plan.

### Runtime verification

- [ ] Confirm migration head is still `20260909_0006` in the implementation branch.
- [ ] Create a fresh temporary database and run `alembic upgrade head` through the repository's standard environment configuration.
- [ ] Run every Python test, not only focused tests:

```bash
PYTHONPATH=src pytest -q
```

Expected: all tests pass.

- [ ] Run lint and formatting:

```bash
ruff check .
ruff format --check .
```

Expected: no lint or formatting failures.

- [ ] Run type checking:

```bash
mypy src tests
```

Expected: no type errors.

- [ ] Run compilation:

```bash
python -m compileall -q src tests
```

Expected: exit code 0 with no compilation errors.

- [ ] Run migration verification:

```bash
alembic upgrade head
```

Expected: database reaches `20260909_0006` successfully.

- [ ] Run the repository package build when Node dependencies are available, because it exercises the repository's current mixed Python/web build contract:

```bash
npm run build
```

Expected: all configured checks pass. If this fails only because the runtime branch intentionally lacks the newer site-production-only files, document the branch-topology mismatch and run the explicit Python gates above plus `npm run check:web`/`npm run test:web` against the runtime branch's own state. Do not copy unrelated site-production changes into `main` merely to make this build green.

### Runtime review

- [ ] Inspect the final diff against the runtime base.
- [ ] Verify no full message content is logged or stored.
- [ ] Verify no owner/admin/mod role exemption was introduced.
- [ ] Verify `86_400` is the only trap cleanup-window value.
- [ ] Verify successful ban path does not call fallback cleanup.
- [ ] Verify a failed ban always reaches fallback cleanup for a claimed incident.
- [ ] Verify no reaction listener triggers enforcement.
- [ ] Verify no startup path calls ban/cleanup for interrupted incidents.
- [ ] Verify no auto-setup blueprint was added for the trap.
- [ ] Verify manual mapping validation is allowed while suggestion validation is blocked.

### Control verification

In the Control worktree:

```bash
npm run check:web
npm run test:web
npm run build
```

Expected: all commands pass.

Then inspect the diff against `web/rob-bot-site-production` and verify:

- [ ] mapping appears under Channels;
- [ ] healthy mapping displays `Armed`;
- [ ] stale mapping displays `Unavailable`;
- [ ] arm/remap cannot save without acknowledgement;
- [ ] clear/disarm can save without acknowledgement;
- [ ] suggestions cannot contain/apply the trap.

### Prepare PRs

After verification is green and only if the user has authorized pushing/opening PRs:

1. Runtime PR:
   - head: `web/compromised-account-trap-runtime-r1`
   - base: `main`
   - title: `feat(moderation): add compromised account trap`
2. Control PR:
   - head: `web/compromised-account-trap-control-r1`
   - base: `web/rob-bot-site-production`
   - title: `feat(control): configure compromised account trap`

Do not merge either PR in this task unless the user explicitly authorizes it. Do not restart Bot-Hosting.net merely because the runtime PR exists.

---

## Deployment order after explicit authorization

This section is an operational dependency, not pre-authorization to deploy.

1. Merge the runtime PR to `main` only after all runtime gates are green.
2. Merge the Control PR to `web/rob-bot-site-production` only after all web gates are green.
3. Allow Vercel to deploy the Control branch through its existing production configuration.
4. Restart/update the bot through the established `ops/bot-hosting-restart` workflow so the runtime starts from the new `main` and applies migration `20260909_0006` through normal startup.
5. Before arming the trap, verify the runtime is healthy and the Control snapshot sees the target channel.
6. Map the intended channel manually in Control and complete the destructive confirmation. Do not test by sending a human message from a real account that should remain in the server.
7. Verify the mapping snapshot shows the configured channel and the UI shows `Armed`.

A production smoke test should use non-destructive evidence such as runtime logs, snapshot/resource state, and a controlled test guild if available. Do not sacrifice a real member account merely to prove the trap fires.

## Final verification checklist

- [ ] Spec requirement: exact mapped channel only.
- [ ] Spec requirement: any normal/reply human-authored message qualifies without content inspection.
- [ ] Spec requirement: reactions do not trigger.
- [ ] Spec requirement: bots/webhooks/system messages ignored.
- [ ] Spec requirement: no human privilege exemptions.
- [ ] Spec requirement: ban attempts 86,400-second native deletion.
- [ ] Spec requirement: failed ban activates 24-hour fallback cleanup.
- [ ] Spec requirement: fallback continues after per-scope failures.
- [ ] Spec requirement: active and accessible archived threads are included.
- [ ] Spec requirement: duplicate in-flight triggers do not start duplicate incidents.
- [ ] Spec requirement: 60-second durable cooldown suppresses repeated full sweeps while duplicate/cooldown trap messages are best-effort deleted.
- [ ] Spec requirement: durable state exists before destructive action.
- [ ] Spec requirement: interrupted incidents are surfaced without destructive replay.
- [ ] Spec requirement: one moderation case and one moderation-log summary per full incident.
- [ ] Spec requirement: no full message content persisted/logged.
- [ ] Spec requirement: mapping itself is arm/disarm state.
- [ ] Spec requirement: stale mapping fails closed.
- [ ] Spec requirement: arm/remap requires explicit Control confirmation.
- [ ] Spec requirement: clearing is immediate and confirmation-free.
- [ ] Spec requirement: trap excluded from auto-setup and suggestions at both backend and frontend boundaries.
- [ ] Python full gates are green.
- [ ] Control full gates are green.
- [ ] Migration upgrade is green on a non-production database.
- [ ] Runtime and Control diffs target their correct production branches.

## Plan self-review

Before execution, the implementing agent must read this plan end to end and confirm:

- every accepted behavior in the linked spec maps to at least one task/test above;
- no line contains `TBD`, `TODO`, `FIXME`, or an unresolved placeholder;
- service, repository, model, migration, and test names agree;
- `TRAP_DELETE_SECONDS` and cooldown semantics agree across service and persistence;
- the migration still follows the current Alembic head;
- website work is not accidentally based on `main`;
- runtime work is not accidentally based on the website production branch.

Use:

```bash
grep -nE 'TBD|TODO|FIXME|<placeholder>' docs/superpowers/plans/2026-09-09-compromised-account-trap.md
```

Expected: no matches.

## Stop conditions

Stop and report before proceeding if:

- `main` or `web/rob-bot-site-production` has materially changed in a way that invalidates this file table or interface plan;
- Alembic head is no longer `20260908_0005` before Task 2 starts;
- `20260909_0006` already exists with unrelated content;
- the accepted spec and this plan conflict;
- a required dependency is missing and adding it would change architecture;
- unrelated tests are already failing before a task begins;
- implementing Discord archived-thread cleanup requires unsupported discord.py APIs beyond what `>=2.6,<3.0` actually provides;
- Control's save contract changed so destructive confirmation cannot be enforced without editing files outside this table;
- an implementation would require a human privilege exemption or a cleanup window above 24 hours;
- a production DB mutation, production merge, or bot restart would be required before the user explicitly authorizes it.
