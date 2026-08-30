# Rob-bot Control Sidebar Polish Implementation Plan

> **For agentic workers:** Execute inline with test-driven development. Do not dispatch subagents for this task.

**Goal:** Implement the approved Control sidebar behavior and visual polish 1:1 with the final localhost companion while preserving Control routing, save semantics, mobile drawer behavior, and accessibility.

**Architecture:** Keep the existing router and page registry. Separate revealed-domain state from current-route state in `control-navigation.js`, render navigation markup once, then synchronize route state in place so ordinary child navigation does not replace the nav DOM. Use a small FLIP-style reveal transition only when the expanded domain changes. Apply the approved borderless surface and interaction tokens through existing Control CSS files instead of redesigning page modules.

**Tech Stack:** Browser-native HTML/CSS/ES modules, Node 20+ built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-control-sidebar-polish.md`

## Global Constraints

- Exact base: `2c58e3c2a1b89e8e4cebf656dfc21b34c4cdbe4a` from `web/rob-bot-site-production`.
- Work only on `web/control-sidebar-polish-r1`.
- No API, database, Discord bot runtime, command-contract, or save/revision/conflict changes.
- No Discord bot restart.
- No commit or push unless the user separately requests it.
- Parent section clicks reveal only.
- Analytics belongs with Commands and Activity.
- Same-domain child navigation must not rebuild or animate the sidebar.
- Preserve reduced-motion and keyboard-focus behavior.

---

### Task 1: Freeze navigation/state/markup contracts with RED tests

**Files:**
- Create: `web-tests/control-sidebar-polish.test.js`
- Modify later: `docs-site/control-navigation.js`
- Modify later: `docs-site/control-components.js`
- Modify later: `docs-site/control-app.js`

**Interfaces:**
- `createNavigationState(...).revealDomain(domainKey)` changes only `expandedDomain`.
- `navigationModel(current, expandedDomain)` returns expandable domains in `primary` and Analytics/Commands/Activity in `secondary`.
- `navigationMarkup(model)` renders no chevron and exposes current-domain marker markup.

- [ ] **Step 1: Write failing tests**

Add tests that assert:

```js
const state = createNavigationState({ currentPath: '/control/community/reputation' });
state.revealDomain('content');
assert.equal(state.current.path, '/control/community/reputation');
assert.equal(state.expandedDomain, 'content');

const model = navigationModel(destinationForPath('/control/community/reputation'), 'content');
assert.deepEqual(model.primary.map(item => item.key), [
  'community', 'content', 'utilities', 'workflows', 'mappings',
]);
assert.deepEqual(model.secondary.map(item => item.path), [
  '/control/analytics', '/control/commands', '/control/activity',
]);

