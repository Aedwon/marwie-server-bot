# Anonymous Messages Port Decisions

Date: 2026-09-09

## Context

`Aedwon/Discord-Bot` has a production anonymous-message system that the Marwie server wants to adopt closely. The reference implementation assumes a single public anonymous-message channel and an MLBB-specific verification database. `marwie-server-bot` has a newer multi-guild resource mapping and control-plane architecture, plus explicit requirements for durable state and staff-auditable anonymity.

## Decision 1: Keep three destinations independently mapped

### Options considered

1. Keep the old single public channel for panel and submissions, plus one audit log.
2. Split panel, submissions, and audit log into three required channel mappings.
3. Hardcode one or more destinations in feature code.

### Chosen

Use three independent mappings:

- `anon_messages_panel`
- `anon_messages_submissions`
- `anon_messages_audit_log`

Panel and submissions may point to the same Discord channel when exact reference behavior is desired.

### Why

The team needs to see and control exactly where the panel and public submissions land. Independent mappings preserve the old layout as a configuration choice while avoiding a later migration if the panel needs a dedicated channel. Hardcoded IDs violate the repository architecture.

## Decision 2: Do not port MLBB verification

### Options considered

1. Recreate the old MLBB account-verification gate.
2. Add a new required Discord role solely for this feature.
3. Use the server's Discord access controls and current resource mappings as the eligibility boundary.

### Chosen

Use option 3. A member may use the feature when the feature is enabled and they can interact with the currently mapped panel/submissions surface. Persistent buttons in stale, previously mapped channels are rejected.

### Why

The old gate proves ownership of a game account, not membership legitimacy in an AI/community server. Adding a new mandatory role would introduce behavior the user did not request. Discord channel permissions already provide an operator-controlled membership boundary without importing unrelated game-domain state.

## Decision 3: Public anonymity is not staff anonymity

### Chosen

Keep identity hidden from public messages and replies, but retain the submitter identity and content in durable records and send an audit embed to the mapped private staff log.

Member-facing panel copy must say that authorized staff can review identity for abuse or safety handling. The old absolute statement that identity will “never” be shown is not retained because it conflicts with the actual audit behavior.

## Decision 4: Persist messages and panel state

### Options considered

1. Scan Discord history like the old bot and keep panel message ID only in memory/settings.
2. Persist anonymous message/reply records and panel state in dedicated database tables.

### Chosen

Persist both.

### Why

The target repository requires durable state and restart-safe background behavior. Dedicated persistence also makes deletion/renumber reconciliation deterministic and keeps the audit trail independent of Discord message history.

## Decision 5: Preserve member UX, not legacy file structure

### Chosen

Preserve button labels, modal constraints, numbering behavior, anonymous replies, sticky refresh cadence, and `/anon deploy` / `/anon sync` operations. Implement them using the target repository's service/repository/render/view/cog boundaries instead of copying the old giant cog.

## Decision 6: Audit mapping is required for an operational panel

### Chosen

The panel interaction and `/anon deploy` require panel, submissions, and audit destinations to resolve to text channels. The bot validates send/embed permissions before opening a submission modal.

### Why

A public anonymous surface should not intentionally enter service without its staff accountability path configured. Durable database identity remains an additional backstop if a later Discord audit send itself fails.
