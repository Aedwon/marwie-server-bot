# Anonymous Messages Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the reference anonymous-message panel, numbered posts, anonymous replies, sticky behavior, deletion renumbering, and staff audit trail into `marwie-server-bot` with independently mapped panel, submissions, and audit destinations.

**Architecture:** Add a dedicated anonymous-messages feature with SQLAlchemy repository and service layers, focused Discord render/view helpers, and a thin cog for lifecycle/listeners/admin commands. Persist public-message metadata and panel state in new tables. Wire three new channel resource keys through auto-setup and the web control-plane Mappings page.

**Tech Stack:** Python 3.12+, discord.py 2.6+, SQLAlchemy 2, Alembic, pytest/pytest-asyncio, Ruff, mypy, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-09-anonymous-messages-port.md`

## Global Constraints

- Work only on `web/anonymous-messages-port-r1`; do not modify or merge `main`.
- Reference base commit is `ccd1c9ac33aa564248e24e751fd5509750eebf0c`.
- Keep panel, submissions, and audit log as three independent mappings.
- Panel and submissions may map to the same channel.
- Do not copy MLBB verification behavior.
- Public identity must stay hidden; staff audit identity is deliberate and private.
- Use durable database state for anonymous records and panel tracking.
- Keep database code SQLite/PostgreSQL portable.
- Register persistent Discord views on startup.
- Use `AllowedMentions.none()` for anonymous public output.
- Do not self-merge.

---

### Task 1: Resource and mapping contract

**Files:**
- Modify: `src/marwie_bot/config/resources.py`
- Modify: `src/marwie_bot/features/configuration/provisioning.py`
- Modify: `src/marwie_bot/features/control_plane/mappings.py`
- Modify: `docs-site/control-mappings.js`
- Modify: `tests/test_auto_setup_blueprint.py`
- Create: `web-tests/control-anonymous-message-mappings.test.js`

**Interfaces:**
- Produces `ResourceKey.ANON_MESSAGES_PANEL`, `ResourceKey.ANON_MESSAGES_SUBMISSIONS`, `ResourceKey.ANON_MESSAGES_AUDIT_LOG`, and `FeatureName.ANONYMOUS_MESSAGES`.
- Produces three `ResourceType.CHANNEL` mappings available to runtime code.

- [ ] **Step 1: Write backend and web tests for the three mappings.**

Backend assertions must verify that auto-setup covers the new keys and that the audit blueprint is private. Web assertions must verify that the Channels page exposes all three labels and treats them as text-channel mappings.

- [ ] **Step 2: Run focused tests and confirm RED.**

```bash
pytest tests/test_auto_setup_blueprint.py -q
node --test web-tests/control-anonymous-message-mappings.test.js
```

Expected failure: new resource/feature enum members and mapping definitions do not exist yet.

- [ ] **Step 3: Add resource enums, resource types, auto-setup blueprints, mapping ownership, and web definitions.**

Canonical auto-setup names:

```text
anonymous-messages-panel
anonymous-messages
anonymous-audit-log
```

The audit log blueprint must use `private=True`.

- [ ] **Step 4: Re-run focused tests and confirm GREEN.**

```bash
pytest tests/test_auto_setup_blueprint.py -q
node --test web-tests/control-anonymous-message-mappings.test.js
```

---

### Task 2: Durable anonymous-message state and service rules

**Files:**
- Modify: `src/marwie_bot/db/models.py`
- Create: `migrations/versions/20260909_0007_anonymous_messages.py`
- Create: `src/marwie_bot/features/anonymous_messages/__init__.py`
- Create: `src/marwie_bot/features/anonymous_messages/service.py`
- Create: `src/marwie_bot/features/anonymous_messages/repository.py`
- Create: `tests/test_anonymous_message_service.py`

**Interfaces:**
- Produces `AnonymousMessageRecord`, `AnonymousPanelRecord`, `RenumberItem`, `AnonymousMessageService`, and `SQLAlchemyAnonymousMessageRepository`.
- Service methods: `create_message`, `create_reply`, `discard_unposted`, `mark_deleted_by_message`, `renumber_plan`, `set_display_number`, `get_panel`, `save_panel`, `clear_panel`.

- [ ] **Step 1: Write service tests first.**

Tests must cover trimming, 10/2000 message bounds, 5/2000 reply bounds, per-guild top-level numbering, replies not consuming numbers, failed/unposted record discard, soft deletion, and contiguous renumber planning.

- [ ] **Step 2: Run and confirm RED.**

```bash
pytest tests/test_anonymous_message_service.py -q
```

Expected failure: anonymous-message package/service does not exist.

- [ ] **Step 3: Add models and migration.**

Create `anonymous_messages` and `anonymous_message_panels` exactly as specified. `20260909_0007` must revise `20260909_0006`.

- [ ] **Step 4: Implement repository and service minimally to satisfy tests.**

Use a per-guild `asyncio.Lock` in the service around top-level number allocation. Keep Discord concerns out of the service.

- [ ] **Step 5: Re-run focused tests and migration check.**

```bash
pytest tests/test_anonymous_message_service.py -q
DATABASE_URL=sqlite+aiosqlite:///./build/anonymous-messages-task2.db alembic upgrade head
```

---

### Task 3: Discord rendering and persistent interaction views

**Files:**
- Create: `src/marwie_bot/features/anonymous_messages/render.py`
- Create: `src/marwie_bot/features/anonymous_messages/views.py`
- Create: `tests/test_anonymous_messages_views.py`

**Interfaces:**
- Produces `build_panel_embed`, `build_message_embed`, `build_reply_embed`, `build_audit_embed`.
- Produces persistent `AnonPanelView` and `AnonReplyView` plus message/reply modals.
- Views consume `AnonymousMessageService`, `ResourceService`, and `FeatureConfigService`.

- [ ] **Step 1: Write tests for rendering and persistent custom IDs.**

Assert button custom IDs remain `anon_messages:send_button` and `anon_messages:reply_button`. Assert transparent panel copy mentions authorized staff review. Assert public message/reply embeds contain no user identity and replies use no allowed mentions when sent.

- [ ] **Step 2: Run and confirm RED.**

```bash
pytest tests/test_anonymous_messages_views.py -q
```

- [ ] **Step 3: Implement render helpers and interaction flow.**

New-message and reply submission must require current mappings, create durable records before public send, discard unposted records on Discord send failure, attach successful Discord IDs, and then send the audit embed.

- [ ] **Step 4: Re-run focused tests and confirm GREEN.**

```bash
pytest tests/test_anonymous_messages_views.py -q
```

---

### Task 4: Cog lifecycle, sticky panel, delete sync, and admin commands

**Files:**
- Create: `src/marwie_bot/features/anonymous_messages/cog.py`
- Modify: `src/marwie_bot/bot.py`
- Create: `tests/test_anonymous_messages_cog.py`
- Modify: `tests/test_extension_imports.py` only if the generic extension test requires explicit expectations.

**Interfaces:**
- Produces extension `marwie_bot.features.anonymous_messages.cog`.
- Produces administrator group commands `/anon deploy` and `/anon sync`.

- [ ] **Step 1: Write cog tests first.**

Cover persistent-view registration, background-task opt-out when `enable_background_tasks=False`, all-guild sticky reconciliation, current-mapping checks, moved-panel cleanup using stored old channel ID, single/bulk deletion soft-delete queueing, and admin runtime permission decorators.

- [ ] **Step 2: Run and confirm RED.**

```bash
pytest tests/test_anonymous_messages_cog.py tests/test_extension_imports.py -q
```

- [ ] **Step 3: Implement the cog and add it to `EXTENSIONS`.**

The 10-minute sticky loop must iterate all guilds. A separate 5-second queue worker may serialize renumber passes. Discord edits during renumber should sleep two seconds after each changed title, matching the reference feature's rate-limit friendliness.

- [ ] **Step 4: Re-run focused tests and confirm GREEN.**

```bash
pytest tests/test_anonymous_messages_cog.py tests/test_extension_imports.py -q
```

---

### Task 5: Operator/member documentation

**Files:**
- Modify: `docs/commands.md`
- Modify: `docs-site/commands.md`

**Interfaces:**
- Documents the exact member interaction flow and administrator command contract.

- [ ] **Step 1: Add Anonymous Messages documentation.**

Document:

- three required channel mappings;
- panel/submissions may be the same or different;
- public identity hiding versus authorized staff audit visibility;
- message and reply length limits;
- `/anon deploy` syntax, permissions, prerequisites, effects, failures, and example;
- `/anon sync` syntax, permissions, prerequisites, effects, failures, and example;
- 10-minute panel refresh and automatic renumber-on-delete behavior.

- [ ] **Step 2: Keep `docs/commands.md` and `docs-site/commands.md` identical.**

```bash
cmp docs/commands.md docs-site/commands.md
```

---

### Task 6: Full verification and handback

**Files:**
- No production changes unless verification identifies a defect.

- [ ] **Step 1: Run focused feature gates.**

```bash
pytest tests/test_anonymous_message_service.py tests/test_anonymous_messages_views.py tests/test_anonymous_messages_cog.py tests/test_auto_setup_blueprint.py -q
node --test web-tests/control-anonymous-message-mappings.test.js
```

- [ ] **Step 2: Run full repository gates.**

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
python -m compileall -q src tests migrations main.py
DATABASE_URL=sqlite+aiosqlite:///./build/anonymous-messages-verify.db alembic upgrade head
node --test web-tests/*.test.js
git diff --check
```

- [ ] **Step 3: Review branch diff against the spec.**

Confirm no hardcoded guild/channel IDs, no MLBB verification dependency, no public identity leak, and all three mappings are visible in the control plane.

- [ ] **Step 4: Leave the branch unmerged and report exact verification evidence.**
