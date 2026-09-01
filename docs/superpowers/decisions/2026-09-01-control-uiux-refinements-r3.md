# Control UI/UX Refinements R3 Decisions

## Context

R2 established the real Analytics dashboard, canonical summary tables, workflow timelines, announcement composer, and common primary-action treatment. R3 is a refinement of that completed state, not a redesign from the older Control UI.

## Decisions

### R3 is based on the completed R2 checkpoint

R2 was checkpointed locally as `8ab6a6048f8cd45d45787b0e9b792723722f006c`. R3 starts from that commit so the R2 interaction and visual contracts are real ancestry instead of uncommitted assumptions.

### Read mode has no feature-toggle chrome

A feature toggle communicates an editable choice. A disabled duplicate in read mode adds chrome without adding information. Shared feature headers therefore render only `Edit settings` in read mode and render feature toggles only while editing. Persisted state still exists in the page model and remains part of save/discard logic.

### Quiz question toggle means rotation inclusion

The quiz repository's `random_question(guild_id)` selects only questions whose persisted active flag is true. Control already updates that flag through `set_quiz_question_enabled`. The question-level toggle is therefore not redundant with the global Quizzes feature.

R3 keeps the behavior and changes the label from `Enabled` to `Include in rotation`.

### Analytics remains client-rendered from R2 real series

R2 already publishes complete range buckets from persisted data. R3 does not add another analytics API, another persistence layer, or client-generated buckets.

The line graph uses one point per supplied bucket. Adjacent real points are connected with straight segments. No smoothing or synthetic missing points are permitted. The plotted y value remains the same aggregate activity total used by the R2 bar chart.

### Analytics exact-value table is removed from the visible UI

R3 replaces the visible expandable table with accessible chart labeling and a visually hidden summary. The backend series remains available in the snapshot and no data is discarded. This reduces dashboard density while retaining a programmatic chart description.

### Public command previews and canonical details have separate jobs

Preview cards answer three questions only: what command is this, who can use it, and what outcome does it produce. The complete canonical manual remains the source for syntax, parameters, prerequisites, side effects, confirmations, failure conditions, and examples.

The parser keeps canonical command nodes intact for the detail modal instead of maintaining a second long-form documentation source.

### Command details use a native modal dialog

A native `<dialog>` is preferred because modal focus containment, Escape cancellation, and background inertness are platform behavior instead of custom imitation. R3 adds explicit initial focus and focus restoration so activation remains predictable.

Command cards become buttons or button-like activators and never expand inline.

### Command hashes identify the open detail

Existing direct command anchors remain useful. Opening a command sets its canonical `#command-…` hash. Loading a recognized command hash opens that modal. Closing removes the hash without reloading. This preserves practical deep links while changing the interaction model.

### Public Commands uses the Control shell without requiring authentication

The public manual remains no-sign-in. It reuses the Control shell's structural classes, brand/avatar treatment, icon appearance controls, mobile drawer behavior, and selected-state language. It does not call authenticated session APIs merely to look visually consistent.

### Decorative R2 labels are removed only when they add no semantics

Reputation's `01`/`02`/`03` markers and the authenticated Commands `Task` kicker are decorative and are removed. Numbered workflow stages remain because sequence is meaningful. Field labels, statuses, permission labels, and accessibility text remain.
