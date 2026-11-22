# Control command center redesign decisions

Date: 2026-11-23
Status: Active
Scope: Rob-bot Control (`/control/*`), All Commands (`/commands`) and Handbook (`/handbook`)

## Problem

The owner was not satisfied with the website UI. The words used were: things "don't connect well", are "not satisfying" and "not elegant". A recorded audit of the live site on 2026-11-23 (read-only copy on `127.0.0.1:8788`, real snapshot) found:

- Navigation group expand overlaps items mid-animation. The old group collapses instantly while the new group's rows slide through its neighbours.
- Sidebar collapse blanks the panel, then pops icons in. The center jumps instead of sliding.
- Hovering the collapsed rail opens it with no motion. Page changes are hard cuts.
- Control, All Commands and Handbook use three different shells.
- Blocking problems live only in the context panel. Live shows "Missing Send Messages" there while its Post button stays enabled in the center.
- The context panel is a full-height card that is mostly empty on every page.
- Status uses two formats ("Builder · Connected" and "analytics (Connected)").
- A stray shadow sits at the top-left corner. The brand wraps to two lines. The Live checkbox is unstyled.

## Options considered

Shown as an interactive prototype with real data, three switchable directions and slow-motion playback.

| Option | What it is | Cost |
| --- | --- | --- |
| A. Refine | Fix all motion and detail defects. Keep layout and the three separate shells. | Lowest. Leaves the disconnected feel. |
| B. Unify | A plus one shell for all three surfaces, sliding selection, problems on the page, a context panel that fits its content, edit in place. | Medium. Keeps the approved IA. |
| C. Command center | B plus an Overview home, a top bar with server and search, a command palette, and no context panel. | About 30% more than B. Changes the approved IA. |

## Decision 1: Direction C, balanced complexity

The owner chose C at balanced complexity.

## Decision 2: Owner corrections to the first C prototype

Recorded words: "i saw some pills with the dot, i hate that. don't implement it like that. be very conscious of where you put things. i also hate redundant information/text and unnecessary info/text. use progressive disclosure, and other UI/UX fundamentals/principles".

Rules that follow:

- No status pill with a leading dot anywhere. This retires `stateChipMarkup` pills ("Enabled", "Connected") and coverage chips.
- Healthy state says nothing. Only a problem is shown, once, at the place it can be fixed.
- A fact appears once per view. No title repeated as a breadcrumb, no status repeated in a chip, a panel and a callout.
- Secondary content is disclosed on request (agent-standards WEB-I1, WEB-I2, WEB-G9, WEB-G12).

## Decision 3: Revised C approved as direction, not as final detail

The owner approved the revised prototype (`docs/superpowers/specs/assets/2026-11-23-control-c2-prototype.html`) with: "approved, but i assume this is just direction because some elements look badly designed. they don't fit where they currently are and don't make sense".

The prototype fixes the shell, navigation, motion, page model and disclosure rules. Element design is refined during implementation under the element rules in the spec. The spec lists every element the lead judged weak in the prototype and its fix.

## Decision 4: What C supersedes

- Supersedes the right context panel in `2026-10-16-control-interface-information-architecture.md` (three-region shell) and the right-panel and top-bar rules in `2026-10-22-control-shell-navigation.md`. Context content moves into the page as settings rows, field-level problems or disclosed detail. Nothing that was configurable in the panel is lost.
- Supersedes the brand placement in the rail head. Server identity moves to the top bar. Rob-bot's mark stays as the favicon and on signed-out and empty states.
- Supersedes the separate edit mode ("Edit settings"). Settings are editable where they are shown. Changes collect into one save bar per page and save as one page save, as today.
- Supersedes the "Enabled" pill. Each feature's master switch is the first settings row, labeled with what it does.
- Supersedes the Control "Commands" page (`/control/commands`). Its content duplicates All Commands. All Commands becomes the single command reference inside the shell, and the command palette searches it.
- Supersedes the Stage A rule that Passive telemetry rows render "Unavailable". While passive telemetry is disabled in production, the Analytics page omits those rows. If a later snapshot reports them, they render as measured values. They never render as `0` when unavailable.
- Supersedes coverage badges in Analytics. Coverage is shown only when incomplete, as one sentence under the chart.
- Keeps feature-first navigation, complete feature ownership, canonical resource state, the paper and ink palette, Figtree, sky blue as information color, System as the default theme, and 600px as the center floor.

## Decision 5: Motion system

One token set: 120ms micro feedback, 160ms exits, 220ms entrances, 280ms layout. Two curves: `cubic-bezier(.22, 1, .36, 1)` for entering and moving, `cubic-bezier(.55, 0, 1, .45)` for leaving. No looping decoration. Reduced motion keeps fades only. Basis: agent-standards WEB-M1 to WEB-M13.
