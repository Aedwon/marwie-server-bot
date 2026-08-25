# Docs-site Rob-bot logo fix

Date: 2026-08-25
Status: accepted

## Problem

The documentation site currently uses `docs-site/rob.svg` as both its visible brand mark and favicon. That file is an SVG wrapper around an embedded JPEG photograph instead of a Rob-bot logo, so the site displays an unrelated picture wherever the brand icon appears.

## Goal

Replace the incorrect image with a small native SVG Rob-bot mark that is legible at favicon, mobile-header, and sidebar sizes and fits the documentation site's restrained visual system.

## Requirements

- Do not use an embedded raster image or remote asset.
- Keep the artwork self-contained in `docs-site/rob.svg`.
- Use simple vector geometry so it remains crisp at 16–64 px.
- Keep enough contrast for both light and dark site themes.
- Use the same asset for the browser favicon, sidebar brand mark, and mobile brand mark.
- Do not change bot runtime behavior.
- No Bot-Hosting restart is required.

## Visual direction

Use a conservative rounded-square Rob-bot mark with a simple robot face and an `R`-like identifying detail. Avoid gradients, mascots, glossy effects, or decorative clutter. The mark should read as a documentation/product icon, not an illustration.