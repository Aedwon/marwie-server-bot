# Control UI/UX Refinements R3

## Status

Approved by the user on 2026-09-01.

R3 MUST build on completed R2 commit `8ab6a6048f8cd45d45787b0e9b792723722f006c` on branch `web/control-uiux-refinements-r3`. The R2 analytics dashboard, canonical table language, workflow timelines, announcement composer/color picker, and shared Edit settings treatment are the starting point and must not be replaced by pre-R2 UI.

## Goal

Refine Control so read mode is quieter, Analytics reads like a real operational dashboard, Community forms match the established Control language, Mappings removes redundant guidance, and the public `/commands` manual becomes a focused searchable reference with modal command details and the same navigation language as Control.

## Preserved contracts

R3 is a presentation and interaction refinement unless a requirement below explicitly changes presentation behavior.

- Preserve feature ownership and page-save ownership.
- Preserve save, discard, revision, idempotency, CSRF, authorization, and confirmation behavior.
- Preserve Discord permission checks and allowed-mention restrictions.
- Preserve the existing `set_quiz_question_enabled` action and quiz-question persistence.
- Preserve existing mapping selectors, mapping validation, stale/missing-resource warnings, suggestion review behavior, and mapping application behavior.
- Preserve the R2 Analytics persistence model, portable SQLite/PostgreSQL queries, snapshot ranges, exact range boundaries, and real-data-only rule.
- Preserve the public `/commands` page as a no-sign-in reference sourced from the canonical `docs/commands.md` / `docs-site/commands.md` manual.
- Do not add committed application dependencies.
- Do not change slash-command runtime behavior or canonical command documentation content unless a discovered mismatch requires it.

## Global feature-toggle presentation

Pages using the shared feature-header actions must behave as follows:

- Read mode: render `Edit settings` as the only header action. Do not render a disabled/read-only feature toggle.
- Edit mode: render the editable feature toggle or toggles in the header together with existing Save/Discard controls in their established locations.
- Implement the read/edit distinction in the shared header component wherever possible.
- A hidden read-mode toggle must not remove persisted feature state from page state or change save/discard behavior.
- Feature labels and accessible names remain meaningful when the editable control is shown.

## Analytics

### Range row

The selected period and shortcut controls form one responsive row:

- left: selected `From` and `To` period;
- right: `1d`, `3d`, `7d`, `2w`, `1m`, and `All time`;
- narrow screens: stack the period and shortcuts without page overflow.

R2's 7d default and all existing range-selection behavior remain unchanged.

### Activity line graph

Replace the R2 bars with a dependency-free responsive SVG line graph derived only from the selected range's supplied `series`.

- One plotted point per supplied bucket.
- Activity count for a bucket remains the sum of its real moderation cases, tickets opened, tickets closed, quiz answers, anonymous questions, and reputation events.
- Do not create missing buckets client-side.
- Do not smooth curves.
- Connect adjacent supplied points with straight line segments only.
- If the supplied series contains one point, render that point without inventing a second point.
- X axis represents UTC bucket time/date.
- Y axis represents activity count and always starts at zero.
- Render visible axes, tick marks, and concise labels.
- Choose x ticks from actual supplied buckets with at most six visible labels.
- Use a small set of readable y ticks based on the actual maximum count.
- Add an accessible chart name and a visually hidden summary describing the selected range and number of supplied points.
- Remove the R2 subtitle under `Activity over time`.
- Keep one concise visible caption below the graph.
- Remove `View chart data`, `<details>`, and the visible series table completely.

No backend change is expected because R2 already exposes the required real bucket series.

## Community

### Reputation

- Remove decorative `01`, `02`, and `03` rank markers.
- Remove comparable R2 decorative eyebrow/kicker text that carries no user meaning. This includes the `Task` kicker on the authenticated Control Commands summary. Numbered workflow stages remain because they communicate sequence.
- Preserve tier names and threshold semantics.
- Editable thresholds use the established Control form language: one clean field row per tier, consistent input surface/border/radius/height/type/focus, clear labels, and no nested card-on-card treatment.
- Number inputs must not retain browser-default spinner styling.
- Preserve integer parsing, validation, and strict ascending threshold validation.

### Quizzes

Repository behavior confirms that an existing question's persisted active state determines whether it can be selected by `random_question()`. Therefore the question-level toggle is retained and renamed to `Include in rotation`.

