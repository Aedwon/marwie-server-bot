# Control UI/UX Refinements R3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the completed R2 Control UI with edit-only feature toggles, an accessible real-data line chart, cleaner Community and Mappings forms, and a simplified public Commands manual with modal details and shared Control navigation.

**Architecture:** Keep R2 page state, save contracts, backend ownership, and Analytics snapshot data unchanged. Make shared presentation changes in common Control components first, then refine domain renderers. The public Commands manual continues parsing the canonical Markdown but separates concise preview metadata from full canonical nodes shown in a native dialog.

**Tech Stack:** Vanilla ES modules, HTML/CSS, Node built-in test runner, Python 3.12/pytest for existing backend safety tests, optional temporary Playwright/Chromium only for local visual verification.

**Spec:** `docs/superpowers/specs/2026-09-01-control-uiux-refinements-r3.md`

## Global Constraints

- Base commit is completed R2 `8ab6a6048f8cd45d45787b0e9b792723722f006c`.
- Do not change feature ownership, save contracts, permissions, CSRF, revisions, idempotency, API behavior, or slash-command runtime behavior.
- Analytics must use only backend-supplied real range series. No synthetic buckets, smoothing, or fake values.
- Public `/commands` remains no-sign-in and uses the canonical command manual for complete details.
- Do not add committed application dependencies.
- Keep dark, light, and system themes.
- No decorative eyebrows, underlined ordinary actions, gradients, or unnecessary nested cards.
- Do not merge the branch.

---

### Task 1: Lock R3 behavioral contracts RED

**Files:**
- Create: `web-tests/control-uiux-refinements-r3.test.js`
- Create: `web-tests/commands-r3.test.js`
- Read: `docs-site/control-components.js`
- Read: `docs-site/control-community.js`
- Read: `docs-site/control-analytics.js`
- Read: `docs-site/control-mappings.js`
- Read: `docs-site/commands.html`
- Read: `docs-site/commands.js`

**Interfaces:**
- Consumes: completed R2 renderer APIs and page definitions.
- Produces: failing R3 contracts that distinguish the requested UI from R2.

- [ ] **Step 1: Add a shared-feature-header test**

Render `featureHeaderActionsMarkup` in read mode and assert it contains `Edit settings` but no feature checkbox. Render edit mode and assert the configured editable toggle is present.

- [ ] **Step 2: Add Analytics R3 markup tests**

Provide a selected range with a known supplied `series`. Assert the markup contains the six shortcuts, an SVG line chart with axes/ticks, and one plotted point per supplied bucket. Assert `analytics-chart-bars`, `View chart data`, `<details>`, and `analytics-series-table` are absent.

- [ ] **Step 3: Add Community R3 tests**

Assert Reputation read markup has no `01`, `02`, `03` tier markers. In edit mode assert threshold fields use the new Control field class. For an existing quiz question, toggle `enabled` in the draft and assert the diff remains exactly `set_quiz_question_enabled` while markup labels the control `Include in rotation`.

- [ ] **Step 4: Add Mappings helper-removal test**

Render an editable Channels mapping page and assert no `Choose an available …` helper sentence is emitted. Keep existing stale/missing-resource and validation assertions.

- [ ] **Step 5: Add Commands R3 contracts**

Assert the hero uses the exact new introduction, has no Reference/meta/Using-this-manual/PATH rendering, cards no longer use inline `<details>`, dialog hooks exist, command previews are unique, and search metadata includes command name, permission, and administrator-facing outcome.

- [ ] **Step 6: Run RED tests**

Run: `node --test web-tests/control-uiux-refinements-r3.test.js web-tests/commands-r3.test.js`

Expected: failures for R2 disabled read toggles, bar chart/data table, decorative labels, mapping helper text, and inline command expansion.

---

### Task 2: Make feature toggles edit-only and refine Community forms

**Files:**
- Modify: `docs-site/control-components.js`
- Modify: `docs-site/control-community.js`
- Modify: `docs-site/control-community.css`
- Modify: `docs-site/control-secondary.js`
- Modify: `docs-site/control-secondary.css`
- Test: `web-tests/control-uiux-refinements-r3.test.js`
- Regression: `web-tests/control-community.test.js`
- Regression: `web-tests/control-uiux-refinements-r2.test.js`

**Interfaces:**
- Consumes: `featureHeaderActionsMarkup({ editing, toggles, editAttribute })`.
- Produces: read mode with Edit only; edit mode with editable toggles; unchanged draft/diff/save semantics.

