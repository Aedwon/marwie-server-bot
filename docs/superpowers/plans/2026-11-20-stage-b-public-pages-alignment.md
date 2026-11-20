# Stage B: Public Pages (`/handbook` and `/commands`) Design-System Alignment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align All Commands (`/commands`, `docs-site/commands.html`) and Handbook (`/handbook`, `docs-site/index.html`) onto the canonical Control design system (`paper`/`ink`/`sky`, Figtree `400`/`500`/`600`, `>= 12px` metadata floor, System theme default with full Light/Dark parity) while fixing live drawer/shell bugs on both pages and keeping markup changes strictly minimal.

**Architecture:** `/commands` drops `/styles.css`, loads Figtree `400;500;600`, switches default theme to `system`, aligns `.commands-shell` with `control.css` using an `< 876px` drawer threshold (preserving a `>= 600px` workspace floor with no rail mode), fixes `installDrawerController({ isDrawer })` and the Escape-key search conflict, and rewrites `commands.css` onto canonical Control tokens. `/handbook` keeps `/styles.css` returning HTTP 200, migrates `styles.css`, `home.css`, and `visual.css` (resolving cascade priority cleanly) off `#365544` green and SF Pro onto canonical paper/ink/sky tokens, fixes `app.js` theme persistence and mobile drawer `inert`/focus handling, and removes only the stale `"45 slash commands"` count without rearranging Handbook navigation or sections.

**Tech Stack:** Static HTML, CSS custom properties, vanilla ES modules (`docs-site/commands.js`) and deferred script (`docs-site/app.js`), Node.js `node:test`.

**Master Plan:** `docs/superpowers/plans/2026-11-20-website-improvements-critical-path.md`
**Design System:** `docs/superpowers/specs/2026-10-16-control-design-system.md`
**Superseded Spec Clause:** `docs/superpowers/specs/2026-08-30-all-commands-redesign.md:28` (dark appearance by default -> System default)

## Global Constraints

- Execute all edits in `/Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1` on branch `web/control-redesign-finish-r1`. Never touch `main`, Python code, or `/Users/aedwon/Documents/Projects/marwie-server-bot/data/marwie.db`.
- Preserve site routing verbatim (`/` -> `control.html`, `/handbook` -> `index.html`, `/commands` -> `commands.html`) and keep `/styles.css` served with HTTP 200.
- Preserve all 43 command anchors, search (`/` and `Esc`), workflow table structure, `<dialog>` detail viewer, and `docs-site/commands.md === docs/commands.md` untouched.
- Preserve pinned unversioned imports `./control-theme.js` and `./control-navigation.js` in `docs-site/commands.js` (`web-tests/commands-redesign.test.js:71-72`).
- Enforce canonical Design System tokens (`#fcfcfb`/`#ffffff`/`#f4f4f2`/`#111113`/`#4a4a4f`/`#6e6e73`/`#ebebea`/`#dcdcda`/`#7db9e8`/`#2f6fa3` light; `#0f0f11`/`#19191c`/`#1b1b1e`/`#ececee`/`#adadb3`/`#8b8b91`/`#232327`/`#34343a`/`#7db9e8` dark). Zero legacy green hex (`#365544`, `#eaf0ec`, `#2f4d3d`, `#a8c9b2`, `#25352b`, `#bee0c8`, `#28623b`, `#8fd49e`) or legacy neutral hex (`#171719`, `#1d1d1f`, `#f5f5f7`) on public pages.
- Enforce Figtree weights strictly in `{400, 500, 600}` (zero `650` or `700`) across `commands.css`, `styles.css`, `home.css`, and `visual.css`.
- Enforce typography floors: `commands.css` keeps every `font-size >= 13px` and `.search-status`/`.permission-badge` at exact `13px / 18px`; `styles.css`/`home.css`/`visual.css` keep every `font-size >= 12px`.
- Verify WCAG 2.2 AA contrast on actual rendered surfaces (`--text-tertiary` `#6e6e73` on `#fcfcfb` = 4.94:1 AA; `--accent-info` `#2f6fa3` on `#fcfcfb` = 5.21:1 AA; `--accent-info` `#7db9e8` on `#19191c` = 8.33:1 AAA; never use `--text-faint` for essential small text). For `.command-search-field`, pair `--stroke-control` with strong visual cues (search icon in `--text-secondary`, contrasting input surface, `/` `<kbd>`, and `2px solid var(--focus-ring)` on `:focus-within`).
- Do not push to remote.

## File Structure

