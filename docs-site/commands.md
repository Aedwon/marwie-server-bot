# Rob-bot command manual

This is the canonical operating manual for Rob-bot's slash commands. It documents the behavior currently implemented in `src/marwie_bot/features/`.

Rob-bot currently registers **45 slash commands**.

## How to read this manual

Command signatures use square brackets because Discord presents slash-command inputs as named option fields:

`/command [option] [optional_option=default]`

The parameter table under each command is authoritative about which options are required or optional.

Example usage is written in a text form that mirrors Discord's option fields:

`/ban member:@Example reason:"Repeated scam links" delete_message_seconds:86400`

You do not need to type literal square brackets or quote marks into Discord. Select the command and fill the fields Discord shows.

### Confirmation applies to every slash command

Every slash command is intercepted by Rob-bot's global confirmation flow before the command callback runs.

1. Fill in the slash command and submit it.
2. Rob-bot shows an ephemeral confirmation with the command, supplied options, description, and any command-specific side-effect detail.
3. Only the person who invoked the command can press **Approve** or **Decline**.
4. **Approve** runs the command. **Decline** runs nothing.
5. The confirmation expires after 60 seconds.

This also applies to read-only commands such as `/ping`, `/rank`, `/profile`, `/leaderboard`, and `/setup status`.

`/setup auto` has an additional mutation confirmation. Its first approval allows discovery and safe binding of existing server resources. If Rob-bot proposes creating Discord resources, remapping an automatic-style binding, adding the `Solved` tag, or refreshing the self-role panel, it shows those exact changes in a second **Approve changes / Decline changes** prompt.

### Permission terms

- **Administrator** means the Discord Administrator permission.
- **Manage Server** means Discord's `Manage Guild` permission.
- **Moderate Members**, **Kick Members**, **Ban Members**, **Manage Threads**, and **Manage Channels** refer to the matching Discord permissions.
- Commands marked **Anyone** have no Rob-bot staff permission check, although normal Discord command visibility and channel access still apply.
- A command can also require permissions for Rob-bot itself. Those are called out separately.

## Command index

### System and setup

1. `/ping`
2. `/setup auto`
3. `/setup role-panel`
4. `/setup text-channel`
5. `/setup voice-channel`
6. `/setup forum`
7. `/setup category`
8. `/setup role`
9. `/setup solved-tag`
10. `/setup feature`
11. `/setup log-ignore`
12. `/setup status`

### Moderation

13. `/warn`
14. `/timeout`
15. `/kick`
16. `/ban`
17. `/unban`
18. `/history`

### Tickets and announcements

19. `/ticket-type add`
20. `/ticket-type disable`
21. `/ticket-type list`
22. `/ticket-panel post`
23. `/announce`
24. `/live`

### Reputation and build-help

25. `/rank`
26. `/profile`
27. `/leaderboard`
28. `/reputation award`
29. `/reputation thresholds`
30. `/solve`

### Quizzes and anonymous questions

31. `/quiz add`
32. `/quiz start`
33. `/quiz schedule`
34. `/anonask`
35. `/anonwho`

### Coworking and collaboration

36. `/pomodoro start`
37. `/pomodoro status`
38. `/pomodoro stop`
39. `/lfg`

### AI updates, analytics, and showcase

40. `/ai-source add`
41. `/ai-source list`
42. `/ai-source disable`
43. `/ai-source poll`
44. `/analytics`
45. `/app-of-week`

---

# System and setup

## `/ping`

**Syntax:** `/ping`

**Permission:** Anyone. This command is not restricted to a guild by Rob-bot's implementation.

**What happens:** After approval, Rob-bot reads its current Discord gateway latency, rounds it to milliseconds, and replies with `Pong. <latency>ms`.

**Parameters:** None.

**Side effects:** None beyond sending the latency response.

**Example usage:**

`/ping`

---

## `/setup auto`

**Syntax:** `/setup auto`

**Permission:** Administrator.

**Rob-bot permissions required:** View Channels, Send Messages, Embed Links, Read Message History, Manage Channels, and Manage Roles.

**What happens:** This is the recommended first-run setup command. After the first approval, Rob-bot scans the existing server for the channels, Forum Channels, categories, voice channels, and roles its features need. It normalizes case, decorative emoji, spaces, underscores, and hyphens when comparing names, and it knows explicit aliases used by the community such as `live`, `Create VC`, `Coworking`, `general-questions`, and `CO-WORKING SPACE`.

Clear existing matches are stored as resource bindings without renaming, moving, or editing the Discord objects. If multiple suitable matches exist, Rob-bot prefers the oldest matching Discord object. This helps an older founder-created channel win over a newer duplicate created by an earlier setup run.

A valid custom manual mapping whose name is outside the automatic name/alias set stays authoritative.

If discovery still requires a mutation, Rob-bot shows a second private plan before doing it. That plan can contain:

- remapping an automatic-style stored binding to a better existing match;
- creating a missing text channel, voice channel, Forum Channel, category, or role;
- adding the `Solved` tag to the selected build-help forum;
- posting or refreshing the Live Notifications self-role panel.

