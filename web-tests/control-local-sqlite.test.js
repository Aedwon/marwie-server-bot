import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createSqliteTaggedClient } from '../api/_lib/sqlite-database.js';

function withTempDb(run) {
  const directory = mkdtempSync(join(tmpdir(), 'rob-control-sqlite-'));
  const path = join(directory, 'control.db');
  return Promise.resolve(run(path)).finally(() => rmSync(directory, { recursive: true, force: true }));
}

test('SQLite tagged client binds values, translates current Postgres syntax, and decodes JSON', async () => {
  await withTempDb(async path => {
    const sql = createSqliteTaggedClient(path);
    await sql`
      CREATE TABLE control_actions (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (guild_id, actor_id, idempotency_key)
      )
    `;

    const payload = { nested: { enabled: true }, label: "quoted ' value" };
    const inserted = await sql`
      INSERT INTO control_actions (id, guild_id, actor_id, action_type, payload_json, idempotency_key)
      VALUES (${'a1'}, ${'123'}, ${'456'}, ${'save_page'}, ${JSON.stringify(payload)}::json, ${'idem-key-1'})
      ON CONFLICT ON CONSTRAINT uq_control_actions_actor_idempotency DO NOTHING
      RETURNING id, guild_id, payload_json, created_at
    `;

    assert.equal(inserted.length, 1);
    assert.equal(inserted[0].guild_id, '123');
    assert.deepEqual(inserted[0].payload_json, payload);

    const duplicate = await sql`
      INSERT INTO control_actions (id, guild_id, actor_id, action_type, payload_json, idempotency_key)
      VALUES (${'a2'}, ${'123'}, ${'456'}, ${'save_page'}, ${JSON.stringify({ changed: true })}::json, ${'idem-key-1'})
      ON CONFLICT ON CONSTRAINT uq_control_actions_actor_idempotency DO NOTHING
      RETURNING id
    `;
    assert.deepEqual(duplicate, []);

    const cursor = new Date('2026-10-16T06:00:00.000Z');
    const castRows = await sql`SELECT ${cursor}::timestamptz AS created_at, ${JSON.stringify(payload)}::json AS payload_json`;
    assert.equal(castRows[0].created_at, '2026-10-16 06:00:00.000');
    assert.deepEqual(castRows[0].payload_json, payload);

    const intervalRows = await sql`
      SELECT
        CURRENT_TIMESTAMP - INTERVAL '3 minutes' AS three_minutes_ago,
        CURRENT_TIMESTAMP - INTERVAL '60 seconds' AS sixty_seconds_ago
    `;
    assert.match(intervalRows[0].three_minutes_ago, /^\d{4}-\d{2}-\d{2} /);
    assert.match(intervalRows[0].sixty_seconds_ago, /^\d{4}-\d{2}-\d{2} /);

    const busyRows = await sql`PRAGMA busy_timeout`;
    const foreignRows = await sql`PRAGMA foreign_keys`;
    assert.equal(Number(busyRows[0].timeout), 5000);
    assert.equal(Number(foreignRows[0].foreign_keys), 1);
  });
});

test('Control database selects SQLite when CONTROL_SQLITE_PATH is configured', async () => {
  await withTempDb(async path => {
    const previousPath = process.env.CONTROL_SQLITE_PATH;
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.CONTROL_SQLITE_PATH = path;
    delete process.env.DATABASE_URL;
    try {
      const { database } = await import(`../api/_lib/control.js?sqlite-selection=${Date.now()}`);
      const sql = database();
      await sql`CREATE TABLE local_probe (value TEXT NOT NULL)`;
      await sql`INSERT INTO local_probe (value) VALUES (${'local'})`;
      const rows = await sql`SELECT value FROM local_probe`;
      assert.deepEqual(rows, [{ value: 'local' }]);
    } finally {
      if (previousPath === undefined) delete process.env.CONTROL_SQLITE_PATH;
      else process.env.CONTROL_SQLITE_PATH = previousPath;
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });
});

test('always-on worker mode satisfies wake without calling a webhook', async () => {
  const previousMode = process.env.CONTROL_WORKER_MODE;
  const previousWebhook = process.env.CONTROL_WAKE_WEBHOOK_URL;
  const previousFetch = globalThis.fetch;
  process.env.CONTROL_WORKER_MODE = 'always_on';
  delete process.env.CONTROL_WAKE_WEBHOOK_URL;
  globalThis.fetch = async () => {
    throw new Error('wake fetch must not run in always_on mode');
  };
  try {
    const { tryWakeControlWorker } = await import(`../api/_lib/control.js?always-on=${Date.now()}`);
    assert.equal(await tryWakeControlWorker(), true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousMode === undefined) delete process.env.CONTROL_WORKER_MODE;
    else process.env.CONTROL_WORKER_MODE = previousMode;
    if (previousWebhook === undefined) delete process.env.CONTROL_WAKE_WEBHOOK_URL;
    else process.env.CONTROL_WAKE_WEBHOOK_URL = previousWebhook;
  }
});
