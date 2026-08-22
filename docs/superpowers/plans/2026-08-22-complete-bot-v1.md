# Complete bot V1 implementation plan

Date: 2026-08-22
Status: active
Spec: `docs/superpowers/specs/2026-08-22-complete-bot-v1.md`
Branch: `complete-bot`

## Goal

Finish all pre-RAG V1 systems and leave only Discord/bot-hosting.net connection and runtime configuration for deployment.

## Global constraints

- Follow `AGENTS.md` and `SUBAGENTS.md`.
- Build on the verified Milestone 1 foundation.
- Keep Discord handlers thin and persistence behind repositories.
- Every durable table is created by Alembic.
- Every server-specific Discord ID is runtime configuration.
- Persistent views use stable custom IDs and are registered during startup.
- Background jobs are restart-safe and deduplicated.
- Do not add external AI-provider dependencies to V1.

## Execution order

1. Extend typed resources, feature configuration, intents and schema.
2. Finish moderation and message logs.
3. Implement tickets and temporary voice workspaces.
4. Implement announcements and reputation.
5. Implement solved build-help and quizzes.
6. Implement anonymous questions, Pomodoro and LFG.
7. Implement AI update ingestion, analytics, unanswered-help and App of the Week.
8. Expand setup/deployment documentation.
9. Run all CI gates and fix every failure before declaring completion.

## Verification gates

```bash
pytest
ruff check .
ruff format --check .
mypy src tests
python -m compileall -q src tests migrations main.py
alembic upgrade head
```

All commands must exit 0 on Python 3.12 in GitHub Actions.

## Stop conditions

Stop only for a material security/data conflict with the accepted spec or an external platform requirement that cannot be represented through configuration. Ordinary implementation issues are fixed within this plan.
