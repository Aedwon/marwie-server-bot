# Decision: prototype the browser control surface before backend integration

Date: 2026-08-26
Status: accepted

## Decision

Build `/control` as a static, realistic configuration prototype before migrating live bot state or implementing Discord OAuth/write APIs.

## Why

The control surface spans many existing bot capabilities. Locking the field inventory and operator layout first is cheaper and safer than building authentication, database access and Discord mutation APIs around an incomplete information architecture.

The prototype is intentionally nonfunctional. It may simulate selections, toggles, review dialogs and save actions in local browser state, but it must not communicate with Discord, Neon or Bot-Hosting.

## Design rules

- Organize by admin/moderator workflow, not code module.
- Preserve the handbook's border-light, typography/spacing-led visual system.
- Show every current resource binding and feature switch.
- Keep secrets and deployment credentials visibly outside ordinary guild configuration.
- Treat destructive or Discord-mutating operations as reviewed actions, not instant toggles.
- Prefer Discord OAuth + shared Postgres + bot-executed mutation queue for the future live implementation.

## Consequence

The Neon project may exist, but live SQLite migration and production `DATABASE_URL` changes wait until the control surface is reviewed and approved.