- **Modify:** `docs/superpowers/decisions/2026-11-20-website-public-and-analytics-alignment.md` — record `/commands` System-default supersession and `< 876px` drawer threshold.
- **Create:** `web-tests/public-pages-design-system.test.js` — contract tests for `/commands` and `/handbook` canonical tokens, zero legacy green/old neutral hex, Figtree 400/500/600 weights, typography floors, shell/drawer sync, Escape precedence, and Handbook drawer `inert`/focus & theme persistence.
- **Modify:** `web-tests/commands-redesign.test.js:63-75` — update forced-Dark assertion to System default, zero `/styles.css`, Figtree link, and `isDrawer` controller wiring.
- **Modify:** `docs-site/commands.html`, `docs-site/commands.css`, `docs-site/commands.js` — System default, Figtree, drop `/styles.css`, canonical tokens, `< 876px` shell/drawer sync, Escape guard, bump to `commands.css?v=8`, `commands.js?v=8`.
- **Modify:** `docs-site/index.html`, `docs-site/styles.css`, `docs-site/home.css`, `docs-site/visual.css`, `docs-site/app.js` — Figtree, paper/ink/sky tokens with coherent `visual.css` cascade, `>= 12px` floor, remove stale `"45 slash commands"` count, fix `app.js` theme `{ persist: true }` and mobile drawer `inert`/focus handling, bump to `styles.css?v=15`, `home.css?v=3`, `visual.css?v=2`, `app.js?v=18`.

---

### Task 1: Decision Log Update and Visual Companion Mockup Gate

**Files:**
- Modify: `docs/superpowers/decisions/2026-11-20-website-public-and-analytics-alignment.md`

**Interfaces:**
- Produces: Recorded design-reversal decision for `/commands` System default & `< 876px` drawer breakpoint plus inline visual proposals for `/commands` and `/handbook`.

- [ ] **Step 1: Append Stage B decision entry**

Append a `## Public pages design-system alignment` section to `docs/superpowers/decisions/2026-11-20-website-public-and-analytics-alignment.md` recording:
- `/commands` switches from forced Dark default (`2026-08-30-all-commands-redesign.md:28`) to **System default** matching Control and Design System §32.
- `/commands` drops `/styles.css` and uses `< 876px` (`max-width: 875px`) for its drawer breakpoint (`240px` sidebar + `600px` center floor + gaps = `876px`, matching `control-shell-layout.js:22` `labelsNoContext`, since `/commands` has no icon-only rail).
- `/handbook` migrates `styles.css`/`home.css`/`visual.css` off `#365544` green and SF Pro onto canonical paper/ink/sky tokens, Figtree `400`/`500`/`600`, `>= 12px` floor, and `inert` offscreen mobile drawer handling while keeping `/styles.css` served with HTTP 200 and leaving Handbook structure untouched.

- [ ] **Step 2: Render concise Visual Companion mockups via `html_preview` + `html_render`**

Preview light (`728px`), dark (`728px`), and mobile (`390px`) mockups for `/commands` and `/handbook`, confirm clear hierarchy and AA contrast, then call `html_render` before modifying HTML/CSS/JS.

- [ ] **Step 3: Commit decision log update on `web/control-redesign-finish-r1`**

```bash
cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1
git add docs/superpowers/decisions/2026-11-20-website-public-and-analytics-alignment.md
git commit -m "docs(web): record public pages system-theme and breakpoint alignment"
```

---

### Task 2: Align All Commands (`/commands`) and Fix Shell/Drawer/Escape Bugs (TDD)

**Files:**
- Create: `web-tests/public-pages-design-system.test.js`
- Modify: `web-tests/commands-redesign.test.js:63-75`
- Modify: `docs-site/commands.html`
- Modify: `docs-site/commands.css`
- Modify: `docs-site/commands.js:74-95,510-526`

**Interfaces:**
- Consumes: `docs-site/control.css?v=32`, `docs-site/control-theme.js` (`installThemeControls`), `docs-site/control-navigation.js` (`installDrawerController`).
- Produces: `/commands` shell with `data-nav-mode="expanded|drawer"` + `data-context-mode="none"` synced at `max-width: 875px`, interactive desktop sidebar (never `inert`), Escape precedence keeping active search intact when closing the drawer, System default, zero `/styles.css`, `commands.css?v=8`, `commands.js?v=8`.

- [ ] **Step 1: Write failing tests in `web-tests/commands-redesign.test.js` and `web-tests/public-pages-design-system.test.js`**