- It remains separate from the global Quizzes feature toggle.
- It continues to save through `set_quiz_question_enabled`.
- New questions continue to start included and cannot be disabled until first saved, matching the current validation contract.
- Style the control using the established Control toggle/form language.

## Mappings

Remove generic type-selection helper copy from mapping editors, including forms equivalent to:

- `Choose an available text channel.`
- `Choose an available role.`
- `Choose an available category.`
- `Choose an available forum channel.`
- `Choose an available voice channel.`

Do not remove validation errors, incompatible/stale/missing-resource warnings, safe-role constraints, useful restrictions, selector labels, or accessible names. Mapping values, actions, ownership, and save behavior do not change.

## Public `/commands` manual

### Hero and search

- Remove the `Reference` eyebrow.
- Remove `Public reference · No sign-in required.`
- Hero introduction is exactly: `Find the right command by task, permission, or name.`
- Remove the generated `Using this manual` disclosure.
- Search becomes a flat toolbar/field separated by spacing and rules instead of a nested search card.
- Keep `/` focus shortcut, Escape-to-clear behavior when no modal is open, clear button, and live result count.

### Workflow previews

- Remove every PATH row and `workflow-path` rendering.
- Each workflow keeps its title and receives one concise administrator-facing summary.
- Shared workflow context copied from the canonical manual must not appear in the preview grid when it exposes implementation-oriented material. Canonical details remain available in the command modal.

### Command previews

Every canonical command appears exactly once. Each preview contains only the command name once, a concise human permission label, and one short plain-language outcome description. Preview copy must not expose internal implementation identifiers such as `role_panel`. Descriptions are explicit command-by-command copy based on canonical documentation, not a mechanical truncation of detailed paragraphs.

Syntax, parameters, prerequisites, side effects, confirmations, examples, failure conditions, and implementation notes belong only in the modal detail view.

### Command modal

Selecting a command opens a native modal dialog (`<dialog>` where supported by target browsers) instead of expanding a card in the grid.

- Preview activator is keyboard-operable.
- Modal content is the complete canonical documentation already parsed for that command.
- Do not duplicate the command name or syntax merely to decorate the modal.
- Provide an explicit `Close` button.
- On open, focus the Close button.
- Native modal behavior provides focus containment; the implementation must not allow focus to fall into the background while open.
- Escape closes through the dialog cancel path.
- Closing restores focus to the activating command preview when one exists.
- Opening from a direct hash without an activating card focuses the modal control safely.
- Opening a command updates the command hash; closing removes the command hash without reloading.
- Loading `/commands#command-…` opens that command when it exists.
- The modal must not alter grid/card dimensions.

### Shared navigation

The public commands page remains public, but its shell must use the same visual/navigation primitives as Control:

- same `control-shell`, sidebar, mobile top bar/drawer behavior, brand treatment, avatar image, spacing, and selected-state language;
- same icon-only Dark/Light/System appearance controls and placement as `control.html`;
- same shared theme controller and drawer controller;
- Commands is visibly selected;
- keep workflow jump navigation only if it fits inside the shared navigation structure without creating a separate custom brand/appearance block;
- mobile navigation must remain usable at 390px width.

## Responsive and accessibility constraints

- No horizontal page overflow at 1470×987 or 390×844.
- Mapping tables may scroll within their table wrappers; the page itself must not horizontally overflow.
- No underlined ordinary action links.
- No decorative eyebrows.
- No gradients or ornamental decoration added by R3.
- Preserve visible focus indicators.
- Preserve dark, light, and system themes.
- Respect reduced-motion behavior.
- Do not use color alone for interactive state.

## Verification contract

Focused automated verification must cover shared feature toggles absent in read mode and present/editable in edit mode; Analytics six-range selection and 7d default; line graph rendering from supplied series only; question-level `Include in rotation` still emitting `set_quiz_question_enabled`; mapping generic helper removal; command search; unique concise command previews; and modal open/Close/Escape/focus restoration/direct-hash behavior.

Visual verification must cover dark and light at 1470×987 and 390×844 for `/control/analytics`, `/control/community/reputation`, `/control/community/quizzes`, `/control/mappings/channels`, and `/commands`. Report page overflow, clipping, navigation behavior, inline expansion absence, and form/toggle styling. If authenticated Control cannot be opened directly in a local browser, use a temporary non-production visual harness that renders the actual R3 page renderers with deterministic test snapshots, then remove the harness before commit.
