# All Commands redesign implementation plan

Date: 2026-08-30
Status: approved for implementation
Spec: `docs/superpowers/specs/2026-08-30-all-commands-redesign.md`
Decision: `docs/superpowers/decisions/2026-08-30-all-commands-redesign.md`

## Goal

Replace the legacy `/commands` handbook shell with the approved public All Commands Control-sibling shell while preserving the authoritative manual, command anchors, search, and routing.

## Dependencies

- Worker branch `web/site-commands-redesign-r1` must start exactly at `8c3695c389edbedbb05500c78a41815bf2155c66`.
- Existing Control shell, theme, navigation, and typography patterns at that base are the implementation reference.
- `docs/commands.md` remains the canonical content source and is not forked.

## Global constraints

- Follow `AGENTS.md` and the linked accepted spec.
- Do not redesign the approved information architecture.
- Use test-first development.
- Do not change bot runtime, migrations, Discord OAuth configuration, or bot-hosting behavior.
- Do not move `main` or `web/rob-bot-site-production`.
- Do not promote Vercel Production.
- Routine command-page UI text must not be below 13px; metadata uses 13px / 18px where appropriate.

## File table

| Path | Action | Purpose |
| --- | --- | --- |
| `docs/superpowers/specs/2026-08-30-all-commands-redesign.md` | create | Record the approved user contract. |
| `docs/superpowers/decisions/2026-08-30-all-commands-redesign.md` | create | Record the reuse/shell decision. |
| `docs/superpowers/plans/2026-08-30-all-commands-redesign.md` | create | Record this execution plan. |
| `web-tests/commands-redesign.test.js` | create | Focused TDD regressions for shell, theme, typography, anchors, search, public access, and routing. |
| `docs-site/commands.html` | modify | Replace handbook chrome with the Control-sibling All Commands shell. |
| `docs-site/commands.css` | modify | Align command reference presentation to Control tokens, responsive behavior, and typography floor. |
| `docs-site/commands.js` | modify | Reuse Control theme/drawer behavior while retaining content rendering, anchors, and search. |

Files outside this table require stopping and updating the plan first.

## Task 1: Lock the approved shell contract with RED tests

### Files

- Create: `web-tests/commands-redesign.test.js`

### Behavior

The focused tests prove the legacy page currently violates the approved contract. They cover removal of handbook shell chrome, All Commands IA, dark-default Control theme behavior, the 13px typography floor, preservation of command anchors and Control deep links, search behavior, public access, canonical rewrites, and unchanged command content source.

### Test first

Run:

```bash
node --test web-tests/commands-redesign.test.js
```

Expected: FAIL against the current legacy `/commands` shell for the redesign assertions, with routing/content-preservation assertions remaining diagnostic.

### Implement

Do not change production files in this task. Confirm the failure is caused by the legacy shell/theme/typography state.

## Task 2: Replace the page shell and theme/navigation integration

### Files

- Modify: `docs-site/commands.html`
- Modify: `docs-site/commands.js`

### Behavior

Use Control shell classes and shared theme/drawer modules. Default to Dark, retain Light/System, add the `/` and `/handbook` navigation, keep workflow hash navigation and search controls, expose the `All Commands` heading, and require no authentication. Existing markdown rendering and anchor generation stay in place.

### Verify

Run:

```bash
node --test web-tests/commands-redesign.test.js
npm run check:web
```

Expected: focused shell/theme/search/anchor tests pass and JavaScript syntax checks are clean.

## Task 3: Align command-reference styling to Control

### Files

- Modify: `docs-site/commands.css`

### Behavior

Remove the legacy visual-system dependency. Use Control surfaces, borders, focus behavior, spacing, responsive thresholds, wrapping, 44px primary targets, reduced-motion handling, 13px / 18px metadata, and no routine font size below 13px. Keep command cards, workflow grouping, tables, and search usable at narrow widths and near 200% zoom.

### Verify

Run:

```bash
node --test web-tests/commands-redesign.test.js
npm run check:web
```

Expected: all focused regressions pass with no command-page typography-floor violations.

## Final verification

Run:

```bash
node --test web-tests/commands-redesign.test.js
npm run check:web
npm run test:web
npm run build
git diff --check
```

If the build's Python compile step cannot find a system `python` shim, verify that step through the repository-supported `uv` environment instead of classifying the missing shim as an application failure.

Inspect the final diff from the exact base and confirm only the file-table paths changed, with no runtime or migration files. Commit and push only `web/site-commands-redesign-r1`. Then verify the Vercel Preview associated with the exact final worker SHA reaches READY. Re-read `main` and `web/rob-bot-site-production` refs and confirm neither moved because of this worker.

## Stop conditions

Stop if the local worker branch is not at the exact required starting SHA before edits, the canonical command manual/rendering assumptions no longer hold, required verification reveals an unrelated baseline failure that prevents trustworthy completion, or Vercel cannot produce a Preview for the pushed worker SHA.
