# Auto setup and command confirmations specification

Date: 2026-08-25
Status: accepted for implementation

## Goal

Make first-server configuration understandable and safe. Administrators should be able to run one setup command that discovers existing Discord resources, creates only the missing resources needed by V1, stores every resulting resource ID, and explains the result. Every slash command must require an explicit Approve or Decline interaction before its callback executes.

## Command confirmation

All application slash commands are confirmation-gated, including read-only commands.

- The initial slash interaction shows an ephemeral confirmation message with `Approve` and `Decline` buttons.
- Only the user who invoked the command may use those buttons.
- Approval executes the original callback using the button interaction so existing command response code can respond normally.
- Decline executes no callback and leaves a clear declined state.
- Confirmation expires after 60 seconds and executes nothing on timeout.
- Autocomplete interactions are not confirmation-gated.
- Existing Discord permission checks and command checks run before the confirmation prompt.
- The wrapper must be installed centrally after extensions load. Feature cogs must not each implement their own generic confirmation flow.

## `/setup auto`

`/setup auto` is Administrator-only and guild-only.

The command performs an idempotent ensure operation. For each supported resource it uses this priority:

1. keep a currently configured resource when its Discord object still exists and has the expected type;
2. otherwise adopt an existing Discord object with the canonical name and expected type;
3. otherwise create the missing Discord object;
4. persist the selected Discord ID through `ResourceService`.

The command must not delete unrelated channels, categories, roles, or forum tags. It must not rename or move existing resources merely to match the suggested layout. Re-running `/setup auto` must not create duplicates when the previously selected objects still exist.

### Provisioned resources

The default V1 layout uses these canonical names:

- staff text channels: `moderation-log`, `bot-logs`, `ticket-logs`, `analytics`
- community text channels: `ticket`, `announcements`, `live-announcements`, `ai-updates`, `quizzes`, `anonymous-questions`, `app-of-the-week`, `collab-lfg`, `roles`
- forums: `build-help`, `showcase`
- voice channels: `Create Workspace`, `Coworking Lounge`
- categories: `TICKETS`, `WORKSPACES`
- roles: `Builder`, `Contributor`, `Mentor`, `Live Notifications`
- forum tag: `Solved` on the build-help forum

The canonical names are discovery hints, not an ownership claim over an administrator's existing layout.

`message_log` and `bot_log` may intentionally point to the same `bot-logs` channel. Other resource keys receive their own object unless the specification explicitly allows sharing.

The provisioner reports whether each resource was kept, adopted, or created, and identifies failures without silently continuing past an unexpected Discord error.

## Self-role panel

The bot provides a persistent role panel for opt-in roles.

V1 exposes `Live Notifications` as the first self-assignable role. Builder, Contributor, and Mentor are reputation-earned roles and must never be self-assignable.

- `/setup auto` ensures the `Live Notifications` role and `roles` channel exist and stores them as resources.
- `/setup role-panel` posts or refreshes the self-role panel in the configured `roles` channel.
- The persistent button toggles the Live Notifications role for the member who clicked it.
- The view uses a stable custom ID and is registered at startup.
- The bot validates that it can manage the role before adding or removing it.

## Resource keys

Add a channel resource key for the self-role panel destination. The existing string-backed `guild_resources` table requires no migration.

## Documentation

The README must make `/setup auto` the recommended first-run path, list exactly what it creates/adopts, explain that reruns are safe and non-destructive, explain the manual `/setup ...` commands as overrides, and document role semantics:

- `Builder`, `Contributor`, `Mentor`: reputation-earned
- `Live Notifications`: member opt-in via button
- Discord staff/admin roles: server-owned and not created or granted by the bot

## Testing

Add focused tests for the pure setup blueprint and confirmation helper behavior that can be tested without a live Discord server. Existing full verification gates remain required.
