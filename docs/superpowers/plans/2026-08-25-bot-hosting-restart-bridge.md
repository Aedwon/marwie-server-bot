# Bot-Hosting Restart Bridge Plan

Date: 2026-08-25
Status: Implementation complete; runtime verification pending first restart
Spec: `docs/superpowers/specs/2026-08-25-bot-hosting-restart-bridge.md`
Decision log: `docs/superpowers/decisions/2026-08-25-bot-hosting-restart-bridge.md`

## Goal

Add a minimal GitHub Actions bridge that can restart Rob-bot on Bot-Hosting.net using a narrowly scoped API key. Bot-Hosting.net Auto Pull will then fetch the latest `main` branch.

## Files

| File | Change |
| --- | --- |
| `.github/workflows/restart-bot-hosting.yml` | Add minimal restart workflow. |
| `README.md` | Document owner setup, secrets, Auto Pull, and restart behavior. |
| `docs/superpowers/specs/2026-08-25-bot-hosting-restart-bridge.md` | Record required behavior and constraints. |
| `docs/superpowers/decisions/2026-08-25-bot-hosting-restart-bridge.md` | Record permission and trigger decisions. |
| `docs/superpowers/plans/2026-08-25-bot-hosting-restart-bridge.md` | Track implementation and verification. |

## Implementation

1. Add a workflow named `Restart Rob-bot`.
2. Trigger it when `.ops/bot-hosting-restart` changes on branch `ops/bot-hosting-restart`.
3. Also permit `workflow_dispatch` for manual use in GitHub.
4. Grant only `contents: read` GitHub permission.
5. Read `BOT_HOSTING_API_KEY` and `BOT_HOSTING_DEPLOYMENT_ID` from repository secrets.
6. Validate both values are non-empty.
7. Call Bot-Hosting.net `POST /api/v1/deployments/{id}/power` with `{"action":"restart"}`.
8. Use strict curl failure handling and a short job timeout.
9. Document one-time owner setup in README.
10. Do not modify `.github/workflows/ci.yml`.

## Verification

Static checks completed:

- inspected the resulting workflow YAML;
- confirmed trigger branch and path are exact;
- confirmed no checkout or dependency install exists;
- confirmed only `contents: read` is granted;
- confirmed only the two repository secrets are referenced;
- confirmed the API endpoint and request body match current Bot-Hosting.net documentation;
- compared branch to `main` and confirmed no unrelated files changed.

Runtime checks:

- owner has reported that both required repository secrets are configured;
- merge the bridge to `main`;
- create `ops/bot-hosting-restart` from the merged commit;
- update the restart marker to exercise the bridge;
- inspect the resulting workflow run and report the actual result.

## Actions-minute policy

Do not open a PR for this implementation unless requested because the repository's PR CI would consume Actions minutes. Do not manually trigger existing CI. The restart workflow itself runs only when explicitly requested through its marker or GitHub UI.
