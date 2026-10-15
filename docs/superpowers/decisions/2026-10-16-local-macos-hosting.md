# Local macOS Hosting Decisions

Date: 2026-10-16

## Replace Bot-Hosting with the user's Mac

The Bot-Hosting.net deployment and data are gone, so there is no production state to migrate or preserve.

Decision: make the user's M4 MacBook Air the bot runtime host and start with a fresh SQLite database from committed migrations.

This supersedes the active deployment assumptions in the 2026-08-25 Bot-Hosting restart-bridge design. Those documents remain historical records.

## Use a LaunchAgent, not a LaunchDaemon

A LaunchDaemon would require root-level installation and broader machine-level changes.

Decision: run Rob-bot as a user LaunchAgent. It starts at login, runs with the user's existing project/toolchain permissions, and can be unloaded without root access.

Cost: the bot is not available before the user logs in after a reboot.

## Keep secrets outside the repository and plist

The Discord token should not appear in Git, relay issues, the LaunchAgent plist, or process arguments.

Decision: keep production environment values in `~/.config/marwie-server-bot/production.env` with mode `0600`. The LaunchAgent invokes a repository helper that reads this file before starting the bot.

## Use local SQLite for the fresh deployment

The existing application already supports SQLite at `data/marwie.db`, and this host does not need multi-node database access.

Decision: use the default SQLite configuration. Do not add PostgreSQL or another managed database solely for local hosting.

## Use caffeinate only while on AC power

Changing global macOS power settings would be broader than the hosting requirement.

Decision: run the bot under `/usr/bin/caffeinate -s`. This prevents idle system sleep while the bot is running on AC power without modifying permanent power settings.

Closing the lid can still suspend the Mac and cause downtime.

## Keep application updates explicit

Automatically pulling `main` into a live bot could deploy an unverified or partially coordinated change.

Decision: do not add an auto-pull loop. Stop the service, fast-forward to the intended accepted `main`, verify dependencies/tests/migrations, then restart the service.

## Retire the Bot-Hosting control bridge

There is no deployment for the old restart workflow to control.

Decision: remove the active Bot-Hosting restart workflow and marker from the bot production line. Keep the old spec/plan/decision files as history.

## Do not bypass relay launchctl restrictions

The terminal relay deliberately blocks `launchctl` and repository policy treats that as a trust boundary.

Decision: automate file/configuration installation and verification through the runner, but leave the final `launchctl bootstrap`/`kickstart` activation as an explicit local operator step. Do not hide a `launchctl` invocation inside another permitted script to bypass the relay policy.
