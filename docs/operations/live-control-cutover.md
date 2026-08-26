# Rob-bot live Control cutover

This runbook takes the approved `/control` UI from preview to a Discord-authenticated control plane backed by Neon Postgres.

## Safety contract

- Never put `DISCORD_TOKEN`, `DISCORD_CLIENT_SECRET`, a Neon password, or a Bot-Hosting API key in source control or chat.
- Vercel receives Discord OAuth credentials and a Neon connection string, but **never** the Discord bot token.
- Rob-bot and Vercel must use the same Neon database after cutover.
- Do not switch `DATABASE_URL` until the SQLite migration reports `MIGRATION_VERIFIED`.
- The final SQLite snapshot is taken only while `CUTOVER_READ_ONLY=true` is active.
- If any verification fails, keep Rob-bot on SQLite and remove maintenance mode before retrying.

## Stable URLs

Production Control origin:

`https://rob-bot-team-guide.vercel.app`

Feature-branch preview origin used during rollout:

`https://rob-bot-team-guide-git-feat-live-83686f-aerol-balayons-projects.vercel.app`

OAuth callback paths are always:

`/api/auth/callback`

## Phase 1 — Discord OAuth

In the existing Rob-bot application in the Discord Developer Portal:

1. Open **OAuth2**.
2. Copy the **Client ID** for later Vercel configuration.
3. Generate/copy the **Client Secret** for later Vercel configuration. Do not paste it into chat.
4. Add these redirect URIs exactly:
   - `https://rob-bot-team-guide-git-feat-live-83686f-aerol-balayons-projects.vercel.app/api/auth/callback`
   - `https://rob-bot-team-guide.vercel.app/api/auth/callback`
5. Save changes.

The control panel requests only `identify guilds`. The bot-side worker independently rechecks membership and permissions before executing an action.

## Phase 2 — Vercel preview variables

In Vercel → **rob-bot-team-guide** → **Settings** → **Environment Variables**, add these to **Preview** first:

- `DISCORD_CLIENT_ID` — Discord application Client ID.
- `DISCORD_CLIENT_SECRET` — Discord OAuth Client Secret.
- `CONTROL_BASE_URL` — `https://rob-bot-team-guide-git-feat-live-83686f-aerol-balayons-projects.vercel.app`
- `DATABASE_URL` — the Neon `rob-bot` connection string for database `neondb`.

The API also accepts `CONTROL_DATABASE_URL`, but use only one database variable. `DATABASE_URL` keeps the final Vercel/Bot-Hosting configuration consistent.

After saving, redeploy the feature branch preview and verify:

1. `/control` shows **Sign in with Discord**.
2. Discord OAuth returns to `/control` successfully.
3. Only servers where the user owns the guild, has Administrator, or has Manage Server are listed.
4. Until Rob-bot is using Neon, a selected guild may correctly show no live snapshot. Do not treat that as a control failure yet.

## Phase 3 — Prepare Neon

The Neon project is `rob-bot`, database `neondb`.

Before migration:

- the target application tables must be empty;
- the migration utility upgrades the target schema itself;
- do not manually seed Rob-bot application data into the target.

The one-shot utility is:

```bash
python tools/migrate_sqlite_to_postgres.py
```

With no target variable it only creates an atomic SQLite backup and reports source row counts.

The real migration uses:

```bash
MIGRATION_TARGET_DATABASE_URL='[set as a secret/environment variable]' \
python tools/migrate_sqlite_to_postgres.py --apply
```

Success requires the final line:

```text
MIGRATION_VERIFIED
```

The JSON report contains row counts and fingerprints but no connection string.

## Phase 4 — Freeze SQLite writes

This is the only short maintenance window.

1. In Bot-Hosting, set `CUTOVER_READ_ONLY=true`.
2. Keep the existing SQLite `DATABASE_URL` unchanged.
3. Restart Rob-bot.
4. Confirm startup logs show that cutover read-only mode is enabled.
5. Confirm a slash command is rejected with the temporary read-only maintenance message.

When this flag is active:

- slash commands are blocked;
- background schedulers are disabled;
- SQLite application sessions run with `PRAGMA query_only=ON`.

This freezes Rob-bot's persistent state while leaving the process online so the source database can be copied safely.

## Phase 5 — Copy SQLite to Neon

With Rob-bot still in cutover read-only mode:

1. Set `MIGRATION_TARGET_DATABASE_URL` in the Bot-Hosting environment to the Neon connection string.
2. Run:

```bash
python tools/migrate_sqlite_to_postgres.py --apply
```

3. Do **not** continue unless every table reports:
   - matching source/target row counts;
   - `count=PASS`;
   - `digest=PASS`;
   - final `MIGRATION_VERIFIED`.
4. Keep the generated report for the cutover record.

The tool refuses to overwrite a target that already contains application rows.

## Phase 6 — Switch Rob-bot to Neon

Only after `MIGRATION_VERIFIED`:

1. Replace Bot-Hosting `DATABASE_URL` with the same Neon connection string.
2. Set `CUTOVER_READ_ONLY=false`.
3. Remove `MIGRATION_TARGET_DATABASE_URL` after the cutover if it is no longer needed.
4. Restart Rob-bot.
5. Confirm startup migrations complete and the bot reaches ready state.
6. Confirm the control worker begins refreshing guild snapshots.

Rollback rule: if the Neon-backed bot cannot start, restore the previous SQLite `DATABASE_URL`, set `CUTOVER_READ_ONLY=false`, and restart. Do not write to both databases independently and later attempt to merge them.

## Phase 7 — Vercel production variables

After the Neon-backed bot is healthy, add the same production-safe variables in Vercel for **Production**:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `CONTROL_BASE_URL=https://rob-bot-team-guide.vercel.app`
- `DATABASE_URL` with the Neon connection string

Redeploy production after the code branch is approved/merged into the production docs deployment path.

## Phase 8 — Smoke test

Perform these checks in order:

1. Sign in to `/control` with Discord.
2. Confirm the expected server appears.
3. Confirm the snapshot is fresh and shows Neon Postgres.
4. Confirm real channels, roles, features, ticket types, feeds and panel configuration load.
5. Make one low-risk reversible change, such as toggling a noncritical feature or remapping a test-safe resource.
6. Confirm the browser action progresses `queued → claimed → completed`.
7. Confirm the resulting Discord/bot state matches the browser.
8. Revert the smoke-test change if it was only for verification.

Only after these checks should higher-impact operations such as announcements, setup mutations, reputation adjustments, or role-panel posting be considered production-ready.

## Required environment variables by service

### Vercel

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `CONTROL_BASE_URL`
- `DATABASE_URL`

### Bot-Hosting after cutover

- existing `DISCORD_TOKEN`
- `DATABASE_URL` → Neon
- `CUTOVER_READ_ONLY=false`
- existing Rob-bot environment variables

Temporary during cutover only:

- `MIGRATION_TARGET_DATABASE_URL`

No Vercel environment needs `DISCORD_TOKEN` or Bot-Hosting credentials.
