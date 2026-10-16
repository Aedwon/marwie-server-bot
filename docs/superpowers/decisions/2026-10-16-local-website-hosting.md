# Local Website Hosting Decisions

Date: 2026-10-16

## Co-locate the full web runtime with Rob-bot

The Control website is only useful while the Mac-hosted bot is available. Keeping Vercel and Neon online does not remove that dependency.

Decision: host the public site, Control API, and bot on the same M4 MacBook Air. This supersedes the Vercel/Neon production-runtime assumption in the 2026-08-27 live-control-plane design. The existing authentication, authorization, queue, audit, and stale-snapshot safety behavior remains binding.

## Use the bot's SQLite database

Once both runtimes are on one host, a network-shared database is unnecessary. The local production SQLite database already contains the Control tables.

Decision: the local website opens the bot production SQLite database directly. Do not run local PostgreSQL or keep Neon solely for the website. Keep temporary Neon compatibility only for rollback until cutover is verified.

## Keep bot and website checkouts separate

The repository historically has separate bot and website production lines. Co-location on one computer does not require merging those lines.

Decision: keep the bot checkout on `main` and run the website from a separate worktree derived from `web/rob-bot-site-production`. Share only the SQLite file and external runtime configuration.

## Use Node's built-in SQLite support

The host has Node 26, which provides `node:sqlite`.

Decision: implement the local Control database adapter with the built-in runtime instead of adding a native third-party SQLite dependency. Preserve the existing tagged-query contract and translate only the PostgreSQL syntax currently used by the API.

## Retire wake delivery only in explicit always-on mode

The Discord webhook existed to wake a sleeping Bot-Hosting deployment. The LaunchAgent-managed local bot is intended to stay running.

Decision: add an explicit `always_on` worker mode where wake delivery is a successful no-op. Keep fresh-snapshot checks and bot-side permission checks unchanged. This avoids weakening offline/stale-state safety.

## Use Cloudflare Tunnel as the public edge

Direct router port forwarding would expose the Mac's network service and require more local network hardening. A transient Quick Tunnel does not provide a stable OAuth callback hostname.

Decision: bind Node to loopback and publish it through a named Cloudflare Tunnel with a stable hostname. Cloudflare account/domain authorization is an explicit user approval step when required.

## Do not destroy Vercel or Neon during cutover

Deleting hosted resources removes an easy rollback path and may destroy retained data.

Decision: local implementation and cutover may stop using Vercel/Neon, but deletion of those resources is out of scope until the user explicitly approves decommissioning after end-to-end verification.

## Preserve relay trust boundaries

The relay blocks `launchctl` intentionally.

Decision: generate and verify LaunchAgent files through the relay, but do not invoke or hide `launchctl` through another tool. Final service bootstrap/kickstart remains an explicit local operator action.
