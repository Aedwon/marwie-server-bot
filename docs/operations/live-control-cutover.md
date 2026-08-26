# Rob-bot live Control cutover

This runbook takes the approved `/control` UI from preview to a Discord-authenticated control plane backed by Neon Postgres without introducing paid infrastructure.

## Safety contract

- Never put `DISCORD_TOKEN`, `DISCORD_CLIENT_SECRET`, a Neon password, a Discord incoming-webhook URL, or a Bot-Hosting API key in source control or chat.
- Vercel receives Discord OAuth credentials, the private wake-webhook URL and a Neon connection string, but **never** the Discord bot token.
- Bot-Hosting receives only the wake webhook's numeric ID, not its secret URL.
- Rob-bot and Vercel must use the same Neon database after cutover.
- Do not switch `DATABASE_URL` until the SQLite migration reports `MIGRATION_VERIFIED`.
- The final SQLite snapshot is taken only while `CUTOVER_READ_ONLY=true` is active.
- Do not complete a Discord OAuth login against the empty Neon target before migration. Login creates a durable control session and would intentionally make the fail-closed migration reject that target as nonempty.
- If any verification fails, keep Rob-bot on SQLite and remove maintenance mode before retrying.

## Stable URLs

Production Control origin:

`https://rob-bot-team-guide.vercel.app`

Feature-branch preview origin used during rollout:

`https://rob-bot-team-guide-git-feat-live-83686f-aerol-balayons-projects.vercel.app`

OAuth callback paths are always:

`/api/auth/callback`

## Phase 1 — Discord OAuth and private wake webhook

In the existing Rob-bot application in the Discord Developer Portal:

1. Open **OAuth2**.
2. Copy the **Client ID** for later Vercel configuration.
3. Generate/copy the **Client Secret** for later Vercel configuration. Do not paste it into chat.
4. Add these redirect URIs exactly:
   - `https://rob-bot-team-guide-git-feat-live-83686f-aerol-balayons-projects.vercel.app/api/auth/callback`
   - `https://rob-bot-team-guide.vercel.app/api/auth/callback`
5. Save changes.

In Discord server settings, create one incoming webhook in a private staff/bot-only text channel used only to wake the control worker.

Record these separately without pasting either into chat:

- the full webhook URL for Vercel as `CONTROL_WAKE_WEBHOOK_URL`;
- the numeric webhook ID for Bot-Hosting as `CONTROL_WAKE_WEBHOOK_ID`.

The numeric ID is the number immediately after `/api/webhooks/` in the webhook URL. The bot matches only this ID. The webhook message itself has no authority to create or approve actions; it only tells Rob-bot to inspect the already-authenticated Neon queue.

The control panel requests only `identify guilds`. The bot-side worker independently rechecks membership and permissions before executing an action or publishing an on-demand fresh snapshot.

## Phase 2 — Prepare Neon while SQLite remains primary

The Neon project is `rob-bot`, database `neondb`.

Before migration:

- the target application tables must be empty;
- the migration utility upgrades the target schema itself;
- do not manually seed Rob-bot application data into the target;
- do not sign into `/control` against this target yet.

The one-shot utility is:

```bash
python tools/migrate_sqlite_to_postgres.py
```

With no target variable it only creates an atomic SQLite backup and reports source row counts.

## Phase 3 — Freeze SQLite writes and migrate

This is the only short maintenance window.

1. In Bot-Hosting, set `CUTOVER_READ_ONLY=true`.
2. Keep the existing SQLite `DATABASE_URL` unchanged.
3. Restart Rob-bot.
4. Confirm startup logs show that cutover read-only mode is enabled.
5. Confirm a slash command is rejected with the temporary read-only maintenance message.
6. Set `MIGRATION_TARGET_DATABASE_URL` in Bot-Hosting to the Neon connection string.
7. Run:

```bash
python tools/migrate_sqlite_to_postgres.py --apply
```

Do **not** continue unless every table reports:

- matching source/target row counts;
- `count=PASS`;
- `digest=PASS`;
- final `MIGRATION_VERIFIED`.

The JSON report contains row counts and fingerprints but no connection string. Keep it for the cutover record. The tool refuses to overwrite a target that already contains application rows.

When `CUTOVER_READ_ONLY=true` is active:

- slash commands are blocked;
- background schedulers and the control worker are disabled;
- SQLite application sessions run with `PRAGMA query_only=ON`.

## Phase 4 — Switch Rob-bot to Neon and enable wake handling

Only after `MIGRATION_VERIFIED`:

