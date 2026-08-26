# Live browser control plane

Date: 2026-08-27
Status: approved for implementation
Supersedes: prototype-only safety boundary in `2026-08-26-control-panel-prototype.md` for the new live implementation branch only.

## Goal

Turn the approved `/control` prototype into an authenticated browser control plane for Rob-bot without exposing the Discord bot token to the browser or Vercel runtime.

The public handbook and command manual remain public. `/control` requires Discord authentication before server data is returned or actions are accepted.

## Architecture

Use the following free-tier architecture:

- Vercel serves the website and server-side OAuth/control API.
- Discord OAuth identifies the operator and the guilds they can administer.
- Neon Postgres is the shared durable database.
- Rob-bot remains the only component that holds the Discord bot token and executes Discord mutations.
- Browser mutations are inserted as audited control actions in Neon.
- Rob-bot claims queued actions, re-checks the actor against the live guild and required Discord permissions, executes through existing domain services/repositories, and records the result.
- The browser polls action state and refreshes live configuration after completion.

Vercel must never receive or store the Discord bot token.

## Authentication and authorization

Use Discord OAuth2 authorization-code flow with `identify guilds` scopes.

- Protect OAuth callback state.
- Create an HTTP-only, Secure, SameSite=Lax application session after callback.
- Store only a random opaque session identifier in the browser cookie.
- Durable session records live in Neon and expire automatically.
- Store Discord OAuth credentials server-side only. Never expose access/refresh tokens to browser JavaScript.
- A server is selectable only when the OAuth result shows the operator has Administrator or Manage Server permission and Rob-bot is installed in the guild.
- Every queued mutation contains `guild_id` and `actor_id`.
- Rob-bot re-checks the actor's current guild membership and permissions before executing the mutation. A stale browser session can therefore never bypass current Discord permissions.

Read endpoints may rely on the short-lived authenticated session plus guild authorization. Mutations always require the bot-side live permission check.

## CSRF and request safety

- Generate one CSRF secret per control session.
- Expose a derived CSRF token to authenticated page JavaScript through the session endpoint.
- Require the token on every state-changing Vercel API request.
- Reject cross-origin mutation requests.
- Validate action payloads server-side before queueing.
- Rate-limit mutation creation per session/guild.
- Use idempotency keys for browser submissions so retries do not duplicate Discord actions.

## Shared database and migration

The current production bot uses SQLite. Neon becomes the production database only after a verified staged migration.

Add a one-shot migration utility that can run while SQLite is still primary:

1. connect to the current SQLite database;
2. create/upgrade the target Neon schema with Alembic;
3. copy all durable application tables transactionally where possible;
4. preserve primary keys and timestamps;
5. repair PostgreSQL sequences after explicit-ID copy;
6. compare row counts and selected configuration invariants;
7. stop without changing the bot's active `DATABASE_URL`.

Cutover is manual and explicit. Only after migration verification does the operator replace Bot-Hosting `DATABASE_URL` with the Neon async SQLAlchemy URL and restart Rob-bot.

The migration utility must be rerunnable only when the target is empty or when an explicit safe-retry mode is selected. It must never silently merge conflicting production records.

## Control action model

Persist browser mutations in a `control_actions` queue with at least:

- unique action ID;
- guild ID;
- actor Discord user ID;
- action type;
- validated JSON payload;
- idempotency key;
- queued/claimed/completed/failed/rejected status;
- created, claimed and finished timestamps;
- worker identity/version where available;
- sanitized result JSON;
- safe user-facing error;
- internal error reference.

The queue is also the durable mutation audit trail. Destructive or security-sensitive actions must retain enough sanitized context to explain what changed and who requested it.

Rob-bot claims actions atomically so one action is never executed by two workers.

## Live reads

The authenticated control state endpoint should return one guild-scoped snapshot containing the fields represented by the approved prototype:

- guild identity and bot health;
- Rob-bot permission/hierarchy diagnostics;
- all 25 resource mappings and their resolved Discord objects;
- all 14 feature switches;
- ticket types;
- reputation thresholds;
- quiz schedule and question metadata needed by the editor;
- AI feed sources and poll health;
- announcement/live destinations and current publishing defaults;
- message-log exclusions;
- notification role-panel configuration;
- deployment-safe advanced state.

