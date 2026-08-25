# Operator-focused documentation homepage

Date: 2026-08-25
Status: accepted

## Problem

The current Rob-bot documentation homepage is organized mostly as a feature inventory. It lists member commands, staff commands, automatic features, setup, roles, resources, hosting, and troubleshooting as parallel sections.

That structure is complete enough to browse, but it is weak as an on-duty reference. Moderators and administrators usually arrive with a task or incident in mind: set up the bot, verify that it is healthy, moderate a member, handle tickets, publish an update, diagnose a failure, or maintain a community program.

The homepage should optimize for those jobs instead of requiring staff to translate a feature taxonomy into an operating workflow.

## Primary users

1. Server administrators doing first-time setup or configuration changes.
2. Moderators handling incidents and support work.
3. Community-operations staff running announcements, reputation, quizzes, feeds, analytics, and showcase programs.
4. Deployment maintainers diagnosing host/configuration problems.

Member-facing features remain documented because staff need to support them, but the homepage is not primarily a member command directory.

## Information architecture

The homepage should answer, in order:

1. **What are you trying to do?**
2. **Is Rob-bot healthy enough to do it?**
3. **What is the normal workflow?**
4. **What permissions/configuration does that workflow depend on?**
5. **Where do you go when it fails?**

The exhaustive `/commands` page remains the source for exact syntax and parameter details.

## Required homepage sections

### Start here

Provide clear entry points for:

- first-time setup;
- moderator on duty;
- community operations;
- troubleshooting / something is not working.

Each entry point should link to the relevant section or `/commands`, not duplicate exhaustive command documentation.

### Quick health check

A short operational sequence:

1. Confirm slash commands are visible and `/ping` responds.
2. Run `/setup status` and look for stale/missing mappings.
3. Check Rob-bot role position when moderation or role assignment is failing.
4. Check feature-specific prerequisites before changing configuration blindly.

### First-time setup

Update onboarding to match the current discovery-first `/setup auto` behavior. Do not tell admins to create every channel manually before setup.

The preferred flow is:

1. install/sync the bot;
2. configure host essentials and optional Message Content behavior;
3. run `/setup auto` and review discovery plus any second mutation confirmation;
4. verify with `/setup status`;
5. add content/policy choices that auto-setup intentionally does not invent;
6. smoke-test the workflows the server will actually use.

### On-duty playbooks

Group operational guidance by staff goal:

- moderate and investigate;
- handle support tickets;
- publish announcements/live notices;
- run community programs;
- maintain feeds, analytics, and showcase.

Use short sequence-oriented guidance with links to the exact command manual.

### Permissions and hierarchy

Keep role-order and permission information easy to reach because it is a frequent cause of moderation and managed-role failures.

### Member-facing behavior staff may need to support

Summarize member workflows such as tickets, reputation, anonymous questions, Pomodoro, LFG, quizzes, and solved replies. Do not present this as the primary navigation model.

### Automatic behavior

Explain background jobs and restart recovery so staff know what should happen without manual action.

### Configuration reference

Keep the channel/role resource map available as a reference. Emphasize that `/setup auto` discovers existing resources first and that names in the map are examples, not requirements.

### Troubleshooting

Organize common failures by symptom and first check. Direct staff to `/setup status`, role hierarchy, permissions, intents, feature toggles, or host settings before suggesting destructive changes.

### Hosting

Keep deployment settings lower on the page and label them for deployment owners. Moderators should not need to pass through hosting details to reach day-to-day procedures.

## UX constraints

- Preserve the existing understated visual language, theme switcher, responsive sidebar, and static-site architecture.
- Avoid decorative dashboard chrome that does not improve retrieval.
- Do not use pills/tags as the primary navigation device.
- Prefer short task cards, ordered flows, and concise reference tables.
- Keep `/commands` as a separate first-class page.
- No live API calls or bot-control functionality from the docs site.
- No bot runtime, database, or Bot-Hosting changes.

## Source alignment

Homepage setup guidance must reflect the current `main` behavior:

- every slash command has contextual confirmation;
- `/setup auto` is discovery-first;
- clear existing matches are bound before creation is considered;
- mutations require the second explicit confirmation;
- auto-setup does not delete/rename/move existing resources;
- ticket types, quiz content, AI feed sources, policy thresholds, log exclusions, and feature choices remain administrator decisions.
