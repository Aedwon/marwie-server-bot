# Docs-site Rob-bot logo fix plan

Status: in progress
Date: 2026-08-25
Spec: `docs/superpowers/specs/2026-08-25-docs-site-logo-fix.md`

## Files

| File | Change |
| --- | --- |
| `docs-site/rob.svg` | Replace embedded JPEG with a native vector Rob-bot mark. |
| `docs-site/index.html` | Bump brand/fav icon asset version to force cache refresh. |
| `docs-site/commands.html` | Bump brand/fav icon asset version to force cache refresh. |
| spec/plan | Record the logo repair. |

## Verification

- `rob.svg` contains vector shapes only and no `<image>`, `data:image`, or remote URL.
- both site pages reference the same `rob.svg` version for favicon and visible brand images;
- branch changes only the planned documentation-site files;
- after merging to `rob-bot-docs-site`, inspect the Git-linked Vercel deployment and request `/rob.svg`, `/`, and `/commands`.