- [ ] **Step 1: Change the shared header renderer**

When `editing === false`, do not build or return toggle markup. Return only the existing Edit settings primary button. When editing, render toggle labels using existing `toggleAttribute` and draft values.

- [ ] **Step 2: Remove decorative R2 labels**

Delete Reputation's `community-tier-index` output and remove the authenticated Control Commands `Task` kicker. Keep numbered workflow stages.

- [ ] **Step 3: Restyle Reputation threshold editing**

Render one semantic labeled threshold field per tier without nested cards. Add a Community numeric-input class matching the Control surface, border, radius, minimum height, 13px+ type, focus-visible ring, consistent spacing, and `appearance:textfield` plus WebKit spinner removal. Do not change parsing or ascending validation.

- [ ] **Step 4: Rename and style question inclusion**

For persisted questions render the existing `data-question-field="enabled"` checkbox with visible label `Include in rotation` and established Control toggle track/copy styling. Keep new-question validation unchanged.

- [ ] **Step 5: Run focused GREEN tests**

Run: `node --test web-tests/control-uiux-refinements-r3.test.js web-tests/control-community.test.js web-tests/control-uiux-refinements-r2.test.js`

Expected: all pass.

---

### Task 3: Replace Analytics bars with the real-series line graph

**Files:**
- Modify: `docs-site/control-analytics.js`
- Modify: `docs-site/control-analytics-workflows.css`
- Test: `web-tests/control-uiux-refinements-r3.test.js`
- Regression: `web-tests/control-analytics-workflows.test.js`
- Regression: `web-tests/control-uiux-refinements-r2.test.js`

**Interfaces:**
- Consumes: R2 `snapshot.analytics.ranges[range].series`.
- Produces: responsive SVG line graph with real points, x/y axes, selected-period/range row, accessible summary, and no visible data table.

- [ ] **Step 1: Align period and shortcuts**

Move selected From/To markup and `rangeControlsMarkup()` into one `.analytics-range-row`, with period on the left and shortcuts on the right. Add narrow stacking CSS.

- [ ] **Step 2: Add deterministic axis helpers**

Implement helpers that compute bucket activity totals from supplied fields, choose at most six x tick indexes from actual series entries, choose a readable y maximum and 3–5 ticks at or above the real maximum, and format x labels as UTC time for short ranges or UTC date for longer ranges. No helper inserts missing series items.

- [ ] **Step 3: Render the SVG**

Create a viewBox-based responsive SVG with visible x/y axis lines, tick marks/text, one circle per supplied point, and a straight polyline/path through supplied points only when two or more points exist. Add `role="img"`, accessible labeling, and a visually hidden concise summary.

- [ ] **Step 4: Remove R2 chart extras**

Delete the subtitle under Activity over time, bar markup/styles, `View chart data`, `<details>`, and the visible exact-value table. Keep one concise figure caption.

- [ ] **Step 5: Run focused GREEN tests**

Run: `node --test web-tests/control-uiux-refinements-r3.test.js web-tests/control-analytics-workflows.test.js web-tests/control-uiux-refinements-r2.test.js`

Expected: all pass with no backend changes.

---

### Task 4: Remove redundant Mappings helper copy without changing validation

**Files:**
- Modify: `docs-site/control-mappings.js`
- Test: `web-tests/control-uiux-refinements-r3.test.js`
- Regression: `web-tests/control-mappings.test.js`

**Interfaces:**
- Consumes: existing mapping definitions, option filtering, validation/status rendering.
- Produces: same selectors and warnings without generic type-selection helper sentences.

- [ ] **Step 1: Remove the generic help span**

Delete the `Choose an available ${kindLabel(...)}` field-help element and remove any `aria-describedby` reference that exists only for that generic sentence.

- [ ] **Step 2: Preserve useful messaging**

Do not alter stale-resource state text, expected-kind validation, safe-role filtering, confirmation review, suggestion review, or save payload creation.

- [ ] **Step 3: Run focused GREEN tests**

Run: `node --test web-tests/control-uiux-refinements-r3.test.js web-tests/control-mappings.test.js`

Expected: all pass.

---

### Task 5: Simplify the public Commands manual and shared shell

**Files:**
- Modify: `docs-site/commands.html`
- Modify: `docs-site/commands.js`
- Modify: `docs-site/commands.css`
- Modify if needed for exact shared shell reuse: `docs-site/control.css`
- Create only if needed for pure interaction helpers: `docs-site/commands-interactions.js`
- Test: `web-tests/commands-r3.test.js`
- Regression: existing Commands/manual focused tests discovered by `node --test web-tests/*commands*.test.js`

