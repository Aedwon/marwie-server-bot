# Docs-site Rob-bot logo fix

Date: 2026-08-25
Status: accepted

## Problems

The documentation site currently uses `docs-site/rob.svg` as both its visible brand mark and favicon. That file is an SVG wrapper around an embedded JPEG photograph instead of a Rob-bot logo, so the site displays an unrelated picture wherever the brand icon appears.

After the Vercel project was linked to GitHub, Git-triggered deployments also exposed a repository-layout issue: Vercel deploys from the repository root while the static website lives under `docs-site/`. Without root-level routing, Git preview deployments return 404 for site assets such as `/rob.svg`.

## Goal

Replace the incorrect image with a small native SVG Rob-bot mark and make Git-triggered Vercel deployments serve the `docs-site/` static site correctly from public root URLs.

## Requirements

- Do not use an embedded raster image or remote asset.
- Keep the artwork self-contained in `docs-site/rob.svg`.
- Use simple vector geometry so it remains crisp at 16–64 px.
- Keep enough contrast for both light and dark site themes.
- Use the same asset for the browser favicon, sidebar brand mark, and mobile brand mark.
- Root Git deployments must expose `/`, `/commands`, `/rob.svg`, CSS, JavaScript, and other docs-site static assets without moving the website files into the bot source tree.
- Do not change bot runtime behavior.
- No Bot-Hosting restart is required.

## Visual direction

Use a conservative rounded-square Rob-bot mark with a simple robot face and an `R`-like identifying detail. Avoid gradients, mascots, glossy effects, or decorative clutter. The mark should read as a documentation/product icon, not an illustration.

## Deployment direction

Keep `docs-site/` as the documentation source directory. Add root-level Vercel rewrites so the Git-linked project can deploy the repository root while presenting the documentation site at clean public paths.