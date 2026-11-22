# Control command center redesign

Date: 2026-11-23
Status: approved direction (owner), element detail per this spec
Decision record: `docs/superpowers/decisions/2026-11-23-control-command-center-redesign.md`
Visual reference: `docs/superpowers/specs/assets/2026-11-23-control-c2-prototype.html` (open in a browser; the dark bar at the top is review tooling, not product)

## Goal

Control, All Commands and Handbook become one product with one shell. Every page answers "what is this, is anything wrong, what can I change" with nothing repeated. Motion is short, purposeful and continuous: nothing jumps, overlaps or pops.

## Scope

Included:

- Shell: top bar, sidebar, rail, drawer, account menu, server menu, command palette, page transition, save bar.
- Page model: settings rows, master switch row, inline editing, field-level problems, disclosure.
- Every Control destination restyled to the page model. Context panel content moved into pages.
- New Overview page as the Control home.
- All Commands and Handbook moved into the shell.
- Motion tokens and every animation.
- Light, dark, phone, keyboard, reduced motion.

Not included:

- Bot runtime, API contracts, snapshot schema, save semantics. The page save request built by `control-state.js` stays the same shape.
- New features or settings that do not exist today.
- Signed-out landing redesign beyond fitting the shell (sign-in card centered in the main area).

## Standards applied

Sheets in `~/Documents/Projects/agent-standards/`.

- Layout and hierarchy: WEB-L1, WEB-L2, WEB-L3, WEB-L4, GD-GRID, GD-GAP, GD-ONE-LEAD, GD-SQUINT.
- Type: WEB-T1, WEB-T2, WEB-T6, WEB-T7, TYP-SCALE, TYP-NUM-TAB.
- Color: WEB-C1, WEB-C2 (field boundaries 3:1), WEB-C3 (problems carry an icon and words, not color alone), WEB-C5, WEB-C6.
- Surfaces: WEB-S1, WEB-S2, WEB-S3.
- Motion: WEB-M1 to WEB-M13.
- Interaction and disclosure: WEB-I1 to WEB-I11.
- Accessibility: WEB-A1, WEB-A2, WEB-WCAG20AA (project target WCAG 2.2 AA).
- Tokens: WEB-K2, WEB-K4, WEB-K5, WEB-K6.
- Anti-patterns to avoid: WEB-G4 (three equal icon cards), WEB-G5, WEB-G6 (left accent bars), WEB-G7, WEB-G9, WEB-G10 (page-wide staggered fade), WEB-G12 (remove-one test).
- Copy: UXW-CONCISE, UXW-FRONT, UXW-PLAIN, UXW-BUTTON, UXW-ERROR, UXW-TERMS, UXW-CASE, UXW-LEAVE.
- Owner taste rules (decision 2): no dotted pills, healthy says nothing, one fact once, disclose secondary content.

## Global rules

1. A healthy state renders no status text, chip or icon.
2. A problem renders once: at the setting that fixes it, as a warning icon plus one sentence of what happened and its effect ("Deleted in Discord. Quizzes can't post."). The same problem also appears on Overview and as a nav flag. No other place.
3. No pill, chip or badge with a leading dot. `stateChipMarkup` is deleted.
4. Every editable value uses a standard control with a visible boundary (WEB-C2, WEB-I11): bordered select, bordered number input with unit, switch. No borderless "quiet" inputs.
5. A page shows its core first. Long explanations, rare options, diagnostics and history sit behind one disclosure pattern: a text button with a chevron that expands in place (`aria-expanded`). No tooltips for essential facts. No modals for detail.
6. Copy: sentence case, verbs on buttons, no filler, no restating the title.

## Shell

Grid: 12px outer gutter. Columns: sidebar 232px (rail 60px) and main. Rows: 52px top bar and content.

### Top bar

