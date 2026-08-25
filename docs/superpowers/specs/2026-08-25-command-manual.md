# Exhaustive command manual

Status: accepted for implementation
Date: 2026-08-25

## Problem

The README lists Rob-bot slash commands, but it does not explain each command well enough for a server operator or member to know exactly what inputs are accepted, what permissions are required, what side effects occur, or what happens after approval.

## Goal

Create one canonical, comprehensive manual for every slash command currently registered by Rob-bot. The manual must be useful without reading Python source.

## Canonical location

`docs/commands.md` is the canonical command manual. The README keeps a compact command index and links to the manual instead of duplicating full per-command documentation.

## Coverage

The manual must cover all 45 slash commands registered by the current extension set:

- system
- setup/configuration
- moderation
- tickets
- announcements and TikTok live announcements
- reputation and build-help
- quizzes and anonymous questions
- coworking and collaboration
- AI update feeds
- analytics and showcase

Non-slash Discord controls that are necessary to understand a command-driven workflow, such as ticket buttons, announcement preview buttons, quiz answer buttons, the Live Notifications self-role panel, and temporary voice workspace behavior, may be documented in clearly separate related-control sections.

## Required entry structure

Every slash-command entry must include, where applicable:

1. exact slash-command syntax;
2. a concise description of what happens after execution;
3. who can use it and the relevant Discord permission;
4. prerequisites such as configured resources or enabled features;
5. one row per parameter describing:
   - whether it is required;
   - Discord/input type;
   - accepted values and length/range constraints;
   - default value when optional;
   - semantic meaning and normalization behavior;
6. side effects, including messages, database records, role changes, moderation actions, or posted content;
7. important failure conditions and hierarchy restrictions;
8. at least one realistic example usage.

For commands without parameters, the entry must explicitly say that there are no parameters.

## Syntax convention

To stay visually close to Discord slash-command usage, command signatures use square-bracket option names, for example:

`/ban [member] [reason] [delete_message_seconds=0]`

The parameter table is authoritative about which options are required or optional. This avoids implying that every bracketed option is optional.

Examples use Discord's named-option style where useful, for example:

`/ban member:@Example reason:"Repeated scam links" delete_message_seconds:86400`

## Confirmation behavior

The manual must explain once, near the top, that every slash command receives Rob-bot's global Approve/Decline confirmation before its callback runs. Individual entries may call out extra confirmation behavior or unusually important consequences. `/setup auto` must document its second mutation approval.

## Accuracy contract

The implementation source is authoritative. The manual must not invent accepted values or behavior that the code does not enforce.

Any future pull request or change that adds, removes, renames, changes parameters for, changes permissions for, or materially changes the behavior of a slash command must update `docs/commands.md` in the same change.

## Non-goals

- Do not add or change slash commands as part of this documentation task.
- Do not change Discord permissions or feature behavior.
- Do not duplicate the full manual into the README.
- Do not require a bot restart for documentation-only changes.