const markup = navigationMarkup(model);
assert.doesNotMatch(markup, /⌄/);
assert.match(markup, /control-nav-marker/);
```

Also read `control-app.js` in the test and assert the parent-domain click path uses `revealDomain` without calling `navigate`, and the ordinary `navigate()` block does not call `renderNavigation()`.

- [ ] **Step 2: Run RED**

Run:

```text
node --test web-tests/control-sidebar-polish.test.js
```

Expected: FAIL because `revealDomain` does not exist, Analytics is still primary, the chevron is still present, and `navigate()` still rebuilds navigation.

---

### Task 2: Implement reveal-only state, secondary Analytics, and in-place nav synchronization

**Files:**
- Modify: `docs-site/control-navigation.js`
- Modify: `docs-site/control-components.js`
- Modify: `docs-site/control-app.js`
- Test: `web-tests/control-sidebar-polish.test.js`
- Update: `web-tests/control-navigation.test.js`

**Interfaces:**
- `revealDomain(domainKey)` returns the unchanged current destination and updates only expandable-domain state.
- Existing `select(path)` continues to update current-route memory; selecting a route in an expandable domain may make that domain current, but route selection must not force a full nav DOM rebuild.
- Initial `renderNavigation()` remains responsible for creating the nav DOM and wiring listeners.
- Ordinary route changes synchronize `aria-current`, current-domain marker, and route classes in place.

- [ ] **Step 1: Minimal state/model implementation**

Update `control-navigation.js` so expandable domains remain the five section switchers, `revealDomain` changes only the revealed domain, and `navigationModel` places Analytics at the start of `secondary`. Preserve route memory.

- [ ] **Step 2: Minimal markup implementation**

Update `navigationMarkup()` to remove the literal chevron. Render a `.control-nav-marker` only for the current expandable domain and add data hooks needed for in-place synchronization.

- [ ] **Step 3: Minimal app synchronization implementation**

Change the domain-button handler to:

```js
navState.revealDomain(button.dataset.domainSelect);
persistNavigation();
// mutate expanded/hidden state and run reveal reflow; do not navigate
```

Change `navigate()` so it updates current-route state and calls an in-place navigation sync instead of `renderNavigation()`. Same-domain child selection must only move `aria-current` and main-page state. Do not recreate the nav tree.

For revealed-domain changes, record domain section rects before visibility changes, update `hidden`/`aria-expanded`, then animate displaced sections from their old Y positions to zero over approximately 190 ms with `cubic-bezier(.2,.8,.2,1)`. Add the 120 ms incoming-child fade.

- [ ] **Step 4: Run focused GREEN tests**

Run:

```text
node --test web-tests/control-sidebar-polish.test.js web-tests/control-navigation.test.js web-tests/control-foundation-regressions.test.js
```

Expected: PASS.

---

### Task 3: Freeze footer/theme/card/button visual contracts with RED tests

**Files:**
- Modify: `web-tests/control-sidebar-polish.test.js`
- Modify later: `docs-site/control.html`
- Modify later: `docs-site/control.css`
- Modify later: `docs-site/control-community.css`
- Modify later: `docs-site/control-content.css`
- Modify later: `docs-site/control-utilities.css`
- Modify later: `docs-site/control-analytics-workflows.css`
- Modify later: `docs-site/control-mappings.css`
- Modify later: `docs-site/control-secondary.css`

- [ ] **Step 1: Add failing static visual-contract assertions**

Tests must assert that:

```js
assert.match(controlHtml, /Rob-bot Control Panel/);
assert.doesNotMatch(themeBlock, />Dark<|>Light<|>System</);
assert.match(themeBlock, /aria-label="Dark theme"/);
assert.match(themeBlock, /aria-label="Light theme"/);
assert.match(themeBlock, /aria-label="Follow system theme"/);
```

Also assert the approved card selectors no longer have a decorative `border: 1px` declaration and do have a shadow/elevation treatment, and assert nav/theme/action CSS contains visible `:hover`, `:active`, and `:focus-visible` states plus reduced-motion handling.

- [ ] **Step 2: Run RED**

Run:

```text
node --test web-tests/control-sidebar-polish.test.js
```

Expected: FAIL on the current two-line brand, visible theme words, bordered card surfaces, and weaker interaction contract.

---

### Task 4: Implement the approved visual polish

**Files:**
- Modify: `docs-site/control.html`
- Modify: `docs-site/control.css`
- Modify: `docs-site/control-community.css`
- Modify: `docs-site/control-content.css`
- Modify: `docs-site/control-utilities.css`
- Modify: `docs-site/control-analytics-workflows.css`
- Modify: `docs-site/control-mappings.css`
- Modify: `docs-site/control-secondary.css` only for interaction consistency where needed
- Test: `web-tests/control-sidebar-polish.test.js`

- [ ] **Step 1: Footer and theme controls**

Change the brand to one-line `Rob-bot Control Panel`. Replace visible theme text with inline moon, sun, and display SVGs. Keep `data-theme-choice`, `aria-pressed`, accessible `aria-label`s, and `title`s. Target approximately 42 px circular controls.

- [ ] **Step 2: Sidebar interaction styling**

Match the approved companion: stronger hover tonal fill, pressed `scale(.985)` on navigation controls, current-child surface, open-section subtle surface, 120 ms marker/children fade, and 190 ms reflow. Keep explicit focus-visible rings.

- [ ] **Step 3: Borderless card surfaces**

Remove decorative outlines from the card/panel selectors named in the spec. Preserve form-field borders, row/list dividers, validation borders, rail separators, and focus rings. Use existing surface colors plus restrained shadows/elevation; do not turn document-style Workflow/Commands/Activity lists into cards.

- [ ] **Step 4: Button interactivity**

Add consistent hover and pressed feedback to Control action buttons without changing disabled semantics. Keep primary actions high-contrast and secondary actions tonal. Reduced-motion must collapse the transform/transition feedback.

- [ ] **Step 5: Run focused GREEN tests**

Run:

```text
node --test web-tests/control-sidebar-polish.test.js web-tests/control-foundation-regressions.test.js web-tests/control-stage3.test.js web-tests/control-typography-contract.test.js
```

If a named existing test file differs, use the actual matching Control foundation/stage/typography tests discovered in the worktree.

---

### Task 5: Full verification and localhost visual comparison

**Files:**
- No new production files expected.

- [ ] **Step 1: Ensure dependencies are present**

Run `npm install` only if the worktree is missing the declared package dependency required by existing web tests. Confirm `package.json`/lockfile are not unintentionally changed.

- [ ] **Step 2: Full web tests**

Run:

```text
npm run test:web
```

Expected: all web tests pass.

- [ ] **Step 3: JavaScript syntax check**

Run:

```text
npm run check:web
```

Expected: exit 0.

- [ ] **Step 4: Diff hygiene**

Run:

```text
git diff --check
git status --short --branch --untracked-files=all
git diff -- docs-site web-tests docs/superpowers
```

Expected: only the sidebar-polish spec/decision/plan, Control HTML/CSS/JS, and focused web tests are changed. No generated/public output is required unless the repository verification flow explicitly produces it.

- [ ] **Step 5: Localhost visual pass**

Serve the actual `docs-site` from this worktree on a fresh localhost port. Compare the real Control shell against the approved final companion for:

- section-switcher hierarchy and no chevrons;
- reveal-only parent behavior and smooth reflow;
- current-page marker behavior;
- no same-domain child flicker;
- Analytics/Commands/Activity grouping;
- one-line `Rob-bot Control Panel`;
- icon-only theme controls;
- borderless card surfaces;
- hover/pressed/focus states.

Use the user's approved companion as the visual target. Do not claim visual completion from automated tests alone.

- [ ] **Step 6: Stop without commit/push**

Report the verified working-tree state and localhost URL. Do not commit or push unless the user separately requests publication.
