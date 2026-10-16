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

Fresh-snapshot gating remains active. If the Mac or bot is offline, Control must fail safely instead of applying stale state.

## Rollback and hosted infrastructure

Vercel and Neon remain untouched during migration so they can serve as a rollback path. Do not delete either service until local public hosting and OAuth have been verified end to end and the user separately approves decommissioning.