- Left, over the sidebar column: collapse toggle (sidebar icon, 32px), then the server switcher (guild icon 28px, guild name, chevron). The server menu lists the guilds the session can open, marks the current one, and shows "Synced N minutes ago" as its last line.
- Search trigger: starts at the main column's content edge, 280px, shows "Search" and the platform shortcut (⌘K or Ctrl K).
- Right: account button (avatar or initial). Account menu: name and role line, Appearance segmented control (Light, Dark, Auto), Sign out.
- Bot offline: when the snapshot is stale beyond the existing freshness rule, the top bar shows a warning icon and "Rob-bot is offline. Saved changes apply when it reconnects." Nothing shows when online.
- The top bar has no background of its own. It sits on the page color.

### Sidebar

- One surface, 16px radius, shell shadow. Contents in order: Overview; the five feature groups; Resources; label "Playbooks" with Ticket handling and Events; label "Reference" with Commands and Handbook.
- Group rows: icon, label, chevron. Chevron rotates 180 degrees when open. One group open at a time, as today.
- Leaf rows: label only, indented to the group label start (38px). No leaf icons.
- Selection: one indicator surface (`--selected`) slides to the current row. When the current row's group is collapsed, the indicator sits on the group row. The indicator follows the row during accordion motion by sampling layout each frame while a `grid-template-rows` transition runs.
- Flags: a feature with a problem shows a 14px warning icon at the row end. A collapsed group shows the icon if any child has a problem. An open group hides its own flag because its children show theirs. Flags never render for healthy features.
- Rail (collapsed): 60px. Icons stay at the same x position in both widths. Labels, chevrons, section labels and flags fade out. Group children are hidden in the rail; the group icon carries the selection.
- Peek: hovering the rail for 150ms widens the panel over the main area to 232px with the floating shadow. Leaving for 200ms closes it. Keyboard focus inside keeps it open.
- Drawer: below 760px viewport, the sidebar becomes a left drawer under a scrim. The top bar shows a menu button instead of the collapse toggle. Escape, scrim click and navigation close it. Focus moves into the drawer on open and back to the menu button on close. Background is `inert` while open.
- The rail and drawer thresholds come from the existing resolver (`control-shell-layout.js`) with the context column removed from the arithmetic.

### Main area

- Pages are left-aligned to a 40px inset from the sidebar edge, not centered in the remaining space. Settings pages max 720px wide. Tables, analytics, commands and handbook max 960px.
- One page entrance animation on the page container: opacity 0 to 1 and 4px rise, 220ms. Blocks inside the page do not animate separately.
- The outgoing page is removed at once. Navigation never waits for motion (WEB-M8).
- Main scroll position resets to top on navigation and is kept on save.

### Save bar

- Appears when a page has unsaved changes. Floating, bottom center of main, 480px max, ink background, page-color text.
- Content: change count ("1 unsaved change"), Discard (quiet), Save (primary). Cmd or Ctrl S saves.
- Saving: spinner and "Saving". Success: drawn check and "Saved", held 900ms, then the bar exits. Changed rows get a 500ms sky tint fade.
- Failure: the bar stays, shows the error sentence and error reference, Save becomes "Retry". Conflict: "Server settings changed. Review and save again." with Reload as the secondary action. These map to the existing state store statuses.
- Leaving a page with unsaved changes: navigation is blocked, the bar nudges 2px left and right once and reads "Save or discard your changes first". The browser `beforeunload` guard stays for tab close.

### Command palette

- Opens from the search trigger and Cmd or Ctrl K. Scrim plus centered panel at 14vh.
- Searches destinations (with their group as the right-aligned hint) and every slash command (hint "Command"). Selecting a command opens Commands with that command expanded.
- Arrow keys move, Enter opens, Escape closes and returns focus to the trigger. "No matches" when empty.

## Page model

### Header

- `h1` page title, 24px, 600. Header actions (rare) sit at the right on the same line.
- Optional lede: one sentence that states what the feature does in this server, using live names where possible ("Joining Create VC gives a member their own voice room."). Omit the lede when the title says it all.

### Settings rows

