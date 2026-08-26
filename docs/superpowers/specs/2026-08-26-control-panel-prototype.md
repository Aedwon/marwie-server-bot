# Browser control panel prototype

Date: 2026-08-26
Status: approved for prototype only

## Goal

Add a third website page at `/control` that shows the intended browser configuration surface before any browser-to-Discord or browser-to-database write path is implemented.

## Safety boundary

The prototype is static and must not:

- authenticate against Discord;
- connect to Neon;
- expose or request the Discord bot token, database password, or hosting credentials;
- mutate Discord resources;
- persist configuration;
- invoke bot commands or hosting actions.

Interactive controls may change local page state only and must visibly identify the page as a prototype.

## Information architecture

The control surface is organized by operator task:

1. Overview — identity, selected server, bot/database/permissions health.
2. Setup — auto-discovery preview and all Discord resource mappings.
3. Features — all guild feature switches.
4. Tickets — ticket types and panel prerequisites.
5. Reputation — thresholds, tier roles, manual adjustment shape.
6. Quizzes — schedule and question authoring fields.
7. Feeds — AI/RSS source configuration and diagnostics.
8. Publishing — announcement composer and live-announcement settings.
9. Logs & automation — message-log exclusions, analytics and build-help automation state.
10. Advanced — deployment-only settings, secrets boundary and restart requirements.

## Exact configuration coverage

The prototype must represent every current `ResourceKey` and `FeatureName` from `main`.

Resource mappings: 25.
Feature switches: 14.

It must also represent current command-backed configuration fields:

- ticket type key, label, description, enabled state;
- reputation Builder, Contributor and Mentor thresholds;
- reputation manual member/points/reason action shape;
- quiz category, prompt, four options, correct option, explanation and interval hours;
- AI source name, URL, category and enabled state;
- announcement channel, title, body, footer and hex color;
- live topic, destination/fallback, ping role and TikTok URL boundary;
- ignored message-log channels;
- environment/background-task/message-content status.

## UX

Use the shared handbook visual system. Avoid a wall of bordered cards. Prefer section rhythm, tonal surfaces, grouped rows, concise labels and visible state. Dense configuration groups can use rows and native disclosure where it improves scanability.

Resource selectors should look like Discord-backed selects but use mock values. Setup discovery should show matched/missing resources and a realistic review step. Mutating buttons must only display a prototype notice.

## Future live architecture

The prototype should make room for the intended live model:

- Discord OAuth session for identity and guild authorization;
- server-side API on Vercel;
- shared Neon Postgres for bot configuration/state;
- Rob-bot as the executor of Discord mutations;
- audited queued actions for changes that need the bot token.
