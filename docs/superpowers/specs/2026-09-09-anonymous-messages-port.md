# Anonymous Messages Port Specification

## Goal

Port the production anonymous-message interaction flow from `Aedwon/Discord-Bot` into `Aedwon/marwie-server-bot` while preserving the member-facing behavior and adapting configuration, persistence, branding, permissions, and audit handling to the newer bot architecture.

## Reference behavior to preserve

The reference feature provides:

- a persistent **Send Message** button on an anonymous-message panel;
- a modal for new anonymous messages with a 10-character minimum and 2000-character maximum;
- public top-level embeds titled `Anonymous Message #N`;
- a persistent **Reply Anonymously** button on every anonymous message and anonymous reply;
- a reply modal with a 5-character minimum and 2000-character maximum;
- Discord message references for anonymous replies;
- no allowed mentions in anonymous replies;
- a panel refresh loop every 10 minutes that keeps the panel at the bottom of its configured panel channel;
- automatic sequential renumbering after top-level anonymous-message deletions;
- administrator-only `/anon deploy` and `/anon sync` commands;
- staff-only audit logging that includes the submitting Discord identity and submitted content.

## Deliberate adaptations

### Independent Discord mappings

The target bot MUST expose three independent channel resources:

1. `anon_messages_panel` — where the sticky submission panel is posted;
2. `anon_messages_submissions` — where anonymous top-level messages and replies are posted;
3. `anon_messages_audit_log` — private staff-only destination for identity-bearing audit entries.

Panel and submissions MAY be mapped to the same channel to reproduce the reference layout exactly. They MUST remain independently configurable in the control-plane Mappings UI.

### Eligibility

The reference bot's verification check is tied to MLBB account verification and MUST NOT be copied. In the Marwie server, eligibility is determined by Discord access to the currently mapped panel/submission channels plus the anonymous-messages feature being enabled. A stale panel or reply button in a previously mapped channel MUST refuse the interaction.

### Transparency and branding

Public anonymity means the member's identity is hidden from other members, not from authorized staff. Rob-bot copy MUST say this accurately. The panel MUST disclose that authorized staff can review identity for abuse or safety handling. Public anonymous embeds MUST continue to use the server icon when available and generic `Anonymous` / `Anonymous Reply` authorship.

### Architecture

Do not copy the reference cog structure wholesale.

- Discord commands, listeners, background loops, permission checks, and response handling belong in a thin cog.
- Modal/button interaction code belongs in focused Discord UI helpers.
- Validation, numbering, deletion state, and renumber planning belong in a service.
- SQLAlchemy persistence belongs in a repository.
- Embed construction belongs in rendering helpers.
- Guild-owned state MUST include `guild_id`.
- Durable message and panel state MUST live in the database.
- Schema changes MUST use Alembic and remain SQLite/PostgreSQL portable.

## Durable data

### `anonymous_messages`

Store one row for every anonymous top-level message or reply:

- internal integer primary key;
- `guild_id`;
- submitting `user_id` for staff audit;
- public `channel_id`;
- Discord `message_id`, nullable until the Discord send succeeds;
- `kind`, one of `message` or `reply`;
- `display_number`, required for top-level messages and null for replies;
- `reply_to_message_id`, null for top-level messages and populated for replies;
- full normalized `content` up to 2000 characters;
- nullable `deleted_at` for soft deletion;
- `created_at`.

Top-level numbering is per guild. Active top-level messages are ordered by creation order and are expected to display contiguous numbers starting at 1.

### `anonymous_message_panels`

Store one row per guild:

- `guild_id` as primary key;
- current panel `channel_id`;
- current panel Discord `message_id`;
- `updated_at`.

This state allows the bot to reconcile a moved mapping or restart without losing track of the old panel.

## Posting flow

### New message

1. Member presses **Send Message** on the currently mapped panel.
2. Bot verifies the feature is enabled and all three mappings exist and resolve to text channels.
3. Bot checks its permissions to send embeds in the submissions channel and audit channel.
4. Bot opens the message modal.
5. Service strips input and rejects fewer than 10 characters or more than 2000 characters.
6. Service allocates the next per-guild display number and creates the durable record.
7. Bot posts `Anonymous Message #N` in the mapped submissions channel with the persistent reply view and no member identity.
8. Bot attaches the Discord message ID to the durable record.
9. Bot sends a staff audit embed to the mapped audit log containing author identity, public channel, content, and `Message #N` context.
10. Member receives an ephemeral success response.

