# Local website hosting

Rob-bot's public website and Control API can run on the same M4 Mac as the Discord bot. The local origin listens only on `127.0.0.1:8787`, uses the bot checkout's SQLite database, and is intended to be exposed through a named Cloudflare Tunnel.

## Runtime layout

- Bot checkout: `~/Documents/Projects/marwie-server-bot`
- Website checkout: `~/Documents/Projects/marwie-server-bot-wt-local-web-hosting-r1`
- Shared database: `~/Documents/Projects/marwie-server-bot/data/marwie.db`
- Web environment: `~/.config/marwie-server-bot/web-production.env`
- Web LaunchAgent: `~/Library/LaunchAgents/com.aedwon.marwie-server-web.plist`
- Logs: `~/Library/Logs/marwie-server-bot/web-stdout.log` and `web-stderr.log`

The web environment is owner-only (`0600`). The LaunchAgent contains paths only and never contains OAuth secrets.

## Install and validate

From the website checkout:

```bash
node scripts/local_web_hosting.mjs install
node scripts/local_web_hosting.mjs check
```

`install` creates a template environment file only when one does not exist. It never overwrites an existing operator environment. Fill the blank `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `CONTROL_BASE_URL` values before `check` can pass.

`CONTROL_BASE_URL` is the final public HTTPS origin. The Discord OAuth redirect URI must be exactly `<CONTROL_BASE_URL>/api/auth/callback`.

Local production must set `CONTROL_WORKER_MODE=always_on` in both the web environment and the bot production environment. In this mode the always-running bot checks the durable Control queue about once per second and refreshes connected-guild snapshots about once per minute. Hosted Vercel/Neon rollback uses the backward-compatible `webhook` mode instead.

When Control reads a stale or missing snapshot, `/api/guild-state` queues or reuses an internal refresh and returns HTTP `202` immediately. The browser retries once per second for a bounded window; the request is never held open waiting for the bot, and timeout leaves Control non-actionable with an explicit unavailable state.

## Control visual review

Run the automated checks first:

```bash
npm run check:web
npm run test:web
git diff --check
```

Then capture every canonical Control route at desktop, intermediate desktop, and mobile widths in light and dark themes:

```bash
node scripts/control_visual_review.mjs \
  --base-url http://127.0.0.1:8787 \
  --out .visual-companion/control-finish-review/screenshots
```

The first run opens a headed browser with a dedicated profile at `.visual-companion/control-finish-review/brave-profile`. Sign in with Discord once. The script waits for the authenticated session and then captures the route matrix. Reuse the profile on later runs. Add `--headless` only after the profile is signed in.

The signed-in capture must use the hostname that `CONTROL_BASE_URL` points to. When the local server is published through the tunnel, sign in and capture at the public hostname. The public hostname reaches the same local server and database. A `127.0.0.1` capture does not share the session cookie set by the public OAuth callback.

Add `--edit` to include edit mode. The script captures each page-specific context drawer at intermediate and mobile widths when the route has context. Inspect the generated `manifest.json` for viewport dimensions and capture paths.

Required review coverage:

1. All 19 canonical routes.
2. Read and edit modes for every feature route.
3. Desktop light and dark themes.
4. Desktop at 1440 and 1024, mobile at 390.
5. Context open and closed where the route has context.
6. No header-only center, no reserved empty right column, no raw enum labels, no Mappings detour copy, no clipped content, and no horizontal page overflow at 390.

Fixture captures from a local fixture server are not proof of a signed-in production session. Use them for layout isolation only.

## Cloudflare Tunnel

Use a named tunnel, not a Quick Tunnel, because Discord OAuth requires a stable callback hostname. The public hostname should route only to:

```text
http://127.0.0.1:8787
```

Cloudflare authentication may require one browser approval:

```bash
cloudflared tunnel login
```

After authorization, create a named tunnel and route the chosen hostname to the local origin. Keep tunnel credentials and configuration under the user's Cloudflare configuration directory. Do not commit them.

## LaunchAgent activation boundary

The project relay intentionally does not run `launchctl`. After `install` and `check` pass, activation is an explicit local operator action:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.aedwon.marwie-server-web.plist
launchctl kickstart -k gui/$(id -u)/com.aedwon.marwie-server-web
```

Use the corresponding `bootout` command for rollback. Do not replace this boundary with a hidden process-kill or service-manager workaround.

## Cutover verification

Before treating local hosting as production, verify in order:

1. `http://127.0.0.1:8787/healthz` returns healthy locally.
2. Control, Commands, and Handbook pages load locally.
3. The named Cloudflare hostname serves the same pages over HTTPS.
4. Discord OAuth signs in and returns to `/api/auth/callback`.
5. Control displays a fresh bot snapshot.
6. One low-risk Control write is queued, consumed by the local bot, and reflected back in Control.
7. After more than 60 seconds without a Discord wake webhook, Control still reports a fresh snapshot.

Fresh-snapshot gating remains active. If the Mac or bot is offline, Control must fail safely instead of applying stale state.

## Promotion checks

Promote the Control redesign only after the route-by-route visual review is accepted. In order:

1. Confirm the finish branch is based on production and contains no bot deploy or `main` change.
2. Run `npm run check:web`, `npm run test:web`, and `git diff --check`.
3. Confirm the real authenticated capture completed against the local server, using the hostname that matches `CONTROL_BASE_URL`.
4. Record the accepted screenshot folder and any accepted exceptions in the finish decision record and plan acceptance table.
5. Merge to the production website branch.
6. Integrate into the local hosting checkout without resetting its local runtime edits.
7. Run `node scripts/local_web_hosting.mjs check` and `curl -fsS http://127.0.0.1:8787/healthz`.
8. Repeat the signed-in Control smoke check on the Cloudflare hostname.

## Rollback and hosted infrastructure

Vercel and Neon remain untouched during migration so they can serve as a rollback path. Do not delete either service until local public hosting and OAuth have been verified end to end and the user separately approves decommissioning.