Pressing **Approve changes** applies only the listed mutations. Pressing **Decline changes** keeps any safe existing-resource bindings discovered during the first phase, but does not create or modify Discord resources.

Rob-bot never automatically deletes, renames, moves, or merges existing server resources. It also does not delete duplicates left by an older setup run.

**Parameters:** None.

**Important conditions:**

- Discord Community is required only when the approved mutation plan needs Rob-bot to create a new Forum Channel. Existing Forum Channels can still be discovered and bound without that creation step.
- Setup configures infrastructure. It does not invent ticket types, quiz questions, AI feed sources, or community policy choices.

**Example usage:**

`/setup auto`

---

## `/setup role-panel`

**Syntax:** `/setup role-panel`

**Permission:** Administrator.

**Rob-bot permissions required:** View Channels, Send Messages, Embed Links, Read Message History, and Manage Roles.

**What happens:** Rob-bot resolves the stored `role_panel` text channel and `live_ping_role` role, then posts or refreshes the persistent Live Notifications self-role panel. Members can use that button to add or remove the configured Live Notifications role from themselves.

**Parameters:** None.

**Prerequisites:**

- `role_panel` must point to a text channel.
- `live_ping_role` must point to an existing role.
- Rob-bot's highest role must be above the role it needs to grant/remove.

**Example usage:**

`/setup role-panel`

---

## `/setup text-channel`

**Syntax:** `/setup text-channel [key] [channel]`

**Permission:** Administrator.

**What happens:** Replaces the stored Discord resource mapping for the chosen key with the selected text channel. It does not rename, move, create, or edit the channel itself.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `key` | yes | A Rob-bot `ResourceKey` choice | Logical bot resource to bind. Keys whose stored resource type is not `channel` are rejected. |
| `channel` | yes | An existing Discord text channel | Text channel whose Discord ID will be stored for the key. |

**Recommended text-channel keys:** `moderation_log`, `message_log`, `ticket_panel`, `ticket_logs`, `announcements`, `live_announcements`, `role_panel`, `ai_updates`, `quiz_channel`, `anon_questions`, `analytics`, `app_of_the_week`, `collab_lfg`, and `bot_log`.

**Important note:** Some logical resources such as `build_help_forum`, `showcase_forum`, `create_workspace_voice`, and `coworking_lounge` also use the generic stored resource type `channel`, but their features expect a Forum Channel or voice channel at runtime. Use `/setup forum` or `/setup voice-channel` for those instead. The storage layer does not currently distinguish every Discord channel subtype.

**Example usage:**

`/setup text-channel key:announcements channel:#🚨-announcements`

---

## `/setup voice-channel`

**Syntax:** `/setup voice-channel [key] [channel]`

**Permission:** Administrator.

**What happens:** Replaces the stored channel mapping with an existing Discord voice channel. It does not edit the voice channel.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `key` | yes | A `ResourceKey` whose stored type is `channel` | Logical resource to bind. |
| `channel` | yes | Existing Discord voice channel | Voice channel whose ID will be stored. |

**Recommended keys:**

- `create_workspace_voice` for the voice channel members join to create temporary workspaces;
- `coworking_lounge` for the configured coworking lounge.

**Example usage:**

`/setup voice-channel key:create_workspace_voice channel:Create VC`

---

## `/setup forum`

**Syntax:** `/setup forum [key] [forum]`

**Permission:** Administrator.

**What happens:** Replaces the stored channel mapping with an existing Discord Forum Channel.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `key` | yes | A `ResourceKey` whose stored type is `channel` | Logical resource to bind. |
| `forum` | yes | Existing Discord Forum Channel | Forum whose Discord ID will be stored. |

**Recommended keys:** `build_help_forum` and `showcase_forum`.

**Example usage:**

`/setup forum key:build_help_forum forum:general-questions`

---

## `/setup category`

**Syntax:** `/setup category [key] [category]`

**Permission:** Administrator.

**What happens:** Replaces a stored category mapping with the selected existing Discord category.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `key` | yes | Category-valued `ResourceKey` | Must be `ticket_category` or `temp_voice_category`. Other resource types are rejected. |
| `category` | yes | Existing Discord category | Category whose Discord ID will be stored. |

**Example usage:**

`/setup category key:temp_voice_category category:CO-WORKING SPACE`

---

## `/setup role`

**Syntax:** `/setup role [key] [role]`

**Permission:** Administrator.

**What happens:** Replaces a stored role mapping with the selected existing Discord role.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `key` | yes | Role-valued `ResourceKey` | `live_ping_role`, `builder_role`, `contributor_role`, or `mentor_role`. |
| `role` | yes | Existing Discord role | Role whose Discord ID will be stored. |

Rob-bot does not grant the role merely because it was mapped. `live_ping_role` is used by the self-role panel and `/live`; Builder, Contributor, and Mentor are managed by reputation thresholds.

**Example usage:**

`/setup role key:live_ping_role role:@Live Notifications`

---

## `/setup solved-tag`

**Syntax:** `/setup solved-tag [forum] [tag_name]`

**Permission:** Administrator.

