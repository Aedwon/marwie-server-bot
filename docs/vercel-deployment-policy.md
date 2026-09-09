# Vercel deployment policy

Vercel is reserved for the final human-review checkpoint and the live Control/site deployment. It is not an intermediate test runner.

## Automatic Git deployments

`vercel.json` permits automatic Git deployments only for these branch patterns:

- `web/rob-bot-site-production` — live Control/site production deployment.
- `vercel-ready-*` — temporary final-review preview branches.

All other branches, including `main`, `web/*` implementation branches, staging branches, RED/GREEN branches, and worker branches, are excluded from automatic Vercel deployments.

`main` is the bot runtime branch. Bot-only work can merge to `main` without creating a Vercel deployment.

## Review workflow

1. Implement and verify work on its normal feature/worker branch. These commits do not deploy to Vercel.
2. When the work is complete and ready for human checking, create or update a branch named `vercel-ready-<task>` to point at the exact review candidate.
3. Vercel creates one Preview deployment for that human-review candidate.
4. If human review finds corrections, make and verify those corrections on the implementation branch without updating the `vercel-ready-*` branch during intermediate work.
5. When the corrected candidate is ready for human checking again, update the same `vercel-ready-*` branch. That creates one additional Preview deployment for the new review round.
6. After approval, integrate website/Control changes into `web/rob-bot-site-production`. That branch creates the production Vercel deployment.
7. Delete the temporary `vercel-ready-*` branch after the reviewed work has landed and no further preview is needed.

With no correction round, website work should normally consume two Vercel deployments: one final-review Preview and one production deployment. Each additional human-review correction round should consume one additional Preview.

Do not update `vercel-ready-*` for formatting, test-only iteration, intermediate fixes, or ordinary worker progress. Local verification and GitHub CI own those stages.

Branches created before this policy reaches their branch root may still contain the old unrestricted `vercel.json`. New work should branch from an updated root, or first incorporate this policy before further pushes.
