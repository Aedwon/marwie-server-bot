# Docs visual-system refinement plan

Status: complete
Date: 2026-08-26

## Files

| File | Change |
| --- | --- |
| `docs-site/visual.css` | Shared border-light visual system for handbook and command manual. |
| `docs-site/home.css` | Recompose Start, health, setup, and playbooks around spacing and tonal grouping. |
| `docs-site/commands.css` | Present command entries as scan-first tonal reference cards without outline framing. |
| `docs-site/index.html` | Cache-bust the revised handbook stylesheet. |
| `docs-site/commands.html` | Cache-bust the revised command stylesheet. |
| spec/decision/plan | Record the design contract. |

## Completed

1. Added a shared surface, spacing, navigation, section, control, and callout layer.
2. Replaced four individually outlined Start cards with one composed workflow launcher.
3. Reframed health as a compact diagnostic matrix and playbooks as editorial operating rows.
4. Removed outlined command-card styling while preserving scan-first disclosure and full detail.
5. Made workflow paths compact inline sequences instead of boxed callouts.
6. Kept dividers only where they encode table, list, or open-detail structure.
7. Preserved the current copy where it was already semantically dense instead of cutting safety or operational meaning merely to shorten the page.

## Verification

- No bot CI or Bot-Hosting restart was used.
- Canonical `docs-site/commands.md` was not changed.
- Vercel created READY preview deployments for the revised handbook and command styles and the final page-shell commits.
- Existing command search, workflow regrouping, disclosures, anchors, theme switching, and responsive code were not changed by this visual pass.
- CSS explicitly collapses the Start launcher, health matrix, playbooks, and command grid to single-column layouts on narrow screens.
- Branch comparison remains ahead-only from `rob-bot-docs-site`; only planned docs-site presentation files and design records are changed.

A browser visual review by the operator is still the final subjective gate before merge.