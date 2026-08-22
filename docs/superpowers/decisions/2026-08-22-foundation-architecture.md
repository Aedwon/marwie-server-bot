# Foundation architecture decisions

Date: 2026-08-22
Status: active

## Greenfield rebuild

The new bot will use the old `Aedwon/Discord-Bot` repository as a behavior reference only. Existing cogs and the large database initializer will not be copied as the project structure.

Cost: some proven features will take longer to port because their behavior has to be separated from old storage and unrelated systems.

## Domain-first package layout

Features will own their cog, service, repository, and feature-specific rendering or views. Shared code will stay limited to concerns that genuinely cross features.

Cost: there are more small files than a flat `cogs/` directory, but feature boundaries are visible and testable.

## SQLAlchemy 2, Alembic, SQLite first

The initial database is SQLite through SQLAlchemy's async interface. Alembic owns migrations. PostgreSQL remains a supported future target by keeping models and repository queries portable.

Cost: SQLAlchemy and Alembic add setup overhead compared with handwritten SQLite calls. The benefit is explicit migrations and a much cleaner PostgreSQL move later.

## Apply committed migrations on startup

The bot will run `alembic upgrade head` before connecting to Discord. This supports hosting environments without shell access, including the initial bot-hosting.net target.

This does not allow feature code to mutate schema at runtime. Only committed migrations are applied.

Cost: a broken migration prevents the bot from starting. That is intentional because running against an unknown schema is worse.

## Database-backed Discord resource configuration

Channel and role IDs will be stored per guild behind a resource service. Feature code uses named resource keys instead of hardcoded IDs.

Cost: the server needs an initial setup command before features that depend on configured resources can deliver their full audit output.

## Moderation history stays independent

Moderation cases will not alter reputation, XP, quiz scores, or future community contribution systems.

Cost: any later policy that wants moderation penalties to affect reputation will need an explicit new design decision.

## Minimal privileged intents

The first milestone uses only the Discord intents needed for slash-command operation. Message Content and Members privileged intents are not enabled until a feature requires them.

Cost: later message logging or passive activity features will need an explicit intent change and Discord Developer Portal configuration.
