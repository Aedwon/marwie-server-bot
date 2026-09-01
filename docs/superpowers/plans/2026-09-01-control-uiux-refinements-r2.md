# Control UI/UX Refinements R2 Implementation Plan

> **For agentic workers:** Use the approved R2 spec/decision as design authority. Use test-driven development for Analytics range behavior and Voice ownership. Do not dispatch subagents.

**Goal:** Apply the approved balanced Control refinement pass from base `1e3a8aedaee0808d30955b3b074c736b3d8ffb8f` while preserving Control safety contracts and stopping before commit/push.

**Spec:** `docs/superpowers/specs/2026-09-01-control-uiux-refinements-r2.md`

**Decision:** `docs/superpowers/decisions/2026-09-01-control-uiux-refinements-r2.md`

**Architecture:** Keep the vanilla Control modules and shared snapshot/page-state architecture. Reuse canonical Mappings table semantics and centralized UI action styles. Narrow Voice page ownership end-to-end. Extend `AnalyticsService` with aggregate-only multi-range snapshot data and dependency-free bucketed charts; do not make the shared guild snapshot range-specific.

**Tech Stack:** Vanilla ES modules/CSS, Node `node:test`, Python/discord.py, SQLAlchemy async database layer supporting SQLite and PostgreSQL, pytest.

## Task 1: Lock behavioral contracts RED

**Files:** `web-tests/control-uiux-refinements-r2.test.js`, `tests/test_analytics_workflows_wave9.py`, relevant page-save contract tests.

Add focused failing tests proving Voice renders one Temporary voice toggle and emits/accepts only `voice`, while coworking remains untouched; prove Analytics produces the six real ranges, 7d default, exact boundaries, bucket series, zero-answer semantics and aggregate-only snapshot shape. Run only these focused tests and confirm expected RED failures.

## Task 2: Narrow Voice ownership

**Files:** `docs-site/control-community.js`, `src/marwie_bot/features/control_plane/page_revisions.py`, `src/marwie_bot/features/control_plane/page_save_contract.py`, `api/_lib/page-save.js`, focused tests.

Remove the coworking UI/diff ownership, retain route compatibility, render only Temporary voice category mapping, and leave coworking persistence/runtime and all Mappings resources unchanged. Bring focused Voice tests GREEN.

## Task 3: Implement real Analytics ranges

**Files:** `src/marwie_bot/features/analytics/service.py`, `src/marwie_bot/features/control_plane/cog.py`, `docs-site/control-analytics.js`, `docs-site/control-analytics-workflows.css`, focused Python/JS tests.

Keep `weekly()` for the Discord command. Add a Control dashboard projection containing 1d/3d/7d/2w/1m/all ranges and real contiguous aggregate buckets at one UTC end time. Preserve flat 7d fields for compatibility. Add local range controls, selected-range label, summary metrics, dependency-free activity graph, accessible data equivalent, and canonical Reporting mapping table. Bring focused Analytics tests GREEN.

## Task 4: Standardize shared actions, headers and canonical tables

**Files:** `docs-site/control-components.js`, `docs-site/control.css`, `docs-site/control-community.js`, `docs-site/control-community.css`, `docs-site/control-content.js`, `docs-site/control-content.css`, `docs-site/control-utilities.js`, `docs-site/control-utilities.css`, `docs-site/control-mappings.js`, `docs-site/control-mappings.css`, `docs-site/control-analytics-workflows.css`.

Add reusable inline-arrow and canonical-table markup/style helpers where practical. Put Edit settings before feature toggle, remove toggle enclosure border, normalize inverse monochrome buttons, convert requested summaries/ticket/panel/feed tables, move section-level Manage mappings actions to the requested positions, and preserve the 13px routine type minimum.

## Task 5: Refine Community and Content operational surfaces

**Files:** Community/Content JS and CSS plus focused existing markup tests as needed.

Create Reputation tier progression and Quizzes operational snapshot. Reduce Content header gaps, refine Feeds table, Announcement composer/preview hierarchy and Post placement, implement accessible hue + saturation/value picker with synchronized hex/focus/viewport behavior, and restructure Live into a compact dispatch sequence without changing post semantics.

## Task 6: Refine Utilities, Workflows, Commands and Mappings

**Files:** `docs-site/control-utilities.js`, `docs-site/control-utilities.css`, `docs-site/control-workflows.js`, `docs-site/control-secondary.js`, `docs-site/control-analytics-workflows.css`, `docs-site/control-mappings.js`, `docs-site/control-mappings.css`, `docs-site/control.css`; read `docs/commands.md` before workflow copy edits.

Make Utilities summaries/table ownership consistent; prevent active Anonymous Questions wrapping; render all workflows as consistent numbered operational sequences based only on repository facts; render Commands as compact action rows with command chips and arrow actions; restyle Suggested mappings CTA without changing its behavior.

## Task 7: Focused verification and visual inspection

**Files:** verification only unless a concrete regression is found.

Run the focused Analytics and Voice tests, touched-JavaScript `node --check`, Python compile checks for touched Python modules, and `git diff --check`. Inspect the complete diff. Start the real local Control site if supported and visually inspect representative Community/Content/Utilities/Workflows/Commands/Mappings/Analytics pages in dark/light and wide/narrow states, including color-picker keyboard/focus behavior and Analytics range switching. Do not run a broad suite solely for visual changes.

## Task 8: Pre-commit handoff

Report branch/base, changed files, design-record changes, diff summary, visual notes/screenshots, focused verification, and unresolved limitations. Stop with the working tree uncommitted and unpushed unless Aedwon explicitly authorizes commit/push.