- A list of rows separated by hairlines. Row: label (500) and optional hint (13px muted) on the left; one control on the right in a fixed 240px control column, right-aligned.
- Master switch row: the first row of a feature page. Label says what turning it on does ("Award reputation", "Post quizzes on a schedule", "Create voice rooms", "Post the weekly report"). When off, the rows below dim to 50% and stay editable, and the hint states the effect ("Members keep their points.").
- Channel, role and category controls are bordered selects that show `#name`, `@name` or the category name. Options come from the snapshot's available resources for that resource type.
- Problem on a row: hint line becomes the problem sentence in error color with a warning icon. The select gets the error border and reads "Choose a channel".
- Numbers: bordered input 88px with unit text after it ("hours", "pts").
- Phone: rows stack; control full width; 44px minimum height; 16px text.

### Lists, tables, composers

- Tables: 12px muted header row, 46px rows, hairlines, hover tint. Right-aligned numbers with tabular figures.
- Composer (Live, Announcements): a bordered surface with the input, options as switch rows, and the primary action at the bottom right. The action is disabled while a blocking problem exists; the problem sentence is the row above it, not repeated next to the button.
- Empty states: one plain sentence and the one action that fixes it. Newsreader italic only for the Overview "Everything is running." state.

### Disclosure

- One pattern: muted text button with chevron, expands in place with the grid-rows animation (220ms). Used for: Overview feature list, playbook step details, advanced settings, command details, activity details, coverage details.

## Pages

Each page lists what shows up front and what moves where. "Context" means the old right panel.

- Overview (new, home at `/control`): `h1` Overview. "Needs attention" list only when problems exist: each row has the warning icon, the problem title ("Live can't post"), its cause, and a "Choose channel" button that opens the feature page with the broken control focused. When nothing is wrong: "Everything is running." in Newsreader italic. "Last 7 days": total events with a 7-bar mini chart labeled by weekday initials, linking to Analytics. Then a disclosure "N features running normally" listing every healthy feature with a one-line live summary.
- Reputation: master switch "Award reputation". Rows: Builder, Contributor, Mentor thresholds (pts) with the tier role select inline in each row's hint position only if that role binding has a problem. Context readiness and dependency text become field-level problems.
- Quizzes: master switch "Post quizzes on a schedule". Rows: Channel select, Posts every (hours, hint "Leave blank to post only with /quiz start"). Section Questions: list with Add question; each question row discloses its options and correct answer.
- Voice & Coworking: master switch "Create voice rooms". Rows: Join to create (voice select), New rooms go in (category select), Coworking lounge (voice select, hint "Shared room for Pomodoro sessions").
- Showcase, Notification roles, Feeds, Announcements, Tickets, Anonymous Questions, Moderation: same model. Their current read and edit content maps to rows; their context sections map per the page inventory in the plan.
- Live: settings row "Posts to" with the channel select. Composer: Topic input, "Ping @Live Notifications" switch row, Post live notice. Missing Send Messages is a row problem on "Posts to".
- Analytics: header actions: range segmented control. Lead: total events (40px) with "in the last 7 days" and "Updated 6:06 AM" muted on the same line. Chart: line and soft area, integer ticks, 12px labels, every day labeled, hover or focus shows a guide line and a tooltip with the day and count; the chart has an accessible name listing values. Breakdown: two-column fact list. Ticket semantics from the Stage A decision stay. Weekly report: master switch "Post the weekly report" and "Posts to" select. Coverage: one sentence under the chart only when incomplete.
- Activity: list of changes, newest first: what changed, who, relative time; details disclosed per row.
- Resources (was Mappings): tabs Channels, Roles, Categories. Table "Used for" and the bound resource as a bordered select. Broken rows sort first. "Suggest matches" quiet header action opens the existing suggestion review flow.
- Ticket handling and Events (playbooks): numbered steps stay (they are a real sequence, WEB-I5). Each step shows its title and one-line summary; checks and failure conditions disclose per step.
- Commands (`/commands`, also reached from Control): search field "Search 43 commands" with the count from the manual. Groups as sections. Rows: command, what it does, who can use it (muted text, no pill). A row expands in place to show syntax, options and an example from `docs/commands.md`.
- Handbook (`/handbook`): reading layout with 64ch text and a sticky "On this page" list at the right on wide screens, which highlights the section in view. Content stays as it is today.