1. Replace Bot-Hosting `DATABASE_URL` with the Neon connection string.
2. Set `CONTROL_WAKE_WEBHOOK_ID` to the numeric Discord webhook ID from Phase 1.
3. Set `CUTOVER_READ_ONLY=false`.
4. Remove `MIGRATION_TARGET_DATABASE_URL` after the cutover if it is no longer needed.
5. Restart Rob-bot.
6. Confirm startup migrations complete and the bot reaches ready state.
7. Confirm no warning says `CONTROL_WAKE_WEBHOOK_ID` is missing.
8. Confirm the control worker publishes its initial guild snapshot and drains any already-queued actions once at startup.

The worker does **not** poll Neon continuously. After startup, Vercel wakes it through the private Discord webhook only when an action or stale-state refresh is needed. This allows Neon Free compute to scale to zero during idle periods.

Rollback rule: if the Neon-backed bot cannot start, restore the previous SQLite `DATABASE_URL`, set `CUTOVER_READ_ONLY=false`, and restart. Do not write to both databases independently and later attempt to merge them.

## Phase 5 — Configure Vercel Preview

After the production data is migrated and the Neon-backed bot is healthy, open Vercel → **rob-bot-team-guide** → **Settings** → **Environment Variables** and add these to **Preview**:

- `DISCORD_CLIENT_ID` — Discord application Client ID.
- `DISCORD_CLIENT_SECRET` — Discord OAuth Client Secret.
- `CONTROL_BASE_URL` — `https://rob-bot-team-guide-git-feat-live-83686f-aerol-balayons-projects.vercel.app`.
- `DATABASE_URL` — the same Neon `rob-bot` connection string used by Rob-bot.
- `CONTROL_WAKE_WEBHOOK_URL` — the full private incoming-webhook URL from Phase 1.

The API also accepts `CONTROL_DATABASE_URL`, but use only one database variable. `DATABASE_URL` keeps Vercel and Bot-Hosting consistent.

Redeploy the feature-branch preview after saving the variables.

## Phase 6 — Preview OAuth and control smoke test

Only now perform the first real OAuth login:

1. `/control` shows **Sign in with Discord**.
2. Discord OAuth returns to `/control` successfully.
3. Only servers where the user owns the guild, has Administrator, or has Manage Server are listed.
4. Selecting a server loads a fresh guild snapshot.
5. If the snapshot has aged past the freshness window, the request automatically queues an internal `refresh_snapshot`, wakes Rob-bot, waits briefly, and returns only after a fresh snapshot is available.
6. Make one low-risk reversible change, such as toggling a noncritical feature or remapping a test-safe resource.
7. Confirm the browser action progresses `queued → claimed → completed`.
8. Confirm Rob-bot logs one wake event and processes the queue without a two-second database polling loop.
9. Revert the smoke-test change if it was only for verification.

## Phase 7 — Vercel Production variables

After preview verification and production code approval, add the production-safe variables in Vercel for **Production**:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `CONTROL_BASE_URL=https://rob-bot-team-guide.vercel.app`
- `DATABASE_URL` with the Neon connection string
- `CONTROL_WAKE_WEBHOOK_URL` with the same private wake webhook

Redeploy production only after the implementation branch has been approved for the production deployment path.

## Phase 8 — Production smoke test

Perform these checks in order:

1. Sign in to `/control` with Discord.
2. Confirm the expected server appears.
3. Confirm the snapshot is fresh and shows Neon Postgres.
4. Confirm real channels, roles, features, ticket types, feeds and panel configuration load.
5. Wait longer than the three-minute snapshot freshness window, reload Control, and confirm an on-demand wake refreshes state without continuous Neon polling.
6. Make one low-risk reversible change.
7. Confirm the browser action progresses `queued → claimed → completed` and Discord state matches.
8. Revert the smoke-test change.

Only after these checks should higher-impact operations such as announcements, setup mutations, reputation adjustments, or role-panel posting be considered production-ready.

## Required environment variables by service

### Vercel

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `CONTROL_BASE_URL`
- `DATABASE_URL`
- `CONTROL_WAKE_WEBHOOK_URL`

### Bot-Hosting after cutover

- existing `DISCORD_TOKEN`
- `DATABASE_URL` → Neon
- `CONTROL_WAKE_WEBHOOK_ID`
- `CUTOVER_READ_ONLY=false`
- existing Rob-bot environment variables

Temporary during cutover only:

- `MIGRATION_TARGET_DATABASE_URL`

No Vercel environment needs `DISCORD_TOKEN` or Bot-Hosting credentials. Bot-Hosting does not need the wake webhook's secret URL.