Do not return secrets, database URLs, tokens, or anonymous-identity audit data.

## Supported mutations

Wire every editable prototype workflow.

### Setup

- discover existing resources;
- review proposed create/remap/tag operations;
- bind/rebind/clear allowed resource mappings;
- apply reviewed auto-setup changes;
- manage message-log exclusions;
- refresh or save the notification role panel.

Resource creation/remapping must preserve the current two-stage setup safety contract. Discovery may be read-only. Any Discord mutation is a queued action with final browser confirmation.

### Features

Enable/disable all current feature switches while preserving prerequisites.

### Tickets

Create, update, enable/disable ticket types and refresh/post the ticket panel through existing ticket services.

### Reputation

Update Builder/Contributor/Mentor thresholds and queue manual reputation adjustments with member, points and reason.

### Quizzes

Update schedule interval and add quiz questions using the same validation rules as slash commands.

### Feeds

Create/update/enable/disable AI sources and request an immediate poll.

### Publishing

- send announcements with destination, optional message/mentions, embed title/body/footer/color;
- post Live notices with destination/fallback, ping role, topic and configured TikTok URL.

Mention handling is allow-list based. Resolve explicit users/roles and `@everyone`/`@here` server-side. Never pass arbitrary browser text into unrestricted `AllowedMentions`.

### Notification role panel

Replace the current one-button hard-coded model with durable guild configuration for:

- target channel;
- title;
- description;
- ordered role-button rows;
- Discord role per row;
- label;
- optional emoji;
- supported Discord button style.

The persistent Discord view must be reconstructed on startup from database configuration. Button interactions must only toggle their configured role and must fail safely if the role becomes invalid or unmanageable.

## Action permissions

Each action type has an explicit required Discord permission. At minimum:

- setup/resource/feature/ticket/reputation/quiz/feed/panel administration: Manage Server unless existing slash-command behavior requires Administrator or another stronger permission;
- moderation-style reputation adjustments preserve current command permission checks;
- channel creation/editing also checks Rob-bot `Manage Channels`;
- role creation/assignment also checks Rob-bot `Manage Roles` and hierarchy;
- publishing preserves current announcement/live permission contract.

Do not weaken existing slash-command permission rules to make browser actions easier.

## Vercel API surface

Keep the static UI. Add server-side endpoints under `/api` for:

- OAuth start;
- OAuth callback;
- logout;
- current session/server list;
- guild control-state snapshot;
- setup discovery/review;
- create control action;
- fetch action status.

Use a small shared API data-access/auth module instead of duplicating SQL/session logic across handlers.

## UI behavior

Reuse the approved prototype visual design.

- Replace mock identity/server state with authenticated state.
- Disable the editor until a valid guild is selected and live state has loaded.
- Populate channel/role/member selectors from live Discord-resolved state returned by the server/bot projection.
- Keep dirty/valid state locally.
- Final confirmation creates one queued action.
- Show queued/running/succeeded/failed state inline without losing form context.
- Refresh affected control state after success.
- Preserve live Discord-style publishing/panel previews.

## Deployment-only settings

The browser must not expose or edit:

- Discord bot token;
- Neon/database password or full connection string;
- Discord OAuth client secret;
- Vercel session/encryption secrets;
- Bot-Hosting API credentials.

Advanced may show only safe status such as environment name, database backend, worker heartbeat, background-task state and whether required secrets are configured.

## Verification and cutover

Before production cutover:

1. focused unit tests for auth/session/CSRF/action validation;
2. focused bot tests for queue claiming, permission rejection and action dispatch;
3. notification-panel persistence/view tests;
4. migration tests from a populated SQLite fixture into PostgreSQL-compatible schema behavior where locally executable;
5. full repository verification gates;
6. Neon schema and migration row-count verification;
7. preview OAuth/control smoke test on a non-production callback URL where possible;
8. production secrets configured;
9. explicit SQLite → Neon migration run and verification;
10. explicit Bot-Hosting `DATABASE_URL` cutover and restart;
11. post-restart bot/database/queue health verification;
12. production `/control` login, read and one low-risk write smoke test.

Do not merge/cut over if migration verification, OAuth authorization, CSRF checks, bot permission re-checking, or queue idempotency are unresolved.