Update `web-tests/commands-redesign.test.js:63-75`:
```js
test('All Commands defaults to System and reuses Control theme and drawer behavior', () => {
  assert.match(commandsHtml, /<html[^>]*data-theme="light"[^>]*data-preference="system"/);
  assert.match(commandsHtml, /localStorage\.getItem\('rob-doc-theme'\) \|\| 'system'/);
  assert.match(commandsHtml, /<meta name="theme-color" content="#fcfcfb" id="themeColor">/);
  assert.match(commandsHtml, /fonts\.googleapis\.com\/css2\?family=Figtree:wght@400;500;600/);
  assert.doesNotMatch(commandsHtml, /\/styles\.css/);
  assert.match(commandsHtml, /class="control-shell commands-shell"[^>]*data-nav-mode="expanded"[^>]*data-context-mode="none"/);
  const appearanceStart = commandsHtml.indexOf('class="control-appearance"');
  assert.ok(appearanceStart >= 0);
  const appearance = commandsHtml.slice(appearanceStart, commandsHtml.indexOf('</div>', appearanceStart));
  assert.ok(appearance.indexOf('data-theme-choice="dark"') < appearance.indexOf('data-theme-choice="light"'));
  assert.ok(appearance.indexOf('data-theme-choice="light"') < appearance.indexOf('data-theme-choice="system"'));
  assert.match(appearance, /data-theme-choice="system"[^>]*aria-pressed="true"/);
  assert.match(commandsJs, /import \{ installThemeControls \} from '\.\/control-theme\.js';/);
  assert.match(commandsJs, /import \{ installDrawerController \} from '\.\/control-navigation\.js';/);
  assert.match(commandsJs, /installThemeControls\s*\(/);
  assert.match(commandsJs, /installDrawerController\s*\(/);
  assert.match(commandsJs, /isDrawer\s*:/);
  assert.doesNotMatch(commandsJs, /mediaQuery\s*:/);
});
```

