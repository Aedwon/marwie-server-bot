# Auto setup and confirmation decisions

Date: 2026-08-25
Status: active

## Confirm every slash command centrally

All slash commands require an explicit Approve or Decline button before their callback runs. This includes read-only commands because the product requirement is intentionally uniform.

The confirmation layer is installed centrally after cogs are loaded. It wraps registered application-command callbacks instead of adding repetitive confirmation code to every cog.

Cost: every slash command gains one extra click.

## Execute approved commands from the button interaction

The approval button invokes the original callback with the button interaction. This gives the original callback a fresh Discord interaction response and avoids rewriting all existing command responses to use followups.

Cost: code inside a command should not depend on `interaction.command` being populated during the approved callback. The current V1 callbacks do not use that field for business behavior.

## Auto setup is additive and idempotent

`/setup auto` may create missing bot resources and repair stored resource mappings, but it does not delete or rename unrelated server resources. Existing matching resources are adopted before creating duplicates.

Cost: an untidy pre-existing server is not automatically reorganized.

## Self-role scope is opt-in roles only

The initial self-role panel exposes only `Live Notifications`. Reputation roles remain earned and staff roles remain server-owned.

Cost: adding new self-assignable community-interest roles later requires explicitly adding them to the role-panel configuration.
