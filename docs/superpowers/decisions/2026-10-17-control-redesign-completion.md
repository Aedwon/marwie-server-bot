# Control Redesign Completion Decisions

Date: 2026-10-17

## Context

The October 16 Control design system and information-architecture decisions are Control-wide. The September refinement implementation plan covered only a subset of that design. Shipping the refinement tasks without finishing the route-level redesign left major Control pages visually and structurally on the legacy presentation.

This decision locks the completion boundary so implementation cannot stop after shared shell/components again.

## Completion boundary

The redesign is complete only when every canonical Control route uses the October design system, the feature-first information architecture, and the stable three-region composition where useful. Existing URLs remain valid so saved links and route memory do not break.

The canonical routes remain:

- `/control/community/reputation`
- `/control/community/quizzes`
- `/control/community/voice-coworking`
- `/control/community/showcase`
- `/control/content/feeds`
- `/control/content/announcements`
- `/control/content/live`
- `/control/utilities/ticket-configuration`
- `/control/utilities/notification-roles`
- `/control/utilities/anonymous-questions`
- `/control/analytics`
- `/control/workflows/moderation`
- `/control/workflows/ticket-handling`
- `/control/workflows/events`
- `/control/mappings/channels`
- `/control/mappings/roles`
- `/control/mappings/categories`
- `/control/commands`
- `/control/activity`

## Navigation

Navigation groups are organization layers, not configuration destinations.

### Engagement
- Reputation
- Quizzes
- Voice & Coworking
- Showcase
- Notification roles

### Publishing
- Feeds
- Announcements
- Live

### Support & Safety
- Tickets
- Anonymous Questions
- Moderation

### Insights
- Analytics
- Activity

### System
- Resources
- Commands

Ticket handling and Events remain secondary guidance-only Playbooks. Moderation is a Support & Safety feature. Do not add a speculative Bot settings destination.

Resources is one System feature in navigation. Its existing Channels, Roles, and Categories URLs remain valid and are presented as in-page peer views while preserving route memory/deep links.

## Feature-local resource editing

The October feature-ownership decision supersedes the older assumption that routine Discord resource edits must stay on Mappings pages.

A feature page is the preferred surface for the resources required by its normal workflow. The global Resources view remains the cross-feature overview, troubleshooting, and advanced administration surface.

This does not create duplicate state. Feature-local editors and Resources read and write the same canonical resource bindings using the existing `set_resource` / `clear_resource` persistence and safety semantics.

Feature ownership:

- Reputation: `builder_role`, `contributor_role`, `mentor_role`
- Quizzes: `quiz_channel`
- Voice & Coworking: `create_workspace_voice`, `coworking_lounge`, `temp_voice_category`
- Showcase: `showcase_forum`, `app_of_the_week`, `collab_lfg`
- Notification roles: `role_panel`
- Feeds: `ai_updates`
- Announcements: `announcements`
- Live: `live_announcements`, `live_ping_role`
- Tickets: `ticket_panel`, `ticket_logs`, `ticket_category`
- Anonymous Questions: `anon_questions`
- Moderation: `moderation_log`, `compromised_account_trap`
- Analytics: `analytics`

Resources retains access to every canonical binding, including current production-only/system-only mappings such as Anonymous Messages resources.

## Shell and context

Wide desktop uses the approved three-region shell: 240px floating left navigation, flat center workspace, and an optional 304px contextual right shell. The right shell appears only when it helps the current task. It may contain canonical resource bindings, readiness, dependencies, permissions, preview, recent activity, or concise contextual help.

At narrower breakpoints the right region becomes a temporary drawer, and below 900px the left navigation also becomes a drawer. Essential feature work remains possible in the center.

## Save and safety semantics

Feature settings and feature-owned resource edits participate in the existing page-level revision-aware save model. There is no bulk save. Existing authorization, CSRF, idempotency, conflict handling, consequence confirmations, and Discord permission/resource validation remain authoritative.

## Acceptance

The completion run must visually review all canonical routes and run the full web suite with zero known failures before production promotion. A page such as Notification roles is not considered redesigned if it still presents its old route body with only shared-shell refinements layered around it.
