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

The ordering above is stable unless a later product decision changes it. The current review found the task grouping and ordering useful; refinement work should improve interaction and visual hierarchy without arbitrarily regrouping the page.

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

## Visual system

Use the shared handbook visual system. Avoid a wall of bordered cards. Prefer section rhythm, tonal surfaces, grouped rows, concise labels and visible state. Dense configuration groups can use rows and native disclosure where it improves scanability.

Structure must be communicated in this order:

1. layout and spacing;
2. typography and value hierarchy;
3. tonal surfaces;
4. color only when it communicates state or action.

Use only three broad surface levels: page base, raised editable/action surface, and subtle inset/preview surface. Do not add decorative borders to compensate for weak hierarchy.

Color must be restrained. Healthy, review, missing and error states may use small accents, dots, labels or chips; large colored status cards are not appropriate for routine setup state. Primary actions should be visually distinct without relying on a loud pastel fill.

## Control affordance

Editable values must be immediately distinguishable from static text without relying on traditional outlined fields.

Inputs, selects and textareas should use:

- a clearly different filled surface from surrounding static content;
- consistent control height and internal padding;
- visible placeholder or selected value;
- explicit chevrons for selects;
- hover/focus tonal changes;
- a restrained focus ring or glow;
- disabled styling that reads as unavailable, not simply faded text.

Selected values may use chips. Actions must not look identical to selected-value chips. In particular, `+ Add` controls are action buttons and require a distinct visual treatment.

## Stateful actions

Buttons must reflect whether an action is currently meaningful.

- No relevant changes or unmet prerequisites: disabled and visually quiet.
- Valid pending changes: enabled and visually prominent for that local context.
- Prototype action invoked: show review/preview state only; never perform a remote write.
- Success/error states may be simulated locally only where useful for reviewing final UX.

The prototype should track dirty and validity state for representative editors, including resource mappings, role-panel dependencies, reputation thresholds/manual adjustment, quiz question authoring, feed source creation, publishing and log exclusions.

## Setup refinement

Setup discovery should use a compact status strip rather than large colored summary cards. The status strip must preserve counts for matched, review and missing resources while keeping review/missing as small status accents.

Resource mappings should prioritize:

1. human-readable purpose;
2. selected Discord resource;
3. resource type;
4. raw internal key as secondary metadata;
5. mapping state/change indication.

Raw keys such as `ticket_panel` or `message_log` must not dominate the list. Group labels remain because they improve scanability, but row chrome should be minimal.

The `Refresh role panel` action depends on `role_panel` and `live_ping_role`. It should be disabled at rest and become actionable when either mapping changes and both dependencies are valid.

## Publishing preview

Publishing must show an actual mock Discord output, not a generic prototype-warning modal.

The announcement preview should reflect, at minimum:

- destination channel;
- title;
- body;
- embed color;
- footer.

The live preview should reflect, at minimum:

- destination/fallback channel;
- ping role when selected;
- optional topic;
- TikTok button availability boundary.

On desktop the preview may sit beside the editor; on narrow screens it should stack below. The prototype disclaimer should remain visible but subordinate to the preview itself.

## Review-first flows

Setup, publishing and other consequential actions should model the intended sequence:

1. edit or discover;
2. preview/review;
3. confirm;
4. apply in the future live implementation.

The prototype stops before step 4.

## Future live architecture

The prototype should make room for the intended live model:

- Discord OAuth session for identity and guild authorization;
- server-side API on Vercel;
- shared Neon Postgres for bot configuration/state;
- Rob-bot as the executor of Discord mutations;
- audited queued actions for changes that need the bot token.
