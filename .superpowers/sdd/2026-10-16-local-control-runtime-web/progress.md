# SDD ledger — plan: docs/superpowers/plans/2026-10-16-local-control-runtime-web.md
Pre-flight: Task 1 produces explicit-UTC SQLite rows consumed by Tasks 2-4. Task 2 produces HTTP 202 refresh contract consumed by Task 3. Task 3 produces bounded loadGuildState behavior consumed by Task 4 verification.
Task 1: Ruling: relay workspace_exec has no env field; use /usr/bin/env TZ=Asia/Manila before node for timezone verification — same process environment semantics — cost if wrong: timezone regression test could run under host TZ.
Task 1: complete (no commit by approved plan; tests: TZ=Asia/Manila control-local-sqlite + control-foundation-contract -> 10 passed).
Task 2: complete (no commit by approved plan; nonblocking + dedup focused suite 15 passed).
Task 3: complete (no commit by approved plan; focused polling/error suite 15 passed).
Task 4: cross-runtime SQLite verification passed: Python wrote current-schema snapshot/action; Node under Asia/Manila read explicit UTC timestamp as fresh and action fields without drift.
Final focused Control/foundation suite passed; npm run check:web passed; git diff --check passed; local website hosting configuration check passed.
Full npm test:web result: 237/239 passed. The only two failures are anonymous-message mapping tests in untouched mapping code and are outside this repair; the stale-refresh contract introduced by this change is green.
Final self-review: no Critical or Important findings in web diff. Timestamp normalization is narrow to *_at SQLite timestamp text; stale reads return immediate 202; refresh dedup prevents backlog; browser polling is fixed and bounded; failure leaves state non-actionable.
Runtime config: web-production.env has CONTROL_WORKER_MODE=always_on with mode 0600. Remaining gate: operator-only launchctl restart and live end-to-end verification.
Post-restart web verification: local/public /healthz, Control, Commands, and Handbook all returned HTTP 200.
Public OAuth start verified via curl: HTTP 302 to discord.com with exact callback https://aidevph.aedwon.site/api/auth/callback and identify guilds scope.
Live bot heartbeat and authorized queue smoke both passed against shared production SQLite; pending queue returned to zero.
Remaining manual verification only: complete an actual Discord OAuth sign-in in a browser and confirm authenticated Control loads.
Final manual browser verification: Discord OAuth sign-in succeeded; authenticated Control returned immediately with fresh server state and no multi-second wait.