If the public Discord send fails, the unposted durable record MUST be discarded so it does not consume a display number.

### Reply

1. Member presses **Reply Anonymously** on a message in the currently mapped submissions channel.
2. Bot verifies the feature remains enabled, all mappings resolve, and the clicked message is in the current submissions channel.
3. Bot opens the reply modal.
4. Service strips input and rejects fewer than 5 characters or more than 2000 characters.
5. Service creates a durable reply record with the clicked Discord message ID as `reply_to_message_id`.
6. Bot posts an `Anonymous Reply` embed as a Discord reply to the clicked message, with `AllowedMentions.none()` and the persistent reply view.
7. Bot attaches the Discord message ID and writes the staff audit entry.
8. Member receives an ephemeral success response.

Replies are not numbered and do not affect top-level numbering.

## Deletion and renumbering

- Raw single and bulk deletion listeners MUST react only to the currently mapped submissions channel for the affected guild.
- Deleted tracked records are soft-deleted by Discord message ID.
- Deleting replies MUST NOT change top-level numbering.
- Deleting a top-level message MUST queue a guild renumber pass.
- The renumber plan MUST be derived from active durable top-level records in creation order.
- Discord embed titles are edited only when the expected number differs.
- Successful edits MUST update durable `display_number` state.
- A missing Discord message discovered during sync MUST be marked deleted and excluded from the next pass.
- The automatic worker may process queued guilds serially to stay friendly to Discord rate limits.

## Sticky panel behavior

- Persistent panel and reply views MUST be registered on extension load.
- When background tasks are enabled, a 10-minute loop checks every connected guild.
- If the tracked panel is already the latest message in the currently mapped panel channel, do nothing.
- Otherwise delete the previously tracked panel when possible and post a new panel in the current mapping.
- When the panel mapping changes, the stored old `channel_id` MUST be used to remove the old tracked panel before posting the replacement.
- Missing permissions or Discord failures MUST be logged with guild/channel context.

## Admin commands

### `/anon deploy`

Administrator only. Requires all three channel mappings. Replaces the tracked panel immediately and reports the mapped panel, submissions, and audit destinations in the ephemeral confirmation.

### `/anon sync`

Administrator only. Requires the submissions mapping. Reconciles tracked top-level anonymous messages to contiguous numbering and reports total and corrected counts.

Both commands are server-only and MUST enforce permissions at runtime, not only through Discord default command metadata.

## Control-plane integration

The Channels mapping page MUST show:

- Anonymous message panel
- Anonymous submissions
- Anonymous audit log

Auto-setup MUST support all three resources. Default names:

- `anonymous-messages-panel` (public)
- `anonymous-messages` (public)
- `anonymous-audit-log` (private)

The audit log auto-created resource MUST deny `@everyone` view access using the existing private-resource provisioning behavior.

## Feature flag

Add `anonymous_messages` to `FeatureName`. It follows the repository default of enabled unless explicitly disabled.

## Security and abuse handling

- Never expose author identity in public embeds, replies, ephemeral success copy, or member-facing errors.
- Audit identity is visible only in the mapped staff channel and database records.
- Do not add a public or staff slash command that reveals identities; audit logs remain the Discord-side review surface for this feature.
- Use `AllowedMentions.none()` for anonymous public output to prevent anonymous pings.
- Validate current mappings on every persistent-view interaction so stale components cannot continue posting into old channels.

## Documentation

`docs/commands.md` MUST document `/anon deploy`, `/anon sync`, the panel/reply workflow, mapping prerequisites, staff audit visibility, and the fact that panel and submissions may be the same or different channels.

## Verification gates

Focused:

```bash
pytest tests/test_anonymous_message_service.py tests/test_anonymous_messages_cog.py tests/test_auto_setup_blueprint.py -q
node --test web-tests/control-anonymous-message-mappings.test.js
```

Full:

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
python -m compileall -q src tests migrations main.py
DATABASE_URL=sqlite+aiosqlite:///./build/anonymous-messages-verify.db alembic upgrade head
node --test web-tests/*.test.js
git diff --check
```
