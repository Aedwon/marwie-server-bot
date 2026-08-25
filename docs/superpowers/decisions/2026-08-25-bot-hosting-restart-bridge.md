# Bot-Hosting Restart Bridge Decisions

Date: 2026-08-25

## Use restart + Auto Pull instead of sync

Bot-Hosting.net exposes both a power restart endpoint and a sync endpoint.

The sync endpoint requires `deployments:write`, which also authorizes broader deployment modifications. The restart endpoint requires only `deployments:power`.

Decision: use `POST /deployments/:id/power` with `{"action":"restart"}` and rely on Bot-Hosting.net Auto Pull to fetch the latest linked `main` branch during restart.

This keeps the stored credential narrower.

## Use a dedicated operations branch

A workflow tied directly to every push on `main` would consume Actions minutes even when a restart is not wanted. A manual-only workflow cannot currently be dispatched directly through the available GitHub connector in this chat.

Decision: use `ops/bot-hosting-restart` with a single marker file. Updating the marker is the machine-triggerable restart signal.

This produces small isolated operations commits and avoids adding restart-only commits to `main`.

## Store deployment ID as a secret too

The deployment ID is not equivalent to an API credential, but using repository secrets for both required values keeps owner setup in one GitHub screen and avoids adding deployment-specific identifiers to repository files.

Decision: use `BOT_HOSTING_API_KEY` and `BOT_HOSTING_DEPLOYMENT_ID` repository secrets.

## Do not modify normal CI

The repository's existing CI is comparatively expensive because it installs dependencies and runs tests, linting, formatting, typing, compilation, and migrations.

Decision: keep the restart bridge in a separate minimal workflow with no checkout and no dependency installation. Restart-only operations must not trigger normal CI.
