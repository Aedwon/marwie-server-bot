# Bot-Hosting Restart Bridge Spec

Date: 2026-08-25
Status: Accepted for implementation

## Problem

Rob-bot is deployed from GitHub on Bot-Hosting.net. The user wants routine feature work to be operable from ChatGPT without switching to the hosting panel for every deployment. Bot-Hosting.net can re-pull the linked repository when a deployment restarts if Auto Pull is enabled.

ChatGPT can write to GitHub in this repository, but the Bot-Hosting.net account is not directly connected here. GitHub therefore acts as the narrow control bridge for deployment restarts.

## Goals

- Allow a GitHub-side action to restart the Bot-Hosting.net deployment.
- Use Bot-Hosting.net Auto Pull so a restart picks up the latest `main` code.
- Minimize GitHub Actions usage.
- Minimize Bot-Hosting.net API permissions.
- Keep the Bot-Hosting.net API key out of the repository and chat history.
- Let an authorized repository write update trigger a restart without needing a pull request or normal CI run.

## Non-goals

- Do not grant deployment write, file, environment, backup, billing, or account scopes.
- Do not manage the Discord token through this workflow.
- Do not automatically deploy every branch.
- Do not trigger the repository's normal Python CI for restart-only requests.
- Do not expose the Bot-Hosting.net API key in workflow output.

## Design

### API permission

The Bot-Hosting.net API key used by GitHub must have only the `deployments:power` scope.

The workflow calls:

`POST https://bot-hosting.net/api/v1/deployments/{deployment_id}/power`

with body:

```json
{"action":"restart"}
```

### Repository secrets

The workflow reads two GitHub Actions repository secrets:

- `BOT_HOSTING_API_KEY`
- `BOT_HOSTING_DEPLOYMENT_ID`

Both are configured manually by the repository owner. The API key must never be committed.

### Trigger model

A dedicated operations branch named `ops/bot-hosting-restart` carries a marker file at `.ops/bot-hosting-restart`.

The restart workflow runs only when that marker changes on the operations branch. It also supports `workflow_dispatch` for a human-triggered restart in GitHub's Actions UI.

This keeps restart-only actions off `main`, avoids running the existing CI workflow, and consumes Actions minutes only when a restart is actually requested.

For a normal feature deployment:

1. feature work reaches `main`;
2. the restart marker is updated on `ops/bot-hosting-restart`;
3. the restart workflow calls Bot-Hosting.net;
4. Bot-Hosting.net restarts the deployment;
5. Auto Pull re-pulls the linked `main` branch during restart.

### Workflow safety

- `contents: read` is the only GitHub permission granted to the workflow.
- No repository checkout is required.
- Missing secrets fail clearly before contacting Bot-Hosting.net.
- `curl --fail-with-body` makes HTTP failures fail the job.
- The job has a short timeout.

## Required hosting configuration

The Bot-Hosting.net deployment must:

- be linked to `Aedwon/marwie-server-bot`;
- use branch `main`;
- have Auto Pull enabled.

## Verification

Static verification must confirm:

- workflow trigger is restricted to the operations branch and marker path;
- workflow uses only the two named secrets;
- API request uses `deployments:power` endpoint behavior and `restart` action;
- no API credential is committed;
- existing CI workflow is unchanged.

Runtime verification requires the owner to configure the two repository secrets first. After that, one marker update should cause a workflow run and Bot-Hosting.net restart.