**Interfaces:**
- Consumes: canonical rendered command nodes from `docs-site/commands.md`, shared `installThemeControls`, and `installDrawerController`.
- Produces: unique concise previews plus native modal details with deep-link and focus behavior.

- [ ] **Step 1: Replace hero and search chrome**

Use exactly `Find the right command by task, permission, or name.` Remove Reference/meta copy and generated Using this manual. Flatten search into a toolbar separated by spacing/rules while keeping `/`, Escape-clear, Clear, and result-count behavior.

- [ ] **Step 2: Rebuild the public sidebar from shared Control primitives**

Use the same brand text/avatar markup and icon-only Dark/Light/System controls as `control.html`, the same drawer/mobile structure, and the same primary-nav selected-state classes. Keep the page public and do not add session/API requirements.

- [ ] **Step 3: Simplify workflow headers**

Remove `path` data/rendering and all `workflow-context` preview insertion. Give each `WORKFLOWS` entry one concise administrator-facing `intro`.

- [ ] **Step 4: Add explicit preview metadata**

Create an explicit metadata map covering every canonical command. Each entry contains a concise permission label matching canonical docs and one rewritten administrator-facing outcome sentence with no internal identifiers. At render time warn or fail visibly in development if a canonical command has no metadata instead of falling back to implementation-heavy source text.

- [ ] **Step 5: Render unique nonexpanding previews**

Render one activator per canonical command with command name, permission, and outcome only. Enforce one command once even if workflow lists overlap. Do not put syntax or long-form nodes in the grid.

- [ ] **Step 6: Add native dialog detail rendering**

Add one `<dialog>` to `commands.html`. On activation, populate it with that command's already-parsed canonical detail nodes, set/update the canonical hash, call `showModal()`, and focus Close. On close/cancel, clear modal content, remove the command hash, and restore focus to the opening card when available. On initial recognized hash, open the matching command after parsing.

- [ ] **Step 7: Preserve and test search**

Search over explicit preview metadata plus command name/permission. `/` focuses search when no dialog is open. Escape closes the dialog when open and otherwise clears search.

- [ ] **Step 8: Run Commands GREEN tests**

Run: `node --test web-tests/commands-r3.test.js` and discovered existing Commands/manual focused tests.

Expected: search and modal contracts pass with no inline expansion.

---

### Task 6: Focused safety regression and visual verification

**Files:**
- No production files expected.
- Temporary visual fixture files are permitted only if deleted before commit.

**Interfaces:**
- Consumes: completed R3 working tree.
- Produces: evidence for behavior, safety, responsiveness, dark/light presentation, and repository hygiene.

- [ ] **Step 1: Run syntax and focused behavior tests**

Run `node --check` on every changed `.js` file.

Run: `node --test web-tests/control-uiux-refinements-r3.test.js web-tests/commands-r3.test.js web-tests/control-community.test.js web-tests/control-mappings.test.js web-tests/control-analytics-workflows.test.js web-tests/control-uiux-refinements-r2.test.js` plus existing page-save/action safety tests affected by shared Control interaction changes.

- [ ] **Step 2: Run Python safety tests if backend files change**

No backend behavior is expected to change. If any Python production file changes, run the focused page-save/quiz ownership tests. Otherwise verify no Python production diff exists from R2.

- [ ] **Step 3: Run visual browser verification**

Use temporary Playwright/Chromium if available without committing dependencies. Render actual routes when possible; for authenticated Control pages, a temporary test-only harness may call actual page renderers with deterministic snapshots.

Inspect 1470×987 dark, 1470×987 light, 390×844 dark, and 390×844 light for Analytics, Reputation, Quizzes, Mappings Channels, and public Commands. Check `document.documentElement.scrollWidth <= innerWidth`, clipped controls, number-spinner appearance, mobile navigation, stable command-card dimensions during modal open, dialog containment, inline expansion absence, and line-graph axis/tick legibility. Delete all temporary fixture/browser/dependency artifacts.

- [ ] **Step 4: Final repository verification**

Run `git diff --check`, `git status --short`, `git diff --stat`, and a requirement/scope audit against the R3 spec. Confirm no generated lockfile, `node_modules`, screenshots, or temporary harness remains.

- [ ] **Step 5: Commit and push R3**

After all verification is GREEN, commit R3 with a concise repository-style message, push `web/control-uiux-refinements-r3`, do not merge, and record the exact commit SHA for handoff.
