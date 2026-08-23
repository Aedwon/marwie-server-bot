# TikTok live announcement decisions

Date: 2026-08-23
Status: active

## Manual trigger instead of TikTok detection

Rob-bot will use a manual `/live` command for the first version. It will not depend on TikTok scraping, unofficial LIVE libraries, or a third-party webhook service.

Cost: Mar Wie must invoke one Discord command after starting a TikTok Live. The benefit is predictable behavior on bot-hosting.net and no dependency on an unstable or paid integration.

## Exact Mar Wie user ID is authoritative

The command is authorized only for Discord user ID `703986808962285621`. Discord administrator default permissions are used for visibility and an administrator runtime check is retained, but the exact user-ID check decides whether a live announcement may be published.

Cost: if Mar Wie changes Discord accounts, `MAR_WIE_USER_ID` must be updated. The setting remains environment-overridable so this does not require a code change.

## Dedicated live resources with safe fallback

A new `live_announcements` channel resource will be preferred. If it is not configured or is stale, Rob-bot may fall back to the existing `announcements` channel resource.

A separate optional `live_ping_role` resource controls notification pings. Rob-bot will not use `@everyone` or `@here` for this feature.

Cost: administrators who want the dedicated channel and opt-in ping must configure up to two resources with existing `/setup` commands.

## TikTok link is runtime configuration

`MAR_WIE_TIKTOK_URL` is optional runtime configuration. When set, Rob-bot includes a `Watch on TikTok` link button. When unset, `/live` still posts the announcement without a button.

Cost: the initial deployment can work before the URL is supplied, but the best member experience requires the URL to be configured on bot-hosting.net.

## No live-session persistence

Each authorized `/live` invocation publishes one announcement. The bot does not persist live state, deduplicate streams, or track stream endings in this version.

Cost: Mar Wie can intentionally or accidentally invoke the command more than once for the same stream. Avoiding a new state model keeps the feature small and reliable; durable stream lifecycle tracking can be designed later if it becomes necessary.
