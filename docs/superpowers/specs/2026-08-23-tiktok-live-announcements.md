# TikTok live announcements spec

Date: 2026-08-23
Status: accepted

## Goal

Add a manual `/live` command that lets Mar Wie announce the start of his TikTok livestream through Rob-bot with one Discord command.

## Context

A large share of the community joins after watching Mar Wie on TikTok Live. Discord should provide a reliable bridge from a new livestream to the server without depending on unofficial TikTok scraping or a paid third-party detector.

The bot is hosted on bot-hosting.net. The implementation must continue to work with the repository's environment-driven settings and startup migration flow.

Mar Wie's Discord user ID is `703986808962285621`.

## Scope

Included:

- A guild-only `/live` slash command.
- Discord default command visibility restricted to administrators.
- Runtime authorization restricted to Mar Wie's exact Discord user ID.
- A dedicated `live_announcements` channel resource with fallback to the existing `announcements` resource.
- An optional `live_ping_role` resource. If configured and mentionable by the bot, the announcement pings it.
- An optional short stream topic supplied with `/live`.
- An optional configured TikTok URL. When present, the announcement includes a `Watch on TikTok` link button.
- A dedicated live-announcements feature toggle.
- Operator-facing logs for successful posts, authorization failures, stale resources, and Discord delivery failures.
- bot-hosting.net-compatible environment configuration and README setup instructions.

Not included:

- Automatic TikTok LIVE detection.
- TikTok scraping, unofficial TikTok libraries, or third-party webhook subscriptions.
- Livestream end tracking.
- Livestream history or analytics tables.
- `@everyone` or `@here` pings.
- A new database table or migration.

## User behavior

`/live` accepts an optional `topic` string.

Discord should expose the command to administrators by default. The command must still enforce an exact user-ID check at runtime. An administrator other than Mar Wie receives an ephemeral denial and no announcement is sent.

When Mar Wie invokes `/live`:

1. Rob-bot confirms the live-announcements feature is enabled.
2. Rob-bot resolves `live_announcements`. If it is not configured, it falls back to the existing `announcements` channel resource.
3. Rob-bot creates a TikTok Live embed. The embed includes the topic when supplied.
4. If `live_ping_role` is configured and can be mentioned, Rob-bot pings that role only.
5. If `MAR_WIE_TIKTOK_URL` is configured, the message includes a `Watch on TikTok` link button.
6. Rob-bot sends an ephemeral success response naming the destination channel.

If no usable destination is configured, the command fails ephemerally with setup guidance and does not post elsewhere.

The announcement must not mention users, `@everyone`, or `@here` through user-supplied text.

## Data and persistence

No new schema is required.

`live_announcements` and `live_ping_role` use the existing per-guild resource configuration table and `ResourceService`.

The authorized Discord user ID is a runtime setting named `MAR_WIE_USER_ID` with the accepted default `703986808962285621`.

The TikTok destination is the optional runtime setting `MAR_WIE_TIKTOK_URL`. An empty value means the announcement is posted without a link button.

The command does not persist a live/not-live state. Each authorized invocation represents an intentional request to publish one live announcement.

## Architecture constraints

The Discord cog owns slash-command decorators, Discord permission checks, resource resolution, channel/role objects, Discord responses, and delivery errors.

A small domain service owns exact-user authorization and normalized announcement content.

Discord embed and link-button construction stays in a rendering module so it is separate from domain behavior.

Existing `ResourceService` and `FeatureConfigService` remain the persistence boundary. No raw SQL is added.

## Permissions and abuse controls

- `/live` has Discord `administrator` default permissions and an administrator runtime permission check.
- Exact authorization additionally requires `interaction.user.id == MAR_WIE_USER_ID`.
- The user-ID check is authoritative. Other administrators cannot publish a live announcement through this command.
- Unauthorized failures are ephemeral.
- Only the configured `live_ping_role` may be mentioned by the outgoing message.
- User-supplied topic text is placed in an embed and never used as raw mention content.
- Rob-bot must have Send Messages and Embed Links in the destination channel.
- If a configured ping role cannot be mentioned by Rob-bot, the live announcement still posts without the ping and the caller is told about the skipped ping.

## Failure and recovery

A missing or stale `live_announcements` resource falls back to a valid `announcements` resource. If neither resolves to a text channel, the command stops with an ephemeral configuration error.

Discord `Forbidden` and `NotFound` delivery failures are reported ephemerally and logged with guild/channel context.

A restart requires no reconciliation because the feature has no live-session state.

An unset TikTok URL does not block the announcement. It only removes the link button.

## Observability

Log:

- successful live announcements with guild ID, destination channel ID, and invoking user ID
- unauthorized `/live` attempts with guild ID and user ID
- stale configured channel or role IDs
- Discord delivery failures with contextual exception logging

Do not log tokens, secrets, or message content beyond the optional topic needed for Discord output.

## Testing

Before completion, prove:

- the accepted Mar Wie user ID is authorized
- another administrator/user ID is rejected by domain authorization
- topic whitespace is normalized
- a blank topic behaves as no topic
- default settings contain Mar Wie's accepted user ID
- the TikTok URL setting accepts blank/unset configuration
- the new resource keys have the expected channel/role types
- the new cog imports through the extension list
- repository CI passes tests, lint, formatting, type checking, compilation, and clean Alembic upgrade

## Open questions

None required for implementation. The real TikTok URL can be configured later on bot-hosting.net without a code change.

## Accepted decisions

See `docs/superpowers/decisions/2026-08-23-tiktok-live-announcements.md`.
