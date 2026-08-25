# Docs-site Rob-bot logo fix plan

Status: complete
Date: 2026-08-25
Spec: `docs/superpowers/specs/2026-08-25-docs-site-logo-fix.md`

## Files

| File | Change |
| --- | --- |
| `docs-site/rob.svg` | Replace embedded JPEG with a native vector Rob-bot mark. |
| `vercel.json` | Route Git-triggered repository-root deployments to the static files under `docs-site/`. |
| spec/plan | Record the logo and Git-deployment repair. |

## Verification

Completed checks:

- the old `rob.svg` was confirmed to contain an embedded `data:image/jpeg` photograph;
- the replacement `rob.svg` contains only native SVG vector geometry and no `<image>`, `data:image`, or remote asset;
- the replacement SVG was rendered locally at 256 × 256 and remained legible as a small rounded-square robot mark;
- Vercel now reports the project as Git-linked to `Aedwon/marwie-server-bot`;
- pushes to `fix/docs-site-rob-logo` automatically created READY Vercel preview deployments;
- before the root routing file, the Git preview returned 404 for `/rob.svg`;
- after adding root `vercel.json`, preview deployment `dpl_A5H5vLMkvbhviQi6uEunZgPnCAWa` returned HTTP 200 and `image/svg+xml` for `/rob.svg`, serving the new vector asset;
- the Vercel static asset response uses `max-age=0, must-revalidate`, so replacing the asset at the same URL remains revalidated instead of being treated as an immutable build asset;
- no bot runtime files, database files, Bot-Hosting configuration, or GitHub Actions workflow changed.

The preview deployment is protected by Vercel Authentication, so HTML requests redirect to Vercel SSO during tool-based smoke testing. Production HTML and `/commands` should be checked again after this branch is merged into the configured production docs branch.