**What happens:** Looks for an already-existing Forum tag with the exact supplied name in the selected forum and stores that tag ID as `solved_tag`. It does not create a tag.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `forum` | yes | Existing Discord Forum Channel | Forum whose available tags are searched. |
| `tag_name` | yes | Text, 1 to 100 characters | Must exactly match an existing tag name, including case. |

If no tag has that exact name, the command makes no mapping change and reports that the tag was not found.

**Example usage:**

`/setup solved-tag forum:general-questions tag_name:Solved`

---

## `/setup feature`

**Syntax:** `/setup feature [feature] [enabled]`

**Permission:** Administrator.

**What happens:** Enables or disables one of Rob-bot's feature flags for the current server. Existing data and resource mappings are preserved when a feature is disabled.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `feature` | yes | One of the configured feature choices | `moderation`, `message_logs`, `tickets`, `voice`, `announcements`, `live_announcements`, `reputation`, `build_help`, `quizzes`, `anonymous_questions`, `coworking`, `ai_updates`, `analytics`, or `showcase`. |
| `enabled` | yes | Boolean `true` or `false` | `true` enables the feature; `false` disables it. |

Features default to enabled if the server has never stored an override.

**Example usage:**

`/setup feature feature:quizzes enabled:false`

---

## `/setup log-ignore`

**Syntax:** `/setup log-ignore [channel] [ignored=true]`

**Permission:** Administrator.

**What happens:** Adds or removes a text channel ID from the message-log ignore list. Ignored channels do not have edited/deleted message events mirrored to the configured `message_log` destination.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `channel` | yes | Existing Discord text channel | Source channel to include or ignore. |
| `ignored` | no | Boolean; default `true` | `true` adds it to the ignore list. `false` removes it from the ignore list. |

**Example usage:**

`/setup log-ignore channel:#moderator-chat ignored:true`

To restore logging:

`/setup log-ignore channel:#moderator-chat ignored:false`

---

## `/setup status`

**Syntax:** `/setup status`

**Permission:** Administrator.

**What happens:** Shows the current server resource mappings in an ephemeral embed. Role and channel mappings resolve to mentions when the Discord object still exists. Missing objects are marked as stale. Forum-tag mappings are shown by stored tag ID.

**Parameters:** None.

This is read-only, but the global confirmation still applies.

**Example usage:**

`/setup status`

---

# Moderation

## Moderation hierarchy rules

`/warn`, `/timeout`, `/kick`, and `/ban` all use the same target validation before the action runs:

- you cannot target yourself;
- the server owner cannot be targeted;
- unless you are the server owner, your highest role must be above the target's highest role;
- Rob-bot's highest role must also be above the target's highest role.

These four commands also require the `moderation` feature to be enabled. `/unban` and `/history` currently do not check that feature toggle.

When a moderation case is recorded, Rob-bot also attempts to post it to the configured `moderation_log` channel. Missing or unavailable audit-log configuration does not erase the database case.

## `/warn`

**Syntax:** `/warn [member] [reason]`

**Permission:** Moderate Members.

**Rob-bot permission required:** Moderate Members.

**What happens:** Validates the moderation hierarchy, records a formal `warn` moderation case, attempts to write the case to the moderation audit channel, attempts to DM the member with the server name and reason, then returns the case number privately to the moderator. A failed DM does not cancel the warning.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `member` | yes | Current member of the Discord server | Member receiving the warning. Must pass the shared hierarchy rules above. |
| `reason` | yes | Text, 1 to 1000 characters | Human-readable reason stored in the moderation case and sent in the member DM. |

**Example usage:**

`/warn member:@Example reason:"Please stop posting promotional links outside self-promo."`

---

## `/timeout`

**Syntax:** `/timeout [member] [minutes] [reason]`

**Permission:** Moderate Members.

**Rob-bot permission required:** Moderate Members.

**What happens:** Validates hierarchy, applies Discord's native member timeout until the requested number of minutes has elapsed, records a `timeout` moderation case with the expiry timestamp, attempts to audit-log the case, attempts to DM the member, and returns the case number privately.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `member` | yes | Current server member | Member to timeout. |
| `minutes` | yes | Integer from 1 to 40320 | Timeout duration in minutes. `40320` is 28 days. |
| `reason` | yes | Text, 1 to 1000 characters | Reason passed to Discord and stored in the case. |

**Example usage:**

`/timeout member:@Example minutes:60 reason:"Continued personal attacks after warning."`

---

## `/kick`

**Syntax:** `/kick [member] [reason]`

**Permission:** Kick Members.

**Rob-bot permission required:** Kick Members.

**What happens:** Validates hierarchy, attempts to DM the member before removal, kicks the member from the server, then records and audit-logs the moderation case. The member is not banned and can rejoin later if they still have a valid way to join.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `member` | yes | Current server member | Member to remove. |
| `reason` | yes | Text, 1 to 1000 characters | Reason passed to Discord and stored in the moderation record. |

A failed pre-kick DM does not stop the kick.

**Example usage:**

`/kick member:@Example reason:"Repeated disruption after staff intervention."`

---

## `/ban`

**Syntax:** `/ban [member] [reason] [delete_message_seconds=0]`

**Permission:** Ban Members.

**Rob-bot permission required:** Ban Members.