Add `/commands` tests in `web-tests/public-pages-design-system.test.js`:
- Zero weights outside `{400, 500, 600}` in `commands.css`.
- Zero stale tokens/hex (`--control-border`, `--control-surface`, `--control-muted`, `--page-surface`, `#1d1d1f`, `#171719`, `#365544`).
- Canonical Control tokens present (`--surface-primary`, `--surface-secondary`, `--surface-hover`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--stroke-subtle`, `--stroke-control`, `--focus-ring`).
- Scrollable nav wrapper rule `.commands-nav-body` present in `commands.css`.
- `commands.js` uses `matchMedia('(max-width: 875px)')`, syncs `dataset.navMode` + `drawerController.sync()` on load and `change`, and guards window Escape with `event.defaultPrevented || dialog?.open || commandDrawer?.dataset.open === 'true'`.
- `commands.html` loads `commands.css?v=8` and `commands.js?v=8`.

- [ ] **Step 2: Run tests to verify RED**

Run: `cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1 && TZ=Asia/Manila node --test web-tests/commands-redesign.test.js web-tests/public-pages-design-system.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `/commands` alignment**

1. **`docs-site/commands.html`**:
   - `<html lang="en" data-theme="light" data-preference="system">`, `<meta name="theme-color" content="#fcfcfb" id="themeColor">`, boot script default `'system'`.
   - Load Figtree `400;500;600`, `/control.css?v=32`, `/commands.css?v=8` (remove `/styles.css?v=14`).
   - `<div class="control-shell commands-shell" data-nav-mode="expanded" data-context-mode="none">`.
   - Wrap `<nav class="control-primary-nav ...">` and `<nav class="control-secondary-nav ...">` in `<div class="commands-nav-body">`, and wrap `<a class="control-brand">` + `<div class="control-appearance">` in `<div class="control-rail-foot">` (setting `system` button `aria-pressed="true"` and `dark`/`light` `aria-pressed="false"`).
   - `<script type="module" src="/commands.js?v=8"></script>`.
2. **`docs-site/commands.js`**:
   - Keep unversioned imports `./control-navigation.js` and `./control-theme.js` unchanged.
   - Replace lines 74–90 with `< 876px` (`max-width: 875px`) breakpoint, `isDrawer: () => commandNarrow.matches`, `syncCommandShell()` on boot and `commandNarrow.addEventListener?.('change', syncCommandShell)`, and `drawerController.close({ restoreFocus: false })` on `#workflow-*` anchor click.
   - In `setupCommandSearch` window `keydown` handler (line 512): check `if (event.defaultPrevented || dialog?.open || commandDrawer?.dataset.open === 'true') return;` so Escape closing the drawer never clears search or steals focus.
3. **`docs-site/commands.css`**:
   - Add `.commands-nav-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; }`.
   - Replace all `--control-border`, `--control-surface`, `--control-muted`, `--page-surface`, `--surface`, `--text` with canonical Control tokens (`--stroke-subtle`, `--stroke-control`, `--surface-primary`, `--surface-secondary`, `--surface-hover`, `--text-primary`, `--text-secondary`, `--text-tertiary`, `--focus-ring`, `--shadow-floating`).
   - Replace all `font-weight: 650` and `700` with `500` or `600`.
   - Keep `.command-search-field` visibly distinct via `--surface-primary` background, `1px solid var(--stroke-control)` border, `--text-secondary` search icon, `/` `<kbd>`, and `2px solid var(--focus-ring)` on `:focus-within`.
   - Keep `@media (max-width: 875px)` hiding `.commands-nav-context`, and `@media (max-width: 639px)` setting `.command-search-field input { font-size: 16px; }`.
   - Keep all `font-size >= 13px` and `.search-status`/`.permission-badge` at exact `font-size: 13px; line-height: 18px;`.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1 && TZ=Asia/Manila node --test web-tests/commands-redesign.test.js web-tests/commands-r3.test.js web-tests/public-pages-design-system.test.js`
Expected: PASS.

---

### Task 3: Align Handbook (`/handbook`, `docs-site/index.html`) Tokens, Typography, and Drawer Accessibility (TDD)

**Files:**
- Modify: `web-tests/public-pages-design-system.test.js`
- Modify: `docs-site/index.html:1-25,64-70,165-170`
- Modify: `docs-site/styles.css`
- Modify: `docs-site/home.css`
- Modify: `docs-site/visual.css`
- Modify: `docs-site/app.js:264-301`

**Interfaces:**
- Produces:
  - Minimal `index.html` head/version/subtitle update (keeps existing Handbook sidebar sections and document structure intact).
  - Canonical paper/ink/sky tokens across `styles.css?v=15` (still HTTP 200), `home.css?v=3`, and `visual.css?v=2` (with winning cascade rules aligned so `visual.css` does not clobber `styles.css`).
  - `app.js?v=18` with passive-boot non-persisting theme init + `{ persist: true }` on click, `#0f0f11`/`#fcfcfb` `theme-color`, and accessible mobile drawer (`inert` on closed `#sidebar`, `inert` on `<main>` while open, focus targeting visible `.nav a` instead of hidden `.brand`, and no focus-steal on `#section` anchor navigation).

- [ ] **Step 1: Add failing Handbook tests to `web-tests/public-pages-design-system.test.js`**

Test:
1. `docs-site/index.html` loads Figtree `400;500;600`, sets `<meta name="theme-color" content="#fcfcfb" id="themeColor">`, keeps `data-preference="system"` and `localStorage.getItem('rob-doc-theme') || 'system'`, omits stale `"45 slash commands"`, and references `/styles.css?v=15`, `/home.css?v=3`, `/app.js?v=18`.
2. `docs-site/styles.css`, `docs-site/home.css`, and `docs-site/visual.css`:
   - Zero legacy green or old neutral hex (`#365544`, `#eaf0ec`, `#2f4d3d`, `#a8c9b2`, `#25352b`, `#bee0c8`, `#171719`, `#1d1d1f`, `#f5f5f7`).
   - Zero `SF Pro Text`; `styles.css` declares `Figtree` in `--font-sans`.
   - Zero `font-weight` outside `{400, 500, 600}`.
   - Zero numeric `font-size` below `12px` (checking both `font-size:` and shorthand `font:`).
   - Canonical light/dark tokens (`#fcfcfb`, `#0f0f11`, `#ffffff`, `#19191c`, `#111113`, `#ececee`, `#2f6fa3`, `#7db9e8`) defined cleanly; `home.css` imports `/visual.css?v=2`.
   - `visual.css` uses canonical `var(--surface-*)` / `var(--stroke-*)` and never overrides `.theme-switcher` or `.nav a` back to legacy colors/sizes.
3. `docs-site/app.js`:
   - Sets `themeColor.content` to `#0f0f11` / `#fcfcfb` (zero `#171719` / `#ffffff`).
   - Calls `applyTheme(button.dataset.themeChoice, { persist: true })` on click and `applyTheme(..., { persist: false })` on boot/media change.
   - Synchronizes `side.inert`, `main.inert`, and `aria-hidden` on `#sidebar` via `matchMedia('(max-width: 900px)')`, focuses `.nav a, .theme-switcher button` (never hidden `.brand`) on open, restores focus to `#menuBtn` on Escape/toggle close, and does not steal focus when closing on an in-page `#section` link.

- [ ] **Step 2: Run test to verify RED**

Run: `cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1 && TZ=Asia/Manila node --test web-tests/public-pages-design-system.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement Handbook migration**

1. **`docs-site/index.html`** (minimal targeted edits only):
   - `<meta name="theme-color" content="#fcfcfb" id="themeColor">`
   - Add `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600&amp;display=swap">`
   - Update `/styles.css?v=15`, `/home.css?v=3`, `/app.js?v=18`
   - Line 68: `<div class="release">V1 · slash commands require confirmation</div>`
2. **`docs-site/styles.css`, `docs-site/visual.css`, `docs-site/home.css`**:
   - Define canonical Design System tokens on `:root` (`color-scheme: light`) and `html[data-theme="dark"]` (`color-scheme: dark`) in `styles.css`, mapping internal variables (`--bg`, `--sidebar`, `--surface`, `--surface-soft`, `--text`, `--muted`, `--quiet`, `--border`, `--border-strong`, `--accent`, `--accent-soft`, `--accent-text`, `--focus`, `--code-bg`) directly to canonical semantic tokens.
   - Set `body` font to `16px/1.6 var(--font-sans)` (`Figtree`).
   - Replace every `font-weight: 650`/`700` across all three files with `500` or `600`.
   - Raise every `< 12px` font size (`10px`, `10.5px`, `11px`, `11.5px`) across all three files to `12px` minimum.
   - Align `visual.css` (which loads AFTER `styles.css` via `home.css`) so it reinforces instead of clobbering `styles.css`:
     - `--page-surface: var(--surface-secondary)`, `--page-surface-strong: var(--surface-selected)`, `--hairline: var(--stroke-subtle)`.
     - `.nav a` keeps `min-height: 36px;` (desktop) and `44px` on `<= 600px`; `.nav a[aria-current="true"]` uses `background: var(--surface-selected); color: var(--text-primary); box-shadow: inset 0 0 0 1px var(--stroke-selected);`.
     - `.theme-switcher` keeps `background: var(--surface-secondary); padding: 3px; border-radius: 10px;` and active button uses `background: var(--surface-primary); color: var(--text-primary); box-shadow: 0 1px 2px rgb(0 0 0 / 8%);`.
   - In `home.css`: `@import url('/visual.css?v=2');`, update `.setup-principle` to `background: var(--status-info-bg); border: 1px solid var(--status-info-stroke);`, and `.task-card` to `background: var(--surface-primary);` with `:hover { background: var(--surface-hover); }`.
3. **`docs-site/app.js`**:
   - `applyTheme(pref, { persist = false } = {})`: persist only when `persist` is `true`, and pass `{ persist: true }` inside the theme button click handler; set `themeColor.content = actual === 'dark' ? '#0f0f11' : '#fcfcfb'`.
   - Synchronize mobile `#sidebar` drawer + `<main>` background `inert` state on `matchMedia('(max-width: 900px)')` boot and `change`:
     - When `narrow && !open`: `side.inert = true`, `side.setAttribute('aria-hidden', 'true')`, `main.inert = false`.
     - When `narrow && open`: `side.inert = false`, `side.removeAttribute('aria-hidden')`, `main.inert = true`, focus `side.querySelector('.nav a, .theme-switcher button')`.
     - When `!narrow`: remove `.open`, set `side.inert = false`, `main.inert = false`, remove `aria-hidden`.
     - Escape and `#menuBtn` toggle close restore focus to `#menuBtn`; clicking an in-page `#section` link closes without stealing focus from the target anchor.

- [ ] **Step 4: Run full web verification gates on `web/control-redesign-finish-r1`**

```bash
cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1
TZ=Asia/Manila npm run check:web
TZ=Asia/Manila npm run test:web
git diff --check
```
Expected: ALL pass with 0 failures.

- [ ] **Step 5: Commit Stage B on `web/control-redesign-finish-r1` using named paths**

```bash
cd /Users/aedwon/Documents/Projects/marwie-server-bot-wt-control-redesign-finish-r1
git add \
  docs-site/commands.html \
  docs-site/commands.css \
  docs-site/commands.js \
  docs-site/index.html \
  docs-site/styles.css \
  docs-site/home.css \
  docs-site/visual.css \
  docs-site/app.js \
  web-tests/commands-redesign.test.js \
  web-tests/public-pages-design-system.test.js
git diff --cached --stat
git commit -m "feat(web): align Handbook and All Commands with Control design system"
```