## Element fixes from the prototype review

The owner said some prototype elements "don't fit where they currently are and don't make sense". The lead's list, with fixes:

1. Content centered in the leftover space left a wide gap after the sidebar. Fix: left-align to a 40px inset.
2. Header switch beside the title had no visible meaning. Fix: master switch row with a verb label.
3. Borderless inputs read as plain text and fail non-text contrast. Fix: bordered controls in a fixed control column.
4. Lone collapse button in a sidebar footer wasted a strip. Fix: toggle moves to the top bar beside the server switcher.
5. Warning icon plus chevron on group rows cluttered the row end. Fix: open groups hide their flag; flag sits before the chevron with 8px gap; leaves have no icons.
6. Overview sparkline had no axis or labels. Fix: 7 labeled bars.
7. Overview "features running normally" listed only some features. Fix: every healthy feature, each with a live summary.
8. Commands count floated beside the title. Fix: count moves into the search placeholder.
9. Live form fields were unstructured. Fix: composer surface.
10. Analytics "Updated" time crowded the range control. Fix: moves to the lead line.

## Motion

Tokens: `--motion-micro` 120ms, `--motion-exit` 160ms, `--motion-enter` 220ms, `--motion-layout` 280ms. Curves: `--ease-out` `cubic-bezier(.22, 1, .36, 1)`, `--ease-in` `cubic-bezier(.55, 0, 1, .45)`. Exceptions to the 500ms ceiling: none. The save-row tint is 500ms.

| Interaction | Property | Duration and curve |
| --- | --- | --- |
| Hover, press | background, color; press scale .98 | micro |
| Accordion open and close | grid-template-rows; child opacity | enter, ease-out |
| Selection indicator | transform | enter, ease-out |
| Rail collapse and expand | grid columns, panel width; label opacity (micro) | layout, ease-out |
| Rail peek | panel width, shadow | enter in, exit out |
| Drawer | transform; scrim opacity | layout in, exit out |
| Page entrance | opacity, 4px rise | enter, ease-out |
| Save bar | transform | enter in, exit out with ease-in |
| Menus and palette | opacity, 4px or .98 scale | enter in, exit out |
| Switch | thumb transform, track color | enter |
| Segmented control | thumb transform and width | enter |
| Theme change | View Transition cross-fade where supported | default 250ms |
| Saved row | background tint fade | 500ms |

Reduced motion: transforms removed; opacity fades kept; the accordion and rail snap.

## Accessibility

- Landmarks: header, nav, main. Skip link to main.
- Every disclosure has `aria-expanded`. Menus use `aria-haspopup` and return focus on close. The palette is a dialog with a listbox.
- Collapsed group children are not tabbable.
- Visible focus on every control, 2px focus color.
- Save, failure and offline messages announce through a polite live region.
- Targets 32px desktop, 44px under coarse pointers.
- Contrast: text 4.5:1, field boundaries and icons 3:1, both themes.

## Testing

- Update web tests that lock markup the redesign changes. Each removed assertion is replaced by one that locks the new behavior.
- New tests: indicator target resolution, nav flags from snapshot problems, save bar state machine (dirty, saving, saved, failed, conflict, blocked navigation), palette filtering and keyboard, master switch dimming, Overview attention list from snapshot, no `stateChipMarkup` call sites, motion tokens only (CSS scan for durations and easings outside the token set), no infinite animations outside loading indicators.
- Visual acceptance: headless captures of every destination at 1440x900, 1024x800 and 390x844 in light and dark, plus frame captures of accordion, rail, peek, drawer, page entrance, save and palette at one-tenth speed. Zero overlaps, zero page overflow, zero text below 12px.
- Full gates: `npm run check:web` and `npm run test:web`.

## Open questions

None. Element detail beyond this spec is reviewed by the owner on the built pages.