**What happens:** Validates hierarchy, attempts to DM the member with the moderation reason, then bans the member. Discord can also delete a requested amount of that member's recent message history as part of the ban. After the Discord ban succeeds, Rob-bot records and audit-logs a `ban` moderation case.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `member` | yes | Current member of this Discord server | The person to ban. Because this option is a Discord `Member`, use `/unban` by user ID for users who are already outside the server. The target must pass the shared moderation hierarchy rules. |
| `reason` | yes | Text, 1 to 1000 characters | Reason passed to Discord, stored in the moderation case, and used in the attempted pre-ban DM. |
| `delete_message_seconds` | no | Integer from 0 to 604800; default `0` | Requests deletion of messages sent by the member during the previous N seconds. `0` deletes no history. `86400` is 24 hours. `604800` is 7 days. |

**Examples:**

Ban without deleting previous messages:

`/ban member:@Example reason:"Confirmed scam campaign"`

Ban and request deletion of the previous 24 hours of the member's messages:

`/ban member:@Example reason:"Confirmed scam campaign" delete_message_seconds:86400`

---

## `/unban`

**Syntax:** `/unban [user_id] [reason]`

**Permission:** Ban Members.

**Rob-bot permission required:** Ban Members.

**What happens:** Parses the supplied Discord user ID, fetches that user from Discord, unbans the account from the current server, then records and audit-logs an `unban` case.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `user_id` | yes | Numeric Discord user ID supplied as text | ID of the banned user. Usernames, display names, and mentions are not accepted by the parser. |
| `reason` | yes | Text, 1 to 1000 characters | Reason passed to Discord and stored in the moderation case. |

This command does not use the member hierarchy validator because a banned account is no longer a guild member. The current implementation also does not check the `moderation` feature toggle before unbanning.

**Example usage:**

`/unban user_id:123456789012345678 reason:"Appeal approved by staff."`

---

## `/history`

**Syntax:** `/history [member]`

**Permission:** Moderate Members.

**What happens:** Reads up to the 10 most recent moderation cases for the selected current server member and shows them privately. Each entry includes action, moderator, reason, time, and an expiry timestamp when the case has one.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `member` | yes | Current Discord server member | Member whose moderation history should be viewed. |

This is read-only. It currently remains available even if the `moderation` feature toggle is disabled.

**Example usage:**

`/history member:@Example`

---

# Tickets and announcements

## `/ticket-type add`

**Syntax:** `/ticket-type add [key] [label] [description]`

**Permission:** Administrator.

**What happens:** Creates a new ticket type, or updates and re-enables the existing ticket type with the same normalized key. Ticket types are what members choose after pressing **Open ticket** on the ticket panel.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `key` | yes | Text, 1 to 32 characters | Trimmed and lowercased. After normalization it must start with a letter or digit and contain only `a-z`, `0-9`, `_`, or `-`. Used as the stable internal ticket type key. |
| `label` | yes | Text, 1 to 80 characters | Human-readable option label shown to members. Leading/trailing whitespace is removed. |
| `description` | yes | Text, 1 to 200 characters | Explanation shown with the ticket type. Leading/trailing whitespace is removed. |

Using the same key again updates the label/description and sets that type back to enabled.

**Example usage:**

`/ticket-type add key:bot-help label:"Bot Help" description:"Questions about building, debugging, or deploying bots."`

---

## `/ticket-type disable`

**Syntax:** `/ticket-type disable [key]`

**Permission:** Administrator.

**What happens:** Disables the matching ticket type so it no longer appears in the enabled ticket-type list or member selector. It does not delete past tickets that used that type.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `key` | yes | Text, 1 to 32 characters | Trimmed and lowercased before lookup. |

If the key does not exist, Rob-bot reports that no ticket type was found.

**Example usage:**

`/ticket-type disable key:bot-help`

---

## `/ticket-type list`

**Syntax:** `/ticket-type list`

**Permission:** Administrator.

**What happens:** Shows the server's currently enabled ticket types, ordered by label, with key, label, and description.

**Parameters:** None.

Disabled ticket types are not included in this command's output.

**Example usage:**

`/ticket-type list`

---

## `/ticket-panel post`

**Syntax:** `/ticket-panel post`

**Permission:** Administrator.

**What happens:** Resolves the configured `ticket_panel` text channel, verifies that at least one enabled ticket type exists, then posts a Support tickets embed with a persistent **Open ticket** button.

**Parameters:** None.

**Prerequisites:**

- `ticket_panel` must point to an existing text channel.
- At least one ticket type must be enabled.

**Current implementation detail:** each invocation sends a new ticket-panel message. It does not search for and edit an older panel message.

**Example usage:**

`/ticket-panel post`

### Related ticket controls

The panel and ticket buttons are Discord component interactions, not slash commands, so they do not use the slash-command Approve/Decline wrapper.

