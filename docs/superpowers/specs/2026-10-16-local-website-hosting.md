# Local Website Hosting Spec

Date: 2026-10-16
Status: Accepted for implementation

## Problem

Rob-bot now runs continuously on the user's M4 MacBook Air with a local SQLite production database, while the website and authenticated Control backend still run on Vercel and depend on Neon Postgres. The user wants the entire website and Control runtime moved to the same Mac.

## Goals

- Host the public website, command manual, handbook, Discord OAuth flow, and Control API on the M4 Mac.
- Use the same local SQLite database as the running Discord bot.
- Remove Vercel and Neon from the required production runtime path.
- Preserve the existing Control security model: Discord OAuth, HTTP-only sessions, CSRF, same-origin mutation checks, browser permission checks, bot-side live permission checks, idempotency, rate limiting, and fresh-snapshot gating.
- Expose only the local web service through Cloudflare Tunnel.
- Bind the local origin to loopback only.
- Keep secrets outside Git, relay issues, process arguments, and generated plists.
- Keep Vercel/Neon available only as rollback infrastructure until local production is verified. Their deletion is a separate explicit decommissioning action.

## Architecture

Production topology after cutover:

```text
Internet
  -> Cloudflare HTTPS/Tunnel
  -> 127.0.0.1:8787 local Node web service
       -> static docs-site pages and assets
       -> existing /api OAuth and Control handlers
       -> ~/Documents/Projects/marwie-server-bot/data/marwie.db
            <- Rob-bot local LaunchAgent
                 -> Discord
```

The bot production checkout remains `~/Documents/Projects/marwie-server-bot`. The website runs from a separate checkout/worktree based on `web/rob-bot-site-production` so the repository's bot and website production lines remain isolated.

## Local HTTP service

Add a repository-owned Node HTTP server for local production. It must:

- bind to `127.0.0.1` by default;
- default to port `8787`;
- expose a minimal `/healthz` endpoint without secrets;
- serve `docs-site` with the existing clean routes for `/`, `/control`, `/commands`, and `/handbook`;
- serve static assets only from inside `docs-site`;
- route only an explicit allow-list of `/api` handlers;
- preserve the handler request/response contract used by the existing Vercel functions;
- return safe 404/405 responses for unknown routes;
- prevent path traversal and arbitrary module imports.

Cloudflare terminates public TLS. The Node service does not listen on LAN/WAN interfaces.

## SQLite backend

The website uses Node 26's built-in `node:sqlite` support when `CONTROL_SQLITE_PATH` is configured. The existing Neon backend remains supported temporarily for rollback.

The SQLite adapter must preserve the current tagged-SQL call contract and safely bind values. It must account for the small set of PostgreSQL syntax used by Control, including JSON casts, timestamp casts, interval expressions, and the named idempotency constraint form. Returned `*_json` columns must be decoded to JavaScript values so existing handlers keep their current contracts.

The adapter must set a bounded SQLite busy timeout and enable foreign-key enforcement. It must not create or mutate schema at normal web startup. Alembic remains the schema authority.

The production database path is the bot checkout's existing `data/marwie.db`, which already contains the Control tables.

## Always-on worker behavior

The Bot-Hosting wake webhook is not part of local production. Add an explicit always-on worker mode for the local website. In that mode, wake requests are treated as already satisfied because Rob-bot is managed by its LaunchAgent.

Fresh snapshot checks remain mandatory. If the bot is offline or stale, Control must continue to reject or time out safely. Removing the wake webhook must not make stale state actionable.

## Authentication and secrets

Keep the existing Discord OAuth authorization-code flow and cookie behavior. The public callback is `<CONTROL_BASE_URL>/api/auth/callback`.

Local web secrets live outside Git in `~/.config/marwie-server-bot/web-production.env` with mode `0600`. At minimum it contains:

- `DISCORD_CLIENT_ID`;
- `DISCORD_CLIENT_SECRET`;
- `CONTROL_BASE_URL`;
- `CONTROL_SQLITE_PATH`;
- `CONTROL_WORKER_MODE=always_on`;
- local host/port settings when defaults are changed.

The installer may create a template but must never overwrite an existing environment file or print secret values.

## macOS service model

Add a website hosting helper with `install`, `check`, and `run` operations, following the existing bot-local-hosting pattern. It renders a user LaunchAgent without activating it. The LaunchAgent starts at login, restarts on unexpected exit, runs from the website checkout, and writes durable logs under `~/Library/Logs/marwie-server-bot/`.

A separate Cloudflare Tunnel configuration may also be rendered after Cloudflare authorization is available. Relay policy forbids bypassing `launchctl`; final LaunchAgent activation remains an explicit operator step.

## Cloudflare Tunnel

Use a named Cloudflare Tunnel for a stable hostname. Route only the public website hostname to `http://127.0.0.1:8787`. The tunnel configuration and credential file live outside Git under the user's Cloudflare configuration directory.

Cloudflare account/domain authorization may require one explicit browser approval from the user. Do not place Cloudflare credentials in Git or relay issues. A temporary Quick Tunnel is not production because its hostname is not stable enough for Discord OAuth.

## Cutover

Keep the existing Vercel site and Neon database intact during verification. Cutover order:

1. verify the local website/API against an isolated SQLite fixture;
2. verify read-only local startup against the real production SQLite file;
3. authorize and configure the named Cloudflare Tunnel;
4. configure the Discord OAuth redirect for the final public hostname;
5. start the local website and tunnel services;
6. verify public pages, OAuth login, Control read, and one low-risk Control write end to end;
7. only after successful verification, remove Vercel/Neon from active operational documentation;
8. deleting the Vercel project or Neon project/data requires separate explicit authorization.

## Verification

Implementation verification must include:

- RED/GREEN unit tests for SQLite query translation, JSON decoding, and safe binding;
- RED/GREEN tests for local route mapping, static-file confinement, health response, and API dispatch;
- RED/GREEN tests for always-on wake semantics while retaining stale-snapshot protection;
- RED/GREEN tests for local hosting environment/plist generation without secret leakage;
- the complete existing web test suite;
- `npm run check:web`;
- local HTTP smoke tests on loopback;
- SQLite smoke queries against a disposable database created from current migrations;
- confirmation the production SQLite Control tables exist before cutover;
- public Cloudflare and Discord OAuth smoke tests after the user authorizes the required account/domain step.

No Vercel or Neon production resource is deleted as part of implementation.
