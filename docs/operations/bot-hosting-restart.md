# Bot-Hosting.net restart bridge

This repository can restart the production Rob-bot deployment through GitHub Actions. Bot-Hosting.net Auto Pull then re-pulls the linked `main` branch during the restart.

## One-time owner setup

### 1. Confirm Bot-Hosting.net Git settings

In the Rob-bot deployment on Bot-Hosting.net:

- GitHub repository: `Aedwon/marwie-server-bot`
- branch: `main`
- Auto Pull: enabled

Auto Pull is required because the GitHub workflow only sends a restart signal. It deliberately does not use Bot-Hosting.net's broader deployment-write scope.

### 2. Create a Bot-Hosting.net API key

Create an API key in Bot-Hosting.net API settings.

Grant exactly this scope:

- `deployments:power`

Do not grant `deployments:write`, file, environment, backup, billing, or account scopes for this bridge.

Copy the key when Bot-Hosting.net shows it. Do not commit it and do not paste it into chat.

### 3. Find the deployment ID

Record the Rob-bot deployment ID. Bot-Hosting.net deployment IDs use the `dep_...` form in its API.

If the panel does not show it clearly, use Bot-Hosting.net's `GET /api/v1/deployments` endpoint with a temporary read-capable key to list deployments, then remove that temporary key after recording the correct ID.

### 4. Add GitHub repository secrets

Open:

`Aedwon/marwie-server-bot` → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Create:

- `BOT_HOSTING_API_KEY` = the Bot-Hosting.net API key
- `BOT_HOSTING_DEPLOYMENT_ID` = the Rob-bot `dep_...` deployment ID

The workflow fails before making an API call if either secret is missing.

## How a restart is requested

The workflow is `.github/workflows/restart-bot-hosting.yml`.

It can run in either of two ways:

1. update `.ops/bot-hosting-restart` on branch `ops/bot-hosting-restart`; or
2. use **Run workflow** for **Restart Rob-bot** in GitHub Actions.

The operations branch is intentionally separate from `main`. Restart-only updates therefore do not trigger the repository's normal Python CI workflow.

For ChatGPT-assisted development, the normal production flow is:

1. finish and verify a feature branch;
2. merge the intended code to `main` after authorization;
3. update the restart marker on `ops/bot-hosting-restart`;
4. GitHub Actions calls Bot-Hosting.net's restart endpoint;
5. Bot-Hosting.net Auto Pull fetches the current `main` branch as the deployment restarts.

## API request

The workflow calls:

`POST https://bot-hosting.net/api/v1/deployments/{deployment_id}/power`

with:

```json
{"action":"restart"}
```

This endpoint requires only the `deployments:power` scope.

## Security notes

- The API key is stored only as a GitHub Actions secret.
- The workflow has only `contents: read` GitHub permission.
- The workflow does not echo the API key.
- The workflow does not use Bot-Hosting.net `deployments:write`.
- Do not reuse a broad personal API key for this bridge.
