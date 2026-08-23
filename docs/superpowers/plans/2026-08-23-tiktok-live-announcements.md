# TikTok live announcements implementation plan

Date: 2026-08-23
Status: active
Spec: `docs/superpowers/specs/2026-08-23-tiktok-live-announcements.md`
Branch: `feat/tiktok-live-announcements`

## Goal

Deliver a bot-hosting.net-compatible `/live` command that only Mar Wie can execute and that posts a safe TikTok Live announcement through configured Discord resources.

## Dependencies

- `main` at `a3dd6cefc4cc4756736304a2c52b7be9a1ec35ba` or a descendant containing the completed V1 bot.
- Existing `ResourceService` and `FeatureConfigService` from V1.
- Existing per-guild resource table. No migration is required.
- Discord bot token and normal production configuration remain unchanged.
- `MAR_WIE_TIKTOK_URL` is optional and may be configured after merge.

## Global constraints

- Follow `AGENTS.md` and the linked spec.
- Do not redesign the linked spec while executing this plan.
- Keep Discord handlers thin.
- Use existing resource and feature configuration persistence.
- Do not add TikTok scraping or external TikTok dependencies.
- Use test-first development for feature logic.
- Do not merge this branch from the implementation session.

## File table

| Path | Action | Purpose |
| --- | --- | --- |
| `.env.example` | modify | Document Mar Wie and TikTok runtime settings. |
| `README.md` | modify | Document `/live`, resource setup, and bot-hosting.net configuration. |
| `src/marwie_bot/bot.py` | modify | Load the new live-announcements extension. |
| `src/marwie_bot/config/resources.py` | modify | Add live channel/role resources and feature name. |
| `src/marwie_bot/config/settings.py` | modify | Add Mar Wie user ID and optional TikTok URL settings. |
| `src/marwie_bot/features/live_announcements/__init__.py` | create | Mark the feature package. |
| `src/marwie_bot/features/live_announcements/service.py` | create | Own authorization and announcement-content rules. |
| `src/marwie_bot/features/live_announcements/render.py` | create | Build the Discord embed and optional TikTok link view. |
| `src/marwie_bot/features/live_announcements/cog.py` | create | Implement `/live`, resource resolution, permissions, and Discord delivery. |
| `tests/test_live_announcement_service.py` | create | Prove authorization and draft normalization behavior. |
| `tests/test_settings.py` | modify | Prove accepted default user ID and optional TikTok URL behavior. |
| `tests/test_resource_service.py` | modify | Prove new resource keys have correct resource types. |

## Task 1: Add typed configuration and domain behavior

### Files

- Modify: `src/marwie_bot/config/settings.py`
- Modify: `src/marwie_bot/config/resources.py`
- Create: `src/marwie_bot/features/live_announcements/__init__.py`
- Create: `src/marwie_bot/features/live_announcements/service.py`
- Create: `tests/test_live_announcement_service.py`
- Modify: `tests/test_settings.py`
- Modify: `tests/test_resource_service.py`

### Behavior

Add the accepted Mar Wie user ID as an environment-overridable setting, an optional TikTok URL, a dedicated feature name, a live-announcement channel resource, and an optional live-ping role resource.

The domain service must reject every user ID except the configured authorized user ID. It must normalize an optional topic without processing Discord mentions.

### Test first

Write tests covering exact-user authorization, unauthorized rejection, topic normalization, settings defaults, optional TikTok URL, and resource types.

Run:

```bash
pytest tests/test_live_announcement_service.py tests/test_settings.py tests/test_resource_service.py
```

Expected before implementation: the new imports/settings/resources do not exist or the assertions fail for the intended reason.

### Implement

Add the smallest typed configuration and service code that makes the focused tests pass.

### Verify

Run:

```bash
pytest tests/test_live_announcement_service.py tests/test_settings.py tests/test_resource_service.py
ruff check src/marwie_bot/config src/marwie_bot/features/live_announcements tests/test_live_announcement_service.py tests/test_settings.py tests/test_resource_service.py
mypy src tests
```

Expected after implementation: all commands exit 0.

## Task 2: Add the Discord `/live` command

### Files

- Create: `src/marwie_bot/features/live_announcements/render.py`
- Create: `src/marwie_bot/features/live_announcements/cog.py`
- Modify: `src/marwie_bot/bot.py`

### Behavior

Register a guild-only `/live` command with administrator default permissions and an administrator runtime check. The command must still require the exact configured Mar Wie user ID.

Resolve `live_announcements` first and fall back to `announcements`. Resolve `live_ping_role` optionally. Post an embed, include an optional TikTok link button, and restrict outgoing mentions to the configured role. Missing/stale resources and Discord delivery errors must produce ephemeral caller feedback and contextual logs.

### Test first

The extension import test must initially fail after adding the extension until the cog exists and exposes `setup`.

Run:

```bash
pytest tests/test_extension_imports.py
```

Expected before implementation: the new extension cannot import.

### Implement

Add rendering and the thin Discord cog, then add the extension to `EXTENSIONS`.

### Verify

Run:

```bash
pytest tests/test_extension_imports.py tests/test_live_announcement_service.py
ruff check src/marwie_bot/features/live_announcements src/marwie_bot/bot.py
mypy src tests
```

Expected after implementation: all commands exit 0.

## Task 3: Document deployment and setup

### Files

- Modify: `.env.example`
- Modify: `README.md`

### Behavior

Document the command, the exact accepted default Mar Wie user ID, optional TikTok URL, `live_announcements` channel mapping, optional `live_ping_role`, and bot-hosting.net environment/setup steps.

### Verify

Run:

```bash
python -m compileall -q src tests migrations main.py
```

Expected: exit 0.

## Final verification

Run the repository's full gates through GitHub Actions:

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
python -m compileall -q src tests migrations main.py
alembic upgrade head
```

All commands must exit 0 on Python 3.12 in GitHub Actions before the implementation is declared ready.

## Stop conditions

Stop if:

- the branch no longer descends from the inspected completed V1 state
- the existing resource/configuration services do not match the spec assumptions
- a schema change becomes necessary
- the exact-user authorization cannot coexist with Discord administrator command visibility
- required CI gates reveal unrelated failures that cannot be safely fixed within this file table
