# Command documentation location

Date: 2026-08-25
Status: accepted

## Context

Rob-bot now has enough slash commands that the README's short command list cannot also serve as a useful operating manual. Expanding every command inline would make the README difficult to scan and would duplicate details that need to stay synchronized with command source.

## Decision

Use `docs/commands.md` as the canonical exhaustive command manual.

The README remains the entry point. Its Commands section provides a compact inventory and a prominent link to the manual.

Each command entry documents syntax, permissions, prerequisites, every option, side effects, important failure conditions, and examples. Related button/modal workflows may be documented alongside the relevant command but are not counted as slash commands.

Future command changes must update the manual in the same change. `AGENTS.md` will carry this maintenance requirement so agents do not add or change commands without updating operator documentation.

## Why

A separate page keeps the README usable while allowing enough detail for staff to operate moderation, setup, feeds, tickets, and community systems safely. Keeping a single canonical manual also reduces drift between multiple long command references.

## Rejected alternative

Putting the full manual directly in README was rejected because it would make first-run, deployment, architecture, and setup guidance harder to find.