- **Open ticket:** shows an ephemeral selector containing up to 25 enabled ticket types for 120 seconds.
- A member may have only one active `open` or `claimed` ticket at a time.
- Choosing a type creates a private `ticket-<username>` text channel under the configured `ticket_category`, grants the opener access, records the ticket, and posts persistent ticket controls.
- **Claim:** requires Manage Channels or Moderate Members and records the staff member who claimed it.
- **Close:** requires Manage Channels or Moderate Members. The optional close reason is at most 1000 characters. Blank reasons become `Closed by staff.`. Closing hides the channel from the opener, prefixes its name with `closed-`, records the closure, and attempts to send a transcript of up to 500 messages to the configured `ticket_logs` channel.
- **Reopen:** requires Manage Channels or Moderate Members. It restores the opener's access and removes the `closed-` prefix when possible.

---

## `/announce`

**Syntax:** `/announce [channel]`

**Permission:** Manage Server.

**What happens:** After slash-command approval, Rob-bot opens an announcement composer modal for the chosen text channel. Submitting the modal creates an ephemeral preview. From that preview the original author can **Send**, **Edit**, or **Cancel**. The preview buttons are limited to the original author and remain active for up to 10 minutes.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `channel` | yes | Existing Discord text channel | Destination for the final announcement embed. |

**Composer fields:**

| Field | Required | Accepted input |
| --- | --- | --- |
| Title | no | Up to 256 characters. |
| Body | yes | Up to 4000 characters. |
| Footer | no | Up to 2048 characters. |
| Hex color | no | Blank for Discord blurple, or exactly six hexadecimal digits such as `5865F2`; a leading `#` is accepted. |

The final post disables all mentions, so text that looks like `@everyone`, a user mention, or a role mention will not ping anyone through this announcement path.

The `announcements` feature must be enabled. Rob-bot must also be able to send an embed in the selected destination when **Send** is pressed.

**Example usage:**

`/announce channel:#🚨-announcements`

Then fill the modal, review the preview, and press **Send**.

---

## `/live`

**Syntax:** `/live [topic]`

**Discord permission:** Administrator.

**Additional authorization:** Only the Discord account configured as Mar Wie may actually execute this command. Other administrators still fail the runtime authorization check.

**What happens:** Builds a TikTok Live announcement and posts it to the configured `live_announcements` text channel. If that mapping is unavailable, Rob-bot falls back to the general `announcements` channel. If a valid Live Notifications role is configured and Rob-bot can mention it, that role is pinged. Rob-bot never uses `@everyone` or `@here` for this command.

If `MAR_WIE_TIKTOK_URL` is configured, the announcement includes a TikTok link button. If it is not configured, the live announcement still posts without the link button.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `topic` | no | Free-text Discord slash-command string | Optional description of the current stream. Leading/trailing whitespace is removed. Empty/whitespace-only input is treated as omitted. Rob-bot adds no custom length range beyond Discord's own command input limits. |

**Prerequisites:**

- `live_announcements` feature enabled;
- either a valid `live_announcements` or fallback `announcements` text-channel mapping;
- Rob-bot can Send Messages and Embed Links there.

If the Live Notifications role exists but is not mentionable and Rob-bot lacks permission to mention it, the announcement still posts and the invoker is told that the role ping was skipped.

**Examples:**

`/live`

`/live topic:"Building an AI agent from scratch"`

---

# Reputation and build-help

## `/rank`

**Syntax:** `/rank [member]`

**Permission:** Anyone.

**What happens:** Shows a reputation profile titled `Reputation rank` with the selected member's points, numerical rank, current tier, and counts of reputation-event types. If `member` is omitted, the caller is used.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `member` | no | Current Discord server member | Member to inspect. Defaults to you. |

The result is a normal channel response after the private confirmation, not an ephemeral staff-only view.

**Example usage:**

`/rank`

`/rank member:@Example`

---

## `/profile`

**Syntax:** `/profile [member]`

**Permission:** Anyone.

**What happens:** Shows the same underlying reputation data as `/rank`, but with the `Community profile` title. Omit `member` to inspect yourself.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `member` | no | Current Discord server member | Member to inspect. Defaults to you. |

**Example usage:**

`/profile member:@Example`

---

## `/leaderboard`

**Syntax:** `/leaderboard`

**Permission:** Anyone.

**What happens:** Shows the top 10 reputation totals in the current server, ordered by rank. The response is visible in the channel after approval.

**Parameters:** None.

**Example usage:**

`/leaderboard`

---

## `/reputation award`

**Syntax:** `/reputation award [member] [points] [reason]`

**Permission:** Manage Server.

**What happens:** Adds a durable `staff_award` reputation event for the selected member. Positive values award points and negative values deduct points. After the ledger update, Rob-bot attempts to synchronize the member's configured Builder, Contributor, and Mentor roles against the current thresholds.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `member` | yes | Current server member | Member whose reputation total changes. |
| `points` | yes | Integer from `-1000` to `1000`, excluding `0` | Positive awards points; negative deducts points. Although Discord's numeric range includes zero, Rob-bot rejects zero. |
| `reason` | yes | Text, 1 to 200 characters | Stored as the source/reference for the staff award. |

Role synchronization can fail if Rob-bot cannot manage one of the configured reputation roles. The point event itself is still the authoritative reputation record.

**Examples:**

`/reputation award member:@Example points:25 reason:"Detailed answer in code-help"`

