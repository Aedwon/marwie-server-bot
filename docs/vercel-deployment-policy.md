# Vercel deployment policy

Vercel belongs only to the Rob-bot website and Control production line. It is not the deployment system for the Discord bot.

## Branch ownership

- `web/rob-bot-site-production` is the authoritative website and Control production branch. It deploys to Vercel production.
- `vercel-ready-*` branches are temporary website review candidates. They deploy to Vercel Preview only when a candidate is ready for human checking.
- `main` is the Discord bot runtime branch. It deploys through Bot-Hosting, not Vercel.

Never promote a Vercel deployment whose Git ref is `main`. If Vercel creates a Preview from `main`, treat it as accidental Git-integration behavior, not as a release candidate.

Do not add or maintain Vercel deployment configuration on `main` to solve that infrastructure problem. Vercel Git integration must be configured separately so bot-only branches are not deployment sources.

## Website Git deployments

The website production line carries the repository-side Vercel policy. Its `vercel.json` allows automatic Git deployment only for:

- `web/rob-bot-site-production` for the live website and Control deployment.
- `vercel-ready-*` for temporary final-review Preview deployments.

Ordinary website implementation, staging, worker, RED/GREEN, and feature branches are not deployment branches.

Repository-side branch configuration does not make `main` part of the website production line. If the Vercel project still creates a Preview when `main` changes, that is a project-level integration issue and must not be worked around by merging Vercel configuration into `main`.

## Review workflow

1. Implement and verify website work on its normal feature or worker branch without using Vercel as an intermediate test runner.
2. When the website work is complete and ready for human checking, create or update `vercel-ready-<task>` with the exact review candidate.
3. Vercel creates one Preview for that review round.
4. If review finds corrections, make and verify those corrections on the implementation branch without repeatedly updating the review branch.
5. Update `vercel-ready-<task>` only when the corrected candidate is ready for another human review round.
6. After approval, port or integrate the website-owned changes into `web/rob-bot-site-production`.
7. The website production branch creates the Vercel production deployment.
8. Delete the temporary review branch when it is no longer needed.

With no correction round, website work should normally consume two Vercel deployments: one final-review Preview and one production deployment. Each additional human-review correction round should consume one additional Preview.

## Mixed bot and website features

A feature may include both Discord bot behavior and website or Control changes. Promote those surfaces independently.

- Bot-owned changes go to `main` and are deployed through Bot-Hosting.
- Website and Control changes go to `web/rob-bot-site-production` and are deployed through Vercel.

Do not merge one production branch into the other just to synchronize shared files. Port only the changes owned by the target production line.