`/reputation award member:@Example points:-10 reason:"Reversal of accidental staff award"`

---

## `/reputation thresholds`

**Syntax:** `/reputation thresholds [builder] [contributor] [mentor]`

**Permission:** Manage Server.

**What happens:** Replaces the server's Builder, Contributor, and Mentor point thresholds.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `builder` | yes | Integer 1 to 100000 | Minimum points for Builder. |
| `contributor` | yes | Integer 1 to 100000 | Minimum points for Contributor. Must be above Builder. |
| `mentor` | yes | Integer 1 to 100000 | Minimum points for Mentor. Must be above Contributor. |

All three values must be distinct and strictly increasing: `builder < contributor < mentor`.

Defaults before an override are `50`, `150`, and `500`.

Changing thresholds stores the new policy. The command does not iterate through every server member immediately. Role synchronization occurs when Rob-bot next runs its member-specific reputation role sync, such as after a staff award or eligible message event.

**Example usage:**

`/reputation thresholds builder:50 contributor:150 mentor:500`

---

## `/solve`

**Syntax:** `/solve [answer_message_id]`

**Permission:** The author of the current build-help thread, or a member with Manage Threads.

**Where it works:** Only inside a thread whose parent is the configured `build_help_forum`.

**What happens:** Fetches the selected message from the current thread, records it as the accepted solution, optionally applies the configured `Solved` Forum tag, awards the answer author 10 reputation points, and posts a success response in the thread.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `answer_message_id` | yes | Numeric Discord message ID supplied as text | Message in the current thread that should be accepted as the solution. |

**Restrictions:**

- the `build_help` feature must be enabled;
- the thread must be in the configured build-help forum;
- only the thread owner or someone with Manage Threads may mark it solved;
- the ID must resolve to a message in that thread;
- a bot-authored message cannot be selected;
- a thread can only be recorded as solved once.

To obtain a message ID, enable Discord Developer Mode and use **Copy Message ID** on the answer.

**Example usage:**

`/solve answer_message_id:123456789012345678`

---

# Quizzes and anonymous questions

## `/quiz add`

**Syntax:** `/quiz add [category] [prompt] [option_a] [option_b] [option_c] [option_d] [correct] [explanation]`

**Permission:** Manage Server.

**What happens:** Stores a quiz question with exactly four answer choices. The `correct` value is converted from the human-facing 1 to 4 numbering into the internal A to D answer index.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `category` | yes | Text, 1 to 50 characters | Quiz category shown in the quiz title. |
| `prompt` | yes | Text, 1 to 2000 characters | Question text. |
| `option_a` | yes | Text, 1 to 300 characters | Answer A. |
| `option_b` | yes | Text, 1 to 300 characters | Answer B. |
| `option_c` | yes | Text, 1 to 300 characters | Answer C. |
| `option_d` | yes | Text, 1 to 300 characters | Answer D. |
| `correct` | yes | Integer `1`, `2`, `3`, or `4` | `1=A`, `2=B`, `3=C`, `4=D`. |
| `explanation` | no | Text, 1 to 2000 characters | Optional explanation posted when the quiz closes. |

Whitespace is trimmed before storage. Prompt and all four options must remain non-empty after trimming.

**Example usage:**

`/quiz add category:Python prompt:"Which keyword defines a function?" option_a:def option_b:func option_c:function option_d:lambda correct:1 explanation:"Python uses def to define a named function."`

---

## `/quiz start`

**Syntax:** `/quiz start`

**Permission:** Manage Server.

**What happens:** Resolves the configured `quiz_channel`, selects a random stored quiz question, creates a quiz session, and posts the question with A/B/C/D answer buttons. A manually started session is open for 60 minutes.

**Parameters:** None.

Correct answers award 2 reputation points. Each user can store only one answer for a given quiz session. Once the session's close time is reached, further button attempts are rejected. The background scheduler checks due sessions every 5 minutes and posts the final answer, total/correct count, and explanation if one exists.

If no quiz questions are available, the command reports that no active quiz questions are configured.

**Prerequisite:** `quiz_channel` must point to an existing text channel.

**Example usage:**

`/quiz start`

---

## `/quiz schedule`

**Syntax:** `/quiz schedule [interval_hours]`

**Permission:** Manage Server.

**What happens:** Stores the automatic quiz interval and resets the scheduler's `last_posted_at` timestamp. With background tasks enabled and the quizzes feature on, the scheduler checks every 5 minutes and posts a quiz when the configured interval is due.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `interval_hours` | yes | Integer from 1 to 720 | Number of hours between automatic quiz posts. `720` is 30 days. |

Because the command resets `last_posted_at` to empty, the first automatic quiz can be attempted on the next scheduler check instead of waiting one complete interval before the first post.

**Example usage:**

`/quiz schedule interval_hours:24`

---

## `/anonask`

**Syntax:** `/anonask [question]`

**Permission:** Anyone.

**What happens:** Stores the question together with the submitter's user ID for abuse/audit purposes, then posts only the question itself to the configured anonymous-question text channel. The public embed does not reveal the submitter and explicitly disables mention parsing. The submitter receives a private acknowledgement with the anonymous question number.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `question` | yes | Text, 10 to 4000 characters | Educational or technical question to post anonymously. |

**Prerequisites and limits:**

- `anonymous_questions` feature must be enabled;
- `anon_questions` must point to a text channel;
- default per-user daily limit is 3 questions;
- default per-user cooldown is 10 minutes;
- stored configuration is clamped to a maximum daily limit of 20 and a cooldown between 1 and 1440 minutes.

Anonymous means hidden from the public post, not unknowable to server staff. Authorized staff can resolve the author with `/anonwho`.

**Example usage:**

`/anonask question:"How do I decide whether a task should use an agent or a normal script?"`

---

## `/anonwho`

**Syntax:** `/anonwho [question_id]`

**Permission:** Moderate Members.

**What happens:** Looks up the server's stored anonymous-question record and privately shows the submitting Discord user ID. The response disables mention parsing so it does not ping the identified user.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `question_id` | yes | Positive integer, minimum `1` | Internal anonymous-question number shown on the public question embed. |

This command is intended for deliberate staff abuse/audit review.

**Example usage:**

`/anonwho question_id:12`

---

# Coworking and collaboration

## `/pomodoro start`

**Syntax:** `/pomodoro start [minutes=25]`

**Permission:** Anyone.

**What happens:** Creates a focus session for the caller in the channel where the command is used. The caller can have only one active Pomodoro session in the server at a time. Rob-bot privately reports the relative end time. A background loop checks every minute and, when the session is due, posts a completion mention in the original channel and marks the session completed.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `minutes` | no | Integer from 5 to 180; default `25` | Focus-session duration. |

The `coworking` feature must be enabled.

**Examples:**

`/pomodoro start`

`/pomodoro start minutes:50`

---

## `/pomodoro status`

**Syntax:** `/pomodoro status`

**Permission:** Anyone.

**What happens:** Privately shows when the caller's active focus session ends. It only checks the caller's own session.

**Parameters:** None.

If there is no active session, Rob-bot says so.

**Example usage:**

`/pomodoro status`

---

## `/pomodoro stop`

**Syntax:** `/pomodoro stop`

**Permission:** Anyone.

**What happens:** Cancels the caller's active Pomodoro session and marks it stopped. It does not stop another member's timer.

**Parameters:** None.

**Example usage:**

`/pomodoro stop`

---

## `/lfg`

**Syntax:** `/lfg [project] [looking_for] [link]`

**Permission:** Anyone.

**What happens:** Posts a structured collaboration embed to the configured `collab_lfg` text channel. The embed identifies the caller as the Builder, describes what they are looking for, and optionally shows the supplied project link/text. The acknowledgement sent back to the caller is private and includes the post's jump link.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `project` | yes | Text, 3 to 120 characters | Project name or short title. |
| `looking_for` | yes | Text, 3 to 500 characters | Skills, collaborator type, help, or contribution being requested. |
| `link` | no | Text, 1 to 500 characters | Optional project link. The current implementation does not validate that this field is actually a URL. |

The destination post disables mention parsing.

**Prerequisite:** `collab_lfg` must point to a text channel.

**Example usage:**

`/lfg project:"Open-source prompt evaluator" looking_for:"Python contributor to improve test coverage" link:"https://github.com/example/project"`

---

# AI updates, analytics, and showcase

## `/ai-source add`

**Syntax:** `/ai-source add [name] [url] [category]`

**Permission:** Manage Server.

**What happens:** Creates an RSS/Atom feed source for the current server. If the same exact URL already exists in that server, Rob-bot updates its name and category and re-enables it instead of creating a second source.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `name` | yes | Text, 1 to 100 characters | Human-readable source name. Trimmed before storage. |
| `url` | yes | Text, 8 to 1000 characters | Feed URL. Must parse as `http://` or `https://` and include a network host. Trimmed before storage. |
| `category` | yes | Text, 1 to 50 characters | Source category shown on posted AI-update embeds. Trimmed before storage. |

The command does not prove that the URL is a valid RSS/Atom feed at add time. Feed retrieval/parsing happens when it is polled.

**Example usage:**

`/ai-source add name:"OpenAI News" url:"https://example.com/feed.xml" category:AI`

---

## `/ai-source list`

**Syntax:** `/ai-source list`

**Permission:** Manage Server.

**What happens:** Privately lists all configured AI feed sources for the current server, including disabled sources, with source ID, name, category, on/off state, and URL.

**Parameters:** None.

Source IDs from this list are used by `/ai-source disable`.

**Example usage:**

`/ai-source list`

---

## `/ai-source disable`

**Syntax:** `/ai-source disable [source_id]`

**Permission:** Manage Server.

**What happens:** Disables the feed source with the supplied database ID if it belongs to the current server. It does not delete previously posted feed items or the source record.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `source_id` | yes | Positive integer, minimum `1` | Source ID shown by `/ai-source list`. |

If the ID is absent or belongs to another server, Rob-bot reports `Source not found.`

**Example usage:**

`/ai-source disable source_id:3`

---

## `/ai-source poll`

**Syntax:** `/ai-source poll`

**Permission:** Manage Server.

**What happens:** Uses the normal global command confirmation first. After confirmation, Rob-bot fetches every enabled AI feed source for the current server, parses each feed, considers up to the last 10 parsed items per source, removes candidates whose dedupe keys are already stored, and returns a private preview. Fetching the preview publishes nothing and does not mark candidates as posted or checked.

The preview shows exactly the bounded candidate set eligible for that Post action. Candidates that do not fit in the current complete Discord review are left untouched for a later manual poll. Choose **Post** to publish exactly the displayed candidates, or **Cancel** to close the preview with no feed mutation. The preview expires after 60 seconds; an expired preview cannot be posted.

Before **Post** publishes anything, Rob-bot rechecks Manage Server permission, the `ai_updates` feature, the current Mappings-owned `ai_updates` destination, Rob-bot's destination permissions, enabled-source state, the exact preview candidate identities, and dedupe state. If permission is lost, the feature is disabled, the destination changes or becomes unavailable, a source changes, the candidate set changes, or dedupe state changes after preview, the action fails closed and nothing new is published from that preview. Fetch a new preview before trying again.

If an unexpected publication or service failure occurs, Rob-bot closes that preview, reports a sanitized private failure, logs server-side context, and requires a new preview. Do not blindly retry the old preview. Only the **Post** button can publish a manual preview.

A feed fetch or parse failure contributes no candidates from that source to the manual preview and is logged server-side. It does not switch the command to the automatic polling path.

**Parameters:** None.

With background tasks enabled, enabled sources are still polled automatically every 30 minutes. Scheduled polling remains automatic and does not wait for a manual preview or a Post/Cancel choice.

**Example usage:**

`/ai-source poll`

---

## `/analytics`

**Syntax:** `/analytics`

**Permission:** Manage Server.

**What happens:** Privately builds an aggregate report for the previous 7 days. The report includes moderation cases, tickets opened, tickets closed, solved build-help threads, quiz answers and correct-answer count, anonymous questions, and reputation events.

**Parameters:** None.

This command reads the report on demand. Separately, the background automation checks every 6 hours whether a weekly analytics post is due in the configured `analytics` channel and whether old unanswered build-help threads should be surfaced.

**Example usage:**

`/analytics`

---

## `/app-of-week`

**Syntax:** `/app-of-week [thread]`

**Permission:** Manage Server.

**What happens:** Validates that the selected Discord thread belongs to the configured `showcase_forum` and has not already been spotlighted. It then posts an `App of the Week` embed in the configured `app_of_the_week` text channel with the thread mention, title, and current discussion message count. The selection is persisted so the same thread is not spotlighted again.

| Parameter | Required | Accepted input | Meaning |
| --- | --- | --- | --- |
| `thread` | yes | Existing Discord thread | Must be a thread under the configured showcase Forum Channel and must not already have been selected. |

**Prerequisites:** both `showcase_forum` and `app_of_the_week` must resolve to the correct Discord object types.

With background tasks enabled, Rob-bot also checks every 12 hours whether seven days have passed since the last spotlight. If one is due, it chooses the unspotlighted active showcase thread with the largest current message count.

**Example usage:**

`/app-of-week thread:My AI Study Planner`

---

# Related non-slash behavior

These are part of Rob-bot's operating surface but are not among the 45 slash commands.

## Live Notifications self-role panel

The persistent button created by `/setup role-panel` lets a member toggle the configured Live Notifications role on themselves. Builder, Contributor, and Mentor are not self-service roles. They are reputation-threshold roles.

The button checks that Rob-bot has Manage Roles, that the target role is not a Discord-managed role, and that Rob-bot's highest role is above it.

## Temporary voice workspaces

There is no slash command for creating a temporary voice workspace. When the `voice` feature is enabled and a member joins the voice channel mapped as `create_workspace_voice`, Rob-bot creates a new voice channel named `<display name>'s workspace`, normally under `temp_voice_category`, grants that member voice/channel-management permissions, records the channel, and moves them into it.

The temporary channel is deleted when it becomes empty. A reconciliation loop runs every 5 minutes so empty or manually deleted temporary channels are cleaned up after restarts or missed events.

## Message edit/delete logs

There is no slash command that manually logs a message. When `message_logs` is enabled, Rob-bot listens for message edit/delete events and mirrors them to the configured `message_log` channel unless the source channel was added to the ignore list with `/setup log-ignore`.

Full message content depends on what Discord provides to the bot and on Message Content intent/cache availability. When content is unavailable, the log explicitly marks it unavailable instead of inventing text.

## Reputation from ordinary messages

When the `reputation` feature is enabled, an eligible member message can create a `community_message` reputation event worth 1 point. Rob-bot limits this automatic message award to at most one such event per member every 10 minutes. When it awards this event, it also attempts to synchronize configured Builder, Contributor, and Mentor roles for that member.

# Keeping this manual current

`docs/commands.md` is the canonical slash-command manual. Any code change that adds, removes, renames, changes options for, changes permissions for, or materially changes the behavior of a slash command must update this file in the same change.

The command implementation remains authoritative if documentation and source ever disagree. Treat a disagreement as a documentation defect to fix, not as permission to guess at runtime behavior.
